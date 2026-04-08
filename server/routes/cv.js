const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const User    = require('../models/User')
const { optimizeCV } = require('../utils/ai')
const multer  = require('multer')
const pdfParse = require('pdf-parse-fork')

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } 
})

// ─── POST /api/cv/optimize ──────────────────────────────────────────────
router.post('/optimize', auth, upload.single('cvFile'), async (req, res) => {
  try {
    if (!req.userId) {
      console.warn('❌ CV Optimize: req.userId is missing')
      return res.status(401).json({ message: 'Authentication failed: User ID missing' })
    }

    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Check free limit
    if (!user.isPremium && user.atsOptimizationsUsed >= 2) {
      return res.status(403).json({ 
        error: 'limit_reached',
        message: 'You have reached the limit of 2 free ATS CV optimizations. Upgrade to Pro for unlimited access.' 
      })
    }

    let inputText = req.body.manualText || ''
    
    // If a file was uploaded, parse it
    if (req.file) {
      console.log('📄 PDF detected:', req.file.originalname)
      try {
        const data = await pdfParse(req.file.buffer)
        inputText = (data.text || '') + '\n' + inputText
      } catch (err) {
        console.error('PDF Parse Error:', err)
        return res.status(400).json({ message: 'Failed to parse PDF file. Please try copy-pasting the text instead.' })
      }
    }

    const cleanedInput = inputText.trim()
    if (!cleanedInput || cleanedInput.length < 20) {
      return res.status(400).json({ message: 'Please provide more complete resume text or upload a PDF.' })
    }

    const result = await optimizeCV(cleanedInput)
    
    if (!result) {
       console.error('❌ AI optimization returned null result')
       throw new Error('The AI failed to generate an optimization. Please try again with more detail.')
    }

    if (!result.insufficient) {
       user.atsOptimizationsUsed = (user.atsOptimizationsUsed || 0) + 1
       await user.save()
    }

    res.json({
      ...result,
      used: user.atsOptimizationsUsed,
      limit: user.isPremium ? Infinity : 2,
      remaining: user.isPremium ? Infinity : Math.max(0, 2 - user.atsOptimizationsUsed)
    })
  } catch (err) {
    console.error('CV Optimize API Panic:', err)
    res.status(500).json({ 
      message: 'Internal server error during CV optimization',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    })
  }
})


module.exports = router
