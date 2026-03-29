const mongoose = require('mongoose');
const { google } = require('googleapis');
const User = require('../../models/User');
const Job = require('../../models/Job');
const Notification = require('../../models/Notification');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Exact keywords requested
const keywords = ['interview', 'schedule', 'offer', 'congratulations', 'unfortunately', 'not moving forward', 'rejected'];

async function checkTokens(user) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_GMAIL_CLIENT_ID,
    process.env.GOOGLE_GMAIL_CLIENT_SECRET,
    `${process.env.SERVER_URL || 'https://trkr-job.vercel.app'}/api/auth/google/gmail/callback`
  );
  if (!user.gmailIntegration?.refreshToken) return null;
  oauth2Client.setCredentials({
    access_token: user.gmailIntegration.accessToken,
    refresh_token: user.gmailIntegration.refreshToken
  });
  return oauth2Client;
}

async function scanUserEmails(user) {
  try {
    const auth = await checkTokens(user);
    if (!auth) return;
    const gmail = google.gmail({ version: 'v1', auth });

    // Fetch unread emails from the last 24 hours
    const res = await gmail.users.messages.list({ 
      userId: 'me', 
      q: 'is:unread after:yesterday', 
      maxResults: 15 
    });
    
    // Fix 1 — Limit emails fetched per user to 3 max:
    const messageIds = (res.data.messages || []).slice(0, 3);
    console.log('Processing', messageIds.length, 'emails for user:', user.email);

    // Fix 2 — Add error logging around full email fetch:
    const emails = await Promise.all(
      messageIds.map(async (msg) => {
        try {
          if (user.scannedEmailIds?.includes(msg.id)) return null;

          const full = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date']
          });
          const subject = full.data.payload.headers.find(h => h.name === 'Subject')?.value || '';
          const from = full.data.payload.headers.find(h => h.name === 'From')?.value || '';
          console.log('Fetched email subject:', subject);
          return { id: msg.id, subject, from, snippet: full.data.snippet };
        } catch (err) {
          console.error('Failed to fetch email:', msg.id, err.message);
          return null;
        }
      })
    );

    // Filter out failed fetches
    const validEmails = emails.filter(Boolean);
    console.log('Valid emails fetched:', validEmails.length);

    for (const emailData of validEmails) {
      const { id, subject, from, snippet } = emailData;

      // Checks subject and snippet for keywords
      const checkText = (subject + ' ' + snippet).toLowerCase();
      const matchFound = keywords.some(kw => checkText.includes(kw));

      if (matchFound) {
        // Confirmation with Groq (max_tokens: 150)
        const aiRes = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: "Analyze recruiter email. Return JSON {type: 'interview'|'rejection'|'offer', company: string}. If unknown, return {type: 'unknown'}." },
            { role: 'user', content: `Subject: ${subject}\nSnippet: ${snippet}` }
          ],
          model: 'llama3-8b-8192',
          max_tokens: 150,
          response_format: { type: 'json_object' }
        });
        
        const json = JSON.parse(aiRes.choices[0]?.message?.content || '{}');
        if (json.type && json.type !== 'unknown' && json.company) {
          const regex = new RegExp(`^${json.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
          const job = await Job.findOne({ user: user._id, company: { $regex: regex } });
          
          if (job) {
             const finalStatus = json.type === 'interview' ? 'interview' : json.type === 'rejection' ? 'rejected' : 'offer';
             job.status = finalStatus;
             await job.save();
             
             // Save notification
             await Notification.create({ 
                userId: user._id, 
                type: 'email_detected', 
                message: `Recruiter email for ${json.company} detected! Job card automatically updated.`, 
                jobId: job._id 
             });
          }
        }
      }
      user.scannedEmailIds.push(id);
    }
    await user.save();
  } catch (err) {
    console.error(`Scanner error for ${user.email || 'unknown user'}:`, err.message);
  }
}

module.exports = async (req, res) => {
  const MONGO_URI = process.env.MONGODB_URI;
  if (!MONGO_URI) return res.status(500).json({ success: false, error: 'Database URI missing' });

  // Connect at start
  if (!mongoose.connection.readyState) {
    await mongoose.connect(MONGO_URI);
  }

  try {
    // Limits to 3 users per execution (Vercel timeout prevention), rotating through the users list
    const users = await User.find({ 
      gmailConnected: true,
      isPremium: true,
      autoTrackEmails: { $ne: false } // autoTrackEmails defaults to true
    }).sort({ lastEmailScan: 1 }).limit(3);
    
    for (const user of users) {
      try {
        await scanUserEmails(user);
      } catch (err) {
        console.error('Error scanning user:', user.email, err.message);
      } finally {
        user.lastEmailScan = new Date();
        await user.save();
      }
    }
    
    res.status(200).json({ success: true, scanned: users.length });
  } catch (err) {
    console.error('Email scan error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    // Disconnect at end
    await mongoose.connection.close();
  }
};
