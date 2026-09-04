require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dns = require('dns');

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
const LaundrySlot = require('../models/LaundrySlot');
const MessRequest = require('../models/MessRequest');
const Attendance = require('../models/Attendance');

const { DEFAULT_FEATURES, PLAN_TIERS } = require('../constants/saas.constants');

const FEATURE_DEFINITIONS = [
  { key: 'student_management', name: 'Student Management', description: 'Student onboarding, profiles, room assignment & documents', category: 'core', defaultEnabled: true },
  { key: 'room_management', name: 'Room & Bed Management', description: 'Building, floor, room allocation & live occupancy tracking', category: 'core', defaultEnabled: true },
  { key: 'fee_management', name: 'Fee Collection & Matrix', description: 'Interactive student fee matrix, receipts, grace period & late fees', category: 'finance', defaultEnabled: true },
  { key: 'security_deposit', name: 'Security Deposits', description: 'Deposit ledgers, adjustments, refunds & tracking', category: 'finance', defaultEnabled: true },
  { key: 'expense_management', name: 'Expense Tracker', description: 'Hostel utility bills, vendor payments, maintenance expenses & cashflow', category: 'finance', defaultEnabled: true },
  { key: 'attendance', name: 'Attendance & Gate Passes', description: 'Student entry/exit pass approval and daily attendance', category: 'operations', defaultEnabled: true },
  { key: 'mess_management', name: 'Mess & Leave Requests', description: 'Mess-off rebate leaves, food rating widget & menu schedule', category: 'operations', defaultEnabled: true },
  { key: 'laundry', name: 'Laundry Booking', description: 'Time-slot booking system for washing machines', category: 'operations', defaultEnabled: true },
  { key: 'complaints', name: 'Complaints & Suggestions', description: 'Student ticketing system with resolution statuses', category: 'operations', defaultEnabled: true },
  { key: 'reports', name: 'Financial & Occupancy Reports', description: 'Exportable Excel & PDF financial ledgers', category: 'advanced', defaultEnabled: true },
  { key: 'advanced_analytics', name: 'Advanced Analytics & AI', description: 'Cohort analytics, forecasting & smart chatbot', category: 'advanced', defaultEnabled: false },
  { key: 'custom_branding', name: 'White-label & Custom Branding', description: 'Custom tenant logos, domain & receipt branding', category: 'advanced', defaultEnabled: false },
  { key: 'biometric_integration', name: 'Biometric Attendance Hardware', description: 'Hardware integration with gate access scanners', category: 'advanced', defaultEnabled: false },
  { key: 'api_access', name: 'External API & Webhooks', description: 'REST APIs and webhook triggers for third-party integrations', category: 'advanced', defaultEnabled: false },
];

const SEED_PLANS = [
  {
    name: 'Starter Plan',
    code: 'STARTER',
    description: 'Perfect for single hostel branches or small PG accommodations up to 100 students.',
    priceMonthly: 4999,
    priceYearly: 49990,
    limits: { maxStudents: 100, maxRooms: 50, maxHostels: 1, maxStaff: 5, storageGb: 5 },
    includedFeatures: [
      'student_management',
      'room_management',
      'fee_management',
      'security_deposit',
      'attendance',
      'mess_management',
      'laundry',
      'complaints',
      'reports',
    ],
    isActive: true,
    isPopular: false,
  },
  {
    name: 'Professional Plan',
    code: 'PROFESSIONAL',
    description: 'Ideal for multi-branch hostel chains up to 500 students with expense tracking.',
    priceMonthly: 11999,
    priceYearly: 119990,
    limits: { maxStudents: 500, maxRooms: 250, maxHostels: 5, maxStaff: 20, storageGb: 25 },
    includedFeatures: [
      'student_management',
      'room_management',
      'fee_management',
      'security_deposit',
      'expense_management',
      'attendance',
      'mess_management',
      'laundry',
      'complaints',
      'reports',
      'advanced_analytics',
    ],
    isActive: true,
    isPopular: true,
  },
  {
    name: 'Enterprise Plan',
    code: 'ENTERPRISE',
    description: 'Full-scale solution for large institutions with unlimited capacity, white-labeling & API access.',
    priceMonthly: 24999,
    priceYearly: 249990,
    limits: { maxStudents: 5000, maxRooms: 2000, maxHostels: 50, maxStaff: 100, storageGb: 100 },
    includedFeatures: [
      'student_management',
      'room_management',
      'fee_management',
      'security_deposit',
      'expense_management',
      'attendance',
      'mess_management',
      'laundry',
      'complaints',
      'reports',
      'advanced_analytics',
      'custom_branding',
      'api_access',
      'biometric_integration',
    ],
    isActive: true,
    isPopular: false,
  },
];

