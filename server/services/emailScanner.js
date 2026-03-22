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

    const messageIds = res.data.messages || [];
    console.log('Message IDs found:', messageIds.length);

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

    const offerKeywords = ['offer', 'congratulations', 'pleased', 'welcome to the team'];
    const interviewKeywords = ['interview', 'schedule', 'invitation', 'assessment'];
    const rejectionKeywordsArr = ['unfortunately', 'not moving forward', 'not selected', 'regret'];
    const allKeywords = [...offerKeywords, ...interviewKeywords, ...rejectionKeywordsArr];

    for (const email of emails) {
      if (user.scannedEmailIds?.includes(email.id)) continue;

      const textToCheck = (email.subject + ' ' + (email.snippet || '')).toLowerCase();
      const matched = allKeywords.some(k => textToCheck.includes(k));
      console.log('Email subject:', email.subject, 'Keywords matched:', matched);

      if (!matched) {
        user.scannedEmailIds.push(email.id);
        continue;
      }

      console.log('Calling Groq with model: llama-3.3-70b-versatile');

      try {
        const groqResponse = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 150,
          messages: [
            { role: 'system', content: 'Analyze this recruiter email. Return only JSON: {type: "interview"|"rejection"|"offer"|"unknown", company: string|null, date: string|null}. No explanation.' },
            { role: 'user', content: `Subject: ${email.subject}\n\n${email.snippet}` }
          ]
        });

        const raw = groqResponse.choices[0].message.content;
        console.log('Groq raw response:', raw);

        let result;
        try {
          result = JSON.parse(raw);
        } catch {
          console.log('Failed to parse Groq response');
          user.scannedEmailIds.push(email.id);
          continue;
        }

        console.log('Groq result:', result);

        if (result.type === 'unknown' || !result.company) {
          user.scannedEmailIds.push(email.id);
          continue;
        }

        // Align with schema: use 'user' instead of 'userId'
        const job = await Job.findOne({
          user: user._id,
          company: { $regex: new RegExp(result.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
        });

        console.log('Job found for company:', result.company, !!job);

        if (job) {
          // Align with schema: use enum values ('offer', 'interview', 'rejected') 
          // instead of display strings like 'Offer Received'
          const statusMap = {
            offer: 'offer',
            interview: 'interview',
            rejection: 'rejected'
          };

          if (statusMap[result.type]) {
            job.status = statusMap[result.type];
            await job.save();
            console.log('Job card updated:', job.company, '→', job.status);

            await Notification.create({
              userId: user._id,
              type: 'email_detected',
              message: `${result.type === 'offer' ? 'Offer' : result.type === 'interview' ? 'Interview' : 'Update'} detected from ${result.company} — job card updated!`,
              read: false,
              jobId: job._id
            });
            console.log('Notification created for:', result.company);
          }
        } else {
          // No job found, but we still found a recruiter email
          await Notification.create({
            userId: user._id,
            type: 'email_detected',
            message: `${result.type === 'offer' ? 'Offer' : result.type === 'interview' ? 'Interview' : 'Update'} detected from ${result.company}, but no matching job card found.`,
            read: false
          });
        }
      } catch (err) {
        console.error('Email processing error:', err.message);
      }

      user.scannedEmailIds.push(email.id);
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
