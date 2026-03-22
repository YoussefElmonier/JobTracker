// node-cron removed for serverless compatibility
const { google } = require('googleapis')
const User = require('../models/User')
const Job = require('../models/Job')
const Notification = require('../models/Notification')
const Groq = require('groq-sdk')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const interviewKeywords = [
  'interview', 'schedule', 'invitation', 'invited',
  'call', 'meeting', 'assessment', 'next steps'
]

const rejectionKeywords = [
  'unfortunately', 'not moving forward', 'other candidates',
  'not selected', 'position has been filled', 'regret'
]

const offerKeywords = [
  'offer', 'congratulations', 'pleased to inform',
  'job offer', 'welcome to the team'
]

async function checkTokens(user) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.SERVER_URL || 'http://localhost:3001'}/api/auth/google/callback`
  )
  
  if (!user.gmailTokens?.refreshToken) return null
  
  oauth2Client.setCredentials({
    access_token: user.gmailTokens.accessToken,
    refresh_token: user.gmailTokens.refreshToken
  })

  try {
    const { token } = await oauth2Client.getAccessToken()
    if (token && token !== user.gmailTokens.accessToken) {
       user.gmailTokens.accessToken = token
       await user.save()
    }
  } catch (err) {
    console.error('Failed to refresh Gmail token for', user.email, err.message)
    return null
  }

  return oauth2Client
}

async function scanUserEmails(user) {
  try {
    const auth = await checkTokens(user)
    if (!auth) return

    const gmail = google.gmail({ version: 'v1', auth })
    const query = 'is:unread after:yesterday'

    console.log('Calling Gmail API for user:', user.email);
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50
    })

    const messages = res.data.messages || []
    console.log('Emails fetched for user:', user.email, 'count:', messages.length)

    for (const msg of messages) {
      if (user.scannedEmailIds?.includes(msg.id)) continue

      let msgData
      try {
        msgData = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full'
        })
      } catch (err) {
        console.error('Failed to get message', msg.id, err.message)
        continue
      }

      const payload = msgData.data.payload
      const headers = payload.headers || []
      const subjectHeader = headers.find(h => h.name.toLowerCase() === 'subject')
      const subject = subjectHeader ? subjectHeader.value : ''

      let base64Body = ''
      if (payload.parts) {
        const textPart = payload.parts.find(p => p.mimeType === 'text/plain')
        if (textPart && textPart.body && textPart.body.data) {
          base64Body = textPart.body.data
        } else if (payload.parts[0] && payload.parts[0].parts) {
           const innerText = payload.parts[0].parts.find(p => p.mimeType === 'text/plain')
           if (innerText && innerText.body && innerText.body.data) {
             base64Body = innerText.body.data
           }
        }
      } else if (payload.body && payload.body.data) {
        base64Body = payload.body.data
      }

      let body = ''
      if (base64Body) {
        body = Buffer.from(base64Body, 'base64').toString('utf8')
      } else {
        body = msgData.data.snippet || ''
      }

      const checkText = (subject + ' ' + body.slice(0, 200)).toLowerCase()
      
      const hasInterview = interviewKeywords.some(kw => checkText.includes(kw))
      const hasRejection = rejectionKeywords.some(kw => checkText.includes(kw))
      const hasOffer = offerKeywords.some(kw => checkText.includes(kw))

      console.log('Email subject:', subject, 'Keywords matched:', (hasInterview || hasRejection || hasOffer))

      if (hasInterview || hasRejection || hasOffer) {
        const contentToSend = `Subject: ${subject}\n\nBody: ${body.slice(0, 500)}`
        
        try {
          const aiRes = await groq.chat.completions.create({
            messages: [
              {
                role: 'system',
                content: "Analyze this recruiter email. Return only JSON: {type: 'interview'|'rejection'|'offer'|'unknown', company: string|null, date: string|null}. No explanation."
              },
              {
                role: 'user',
                content: contentToSend
              }
            ],
            model: 'llama3-8b-8192',
            temperature: 0,
            max_tokens: 150,
            response_format: { type: 'json_object' }
          })

          const jsonContent = aiRes.choices[0]?.message?.content || '{}'
          let json = {}
          try {
            json = JSON.parse(jsonContent)
            console.log('Groq result:', json)
          } catch(e) {
            console.error('Failed to parse Groq response', jsonContent)
          }

          if (json.type && json.type !== 'unknown' && json.company) {
             const regex = new RegExp(`^${json.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
             const jobsFound = await Job.find({ user: user._id, company: { $regex: regex } })
             console.log('Looking for company:', json.company, 'Job cards found:', jobsFound.length)
             const job = jobsFound[0]
             
             let updateStatus = ''
             let finalStatusStr = ''
             
             if (json.type === 'interview') {
               updateStatus = 'interview'
               finalStatusStr = 'Interview Scheduled'
             } else if (json.type === 'rejection') {
               updateStatus = 'rejected'
               finalStatusStr = 'Rejected'
             } else if (json.type === 'offer') {
               updateStatus = 'offer'
               finalStatusStr = 'Offer'
             }

             if (job && updateStatus) {
                // don't revert an offer if they send an interview later?? just blindly update as requested
                job.status = updateStatus
                await job.save()
                console.log('Job card updated:', job._id, 'new status:', updateStatus)
                
                await Notification.create({
                   userId: user._id,
                   type: 'email_detected',
                   message: `${finalStatusStr} detected from ${json.company} — job card updated!`,
                   jobId: job._id
                })
             } else {
                await Notification.create({
                   userId: user._id,
                   type: 'email_detected',
                   message: `Email regarding ${json.company} detected, but no matching job card found to update.`,
                })
             }
          }
        } catch(e) {
          console.error('Groq email processing error', e)
        }
      }

      user.scannedEmailIds.push(msg.id)
      if (user.scannedEmailIds.length > 1000) {
         user.scannedEmailIds = user.scannedEmailIds.slice(-1000)
      }
      await user.save()
    }
  } catch (err) {
    if (err.message?.includes('invalid_grant')) {
      user.gmailConnected = false
      await user.save()
    }
    console.error(`Error scanning emails for user ${user.email}:`, err.message)
  }
}

module.exports = { scanUserEmails }
