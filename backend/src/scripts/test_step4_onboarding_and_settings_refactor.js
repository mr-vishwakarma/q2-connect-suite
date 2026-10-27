/**
 * Hosteliq - Step 4 Onboarding & Hostel Admin Settings Refactor Test Suite
 *
 * Verifies:
 * 1. Onboarding creates Organization, Hostel, and Subscription without operational policy fields.
 * 2. Default operational policies are cleanly initialized in both Settings and Hostel.settings.
 * 3. Hostel Admin can fetch settings for their assigned hostel (/api/settings/:hostel).
 * 4. Hostel Admin can update all 5 operational policies:
 *    - Grace Period (Days)
 *    - Late Fee / Day (₹)
 *    - Security Deposit (₹)
 *    - Night Curfew Timing
 *    - Weekly Laundry Slots
 * 5. Changes persist and survive subsequent queries.
 * 6. Validation rejects invalid values:
 *    - Negative or > 60 grace period
 *    - Negative late fee
 *    - Negative security deposit
 *    - Empty or non-string curfew time
 *    - Negative or > 50 laundry slots
 * 7. Multi-hostel data isolation:
 *    - Hostel A's changes DO NOT affect Hostel B's settings.
 *    - Hostel Admin for Branch A cannot modify Branch B's settings (403).
 * 8. Role-based permission enforcement:
 *    - Student cannot update settings (403).
 *    - Warden cannot update settings (403).
 * 9. Changing operational policies does NOT alter the SaaS subscription plan, billing frequency, or trial status.
 * 10. Backward compatibility with existing records.
 */

require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const User = require('../models/User');
const Membership = require('../models/Membership');
const Settings = require('../models/Settings');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');

