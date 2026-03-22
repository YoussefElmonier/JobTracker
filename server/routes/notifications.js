const express = require('express')
const router  = express.Router()
const Notification = require('../models/Notification')
const auth = require('../middleware/auth')

// GET /api/notifications
router.get('/', auth, async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .limit(10)
    
    res.json(notifications)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Server error retrieving notifications' })
  }
})

// PUT /api/notifications/:id/read
router.put('/:id/read', auth, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      { read: true },
      { new: true }
    )
    if (!notif) return res.status(404).json({ message: 'Notification not found' })
    res.json(notif)
  } catch (err) {
    res.status(500).json({ message: 'Server error marking read' })
  }
})

// PUT /api/notifications/read-all
router.put('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.userId, read: false },
      { read: true }
    )
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ message: 'Server error marking all read' })
  }
})

module.exports = router
