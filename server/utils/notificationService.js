/**
 * notificationService.js
 * Native Web Push implementation using the official web-push library.
 * This completely replaces ntfy.sh, sending encrypted notifications directly 
 * to Apple (APNs) and Google (FCM) using TRKR's own VAPID keys.
 */
const webpush = require('web-push');

// TRKR Native VAPID Keys
const publicVapidKey = 'BIYildETI2nVN7bLjBlDRU0RNjHBY8yn6Q_lLAo0RG458hUvt0Q6J87reTfCRseFlUbrKDPg0UYfP4gxkvxVrSU';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || 'JTWDrAO4Z6zXDRPFtO9CNVbhNSF84a8F91lj25Umihc';

// Configure Web Push with our contact and keys
webpush.setVapidDetails(
  'mailto:support@usetrkr.xyz',
  publicVapidKey,
  privateVapidKey
);

/**
 * Empty wrapper to prevent auth.js crashing if it imports generateNtfyTopic
 */
function generateNtfyTopic() {
  return null;
}

/**
 * Sends a native, encrypted push notification directly to the user's browser.
 * 
 * @param {Object} pushSubscription  - The Web Push subscription object from the DB
 * @param {string} title             - Notification title
 * @param {string} body              - Notification body / message
 * @returns {Promise<void>}          Always resolves — never throws (non-blocking)
 */
async function sendPremiumAlert(pushSubscription, title, body) {
  if (!pushSubscription || !pushSubscription.endpoint) return;

  const clientUrl = process.env.CLIENT_URL || 'https://usetrkr.xyz';

  // Construct our own clean JSON payload
  const payload = JSON.stringify({
    title,
    message: body,
    url: `${clientUrl}/dashboard`
  });

  try {
    // webpush.sendNotification automatically handles payload encryption, VAPID headers,
    // and network requests to Apple APNs or Google FCM.
    await webpush.sendNotification(pushSubscription, payload);
    console.log(`[web-push] Native alert sent securely to user successfully.`);
  } catch (err) {
    console.error('[web-push] Notification silent fail:', err.message);
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.error('[web-push] User subscription has expired or was revoked.');
      // Future: Could actively remove it from the DB here
    }
  }
}

module.exports = { generateNtfyTopic, sendPremiumAlert };
