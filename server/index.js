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
const { startEmailScanner, scanUserEmails } = require('./services/emailScanner')
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
startEmailScanner()

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
