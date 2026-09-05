require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dns = require('dns');

// Reliable DNS for MongoDB SRV on Windows
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const User = require('../models/User');
const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Membership = require('../models/Membership');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Feature = require('../models/Feature');
const OrganizationFeature = require('../models/OrganizationFeature');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const SecurityDeposit = require('../models/SecurityDeposit');
const Complaint = require('../models/Complaint');
const Suggestion = require('../models/Suggestion');
const LaundrySlot = require('../models/LaundrySlot');
const MessRequest = require('../models/MessRequest');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const Expense = require('../models/Expense');
const ImpersonationSession = require('../models/ImpersonationSession');

const ACTUAL_MONGODB_URI =
  'mongodb+srv://mayurvish:Mayur2003%21%40%23%24@complete-backend.pqjcnsk.mongodb.net/q2connect?retryWrites=true&w=majority';

async function resetDatabase() {
  try {
    const mongoUri = process.env.MONGODB_URI || ACTUAL_MONGODB_URI;
    console.log('🔄 Connecting to MongoDB:', mongoUri.replace(/:([^:@]+)@/, ':****@'));
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    console.log('\n🧹 Step 1: Clearing all operational & student data...');
    const [
      studentsDeleted,
      feesDeleted,
      paymentsDeleted,
      depositsDeleted,
      complaintsDeleted,
      suggestionsDeleted,
      laundryDeleted,
      messDeleted,
      attendanceDeleted,
      notificationsDeleted,
      auditDeleted,
      expensesDeleted,
      impersonationsDeleted,
    ] = await Promise.all([
      Student.deleteMany({}),
      Fee.deleteMany({}),
      FeePayment.deleteMany({}),
      SecurityDeposit.deleteMany({}),
      Complaint.deleteMany({}),
      Suggestion.deleteMany({}),
      LaundrySlot.deleteMany({}),
      MessRequest.deleteMany({}),
      Attendance.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({}),
      Expense.deleteMany({}),
      ImpersonationSession.deleteMany({}),
    ]);

    console.log(`   - Deleted ${studentsDeleted.deletedCount} students`);
    console.log(`   - Deleted ${feesDeleted.deletedCount} fees & ${paymentsDeleted.deletedCount} payments`);
    console.log(`   - Deleted ${complaintsDeleted.deletedCount} complaints & ${suggestionsDeleted.deletedCount} suggestions`);
    console.log(`   - Deleted ${notificationsDeleted.deletedCount} notifications`);

    console.log('\n🧹 Step 2: Removing resident/student user accounts & clearing lockouts...');
    // Delete all users that are not admins
    const usersDeleted = await User.deleteMany({ role: { $in: ['student'] } });
    // Also delete any pending registration applicants
    const pendingDeleted = await User.deleteMany({ registrationStatus: { $in: ['pending_approval', 'rejected'] } });
    console.log(`   - Removed ${usersDeleted.deletedCount + pendingDeleted.deletedCount} resident/applicant users.`);

    // Reset lockout counters on all remaining admin users
    await User.updateMany({}, { $set: { failedLoginAttempts: 0, lockUntil: null } });
    console.log('   - Cleared failed login attempts & lockouts on all admins.');

    console.log('\n👑 Step 3: Setting up pristine Admin accounts...');
    const adminPasswordPlain = 'Admin@123';
    const superAdminPasswordPlain = 'SuperAdmin@123';
    const salt = await bcrypt.genSalt(12);
    const adminPasswordHashed = await bcrypt.hash(adminPasswordPlain, salt);
    const superAdminPasswordHashed = await bcrypt.hash(superAdminPasswordPlain, salt);

    // 1. Super Admin
    const superAdmin = await User.findOneAndUpdate(
      { email: 'superadmin@q2connect.com' },
      {
        name: 'Super Administrator',
        email: 'superadmin@q2connect.com',
        username: 'superadmin',
        password: superAdminPasswordHashed,
        role: 'super_admin',
        isSuperAdmin: true,
        isActive: true,
        failedLoginAttempts: 0,
        lockUntil: null,
        registrationStatus: 'active',
      },
      { upsert: true, new: true }
    );
    console.log(`   ✅ Super Admin: superadmin@q2connect.com (username: superadmin | password: ${superAdminPasswordPlain})`);

    // 2. Primary Hostel Admin (Abhi)
    const hostelAdmin = await User.findOneAndUpdate(
      { username: 'Abhi1006' },
      {
        name: 'Abhi',
        email: 'abhi1006@q2connect.com',
        username: 'Abhi1006',
        password: adminPasswordHashed,
        role: 'admin',
        isSuperAdmin: false,
        isActive: true,
        hostels: ['Q2', 'Q2.0', 'Q2.1'],
        failedLoginAttempts: 0,
        lockUntil: null,
        registrationStatus: 'active',
      },
      { upsert: true, new: true }
    );
    console.log(`   ✅ Hostel Admin: abhi1006@q2connect.com (username: Abhi1006 | password: ${adminPasswordPlain})`);

    console.log('\n🏢 Step 4: Ensuring Default Organization & Hostel Branches...');
    let defaultOrg = await Organization.findOne({ slug: 'q2-hostels' });
    if (!defaultOrg) {
      defaultOrg = await Organization.create({
        name: 'Q2 Hostel Management Pvt Ltd',
        slug: 'q2-hostels',
        legalName: 'Q2 Hospitality & Accommodations Pvt Ltd',
        contactEmail: 'admin@q2hostels.com',
        phone: '+91 98765 43210',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        status: 'ACTIVE',
      });
    }

    // Link Admins to defaultOrg
    superAdmin.activeOrganizationId = defaultOrg._id;
    await superAdmin.save();
    hostelAdmin.activeOrganizationId = defaultOrg._id;
    await hostelAdmin.save();

    await Membership.findOneAndUpdate(
      { organizationId: defaultOrg._id, userId: hostelAdmin._id },
      { organizationId: defaultOrg._id, userId: hostelAdmin._id, role: 'ORG_ADMIN', status: 'ACTIVE' },
      { upsert: true }
    );

    // Ensure 3 Hostel Branches
    const BRANCHES = [
      { code: 'Q2', name: 'Q2 Girls Hostel - Gachibowli', capacity: 150, genderType: 'GIRLS' },
      { code: 'Q2.0', name: 'Q2 Girls Hostel - Kondapur', capacity: 120, genderType: 'GIRLS' },
      { code: 'Q2.1', name: 'Q2 Girls Hostel - Madhapur', capacity: 100, genderType: 'GIRLS' },
    ];

    for (const b of BRANCHES) {
      const branch = await Hostel.findOneAndUpdate(
        { organizationId: defaultOrg._id, code: b.code },
        { ...b, organizationId: defaultOrg._id, status: 'ACTIVE' },
        { upsert: true, new: true }
      );

      // Create standard rooms for each branch if not present
      const existingRooms = await Room.countDocuments({ hostel: b.code });
      if (existingRooms === 0) {
        const sampleRooms = [
          { roomNumber: '101', capacity: 2, occupiedCount: 0, hostel: b.code, hostelId: branch._id, organizationId: defaultOrg._id },
          { roomNumber: '102', capacity: 3, occupiedCount: 0, hostel: b.code, hostelId: branch._id, organizationId: defaultOrg._id },
          { roomNumber: '201', capacity: 2, occupiedCount: 0, hostel: b.code, hostelId: branch._id, organizationId: defaultOrg._id },
          { roomNumber: '202', capacity: 1, occupiedCount: 0, hostel: b.code, hostelId: branch._id, organizationId: defaultOrg._id },
        ];
        await Room.insertMany(sampleRooms);
      }
      console.log(`   ✅ Branch Verified: ${b.name} (${b.code})`);
    }

    console.log('\n✨ ========================================================');
    console.log('🎉 DATABASE HAS BEEN CLEANED & RESET SUCCESSFULLY!');
    console.log('========================================================');
    console.log('You can now test the website from scratch:');
    console.log('1. Super Admin Login:');
    console.log('   - Email: superadmin@q2connect.com (or username: superadmin)');
    console.log('   - Password: Admin@123');
    console.log('2. Hostel Admin Login:');
    console.log('   - Email: abhi1006@q2connect.com (or username: Abhi1006)');
    console.log('   - Password: Admin@123');
    console.log('3. Resident / Student Registration:');
    console.log('   - Click "Continue with Google"');
    console.log('   - Fill in Phone & Preferred Hostel Branch -> Submits for Admin Approval');
    console.log('   - Admin approves in All Students -> Pending Approvals');
    console.log('   - Student logs in with Google to set their Username & Password!');
    console.log('========================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error resetting database:', err);
    process.exit(1);
  }
}

resetDatabase();
