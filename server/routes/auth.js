const express  = require('express')
const jwt      = require('jsonwebtoken')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const User     = require('../models/User')
const auth     = require('../middleware/auth')
const { google } = require('googleapis')
const multer   = require('multer')

// Client A — Basic login: used for all users — login only
const loginClient = new google.auth.OAuth2(
  process.env.GOOGLE_LOGIN_CLIENT_ID,
  process.env.GOOGLE_LOGIN_CLIENT_SECRET
);

// Client B — Gmail scanning: used only for Gmail connected users
const gmailClient = new google.auth.OAuth2(
  process.env.GOOGLE_GMAIL_CLIENT_ID,
  process.env.GOOGLE_GMAIL_CLIENT_SECRET
);
const upload   = multer({ storage: multer.memoryStorage() })
const router   = express.Router()

// Helper: sign token
const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' })

// Strategy A Callback - BASIC LOGIN (Does NOT update Gmail tokens)
const googleAuthCallbackLogin = async (req, accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value
    let user = await User.findOne({ 
      $or: [{ googleId: profile.id }, { email: email.toLowerCase() }] 
    })

    if (!user) {
      user = await User.create({
        name:     profile.displayName,
        email:    email.toLowerCase(),
        googleId: profile.id,
      })
    } else if (!user.googleId) {
      user.googleId = profile.id
      await user.save()
    }

    return done(null, user)
  } catch (err) {
    return done(err, null)
  }
}

// Strategy B Callback - GMAIL CONNECTION (Updates Gmail tokens ONLY)
const googleAuthCallbackGmail = async (req, accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value
    
    // Retrieve userId from state (passed in the initial redirect)
    const currentUserId = req.userId || req.query.state
    
    let user = await User.findOne({ 
      $or: [{ googleId: profile.id }, { email: email.toLowerCase() }] 
    })

    // If we have a currentUserId, we MUST link it to that user instead of finding by email
    if (currentUserId) {
      const existingUser = await User.findById(currentUserId)
      if (existingUser) {
        user = existingUser
      }
    }

    if (!user) {
      user = await User.create({
        name:     profile.displayName,
        email:    email.toLowerCase(),
        googleId: profile.id,
      })
    }
    
    // Attach googleId if missing
    if (!user.googleId) user.googleId = profile.id

    // Attach/Update Gmail tokens specifically
    user.gmailTokens = {
      accessToken,
      refreshToken: refreshToken || user.gmailTokens?.refreshToken
    }
    
    user.gmailConnected = true
    await user.save()
    return done(null, user)
  } catch (err) {
    return done(err, null)
  }
}

// Client A - Basic Login Strategy (NO offline access needed)
passport.use('google', new GoogleStrategy({
    clientID:     process.env.GOOGLE_LOGIN_CLIENT_ID,
    clientSecret: process.env.GOOGLE_LOGIN_CLIENT_SECRET,
    callbackURL:  `${process.env.SERVER_URL || 'http://localhost:3001'}/api/auth/google/callback`,
    proxy:        true,
    scope:        ['profile', 'email'],
    passReqToCallback: true
  }, googleAuthCallbackLogin))

// Client B - Gmail Connection Strategy (REQUIRED offline access)
passport.use('google-gmail', new GoogleStrategy({
    clientID:     process.env.GOOGLE_GMAIL_CLIENT_ID,
    clientSecret: process.env.GOOGLE_GMAIL_CLIENT_SECRET,
    callbackURL:  `${process.env.SERVER_URL || 'http://localhost:3001'}/api/auth/google/gmail/callback`,
    proxy:        true,
    accessType:   'offline',
    prompt:       'consent',
    scope:        ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
    passReqToCallback: true
  }, googleAuthCallbackGmail))

// POST /api/auth/register
router.post('/register', upload.single('cvFile'), async (req, res) => {
  console.log('📝 Register attempt:', req.body.email || 'Multipart incoming')
  try {
    const { name, email, password } = req.body
    let cvText = req.body.cvText || ''

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' })
    }

    const exists = await User.findOne({ email: email.toLowerCase() })
    if (exists) {
      return res.status(409).json({ message: 'An account with that email already exists' })
    }

    // Process optional PDF if provided during signup
    if (req.file) {
      if (req.file.mimetype === 'application/pdf') {
        const pdfParse = require('pdf-parse-fork')
        const pdfData = await pdfParse(req.file.buffer)
        cvText = pdfData.text
      }
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
        cvText: user.cvText || '',
        gmailConnected: !!user.gmailConnected
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
        cvText: user.cvText || '',
        gmailConnected: !!user.gmailConnected
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
// GET /api/auth/google (Using Basic Login Client)
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  accessType: 'offline',
  prompt: 'consent'
}))

// GET /api/auth/google/gmail (Using Gmail Connected Client)
router.get('/google/gmail', auth, async (req, res, next) => {
  const user = await User.findById(req.userId)
  if (!user?.isPremium) {
     return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/pricing?reason=gmail`)
  }
  
  // Pass the user ID as state to identify the user in the callback
  passport.authenticate('google-gmail', { 
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly'],
    accessType: 'offline',
    prompt: 'consent',
    state: req.userId.toString()
  })(req, res, next)
})

// GET /api/auth/google/callback (Basic Login)
router.get('/google/callback', 
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  async (req, res) => {
    if (!req.user) return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?error=auth_failed`)
    
    const token = signToken(req.user._id)
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/login?token=${token}`)
  }
)

// GET /api/auth/google/gmail/callback (Gmail Client)
router.get('/google/gmail/callback', 
  passport.authenticate('google-gmail', { session: false, failureRedirect: '/profile?error=gmail_failed' }),
  async (req, res) => {
    if (!req.user) return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/profile?error=auth_failed`)
    
    res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/profile?gmail=success`)
  }
)

// POST /api/auth/gmail/disconnect
router.post('/gmail/disconnect', auth, async (req, res) => {
  try {
     const user = await User.findById(req.userId)
     if (!user) return res.status(404).json({ message: 'User not found' })
     
     user.gmailConnected = false
     user.autoTrackEmails = false
     user.gmailTokens = { accessToken: null, refreshToken: null }
     await user.save()
     
     res.json({ success: true, message: 'Gmail disconnected' })
  } catch(e) {
     res.status(500).json({ message: 'Failed to disconnect Gmail' })
  }
})

// PUT /api/auth/gmail/toggle
router.put('/gmail/toggle', auth, async (req, res) => {
  try {
     const { autoTrackEmails } = req.body
     const user = await User.findById(req.userId)
     if (!user) return res.status(404).json({ message: 'User not found' })
     
     user.autoTrackEmails = !!autoTrackEmails
     await user.save()
     
     res.json({ success: true, autoTrackEmails: user.autoTrackEmails })
  } catch(e) {
     res.status(500).json({ message: 'Failed to update toggle' })
  }
})

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

    // Clear cached cover letters and CV analysis for all jobs of this user
    await Job.updateMany(
      { user: req.userId },
      { $set: { 
        aiCoverLetter: { free: '', premium: '' },
        cvAnalysis: null
      } }
    )

    res.json({ message: 'CV saved successfully!', length: cvText.length, cvText })
  } catch (err) {
    console.error('CV upload error:', err)
    res.status(500).json({ message: 'Failed to process CV' })
  }
})

module.exports = router
