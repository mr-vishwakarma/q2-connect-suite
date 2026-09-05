const dns = require('dns');
// On Windows, Node.js querySrv can fail with default ISP DNS. Use Google & Cloudflare DNS.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const Organization = require('../models/Organization');

async function seedSuperAdmin() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in .env');
    process.exit(1);
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(uri);
    console.log('✅ Connected to MongoDB successfully.');

    const targetUsername = 'superadmin';
    const targetEmail = 'superadmin@q2connect.com';
    const targetPassword = 'SuperAdmin@123';

    // Find default organization if available
    let defaultOrg = await Organization.findOne();

    // Check if superadmin user exists by email or username
    let user = await User.findOne({
      $or: [
        { username: targetUsername },
        { email: targetEmail }
      ]
    });

    if (user) {
      console.log(`Found existing user (ID: ${user._id}, email: ${user.email}, username: ${user.username})`);
      user.name = user.name || 'Super Administrator';
      user.email = targetEmail;
      user.username = targetUsername;
      user.password = targetPassword; // Will trigger pre-save bcrypt hash
      user.role = 'super_admin';
      user.isSuperAdmin = true;
      user.isActive = true;
      user.registrationStatus = 'active';
      user.authProvider = 'local';
      user.failedLoginAttempts = 0;
      user.lockUntil = null;
      if (defaultOrg && !user.activeOrganizationId) {
        user.activeOrganizationId = defaultOrg._id;
      }
      await user.save();
      console.log('✅ Updated existing Super Admin credentials and unlocked account.');
    } else {
      console.log('Creating brand new Super Admin user...');
      user = new User({
        name: 'Super Administrator',
        email: targetEmail,
        username: targetUsername,
        password: targetPassword,
        role: 'super_admin',
        isSuperAdmin: true,
        isActive: true,
        registrationStatus: 'active',
        authProvider: 'local',
        failedLoginAttempts: 0,
        lockUntil: null,
        activeOrganizationId: defaultOrg ? defaultOrg._id : undefined
      });
      await user.save();
      console.log('✅ Created new Super Admin user.');
    }

    // Verify password comparison
    const freshUser = await User.findById(user._id);
    const isValid = await freshUser.comparePassword(targetPassword);
    console.log('\n--- VERIFICATION ---');
    console.log(`User ID:               ${freshUser._id}`);
    console.log(`Username:              ${freshUser.username}`);
    console.log(`Email:                 ${freshUser.email}`);
    console.log(`Role:                  ${freshUser.role}`);
    console.log(`isSuperAdmin:          ${freshUser.isSuperAdmin}`);
    console.log(`isActive:              ${freshUser.isActive}`);
    console.log(`isLocked:              ${freshUser.isLocked()}`);
    console.log(`Password Match Test:   ${isValid ? 'PASSED ✅' : 'FAILED ❌'}`);

    if (!isValid) {
      throw new Error('Password verification check failed!');
    }

    console.log('\n🎉 Super Admin credentials seeded successfully!');
    console.log(`   Username: ${targetUsername}`);
    console.log(`   Email:    ${targetEmail}`);
    console.log(`   Password: ${targetPassword}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding Super Admin:', err);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

seedSuperAdmin();
