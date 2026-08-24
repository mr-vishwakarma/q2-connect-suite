const mongoose = require('mongoose');
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
require('dotenv').config();

const User = require('../models/User');

async function setPasswords() {
  try {
    const mongoUri = process.env.MONGODB_URI;
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // 1. Super Admin
    let superAdmin = await User.findOne({ email: 'superadmin@q2connect.com' });
    if (superAdmin) {
      superAdmin.password = 'SuperAdmin@123';
      await superAdmin.save();
      console.log('✅ Super Admin password set to: SuperAdmin@123');
    }

    // 2. Hostel Admin
    let admin = await User.findOne({ email: 'abhi1006@q2connect.com' });
    if (admin) {
      admin.password = 'Admin@123';
      await admin.save();
      console.log('✅ Hostel Admin (abhi1006) password set to: Admin@123');
    }

    let adminVishwakarma = await User.findOne({ username: 'mr-vishwakarma' });
    if (adminVishwakarma) {
      adminVishwakarma.password = 'Admin@123';
      await adminVishwakarma.save();
      console.log('✅ Hostel Admin (mr-vishwakarma) password set to: Admin@123');
    }

    // 3. Student
    let student = await User.findOne({ username: 'kajalsharma' });
    if (student) {
      student.password = 'Student@123';
      await student.save();
      console.log('✅ Student (kajalsharma) password set to: Student@123');
    }

    let studentShyam = await User.findOne({ username: 'shyam06' });
    if (studentShyam) {
      studentShyam.password = 'Student@123';
      await studentShyam.save();
      console.log('✅ Student (shyam06) password set to: Student@123');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

setPasswords();
