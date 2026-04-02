const express    = require('express')
const { Paddle, Environment, EventName } = require('@paddle/paddle-node-sdk')
const crypto     = require('crypto')
const User       = require('../models/User')
const auth       = require('../middleware/auth')
const { generateNtfyTopic } = require('../utils/notificationService')

const router = express.Router()

const envVal = (process.env.PADDLE_ENV || 'production').trim().toLowerCase()
const isLive = envVal !== 'sandbox'
const paddleEnv = isLive ? 'production' : 'sandbox' // Using explicit strings for reliability

const paddle = new Paddle(process.env.PADDLE_API_KEY?.trim(), {
  environment: paddleEnv
})

// ─── POST /api/payment/create-checkout ──────────────────────────────────────
router.post('/create-checkout', auth, async (req, res) => {
  console.log('⚡ /create-checkout route hit by user:', req.userId)
  try {
    const user = await User.findById(req.userId)
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (user.isPremium) return res.status(400).json({ message: 'Already Premium!' })

    const envKey = process.env.PADDLE_API_KEY?.trim() || ''
    const key = envKey.replace(/['"]+/g, '') // Remove any accidental quotes
    
    console.log('--- DEBUG PADDLE KEY ---')
    console.log('Length:', key.length)
    console.log('Starts with apikey_:', key.startsWith('apikey_'))
    console.log('First 10:', key.slice(0, 10))
    console.log('Last 4:', key.slice(-4))
    console.log('Full Key (Careful!):', key.slice(0, 7) + '...' + key.slice(-4))
    console.log('Environment:', paddleEnv)
    console.log('--- END DEBUG ---')

    // Map plan and cycle to Price IDs from .env
    let priceId = process.env.PADDLE_PRO_MONTHLY_ID
    const isYearly = req.body.billingCycle === 'yr'

    if (req.body.planType === 'pro') {
      priceId = isYearly ? process.env.PADDLE_PRO_YEARLY_ID : process.env.PADDLE_PRO_MONTHLY_ID
    } else if (req.body.planType === 'elite') {
      priceId = isYearly ? process.env.PADDLE_ELITE_YEARLY_ID : process.env.PADDLE_ELITE_MONTHLY_ID
    }

    // Use the official SDK to create the transaction
    const transaction = await paddle.transactions.create({
      items: [{ priceId: priceId, quantity: 1 }],
      customData: { userId: user._id.toString() }
    })

    console.log('✅ Created transaction via SDK:', transaction.id)
    res.json({ transactionId: transaction.id })
  } catch (err) {
    console.error('❌ Paddle SDK Error:', err.message)
    if (err.response?.data) {
      console.error('📦 Full Paddle Error Detail:', JSON.stringify(err.response.data))
    }
    const detail = err.response?.data?.error?.detail || err.message
    res.status(500).json({ error: 'checkout_creation_failed', message: detail })
  }
})

// ─── POST /api/payment/verify-payment ────────────────────────────────────────
// Fallback for manual verification
router.post('/verify-payment', auth, async (req, res) => {
  console.log('🔍 Manual verification requested for user:', req.userId)
  try {
    // List transactions to find if any are completed for this user
    const transactions = paddle.transactions.list({
      status: ['completed', 'paid'] // Check both to be safe
    })

    let userTransaction = null
    // We should iterate through the collection, though usually it will be in the first few
    for await (const txn of transactions) {
      if (txn.customData?.userId === req.userId) {
        userTransaction = txn
        break
      }
    }

    if (userTransaction) {
      const upgradeUser = await User.findById(req.userId)
      if (upgradeUser && !upgradeUser.ntfyTopic) {
        upgradeUser.isPremium = true
        upgradeUser.ntfyTopic = generateNtfyTopic()
        await upgradeUser.save()
      } else {
        await User.findByIdAndUpdate(req.userId, { isPremium: true })
      }
      console.log(`✅ Verified: User ${req.userId} found in Paddle transaction ${userTransaction.id}`)
      return res.json({ success: true, message: 'Upgraded successfully!' })
    }

    console.warn(`⚠️ Verification failed: No completed transaction for user ${req.userId}`)
    res.status(404).json({ message: 'No completed transaction found yet. Please wait a moment.' })
  } catch (err) {
    console.error('❌ Verification Error:', err.message)
    res.status(500).json({ error: 'verification_failed', details: err.message })
  }
})

// ─── POST /api/payment/webhook ───────────────────────────────────────────────
// Receives Paddle webhook events and updates user premium status.
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['paddle-signature']
  if (!signature) {
    console.error('❌ Webhook Error: No signature header')
    return res.status(400).json({ message: 'No signature' })
  }

  try {
    const rawBody = req.body.toString()
    // Note: Re-initializing paddle here for webhook unmarshal
    const paddleSDK = new Paddle(process.env.PADDLE_API_KEY?.trim(), { environment: paddleEnv })
    
    const eventData = paddleSDK.webhooks.unmarshal(
      rawBody,
      process.env.PADDLE_WEBHOOK_SECRET?.trim(),
      signature
    )

    console.log('📦 Paddle Webhook Received:', eventData.eventType, 'Event ID:', eventData.eventId)

    if (eventData.eventType === EventName.TransactionCompleted || eventData.eventType === EventName.TransactionPaid) {
      const userId = eventData.data.customData?.userId
      if (userId) {
        const upgradeUser = await User.findById(userId)
        if (upgradeUser) {
          upgradeUser.isPremium = true
          if (!upgradeUser.ntfyTopic) upgradeUser.ntfyTopic = generateNtfyTopic()
          await upgradeUser.save()
          console.log(`✅ Webhook: User ${userId} (${upgradeUser.email}) upgraded to Premium`)
        } else {
          console.warn(`⚠️ Webhook: Received successful payment but user ${userId} NOT found in DB`)
        }
      } else {
        console.warn('⚠️ Webhook: Transaction completed but NO userId found in customData')
        console.dir(eventData.data.customData, { depth: null })
      }
    }
    
    res.json({ received: true })
  } catch (err) {
    console.error('❌ Webhook Verification Failed!', err.message)
    // Log a bit of the body to see what we're getting
    const bodyPreview = req.body ? req.body.toString().slice(0, 100) : 'EMPTY'
    console.log('Body Preview:', bodyPreview)
    res.status(400).json({ message: 'Webhook verification failed', error: err.message })
  }
})

module.exports = router
