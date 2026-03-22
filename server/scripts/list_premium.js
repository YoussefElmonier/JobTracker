const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });
const User = require('../models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const users = await User.find({ isPremium: true });
    console.log('--- PREMIUM USERS ---');
    users.forEach(u => {
      console.log(`Email: ${u.email}, ID: ${u._id}, PaddleTx: ${u.paddleTransactionId}, Created: ${u.createdAt}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
