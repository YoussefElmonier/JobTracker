const express = require('express')
const router  = express.Router()
const auth    = require('../middleware/auth')
const User    = require('../models/User')
const { optimizeCV } = require('../utils/ai')
const multer  = require('multer')
const pdfParse = require('pdf-parse-fork')

const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } }) // 5MB

// ─── POST /api/cv/optimize ──────────────────────────────────────────────
router.post('/optimize', auth, upload.single('cvFile'), async (req, res) => {
  try {
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
      try {
        const data = await pdfParse(req.file.buffer)
        inputText = data.text + '\n' + inputText
      } catch (err) {
        console.error('PDF Parse Error:', err)
        return res.status(400).json({ message: 'Failed to parse PDF file. Please try copy-pasting the text instead.' })
      }
    }

    if (!inputText.trim()) {
      return res.status(400).json({ message: 'Please provide resume text or upload a file.' })
    }

    const result = await optimizeCV(inputText)
    
    if (!result) throw new Error('AI optimization failed')

    // Always increment even on "insufficient" if we want to be strict, but actually 
    // it's better to ONLY increment if successful.
    if (!result.insufficient) {
       user.atsOptimizationsUsed += 1
       await user.save()
    }

    res.json({
      ...result,
      used: user.atsOptimizationsUsed,
      limit: user.isPremium ? Infinity : 2,
      remaining: user.isPremium ? Infinity : Math.max(0, 2 - user.atsOptimizationsUsed)
    })
  } catch (err) {
    console.error('CV Optimize API error:', err.message)
    res.status(500).json({ message: 'Internal server error during CV optimization' })
  }
})

module.exports = router
