const express    = require('express')
const { Paddle, Environment, EventName } = require('@paddle/paddle-node-sdk')
const crypto     = require('crypto')
const User       = require('../models/User')
const auth       = require('../middleware/auth')

const router = express.Router()

const isLive = process.env.PADDLE_ENV !== 'sandbox' // Default to production unless explicitly told otherwise
const paddleEnv = isLive ? Environment.Production : Environment.Sandbox
const apiBase = isLive ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com'

const paddle = new Paddle(process.env.PADDLE_API_KEY, {
  environment: paddleEnv
})

// ─── POST /api/payment/create-checkout ──────────────────────────────────────
router.post('/create-checkout', auth, async (req, res) => {
  console.log('⚡ /create-checkout route hit by user:', req.userId)
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (user.isPremium) return res.status(400).json({ message: 'Already Premium!' })

    const key = process.env.PADDLE_API_KEY?.trim()
    console.log('📦 Creating checkout with key:', key ? `${key.slice(0, 10)}...${key.slice(-4)}` : 'MISSING')

    // Use the official SDK to create the transaction
    const transaction = await paddle.transactions.create({
      items: [{ priceId: process.env.PADDLE_PRODUCT_ID, quantity: 1 }],
      customData: { userId: user._id.toString() }
    })

    console.log('✅ Created transaction via SDK:', transaction.id)
    res.json({ transactionId: transaction.id })
  } catch (err) {
    console.error('❌ Paddle SDK Error:', err.message)
    // If it's a Paddle error, it will have more details
    const detail = err.response?.data?.error?.detail || err.message
    res.status(500).json({ error: 'checkout_creation_failed', message: detail })
  }
})

// ─── POST /api/payment/verify-payment ────────────────────────────────────────
// Fallback for manual verification
router.post('/verify-payment', auth, async (req, res) => {
  try {
    // List transactions to find if any are completed for this user
    const transactions = await paddle.transactions.list({
      status: ['completed']
    })

    const userTransaction = transactions.data?.find(txn => 
      txn.customData?.userId === req.userId
    )

    if (userTransaction) {
      await User.findByIdAndUpdate(req.userId, { isPremium: true })
      console.log(`✅ Verified: User ${req.userId} found in Paddle transaction ${userTransaction.id}`)
      return res.json({ success: true, message: 'Upgraded successfully!' })
    }

    res.status(404).json({ message: 'No completed transaction found yet. Please wait a moment.' })
  } catch (err) {
    console.error('❌ Verification Error:', err.message)
    res.status(500).json({ error: 'verification_failed' })
  }
})

// ─── POST /api/payment/webhook ───────────────────────────────────────────────
// Receives Paddle webhook events and updates user premium status.
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['paddle-signature']
  if (!signature) return res.status(400).json({ message: 'No signature' })

  try {
    // Note: Re-initializing paddle here for webhook unmarshal
    const paddleSDK = new Paddle(process.env.PADDLE_API_KEY?.trim(), { environment: paddleEnv })
    const eventData = paddleSDK.webhooks.unmarshal(
      req.body.toString(),
      process.env.PADDLE_WEBHOOK_SECRET,
      signature
    )

    console.log('📦 Paddle Webhook:', eventData.eventType)

    if (eventData.eventType === EventName.TransactionCompleted) {
      const userId = eventData.data.customData?.userId
      if (userId) {
        await User.findByIdAndUpdate(userId, { isPremium: true })
        console.log(`✅ Webhook: User ${userId} upgraded to Premium`)
      }
    }
    res.json({ received: true })
  } catch (err) {
    console.error('Webhook error:', err.message)
    res.status(400).json({ message: 'Webhook verification failed' })
  }
})

module.exports = router
