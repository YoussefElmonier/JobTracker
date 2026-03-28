const mongoose = require('mongoose');
const User = require('./server/models/User');
const { sendPremiumAlert } = require('./server/utils/notificationService');
require('dotenv').config({ path: './server/.env' });

async function testNotification() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    
    // Find the specific user
    const user = await User.findOne({ email: 'yousifelmonier66@gmail.com' });
    
    if (!user) {
      console.log('User not found.');
      process.exit(1);
    }
    
    if (!user.isPremium || !user.ntfyTopic) {
      console.log(`User found but status is: Premium: ${user.isPremium}, Topic: ${user.ntfyTopic || 'MISSING'}`);
      process.exit(1);
    }

    console.log(`🚀 Sending test alert to topic: ${user.ntfyTopic}`);
    
    await sendPremiumAlert(
      user.ntfyTopic, 
      '🎉 Test: Job Offer Detected! (TRKR)', 
      `Congratulations! We detected a new offer for a job on your TRKR dashboard.`
    );

    console.log('✅ Test notification command sent.');
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testNotification();
