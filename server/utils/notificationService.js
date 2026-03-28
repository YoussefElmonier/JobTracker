/**
 * notificationService.js
 * Handles push notifications via ntfy.sh (100% free, no API key needed).
 * Used as a Premium-only feature to alert users of job offer detections in real time.
 *
 * Uses native fetch (Node 18+) with a 5-second AbortSignal timeout — safe for
 * Vercel serverless where long-running sockets can cause function timeouts.
 */

/**
 * Generates a secure, unique ntfy topic ID for a new user.
 * Format: trkr_ + 16 random alphanumeric characters.
 * @returns {string} e.g. "trkr_a3f9bK2mXp7dN1qR"
 */
function generateNtfyTopic() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let topic = 'trkr_'
  for (let i = 0; i < 16; i++) {
    topic += chars[Math.floor(Math.random() * chars.length)]
  }
  return topic
}

/**
 * Sends a push notification to a user's unique ntfy topic.
 * Only called for Premium users who have a ntfyTopic set.
 *
 * Uses native fetch with AbortSignal.timeout(5000) to stay well within
 * Vercel's serverless response window and avoid dangling socket warnings.
 *
 * @param {string} userTopic  - The user's unique ntfy topic (e.g. "trkr_a3f9bK2mXp7dN1qR")
 * @param {string} title      - Notification title
 * @param {string} body       - Notification body / message
 * @returns {Promise<void>}    Always resolves — never throws (non-blocking)
 */
async function sendPremiumAlert(userTopic, title, body) {
  if (!userTopic) return

  const clientUrl = process.env.CLIENT_URL || 'https://usetrkr.xyz'

  try {
    const res = await fetch(`https://ntfy.sh/${userTopic}`, {
      method: 'POST',
      body, 
      headers: {
        'Title':    title.replace(/[^\x00-\x7F]/g, ""), // Strip emojis for header safety
        'Priority': '4',
        'Tags':     'money,tada',
        'Click':    `${clientUrl}/dashboard`,
      },
      // Abort after 5 s so the Vercel function is never held open by a slow ntfy response
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      console.log(`[ntfy] Alert sent to topic ${userTopic} — status ${res.status}`)
    } else {
      console.warn(`[ntfy] Non-2xx response for topic ${userTopic}: ${res.status}`)
    }
  } catch (err) {
    // Silent fail — a missed notification must never break the email scanner
    console.error('[ntfy] Notification silent fail:', err.message)
  }
}

module.exports = { generateNtfyTopic, sendPremiumAlert }
