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
    process.env.GOOGLE_CLIENT_SECRET
  )
  
  if (!user.gmailTokens?.refreshToken) return null
  
  oauth2Client.setCredentials({
    refresh_token: user.gmailTokens.refreshToken
  })

  try {
    const { credentials } = await oauth2Client.refreshAccessToken()
    oauth2Client.setCredentials(credentials)
    
    // Save new access token to MongoDB
    user.gmailTokens.accessToken = credentials.access_token
    await user.save()
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
    const query = 'is:unread from:youssifelmonier66@gmail.com'

    console.log('Calling Gmail API for user:', user.email);
    const res = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 5
    })

    const messageIds = res.data.messages || []
    console.log('Message IDs found:', messageIds.length)

    // Parallel fetch for metadata (Faster than full format)
    const emails = await Promise.all(
      messageIds.map(async (msg) => {
        const full = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'metadata',
          metadataHeaders: ['Subject', 'From', 'Date']
        });
        const subject = full.data.payload.headers.find(h => h.name === 'Subject')?.value || '';
        const from = full.data.payload.headers.find(h => h.name === 'From')?.value || '';
        return { id: msg.id, subject, from, snippet: full.data.snippet };
      })
    );

    console.log('Full emails fetched:', emails.map(e => e.subject));

    // Process the fetched emails
    for (const email of emails) {
      if (user.scannedEmailIds?.includes(email.id)) continue

      const checkText = (email.subject + ' ' + (email.snippet || '')).toLowerCase()
      
      const hasInterview = interviewKeywords.some(kw => checkText.includes(kw))
      const hasRejection = rejectionKeywords.some(kw => checkText.includes(kw))
      const hasOffer = offerKeywords.some(kw => checkText.includes(kw))

      console.log('Email subject:', email.subject, 'Keywords matched:', (hasInterview || hasRejection || hasOffer))

      if (hasInterview || hasRejection || hasOffer) {
        const contentToSend = `Subject: ${email.subject}\n\nFrom: ${email.from}\n\nSnippet: ${email.snippet}`
        
        try {
          console.log('Calling Groq with model:', 'llama-3.3-70b-versatile');
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
            model: 'llama-3.3-70b-versatile',
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

      user.scannedEmailIds.push(email.id)
    }

    if (user.scannedEmailIds.length > 1000) {
        user.scannedEmailIds = user.scannedEmailIds.slice(-1000)
    }
    await user.save()
  } catch (err) {
    if (err.message?.includes('invalid_grant')) {
      user.gmailConnected = false
      await user.save()
    }
    console.error(`Error scanning emails for user ${user.email}:`, err.message)
  }
}

module.exports = { scanUserEmails }