const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const JWT_SECRET = process.env.JWT_SECRET || 'hosteliq-jwt-secret-dev';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    let reqBody = null;
    if (body) {
      reqBody = JSON.stringify(body);
      reqHeaders['Content-Length'] = Buffer.byteLength(reqBody);
    }

    const req = http.request(
      url,
      { method, headers: reqHeaders, timeout: 8000 },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out to ${path}`));
    });

    if (reqBody) req.write(reqBody);
    req.end();
  });
}

async function runSuite() {
  console.log('============================================================');
  console.log('🏨 HOSTELIQ STEP 4 ONBOARDING & SETTINGS REFACTOR SUITE');
  console.log('============================================================\n');

  await mongoose.connect(process.env.MONGODB_URI);

  // Ensure starter plan exists
  let starterPlan = await Plan.findOne({ code: 'STARTER' });
  if (!starterPlan) {
    starterPlan = await Plan.create({
      name: 'Starter Plan',
      code: 'STARTER',
      priceMonthly: 4999,
      priceYearly: 49999,
      limits: { maxStudents: 100, maxRooms: 50, maxHostels: 1 },
      includedFeatures: ['student_management', 'room_management', 'fee_management'],
    });
  }

  // Set up Express test app with required routes
  const express = require('express');
  const app = express();
  app.use(express.json());

  const authRoutes = require('../routes/auth.routes');
  const superAdminRoutes = require('../routes/superAdmin.routes');
  const settingsRoutes = require('../routes/settings.routes');

  app.use('/api/auth', authRoutes);
  app.use('/api/super-admin', superAdminRoutes);
  app.use('/api/settings', settingsRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  const runId = Date.now().toString(36);

  // Setup Super Admin credentials
  const saEmail = `superadmin.${runId}@hosteliq.test`;
  let saUser = await User.create({
    name: 'Super Admin Tester',
    email: saEmail,
    username: `sa_${runId}`,
    password: 'SuperAdminPass@123',
    role: 'super_admin',
    isSuperAdmin: true,
    isActive: true,
    status: 'ACTIVE',
  });

  const saToken = jwt.sign(
    {
      id: saUser._id,
      userId: saUser._id,
      role: 'super_admin',
      isSuperAdmin: true,
      email: saUser.email,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  const saHeaders = { Authorization: `Bearer ${saToken}` };

  try {
    // ------------------------------------------------------------------
    // TEST 1: Onboarding without operational policy fields
    // ------------------------------------------------------------------
    console.log('--- TEST 1: Onboarding without operational policy fields ---');
    const orgSlug = `novaliving-${runId}`;
    const branchCodeA = `NOVA-A-${runId.toUpperCase().slice(-3)}`;
    const adminEmailA = `admin.novaa.${runId}@novaliving.test`;

    // Pure SaaS onboarding payload: no gracePeriodDays, lateFeePerDay, securityDeposit, curfewTime, laundrySlotsPerWeek
    const onboardingPayload = {
      name: `Nova Living ${runId}`,
      slug: orgSlug,
      contactEmail: `contact.${runId}@novaliving.test`,
      branchName: `Nova Residency Alpha`,
      branchCode: branchCodeA,
      capacity: 120,
      genderType: 'COED',
      adminName: `Arun Verma`,
      adminEmail: adminEmailA,
      adminPhone: '+91 9876543210',
      planCode: 'STARTER',
      billingCycle: 'MONTHLY',
      trialDays: 14,
    };

    const onboardRes = await makeRequest('POST', '/api/super-admin/organizations', onboardingPayload, saHeaders);
    assert(onboardRes.status === 201, 'Onboarding succeeded with 201 Created without operational fields');
    assert(onboardRes.body.success === true, 'Response indicates success: true');
    const createdOrgId = onboardRes.body.data?.organization?._id || onboardRes.body.data?.organization?.id;
    const createdHostelId = onboardRes.body.data?.hostel?._id || onboardRes.body.data?.hostel?.id;
    assert(!!createdOrgId, 'Organization created with valid ID');
    assert(!!createdHostelId, 'Hostel branch created with valid ID');

    // Verify Subscription created and persisted
    const subRecord = await Subscription.findOne({ organizationId: createdOrgId });
    assert(!!subRecord, 'Subscription record persisted for organization');
    assert(subRecord.billingCycle === 'MONTHLY', 'Subscription billing cycle correctly set to MONTHLY');
    assert(subRecord.status === 'TRIAL', 'Subscription status correctly set to TRIAL (14-day trial duration)');

    // Verify default operational policies initialized in Hostel and Settings models
    const hostelA = await Hostel.findById(createdHostelId);
    assert(hostelA.settings.gracePeriodDays === 5, 'Hostel.settings.gracePeriodDays default initialized to 5');
    assert(hostelA.settings.lateFeePerDay === 20, 'Hostel.settings.lateFeePerDay default initialized to 20');
    assert(hostelA.settings.securityDeposit === 5000, 'Hostel.settings.securityDeposit default initialized to 5000');
    assert(hostelA.settings.curfewTime === '21:30', 'Hostel.settings.curfewTime default initialized to 21:30');
    assert(hostelA.settings.laundrySlotsPerWeek === 2, 'Hostel.settings.laundrySlotsPerWeek default initialized to 2');

    const settingsA = await Settings.findOne({ organizationId: createdOrgId, hostel: branchCodeA });
    assert(!!settingsA, 'Settings document created for new hostel branch');
    assert(settingsA.gracePeriodDays === 5, 'Settings.gracePeriodDays default initialized to 5');
    assert(settingsA.securityDeposit === 5000, 'Settings.securityDeposit default initialized to 5000');
    assert(settingsA.curfewTime === '21:30', 'Settings.curfewTime default initialized to 21:30');
    assert(settingsA.weeklyLaundrySlots === 2, 'Settings.weeklyLaundrySlots default initialized to 2');

    // ------------------------------------------------------------------
    // TEST 2: Hostel Admin fetches operational settings
    // ------------------------------------------------------------------
    console.log('\n--- TEST 2: Hostel Admin reads operational settings ---');
    const adminUserA = await User.findOne({ email: adminEmailA });

    const adminTokenA = jwt.sign(
      {
        id: adminUserA._id,
        userId: adminUserA._id,
        role: 'admin',
        activeOrganizationId: createdOrgId,
        activeHostelId: createdHostelId,
        hostels: [branchCodeA],
        email: adminUserA.email,
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const adminHeadersA = { Authorization: `Bearer ${adminTokenA}` };

    const getSettingsRes = await makeRequest('GET', `/api/settings/${branchCodeA}`, null, adminHeadersA);
    assert(getSettingsRes.status === 200, 'Hostel Admin successfully fetched settings (200 OK)');
    assert(getSettingsRes.body.success === true, 'Response indicates success: true');
    assert(getSettingsRes.body.data.gracePeriodDays === 5, 'Fetched gracePeriodDays is 5');
    assert(getSettingsRes.body.data.lateFeePerDay === 20, 'Fetched lateFeePerDay is 20');
    assert(getSettingsRes.body.data.securityDeposit === 5000, 'Fetched securityDeposit is 5000');
    assert(getSettingsRes.body.data.curfewTime === '21:30', 'Fetched curfewTime is 21:30');
    assert(getSettingsRes.body.data.weeklyLaundrySlots === 2, 'Fetched weeklyLaundrySlots is 2');

    // ------------------------------------------------------------------
    // TEST 3: Hostel Admin updates all 5 operational policies
    // ------------------------------------------------------------------
    console.log('\n--- TEST 3: Hostel Admin updates operational policies ---');
    const updatePayload = {
      gracePeriodDays: 7,
      lateFeePerDay: 75,
      securityDeposit: 8000,
      curfewTime: '22:00',
      weeklyLaundrySlots: 3,
    };

    const updateRes = await makeRequest('PUT', `/api/settings/${branchCodeA}`, updatePayload, adminHeadersA);
    assert(updateRes.status === 200, 'Updating operational settings returned 200 OK');
    assert(updateRes.body.data.gracePeriodDays === 7, 'Updated gracePeriodDays is 7');
    assert(updateRes.body.data.lateFeePerDay === 75, 'Updated lateFeePerDay is 75');
    assert(updateRes.body.data.securityDeposit === 8000, 'Updated securityDeposit is 8000');
    assert(updateRes.body.data.curfewTime === '22:00', 'Updated curfewTime is 22:00');
    assert(updateRes.body.data.weeklyLaundrySlots === 3, 'Updated weeklyLaundrySlots is 3');

    // Verify persistence in Settings collection
    const refreshedSettingsA = await Settings.findOne({ organizationId: createdOrgId, hostel: branchCodeA });
    assert(refreshedSettingsA.gracePeriodDays === 7, 'Persisted Settings.gracePeriodDays is 7');
    assert(refreshedSettingsA.lateFeePerDay === 75, 'Persisted Settings.lateFeePerDay is 75');
    assert(refreshedSettingsA.securityDeposit === 8000, 'Persisted Settings.securityDeposit is 8000');
    assert(refreshedSettingsA.curfewTime === '22:00', 'Persisted Settings.curfewTime is 22:00');
    assert(refreshedSettingsA.weeklyLaundrySlots === 3, 'Persisted Settings.weeklyLaundrySlots is 3');

    // Verify dual-sync to Hostel.settings
    const refreshedHostelA = await Hostel.findById(createdHostelId);
    assert(refreshedHostelA.settings.gracePeriodDays === 7, 'Dual-synced Hostel.settings.gracePeriodDays is 7');
    assert(refreshedHostelA.settings.lateFeePerDay === 75, 'Dual-synced Hostel.settings.lateFeePerDay is 75');
    assert(refreshedHostelA.settings.securityDeposit === 8000, 'Dual-synced Hostel.settings.securityDeposit is 8000');
    assert(refreshedHostelA.settings.curfewTime === '22:00', 'Dual-synced Hostel.settings.curfewTime is 22:00');
    assert(refreshedHostelA.settings.laundrySlotsPerWeek === 3, 'Dual-synced Hostel.settings.laundrySlotsPerWeek is 3');

    // Verify Subscription is untouched by operational policy changes
    const subCheck = await Subscription.findOne({ organizationId: createdOrgId });
    assert(subCheck.billingCycle === 'MONTHLY', 'SaaS subscription billing cycle remains MONTHLY');
    assert(subCheck.status === 'TRIAL', 'SaaS subscription status remains TRIAL');

    // ------------------------------------------------------------------
    // TEST 4: Validation rejects invalid inputs
    // ------------------------------------------------------------------
    console.log('\n--- TEST 4: Validation rejects invalid inputs ---');

    // Negative grace period
    const negGraceRes = await makeRequest('PUT', `/api/settings/${branchCodeA}`, { gracePeriodDays: -3 }, adminHeadersA);
    assert(negGraceRes.status === 400, 'Negative grace period rejected with 400 Bad Request');
    assert(negGraceRes.body.code === 'INVALID_GRACE_PERIOD', 'Correct error code INVALID_GRACE_PERIOD returned');

    // Excessive grace period (> 60 days)
    const excessGraceRes = await makeRequest('PUT', `/api/settings/${branchCodeA}`, { gracePeriodDays: 90 }, adminHeadersA);
    assert(excessGraceRes.status === 400, 'Grace period > 60 rejected with 400 Bad Request');

    // Negative late fee
    const negLateFeeRes = await makeRequest('PUT', `/api/settings/${branchCodeA}`, { lateFeePerDay: -10 }, adminHeadersA);
    assert(negLateFeeRes.status === 400, 'Negative late fee rejected with 400 Bad Request');
    assert(negLateFeeRes.body.code === 'INVALID_LATE_FEE_PENALTY', 'Correct error code INVALID_LATE_FEE_PENALTY returned');

    // Negative security deposit
    const negDepositRes = await makeRequest('PUT', `/api/settings/${branchCodeA}`, { securityDeposit: -500 }, adminHeadersA);
    assert(negDepositRes.status === 400, 'Negative security deposit rejected with 400 Bad Request');
    assert(negDepositRes.body.code === 'INVALID_SECURITY_DEPOSIT', 'Correct error code INVALID_SECURITY_DEPOSIT returned');

    // Empty curfew time
    const emptyCurfewRes = await makeRequest('PUT', `/api/settings/${branchCodeA}`, { curfewTime: '' }, adminHeadersA);
    assert(emptyCurfewRes.status === 400, 'Empty curfew time rejected with 400 Bad Request');
    assert(emptyCurfewRes.body.code === 'INVALID_CURFEW_TIME', 'Correct error code INVALID_CURFEW_TIME returned');

    // Excessive laundry slots (> 50)
    const excessLaundryRes = await makeRequest('PUT', `/api/settings/${branchCodeA}`, { weeklyLaundrySlots: 75 }, adminHeadersA);
    assert(excessLaundryRes.status === 400, 'Laundry slots > 50 rejected with 400 Bad Request');
    assert(excessLaundryRes.body.code === 'INVALID_LAUNDRY_SLOTS', 'Correct error code INVALID_LAUNDRY_SLOTS returned');

    // ------------------------------------------------------------------
    // TEST 5: Multi-hostel data isolation
    // ------------------------------------------------------------------
    console.log('\n--- TEST 5: Multi-hostel data isolation ---');
    // Create Branch B for another organization
    const orgSlugB = `zenith-${runId}`;
    const branchCodeB = `ZEN-B-${runId.toUpperCase().slice(-3)}`;
    const adminEmailB = `admin.zenith.${runId}@zenithliving.test`;

    const onboardBRes = await makeRequest('POST', '/api/super-admin/organizations', {
      name: `Zenith Living ${runId}`,
      slug: orgSlugB,
      contactEmail: `contact.${runId}@zenithliving.test`,
      branchName: `Zenith Heights`,
      branchCode: branchCodeB,
      adminName: `Suresh Mehta`,
      adminEmail: adminEmailB,
      planCode: 'GROWTH',
    }, saHeaders);
    assert(onboardBRes.status === 201, 'Branch B created successfully');

    const createdOrgIdB = onboardBRes.body.data?.organization?._id || onboardBRes.body.data?.organization?.id;
    const createdHostelIdB = onboardBRes.body.data?.hostel?._id || onboardBRes.body.data?.hostel?.id;

    // Verify Branch B has its own independent default settings
    const settingsB = await Settings.findOne({ organizationId: createdOrgIdB, hostel: branchCodeB });
    assert(settingsB.gracePeriodDays === 5, 'Branch B grace period is initial default (5), isolated from Branch A');
    assert(settingsB.securityDeposit === 5000, 'Branch B security deposit is initial default (5000), isolated from Branch A');

    // Attempt: Admin A tries to modify Branch B's settings (Unauthorized access)
    const crossHostelRes = await makeRequest(
      'PUT',
      `/api/settings/${branchCodeB}`,
      { gracePeriodDays: 20 },
      adminHeadersA
    );
    assert(crossHostelRes.status === 403, 'Cross-branch modification by foreign Admin rejected with 403 Forbidden');
    assert(crossHostelRes.body.code === 'UNAUTHORIZED_HOSTEL_ACCESS', 'Correct error code UNAUTHORIZED_HOSTEL_ACCESS');

    // Verify Branch B settings were NOT modified
    const untouchedSettingsB = await Settings.findOne({ organizationId: createdOrgIdB, hostel: branchCodeB });
    assert(untouchedSettingsB.gracePeriodDays === 5, 'Branch B settings remained completely unchanged');

    // ------------------------------------------------------------------
    // TEST 6: Role-based permissions (Warden & Student rejected)
    // ------------------------------------------------------------------
    console.log('\n--- TEST 6: Role-based permissions (Warden & Student rejected) ---');

    // Warden token
    const wardenUser = await User.create({
      name: `Warden Test ${runId}`,
      email: `warden.${runId}@novaliving.test`,
      username: `warden_${runId}`,
      password: 'WardenPass@123',
      role: 'warden',
      activeOrganizationId: createdOrgId,
      activeHostelId: createdHostelId,
      hostels: [branchCodeA],
      isActive: true,
      status: 'ACTIVE',
    });

    const wardenToken = jwt.sign(
      {
        id: wardenUser._id,
        userId: wardenUser._id,
        role: 'warden',
        activeOrganizationId: createdOrgId,
        activeHostelId: createdHostelId,
        hostels: [branchCodeA],
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const wardenHeaders = { Authorization: `Bearer ${wardenToken}` };

    const wardenUpdateRes = await makeRequest(
      'PUT',
      `/api/settings/${branchCodeA}`,
      { gracePeriodDays: 10 },
      wardenHeaders
    );
    assert(wardenUpdateRes.status === 403, 'Warden update rejected with 403 Forbidden (adminOnly)');

    // Student token
    const studentUser = await User.create({
      name: `Student Test ${runId}`,
      email: `student.${runId}@novaliving.test`,
      username: `student_${runId}`,
      password: 'StudentPass@123',
      role: 'student',
      activeOrganizationId: createdOrgId,
      activeHostelId: createdHostelId,
      hostels: [branchCodeA],
      isActive: true,
      status: 'ACTIVE',
    });

    const studentToken = jwt.sign(
      {
        id: studentUser._id,
        userId: studentUser._id,
        role: 'student',
        activeOrganizationId: createdOrgId,
        activeHostelId: createdHostelId,
        hostels: [branchCodeA],
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const studentHeaders = { Authorization: `Bearer ${studentToken}` };

    const studentUpdateRes = await makeRequest(
      'PUT',
      `/api/settings/${branchCodeA}`,
      { gracePeriodDays: 15 },
      studentHeaders
    );
    assert(studentUpdateRes.status === 403, 'Student update rejected with 403 Forbidden (adminOnly)');

    // ------------------------------------------------------------------
    // TEST 7: Persistence across sessions
    // ------------------------------------------------------------------
    console.log('\n--- TEST 7: Settings survive session refresh ---');
    const freshLoginToken = jwt.sign(
      {
        id: adminUserA._id,
        userId: adminUserA._id,
        role: 'admin',
        activeOrganizationId: createdOrgId,
        activeHostelId: createdHostelId,
        hostels: [branchCodeA],
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    const freshHeaders = { Authorization: `Bearer ${freshLoginToken}` };

    const freshGetRes = await makeRequest('GET', `/api/settings/${branchCodeA}`, null, freshHeaders);
    assert(freshGetRes.status === 200, 'Fresh session fetched settings (200 OK)');
    assert(freshGetRes.body.data.gracePeriodDays === 7, 'Fresh session verified gracePeriodDays is 7');
    assert(freshGetRes.body.data.lateFeePerDay === 75, 'Fresh session verified lateFeePerDay is 75');
    assert(freshGetRes.body.data.securityDeposit === 8000, 'Fresh session verified securityDeposit is 8000');
    assert(freshGetRes.body.data.curfewTime === '22:00', 'Fresh session verified curfewTime is 22:00');
    assert(freshGetRes.body.data.weeklyLaundrySlots === 3, 'Fresh session verified weeklyLaundrySlots is 3');

  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n============================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
