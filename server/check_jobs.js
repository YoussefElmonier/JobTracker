const mongoose = require('mongoose');
const Job = require('./models/Job');
const dotenv = require('dotenv');
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const jobs = await Job.find({}).sort({ createdAt: -1 }).limit(3);
  console.log(JSON.stringify(jobs.map(j => ({
    company: j.company,
    location: j.location,
    aiSalary: j.aiSalary
  })), null, 2));
  process.exit();
}
check();
