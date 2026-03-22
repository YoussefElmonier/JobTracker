const express  = require('express')
const jwt      = require('jsonwebtoken')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const User     = require('../models/User')
const auth     = require('../middleware/auth')
const multer   = require('multer')
const upload   = multer({ storage: multer.memoryStorage() })
const router   = express.Router()

// Helper: sign token
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' })

// Passport Google Strategy
passport.use(new GoogleStrategy({
    clientID:     process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:  `${process.env.SERVER_URL || 'http://localhost:3001'}/api/auth/google/callback`,
    proxy:        true
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('🛡️ Google Strategy: Verifying user ->', profile.emails?.[0]?.value || 'No Email')
      const email = profile.emails[0].value
      console.log('🛡️ Google Strategy: Looking up user...')
      let user    = await User.findOne({ 
        $or: [{ googleId: profile.id }, { email: email.toLowerCase() }] 
      })
      console.log('🛡️ Google Strategy: User found ->', !!user)

      if (!user) {
        console.log('🛡️ Google Strategy: Creating new user...')
        user = await User.create({
          name:     profile.displayName,
          email:    email.toLowerCase(),
          googleId: profile.id,
          // password not needed for google users
        })
        console.log('🛡️ Google Strategy: New user created.')
      } else if (!user.googleId) {
        // Link existing email account to google
        console.log('🛡️ Google Strategy: Linking existing account to google...')
        user.googleId = profile.id
        await user.save()
        console.log('🛡️ Google Strategy: Account linked.')
      }

      console.log('🛡️ Google Strategy: Execution successful for', user.email)
      return done(null, user)
    } catch (err) {
      console.error('❌ Google Strategy CRASH:', err.message)
      return done(err, null)
    }
  }
))

// POST /api/auth/register
router.post('/register', async (req, res) => {
  console.log('📝 Register attempt:', req.body.email)
  try {
    const { name, email, password, cvText } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' })
    }

    const exists = await User.findOne({ email: email.toLowerCase() })
    if (exists) {
      return res.status(409).json({ message: 'An account with that email already exists' })
    }

    const user  = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      cvText: cvText ? cvText.trim().slice(0, 2000) : ''
    })
    const token = signToken(user._id)

    res.status(201).json({
      token,
      user: { 
        _id: user._id, 
        name: user.name, 
        email: user.email,
        isPremium: !!user.isPremium,
        coverLettersGenerated: user.coverLettersGenerated || 0,
        cvText: user.cvText || ''
      },
    })
  } catch (err) {
    console.error('Register error:', err)
    res.status(500).json({ message: 'Server error during registration' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  console.log('🔑 Login attempt:', req.body.email)
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' })
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password')
    console.log('👤 User search:', email, 'Found:', !!user)
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const match = await user.comparePassword(password)
    console.log('🔑 Password match:', match)
    
    if (!match) {
      return res.status(401).json({ message: 'Invalid email or password' })
    }

    const token = signToken(user._id)

    res.json({
      token,
      user: { 
        _id: user._id, 
        name: user.name, 
        email: user.email,
        isPremium: !!user.isPremium,
        coverLettersGenerated: user.coverLettersGenerated || 0,
        cvText: user.cvText || ''
      },
    })
  } catch (err) {
    console.error('Login error:', err)
    res.status(500).json({ message: 'Server error during login' })
  }
})

// GET /api/auth/me  (protected)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ user })
  } catch (err) {
    res.status(500).json({ message: 'Server error' })
  }
})
// GET /api/auth/google
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

// GET /api/auth/google/callback
router.get('/google/callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    console.log('📬 Google Callback hit. User ->', req.user?.email || 'MISSING')
    if (!req.user) return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=auth_failed`)
    const token = signToken(req.user._id)
    // Redirect to frontend with token in URL
    const target = `${process.env.CLIENT_URL || 'http://localhost:5173'}/login?token=${token}`
    console.log('🚀 Redirecting to ->', target.substring(0, 50) + '...')
    res.redirect(target)
  }
)

// PUT /api/auth/profile/cv
router.put('/profile/cv', auth, upload.single('cvFile'), async (req, res) => {
  try {
    const Job = require('../models/Job')
    console.log('📁 CV Upload route hit user=', req.userId)
    console.log('📁 Content-Type:', req.headers['content-type'])
    console.log('📁 File present:', !!req.file)
    console.log('📁 Body present:', !!req.body.cvText)
    let cvText = ''

    if (req.file) {
      if (req.file.mimetype !== 'application/pdf') {
        return res.status(400).json({ message: 'Only PDF files are supported' })
      }
      const pdfParse = require('pdf-parse-fork')
      const pdfData = await pdfParse(req.file.buffer)
      cvText = pdfData.text
    } else if (req.body.cvText) {
      cvText = req.body.cvText
    } else {
      return res.status(400).json({ message: 'Please provide either a PDF file or text.' })
    }

    cvText = cvText.trim().slice(0, 2000)

    const user = await User.findByIdAndUpdate(req.userId, { cvText }, { new: true })
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Clear cached cover letters for all jobs of this user
    await Job.updateMany(
      { user: req.userId },
      { $set: { aiCoverLetter: { free: '', premium: '' } } }
    )

    res.json({ message: 'CV saved successfully!', length: cvText.length, cvText })
  } catch (err) {
    console.error('CV upload error:', err)
    res.status(500).json({ message: 'Failed to process CV' })
  }
})

module.exports = router
