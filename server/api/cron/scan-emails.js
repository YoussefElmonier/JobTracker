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
  if (!user.gmailTokens?.refreshToken) return null;
  oauth2Client.setCredentials({
    access_token: user.gmailTokens.accessToken,
    refresh_token: user.gmailTokens.refreshToken
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
    
    const messages = res.data.messages || [];

    for (const msg of messages) {
      if (user.scannedEmailIds?.includes(msg.id)) continue;
      
      const msgData = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
      const payload = msgData.data.payload;
      const headers = payload.headers || [];
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      let snippet = msgData.data.snippet || '';

      // Checks subject and first 200 chars for keywords
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
      user.scannedEmailIds.push(msg.id);
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
    // Limits to 3 users per execution (Vercel timeout prevention)
    const users = await User.find({ gmailConnected: true, isPremium: true }).limit(3);
    
    for (const user of users) {
      await scanUserEmails(user);
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
