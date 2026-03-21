const express  = require('express')
const jwt      = require('jsonwebtoken')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const User     = require('../models/User')
const auth     = require('../middleware/auth')

const router = express.Router()

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
      const email = profile.emails[0].value
      let user    = await User.findOne({ 
        $or: [{ googleId: profile.id }, { email: email.toLowerCase() }] 
      })

      if (!user) {
        user = await User.create({
          name:     profile.displayName,
          email:    email.toLowerCase(),
          googleId: profile.id,
          // password not needed for google users
        })
      } else if (!user.googleId) {
        // Link existing email account to google
        user.googleId = profile.id
        await user.save()
      }

      return done(null, user)
    } catch (err) {
      return done(err, null)
    }
  }
))

// POST /api/auth/register
router.post('/register', async (req, res) => {
  console.log('📝 Register attempt:', req.body.email)
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' })
    }

    const exists = await User.findOne({ email: email.toLowerCase() })
    if (exists) {
      return res.status(409).json({ message: 'An account with that email already exists' })
    }

    const user  = await User.create({ name, email, password })
    const token = signToken(user._id)

    res.status(201).json({
      token,
      user: { 
        _id: user._id, 
        name: user.name, 
        email: user.email,
        isPremium: !!user.isPremium,
        coverLettersGenerated: user.coverLettersGenerated || 0
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
        coverLettersGenerated: user.coverLettersGenerated || 0
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
    const token = signToken(req.user._id)
    // Redirect to frontend with token in URL
    res.redirect(`${process.env.CLIENT_URL}/login?token=${token}`)
  }
)

module.exports = router
