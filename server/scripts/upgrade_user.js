const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

async function run() {
  try {
    const email = process.argv[2];
    if (!email) {
      console.error('Please provide an email address: node upgrade_user.js <email>');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (user) {
      console.log(`Found User: ${user.name} (${user.email})`);
      await User.findByIdAndUpdate(user._id, { isPremium: true });
      console.log(`--- SUCCESS: Upgraded ${email} to Premium tier. ---`);
    } else {
      console.log(`User NOT found with email: ${email}`);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
