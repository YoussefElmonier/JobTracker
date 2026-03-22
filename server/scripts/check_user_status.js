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
      console.log(`User: ${user.name}, Email: ${user.email}, isPremium: ${user.isPremium}`);
    } else {
      console.log('User not found.');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
