require('dotenv').config({ override: true })
const express   = require('express')
const mongoose  = require('mongoose')
const cors      = require('cors')
const passport  = require('passport')
const helmet    = require('helmet')
const cookieParser = require('cookie-parser')

const authRoutes    = require('./routes/auth')
const jobRoutes     = require('./routes/jobs')
const logoRoutes    = require('./routes/logo')
const paymentRoutes = require('./routes/payment')
const cvRoutes      = require('./routes/cv')
const notificationRoutes = require('./routes/notifications')

const { scanUserEmails } = require('./services/emailScanner')
const auth = require('./middleware/auth')
const rateLimit = require('express-rate-limit')

const app  = express()
app.set('trust proxy', 1)
const PORT = process.env.PORT || 5000

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https:", "http:"], // Allow images from any source for logos
      "connect-src": ["'self'", "https:", "http:"],
    },
  },
}))

// Rate Limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Strict for auth
  message: { error: 'Too many login attempts — please try again later' }
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 25, 
  message: { error: 'Too many requests — please try again later' }
});

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
    return new Promise((resolve) => {
      mongoose.connection.once('connected', () => resolve(mongoose.connection));
    });
  }

  const connectionString = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!connectionString) {
    const err = new Error('❌ FATAL: Neither MONGO_URI nor MONGODB_URI is set in environment variables!');
    console.error(err.message);
    throw err;
  }
  const activeVar = process.env.MONGO_URI ? 'MONGO_URI' : 'MONGODB_URI';
  try {
    const host = connectionString.replace(/\/\/[^@]+@/, '//<credentials>@').split('?')[0];
    console.log(`[DB] Using env var: ${activeVar}, host: ${host}`);
  } catch { console.log(`[DB] Using env var: ${activeVar}`); }

  const opts = {
    bufferCommands: false,
    serverSelectionTimeoutMS: 20000,
    heartbeatFrequencyMS: 10000,
  };

  cachedDbPromise = mongoose.connect(connectionString, opts);
  
  try {
    await cachedDbPromise;
    console.log('✅ MongoDB connected');
  } catch (err) {
    cachedDbPromise = null;
    console.error('❌ MongoDB connection error:', err.message);
    throw err;
  }
  
  return mongoose.connection;
}

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://trkr-job.vercel.app',
  'https://job-tracker-five-dusky.vercel.app',
  process.env.CLIENT_URL?.replace(/\/$/, ''),
].filter(Boolean)

app.get('/health',     (_, res) => res.json({ status: 'ok' }))
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});
app.get('/', (_, res) => res.json({ message: 'TRKR API is online', health: '/api/health' }))

app.use(async (req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection failed:', err.message);
    res.status(500).json({ message: 'Internal server error (DB connection failure)' });
  }
});

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

app.use(cookieParser())

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (origin.startsWith('chrome-extension://')) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS blocked: ${origin}`))
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))

app.use('/api/', generalLimiter);
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())
const session = require('express-session')
const MongoStore = require('connect-mongo')

const sessionSecret = process.env.JWT_SECRET || 'fallback-secret-for-dev'
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI

if (!mongoUri) {
  console.warn('⚠️  MONGODB_URI not found for session store. Falling back to MemoryStore (sessions will be lost on restart).')
}

app.use(session({
  secret: sessionSecret,
  resave: false,
  saveUninitialized: false,
  store: mongoUri ? MongoStore.create({
    mongoUrl: mongoUri,
    collectionName: 'sessions',
    ttl: 7 * 24 * 60 * 60,
    autoRemove: 'native',
    touchAfter: 24 * 3600 // Only update session in DB once per day unless data changes
  }) : undefined,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));
app.use(passport.initialize())

app.get('/api/cron/scan-emails', async (req, res) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const User = require('./models/User')
    const users = await User.find({ 
      gmailConnected: true,
      isPremium: true,
      autoTrackEmails: { $ne: false }
    }).sort({ lastEmailScan: 1 }).limit(3);
    
    if (users.length === 0) {
      return res.json({ success: true, scanned: 0, message: 'No premium users with Gmail connected' })
    }

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

app.use('/api/auth/login', authLimiter)
app.use('/api/auth/register', authLimiter)
app.use('/api/auth',    authRoutes)

app.use('/api/jobs/:id/analyze-cv', aiLimiter);
app.use('/api/jobs/:id/cover-letter', aiLimiter);
app.use('/api/jobs/fetch-from-url', aiLimiter);
app.use('/api/jobs/:id/salary-insights', aiLimiter);
app.use('/api/jobs/:id/interview-questions', aiLimiter);

app.use('/api/jobs',    jobRoutes)
app.use('/api/logo',    logoRoutes)
app.use('/api/payment', paymentRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/cv',      aiLimiter, cvRoutes)


app.get('/api/test/scan-emails', auth, async (req, res) => {
  try {
    const User = require('./models/User')
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (!user.gmailConnected) return res.status(400).json({ message: 'Gmail not connected' })

    await scanUserEmails(user)
    res.json({ message: 'Email scan triggered successfully. Check your notifications for updates.' })
  } catch (err) {
    console.error('Manual scan error:', err)
    res.status(500).json({ message: 'Failed to scan emails', error: err.message })
  }
})

app.use((_, res) => res.status(404).json({ message: 'Route not found' }))

app.use((err, req, res, next) => {
  console.error(err)
  const isDev = process.env.NODE_ENV === 'development'
  res.status(err.status || 500).json({ 
    message: isDev ? err.message : 'An internal server error occurred',
    ...(isDev && { stack: err.stack })
  })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀  Server running on port ${PORT}`)
  if (process.env.RENDER_URL) {
    const https = require('https')
    setInterval(() => {
      https.get(`${process.env.RENDER_URL}/health`, () => {}).on('error', () => {})
    }, 10 * 60 * 1000)
    console.log('🔄  Keep-alive ping enabled for Render')
  }
})

module.exports = app
