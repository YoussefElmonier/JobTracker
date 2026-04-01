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
const rateLimit = require('express-rate-limit')

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, 
  message: { error: 'Too many requests — please try again later' }
});

const app  = express()
const PORT = process.env.PORT || 5000

// Fail fast on queries if the connection is not established
mongoose.set('bufferCommands', false);

let cachedDbPromise = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    console.log('Using active MongoDB connection');
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2) {
    console.log('Waiting for pending MongoDB connection...');
    if (cachedDbPromise) return cachedDbPromise;
    // If somehow readyState is 2 but promise is missing, we still want to wait
    return new Promise((resolve) => {
      mongoose.connection.once('connected', () => resolve(mongoose.connection));
    });
  }

  console.log('Initiating new MongoDB connection...');
  const opts = {
    bufferCommands: false,
    serverSelectionTimeoutMS: 20000, // Increased to 20s for Atlas FREE TIER / Cold Start resilience
    heartbeatFrequencyMS: 10000,
  };

  // Ensure we use the user's MONGO_URI consistently
  const connectionString = (process.env.MONGO_URI || process.env.MONGODB_URI);
  cachedDbPromise = mongoose.connect(connectionString, opts);
  
  try {
    await cachedDbPromise;
    console.log('✅ MongoDB connected');
  } catch (err) {
    cachedDbPromise = null; // reset to allow retries
    console.error('❌ MongoDB connection error:', err.message);
    throw err;
  }
  
  return mongoose.connection;
}

// CORS — allow configured client origins
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://trkr-job.vercel.app',
  'https://job-tracker-five-dusky.vercel.app',
  process.env.CLIENT_URL?.replace(/\/$/, ''), // strip trailing slash if any
].filter(Boolean)

// Health checks (Moved BEFORE middleware to avoid DB block on heartbeat)
app.get('/health',     (_, res) => res.json({ status: 'ok' }))
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});
app.get('/', (_, res) => res.json({ message: 'TRKR API is online', health: '/api/health' }))

// Middleware
app.use(async (req, res, next) => {
  // Log request
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    res.status(500).json({ message: 'Internal server error (DB connection failure)' });
  }
});
// Handle OPTIONS preflight manually BEFORE cors() — Vercel can return 405 otherwise
// Must use app.use (not app.options) to avoid path-to-regexp wildcard issues
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.header('Access-Control-Allow-Credentials', 'true')
    return res.sendStatus(204)
  }
  next()
})

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin) return callback(null, true)
    // Allow Chrome extensions
    if (origin.startsWith('chrome-extension://')) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS blocked: ${origin}`))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

// Webhook must receive raw body — mount BEFORE express.json()
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())
const session = require('express-session')
app.use(session({
  secret: process.env.JWT_SECRET,
  resave: false,
  saveUninitialized: false
}));
app.use(passport.initialize())

// Routes
// VERCEL CRON: Authenticated endpoint to scan emails for users
app.get('/api/cron/scan-emails', async (req, res) => {
  // CRITICAL FIX 1 & HIGH FIX 2
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const User = require('./models/User')
    // Find up to 3 users who are premium and have Gmail connected, rotating through
    const users = await User.find({ 
      gmailConnected: true,
      isPremium: true,
      autoTrackEmails: { $ne: false } // autoTrackEmails defaults to true
    }).sort({ lastEmailScan: 1 }).limit(3);
    
    if (users.length === 0) {
      return res.json({ success: true, scanned: 0, message: 'No premium users with Gmail connected' })
    }

    console.log(`[Cron] Scanning emails for ${users.length} premium users...`)
    
    for (const user of users) {
      try {
        await scanUserEmails(user)
      } catch (err) {
        console.error('Error scanning user:', user.email, err.message)
      } finally {
        user.lastEmailScan = new Date()
        await user.save()
      }
    }

    res.json({ success: true, scanned: users.length })
  } catch (err) {
    console.error('[Cron] Email scan error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

app.use('/api/auth',    authRoutes)

// ORPHANED PROTECTIONS (MEDIUM FIX 1)
app.use('/api/jobs/:id/analyze-cv', aiLimiter);
app.use('/api/jobs/:id/cover-letter', aiLimiter);
app.use('/api/jobs/fetch-from-url', aiLimiter);
app.use('/api/jobs/:id/salary-insights', aiLimiter);
app.use('/api/jobs/:id/interview-questions', aiLimiter);

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

// Health checks (Handled above now)

// 404
app.use((_, res) => res.status(404).json({ message: 'Route not found' }))

// Global error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' })
})

// Start server
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

module.exports = app
