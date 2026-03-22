const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to DB');

    const customerId = 'ctm_01kmbxyf6b5dca1xs01bkq29s5';
    
    // Search all users for any field matching this ID
    const premiumUsers = await User.find({ isPremium: true });
    console.log('Premium users count:', premiumUsers.length);
    
    let targetUser = null;
    for (const u of premiumUsers) {
      const uStr = JSON.stringify(u);
      if (uStr.includes(customerId)) {
        targetUser = u;
        break;
      }
    }

    if (targetUser) {
      console.log('FOUND USER:', targetUser.email, 'ID:', targetUser._id);
      // Now update them to NOT premium
      await User.findByIdAndUpdate(targetUser._id, { isPremium: false });
      console.log('SUCCESS: User downgraded to Free.');
    } else {
      console.log('User NOT found with that Paddle ID.');
      console.log('Checking all users as a fallback...');
      const allUsers = await User.find({});
      for (const u of allUsers) {
        if (JSON.stringify(u).includes(customerId)) {
           console.log('FOUND USER in non-premium list:', u.email);
           targetUser = u;
           break;
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
