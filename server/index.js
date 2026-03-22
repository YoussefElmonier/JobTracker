require('dotenv').config({ override: true })
const express   = require('express')
const mongoose  = require('mongoose')
const cors      = require('cors')
const passport  = require('passport')

const authRoutes    = require('./routes/auth')
const jobRoutes     = require('./routes/jobs')
const logoRoutes    = require('./routes/logo')
const paymentRoutes = require('./routes/payment')
const notificationRoutes = require('./routes/notifications')
const { scanUserEmails } = require('./services/emailScanner')
const auth = require('./middleware/auth')

const app  = express()
const PORT = process.env.PORT || 5000

// CORS — allow configured client origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://trkr-job.vercel.app',
  process.env.CLIENT_URL?.replace(/\/$/, ''), // strip trailing slash if any
].filter(Boolean)

// Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS blocked: ${origin}`))
  },
  credentials: true,
}))
// Webhook must receive raw body — mount BEFORE express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())
app.use(passport.initialize())

// Routes
// VERCEL CRON: Unauthenticated endpoint to scan emails for users
app.get('/api/cron/scan-emails', async (req, res) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    console.log('No cron secret provided — allowing for testing');
  }

  try {
    const User = require('./models/User')
    // Find up to 3 users where gmailConnected: true (Vercel 10s timeout limit)
    const users = await User.find({ gmailConnected: true }).limit(3)
    console.log('Users found:', users.length, users.map(u => u.email))
    
    if (users.length === 0) {
      return res.json({ success: true, scanned: 0, message: 'No users with Gmail connected' })
    }

    console.log(`[Cron] Scanning emails for ${users.length} users...`)
    
    for (const user of users) {
      console.log('Processing user:', user.email, 'Gmail token exists:', !!user.gmailTokens?.accessToken, 'Refresh token exists:', !!user.gmailTokens?.refreshToken)
      try {
        await scanUserEmails(user)
      } catch (err) {
        console.error('Error scanning user:', user.email, err.message, err.stack)
      }
    }

    res.json({ success: true, scanned: users.length })
  } catch (err) {
    console.error('[Cron] Email scan error:', err)
    // Return 200/JSON even on error so the monitoring service doesn't think the whole app is down
    res.status(500).json({ success: false, error: err.message })
  }
})

app.use('/api/auth',    authRoutes)
app.use('/api/jobs',    jobRoutes)
app.use('/api/logo',    logoRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/notifications', notificationRoutes)

// TEMPORARY: Test route to manually scan emails
app.get('/api/test/scan-emails', auth, async (req, res) => {
  try {
    const User = require('./models/User')
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (!user.gmailConnected) return res.status(400).json({ message: 'Gmail not connected' })

    console.log(`Manual scan requested for ${user.email}`)
    await scanUserEmails(user)
    
    res.json({ message: 'Email scan triggered successfully. Check your notifications for updates.' })
  } catch (err) {
    console.error('Manual scan error:', err)
    res.status(500).json({ message: 'Failed to scan emails', error: err.message })
  }
})


// Start Cron Services
// Removed for Vercel/serverless compatibility. 
// Use /api/cron/scan-emails instead.

// Health checks
app.get('/health',     (_, res) => res.json({ status: 'ok' }))
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }))
app.get('/', (_, res) => res.json({ message: 'TRKR API is online', health: '/api/health' }))

// 404
app.use((_, res) => res.status(404).json({ message: 'Route not found' }))

// Global error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' })
})

// Connect to MongoDB then start server
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅  MongoDB connected')
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀  Server running on port ${PORT}`)

      // Keep Render free tier awake with a self-ping every 10 minutes
      if (process.env.RENDER_URL) {
        const https = require('https')
        setInterval(() => {
          https.get(`${process.env.RENDER_URL}/health`, () => {})
            .on('error', () => {}) // silently ignore ping errors
        }, 10 * 60 * 1000)
        console.log('🔄  Keep-alive ping enabled for Render')
      }
    })
  })
  .catch(err => {
    console.error('❌  MongoDB connection error:', err.message)
    process.exit(1)
  })

module.exports = app
