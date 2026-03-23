// node-cron removed for serverless compatibility
const { google } = require('googleapis')
const User = require('../models/User')
const Job = require('../models/Job')
const Notification = require('../models/Notification')
const Groq = require('groq-sdk')

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const offerKeywordsArr = [
  'offer', 'congratulations', 'pleased to inform', 'welcome to the team',
  'happy to offer', 'excited to offer', 'would like to offer', 'job offer',
  'employment offer', 'offer letter', 'we want you', 'you got the job',
  'selected for the position', 'chosen for the role', 'hired'
];

const interviewKeywordsArr = [
  'interview', 'schedule', 'invitation', 'invited', 'assessment',
  'next steps', 'move forward', 'moving you forward', 'shortlisted',
  'phone screen', 'video call', 'technical interview', 'hiring process',
  'speak with you', 'chat with you', 'meet with you', 'zoom call',
  'google meet', 'microsoft teams', 'we would like to connect',
  'pleased to invite', 'advance to the next', 'next round',
  'final round', 'panel interview', 'onsite interview'
];

const rejectionKeywordsArr = [
  'unfortunately', 'not moving forward', 'not selected', 'regret',
  'other candidates', 'position has been filled', 'not a match',
  'decided to move forward with other', 'will not be moving',
  'not successful', 'unable to offer', 'did not move forward',
  'we have decided', 'after careful consideration', 'not the right fit',
  'pursue other candidates', 'filled the position', 'no longer considering',
  'wish you the best', 'future opportunities'
];

async function checkTokens(user) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_GMAIL_CLIENT_ID,
    process.env.GOOGLE_GMAIL_CLIENT_SECRET
  )
  
  if (!user.gmailIntegration?.refreshToken) return null
  
  oauth2Client.setCredentials({
    refresh_token: user.gmailIntegration.refreshToken
  })

  try {
    const { credentials } = await oauth2Client.refreshAccessToken()
    oauth2Client.setCredentials(credentials)
    
    // Save new access token to MongoDB
    user.gmailIntegration.accessToken = credentials.access_token
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
    const query = 'is:unread subject:(offer OR interview OR congratulations OR unfortunately OR hired OR rejected)'

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

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    user.scannedEmailIds = (user.scannedEmailIds || []).filter(entry => entry.date > sevenDaysAgo);

    for (const email of emails) {
      if (user.scannedEmailIds.some(entry => entry.id === email.id)) continue;

      const textToCheck = (email.subject + ' ' + (email.snippet || '')).toLowerCase();
      
      const isOffer = offerKeywordsArr.some(k => textToCheck.includes(k));
      const isInterview = interviewKeywordsArr.some(k => textToCheck.includes(k));
      const isRejection = rejectionKeywordsArr.some(k => textToCheck.includes(k));

      const matched = isOffer || isInterview || isRejection;
      console.log('Email processing: Keywords matched:', matched);

      if (!matched) {
        user.scannedEmailIds.push({ id: email.id, date: new Date() });
        continue;
      }

      const detectedType = isOffer ? 'offer' : isInterview ? 'interview' : 'rejection';
      const jobs = await Job.find({ user: user._id });
      const matchedJob = jobs.find(j => textToCheck.includes(j.company.toLowerCase()));

      if (matchedJob) {
        console.log('Skipping Groq — type and company detected from keywords alone');
        matchedJob.status = detectedType;
        await matchedJob.save();
        await Notification.create({
          userId: user._id,
          type: 'email_detected',
          message: `${detectedType === 'offer' ? 'Offer' : detectedType === 'interview' ? 'Interview' : 'Update'} detected from ${matchedJob.company} — job card updated!`,
          read: false,
          jobId: matchedJob._id
        });
        console.log('Job card updated without Groq:', matchedJob.company, '→', detectedType);
        user.scannedEmailIds.push({ id: email.id, date: new Date() });
        continue;
      }

      console.log('Calling Groq with model: llama-3.3-70b-versatile');

      try {
        const groqResponse = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 80,
          messages: [
            { role: 'system', content: 'Return only JSON: {type:"interview"|"rejection"|"offer"|"unknown", company:string|null}. Analyze this recruiter email subject.' },
            { role: 'user', content: `Subject: ${email.subject}` }
          ]
        });

        const raw = groqResponse.choices[0].message.content;
        console.log('Groq raw response:', raw);

        let result;
        try {
          result = JSON.parse(raw);
        } catch {
          console.log('Failed to parse Groq response');
          user.scannedEmailIds.push({ id: email.id, date: new Date() });
          continue;
        }

        console.log('Groq result:', result);

        if (result.type === 'unknown' || !result.company) {
          user.scannedEmailIds.push({ id: email.id, date: new Date() });
          continue;
        }

        const job = await Job.findOne({
          user: user._id,
          company: { $regex: new RegExp(result.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') }
        });

        console.log('Job found for company:', result.company, !!job);

        if (job) {
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

      user.scannedEmailIds.push({ id: email.id, date: new Date() });
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
