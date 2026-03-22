const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const email = 'youssefelmonier@yahoo.com';
    const user = await User.findOne({ email });
    
    if (user) {
      console.log(`Found User: ${user.name} (${user.email})`);
      await User.findByIdAndUpdate(user._id, { isPremium: false });
      console.log('--- SUCCESS: Downgraded to Free tier. ---');
    } else {
      console.log('User NOT found with that email.');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