async function seedSaaSEnvironment() {
    const actualMongoUri = 'mongodb+srv://mayurvish:Mayur2003%21%40%23%24@complete-backend.pqjcnsk.mongodb.net/q2connect?retryWrites=true&w=majority';
    const mongoUri = process.env.MONGODB_URI || actualMongoUri;
    console.log('Connecting to MongoDB at:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    // 1. Seed Feature Catalog
    console.log('\n--- 1. Seeding Feature Catalog ---');
    for (const feat of FEATURE_DEFINITIONS) {
      await Feature.findOneAndUpdate({ key: feat.key }, feat, { upsert: true, new: true });
    }
    console.log(`✅ Seeded ${FEATURE_DEFINITIONS.length} Feature definitions.`);

    // 2. Seed Plans
    console.log('\n--- 2. Seeding Subscription Plans ---');
    const plansMap = {};
    for (const planData of SEED_PLANS) {
      const plan = await Plan.findOneAndUpdate({ code: planData.code }, planData, { upsert: true, new: true });
      plansMap[plan.code] = plan;
    }
    console.log(`✅ Seeded ${SEED_PLANS.length} Subscription Plans.`);

    // 3. Seed Super Admin
    console.log('\n--- 3. Seeding Super Administrator ---');
    const superAdminEmail = 'superadmin@q2connect.com';
    let superAdmin = await User.findOne({ email: superAdminEmail });
    if (!superAdmin) {
      superAdmin = await User.create({
        name: 'Super Administrator',
        email: superAdminEmail,
        username: 'superadmin',
        password: 'SuperAdmin@123',
        role: 'super_admin',
        isSuperAdmin: true,
        isActive: true,
      });
      console.log(`✅ Created Super Admin: ${superAdminEmail} (password: SuperAdmin@123)`);
    } else {
      superAdmin.isSuperAdmin = true;
      superAdmin.role = 'super_admin';
      await superAdmin.save();
      console.log(`✅ Verified Super Admin: ${superAdminEmail}`);
    }

    // 4. Seed Default Organization (Q2 Hostel Group)
    console.log('\n--- 4. Seeding Default Tenant Organization ---');
    const orgSlug = 'q2-hostels';
    let defaultOrg = await Organization.findOne({ slug: orgSlug });
    if (!defaultOrg) {
      defaultOrg = await Organization.create({
        name: 'Q2 Hostel Management Pvt Ltd',
        slug: orgSlug,
        legalName: 'Q2 Hospitality & Accommodations Pvt Ltd',
        contactEmail: 'admin@q2hostels.com',
        phone: '+91 98765 43210',
        address: 'Gachibowli, Financial District',
        city: 'Hyderabad',
        state: 'Telangana',
        country: 'India',
        status: 'ACTIVE',
      });
      console.log(`✅ Created Default Tenant Organization: ${defaultOrg.name}`);
    }

    // Seed Organization Subscription
    const enterprisePlan = plansMap['ENTERPRISE'] || plansMap['PROFESSIONAL'];
    let orgSubscription = await Subscription.findOne({ organizationId: defaultOrg._id });
    if (!orgSubscription && enterprisePlan) {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      orgSubscription = await Subscription.create({
        organizationId: defaultOrg._id,
        planId: enterprisePlan._id,
        status: 'ACTIVE',
        billingCycle: 'YEARLY',
        currentPeriodStart: new Date(),
        currentPeriodEnd: nextYear,
      });
      defaultOrg.subscriptionId = orgSubscription._id;
      await defaultOrg.save();
      console.log(`✅ Created Subscription for ${defaultOrg.name}`);
    }

    // Seed Organization Features
    for (const feat of FEATURE_DEFINITIONS) {
      await OrganizationFeature.findOneAndUpdate(
        { organizationId: defaultOrg._id, featureKey: feat.key },
        { enabled: true },
        { upsert: true }
      );
    }
    console.log(`✅ Activated all features for ${defaultOrg.name}`);

    // 5. Seed Branches (Hostels)
    console.log('\n--- 5. Seeding Hostel Branches ---');
    const BRANCHES = [
      { code: 'Q2', name: 'Q2 Girls Hostel - Gachibowli', capacity: 150, genderType: 'GIRLS' },
      { code: 'Q2.0', name: 'Q2 Girls Hostel - Kondapur', capacity: 120, genderType: 'GIRLS' },
      { code: 'Q2.1', name: 'Q2 Girls Hostel - Madhapur', capacity: 100, genderType: 'GIRLS' },
    ];

    const branchMap = {};
    for (const b of BRANCHES) {
      const hostel = await Hostel.findOneAndUpdate(
        { organizationId: defaultOrg._id, code: b.code },
        {
          organizationId: defaultOrg._id,
          name: b.name,
          code: b.code,
          capacity: b.capacity,
          genderType: b.genderType,
          status: 'ACTIVE',
        },
        { upsert: true, new: true }
      );
      branchMap[b.code] = hostel;
      console.log(`✅ Verified Branch: ${b.name} (${b.code}) -> ID: ${hostel._id}`);
    }

    // 6. Migrate Existing Operational Data
    console.log('\n--- 6. Migrating Existing Data to Multi-Tenant Scope ---');

    // Students
    const studentRes = await Student.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: defaultOrg._id } }
    );
    console.log(`✅ Migrated ${studentRes.modifiedCount || 0} Students with organizationId.`);

    for (const [code, branch] of Object.entries(branchMap)) {
      await Student.updateMany(
        { hostel: code, hostelId: { $exists: false } },
        { $set: { hostelId: branch._id } }
      );
    }

    // Rooms
    const roomRes = await Room.updateMany(
      { organizationId: { $exists: false } },
      { $set: { organizationId: defaultOrg._id } }
    );
    console.log(`✅ Migrated ${roomRes.modifiedCount || 0} Rooms with organizationId.`);

    for (const [code, branch] of Object.entries(branchMap)) {
      await Room.updateMany(
        { hostel: code, hostelId: { $exists: false } },
        { $set: { hostelId: branch._id } }
      );
    }

    // Fees & Payments
    await Fee.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: defaultOrg._id } });
    await FeePayment.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: defaultOrg._id } });
    await SecurityDeposit.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: defaultOrg._id } });
    await Complaint.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: defaultOrg._id } });
    await LaundrySlot.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: defaultOrg._id } });
    await MessRequest.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: defaultOrg._id } });
    await Attendance.updateMany({ organizationId: { $exists: false } }, { $set: { organizationId: defaultOrg._id } });

    console.log(`✅ Successfully assigned organizationId to all operational records.`);

    // 7. Create Memberships for existing users
    console.log('\n--- 7. Creating Memberships for Existing Users ---');
    const existingUsers = await User.find({ role: { $in: ['admin', 'warden'] } });
    for (const u of existingUsers) {
      await Membership.findOneAndUpdate(
        { userId: u._id, organizationId: defaultOrg._id },
        {
          userId: u._id,
          organizationId: defaultOrg._id,
          role: u.role === 'admin' ? 'ORGANIZATION_OWNER' : 'WARDEN',
          hostelAccess: ['all'],
          status: 'ACTIVE',
        },
        { upsert: true }
      );
      u.activeOrganizationId = defaultOrg._id;
      await u.save();
    }
    console.log(`✅ Created Memberships for ${existingUsers.length} Admin/Warden users.`);

    console.log('\n🎉 Multi-Tenant SaaS Environment Bootstrap Complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during SaaS seed:', error);
    process.exit(1);
  }
}

seedSaaSEnvironment();
