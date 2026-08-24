const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();

const User = require('../models/User');
const Student = require('../models/Student');

async function listUsers() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB\n');

    const superAdmins = await User.find({ isSuperAdmin: true }).select('name email username role isSuperAdmin');
    console.log('=== 1. SUPER ADMIN ACCOUNTS ===');
    console.log(superAdmins);

    const admins = await User.find({ role: 'admin' }).select('name email username role');
    console.log('\n=== 2. HOSTEL ADMIN ACCOUNTS ===');
    console.log(admins);

    const students = await User.find({ role: 'student' }).select('name email username role studentId').limit(5);
    console.log('\n=== 3. STUDENT ACCOUNTS (Sample 5) ===');
    console.log(students);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

listUsers();
