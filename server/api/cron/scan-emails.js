const mongoose = require('mongoose');
const { google } = require('googleapis');
const User = require('../../models/User');
const Job = require('../../models/Job');
const Notification = require('../../models/Notification');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const interviewKeywords = ['interview', 'schedule', 'invitation', 'invited', 'call', 'meeting', 'assessment', 'next steps'];
const rejectionKeywords = ['unfortunately', 'not moving forward', 'other candidates', 'not selected', 'position has been filled', 'regret'];
const offerKeywords = ['offer', 'congratulations', 'pleased to inform', 'job offer', 'welcome to the team'];

async function checkTokens(user) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.SERVER_URL || 'https://trkr-job.vercel.app'}/api/auth/google/callback`
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
    const res = await gmail.users.messages.list({ userId: 'me', q: 'is:unread after:yesterday', maxResults: 15 });
    const messages = res.data.messages || [];

    for (const msg of messages) {
      if (user.scannedEmailIds?.includes(msg.id)) continue;
      const msgData = await gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'full' });
      const payload = msgData.data.payload;
      const headers = payload.headers || [];
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      let body = msgData.data.snippet || '';

      const checkText = (subject + ' ' + body).toLowerCase();
      const hasInterview = interviewKeywords.some(kw => checkText.includes(kw));
      const hasRejection = rejectionKeywords.some(kw => checkText.includes(kw));
      const hasOffer = offerKeywords.some(kw => checkText.includes(kw));

      if (hasInterview || hasRejection || hasOffer) {
        const aiRes = await groq.chat.completions.create({
          messages: [
            { role: 'system', content: "Analyze recruiter email. Return JSON {type: 'interview'|'rejection'|'offer'|'unknown', company: string|null}." },
            { role: 'user', content: `Subject: ${subject}\nSnippet: ${body}` }
          ],
          model: 'llama3-8b-8192', response_format: { type: 'json_object' }
        });
        const json = JSON.parse(aiRes.choices[0]?.message?.content || '{}');
        if (json.type && json.type !== 'unknown' && json.company) {
          const regex = new RegExp(`^${json.company.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
          const job = await Job.findOne({ user: user._id, company: { $regex: regex } });
          if (job) {
            job.status = json.type === 'interview' ? 'interview' : json.type === 'rejection' ? 'rejected' : 'offer';
            await job.save();
            await Notification.create({ userId: user._id, type: 'email_detected', message: `Job status for ${json.company} updated via Gmail!`, jobId: job._id });
          }
        }
      }
      user.scannedEmailIds.push(msg.id);
    }
    await user.save();
  } catch (err) {
    console.error(`Error scanning emails for ${user.email}:`, err.message);
  }
}

module.exports = async (req, res) => {
  const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoose.connection.readyState) await mongoose.connect(MONGO_URI);

  try {
    const users = await User.find({ gmailConnected: true, autoTrackEmails: true }).limit(3);
    for (const user of users) {
      await scanUserEmails(user);
    }
    res.status(200).json({ success: true, scanned: users.length });
  } catch (err) {
    console.error('Email scan error:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    // Note: Disconnecting from MongoDB in serverless can cause performance issues 
    // because cold starts happen more often. Usually one keeps the connection alive.
    // However, I'm following the explicit user request: "connect at start and disconnect at end".
    await mongoose.connection.close();
  }
};
