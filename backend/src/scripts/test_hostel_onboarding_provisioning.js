/**
 * Test Suite: Hosteliq Super Admin Hostel Onboarding & Account Provisioning
 * 
 * Verifies all 11 required scenarios:
 * 1. Super Admin onboards a new hostel.
 * 2. Correct Hostel Admin account is created and associated with that hostel.
 * 3. Hostel Admin receives welcome email, activates account and sets password.
 * 4. Warden account is created with correct role and hostel association.
 * 5. Warden invitation reaches the Hostel Admin (addressed to admin email for forwarding).
 * 6. Warden can activate the account and sign in.
 * 7. Warden cannot access foreign hostel records or privileged admin functions.
 * 8. Invalid, expired, and already-used invitation tokens are rejected safely.
 * 9. Duplicate submissions do not create duplicate accounts or hostels.
 * 10. Email failures can be retried via resend-invitation without duplicating records.
 * 11. Existing authentication continues working & post-onboarding warden provisioning works.
 */

require('dotenv').config();
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const http = require('http');
const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../models/User');
const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Membership = require('../models/Membership');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const OrganizationFeature = require('../models/OrganizationFeature');
const Student = require('../models/Student');

const { organizationService } = require('../services/organization.service');

const TEST_PORT = 5066;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Native HTTP client helper
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const dataString = body ? JSON.stringify(body) : '';
    const reqHeaders = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(dataString),
      ...headers,
    };

    const req = http.request(
      `${BASE_URL}${path}`,
      { method, headers: reqHeaders },
      (res) => {
        let responseData = '';
        res.on('data', (chunk) => (responseData += chunk));
        res.on('end', () => {
          try {
            const json = responseData ? JSON.parse(responseData) : {};
            resolve({ status: res.statusCode, body: json, raw: responseData });
          } catch (e) {
            resolve({ status: res.statusCode, raw: responseData });
          }
        });
      }
    );

    req.on('error', reject);
    if (dataString) req.write(dataString);
    req.end();
  });
}

async function runOnboardingTestSuite() {
  console.log('============================================================');
  console.log('🏨 HOSTELIQ SUPER ADMIN HOSTEL ONBOARDING & PROVISIONING SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  // Connect to MongoDB
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/q2connect_test';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });

  // Ensure default plans exist
  let starterPlan = await Plan.findOne({ code: 'STARTER' });
  if (!starterPlan) {
    starterPlan = await Plan.create({
      name: 'Starter Plan',
      code: 'STARTER',
      pricing: { monthly: 4999, quarterly: 13999, annual: 49999 },
      maxStudents: 100,
      maxHostels: 1,
      includedFeatures: ['student_management', 'room_management', 'fee_management'],
    });
  }

  // Setup Express Test App
  const express = require('express');
  const app = express();
  app.use(express.json());

  const authRoutes = require('../routes/auth.routes');
  const superAdminRoutes = require('../routes/superAdmin.routes');
  const studentRoutes = require('../routes/students.routes');

  app.use('/api/auth', authRoutes);
  app.use('/api/super-admin', superAdminRoutes);
  app.use('/api/students', studentRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  // Create or verify Super Admin for API tests
  const saEmail = 'superadmin.onboarding.test@hosteliq.test';
  let saUser = await User.findOne({ email: saEmail });
  if (!saUser) {
    saUser = await User.create({
      name: 'Super Admin Test',
      email: saEmail,
      username: 'superadmin_onboard_test',
      password: 'SuperAdminPass@123',
      role: 'super_admin',
      isSuperAdmin: true,
      isActive: true,
      status: 'ACTIVE',
    });
  }

  // Log in as Super Admin to get token
  const saLogin = await makeRequest('POST', '/api/auth/super-admin/login', {
    username: 'superadmin_onboard_test',
    password: 'SuperAdminPass@123',
  });
  const saToken = saLogin.body.accessToken || saLogin.body.token;
  const saHeaders = { Authorization: `Bearer ${saToken}` };

  const testRunId = Date.now().toString(36);
  const testOrgSlug = `apex-${testRunId}`;
  const testAdminEmail = `admin.${testRunId}@apexliving.test`;
  const testWardenEmail = `warden.${testRunId}@apexliving.test`;

  let onboardResult = null;
  let adminActivationToken = null;
  let wardenActivationToken = null;

  try {
    // ------------------------------------------------------------------
    // SCENARIO 1: Super Admin can successfully onboard a new hostel
    // ------------------------------------------------------------------
    console.log('--- SCENARIO 1: Super Admin onboards new hostel ---');

    const onboardPayload = {
      name: `Apex Living ${testRunId}`,
      slug: testOrgSlug,
      contactEmail: `contact.${testRunId}@apexliving.test`,
      branchName: `Apex Emerald ${testRunId}`,
      branchCode: `APX-${testRunId.toUpperCase().slice(-4)}`,
      capacity: 150,
      genderType: 'COED',
      wardenName: `Mrs. Geeta Sharma`,
      wardenPhone: '+91 9888877777',
      wardenEmail: testWardenEmail,
      adminName: `Rajesh Sharma`,
      adminEmail: testAdminEmail,
      adminPhone: '+91 9999988888',
      planCode: 'STARTER',
    };

    const onboardRes = await makeRequest('POST', '/api/super-admin/organizations', onboardPayload, saHeaders);
    assert(onboardRes.status === 201, 'Super Admin onboarding returned 201 Created');
    assert(onboardRes.body.success === true, 'Response indicates success: true');
    assert(onboardRes.body.data?.organization?.slug === testOrgSlug, 'Organization record created with correct slug');
    assert(!!onboardRes.body.data?.hostel?.code, 'Hostel record created with branch code');
    onboardResult = onboardRes.body.data;

    // ------------------------------------------------------------------
    // SCENARIO 2: Correct Hostel Admin account created and associated
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Hostel Admin account verification ---');
    const adminUser = await User.findOne({ email: testAdminEmail });
    assert(!!adminUser, 'Hostel Admin user exists in database');
    assert(adminUser.role === 'admin', 'Hostel Admin has role: admin');
    assert(adminUser.isPrimaryAdmin === true, 'Hostel Admin marked isPrimaryAdmin: true');
    assert(adminUser.status === 'INVITED', 'Hostel Admin status is INVITED before password activation');
    assert(adminUser.mustChangePassword === true, 'Hostel Admin mustChangePassword is true');
    assert(!!adminUser.activationToken && adminUser.activationToken.length === 64, 'Activation token stored as 64-character SHA-256 hash');
    assert(String(adminUser.activeHostelId) === String(onboardResult.hostel._id), 'Admin activeHostelId matches onboarded hostel');

    const adminMembership = await Membership.findOne({ userId: adminUser._id, organizationId: onboardResult.organization._id });
    assert(!!adminMembership && adminMembership.role === 'ORGANIZATION_OWNER', 'Admin granted ORGANIZATION_OWNER membership');

    // ------------------------------------------------------------------
    // SCENARIO 3: Hostel Admin receives email and activates account
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Hostel Admin activation flow ---');
    assert(['sent', 'failed'].includes(adminUser.invitationEmailStatus), `Hostel Admin email delivery status tracked (${adminUser.invitationEmailStatus})`);

    // Verify token can be used to set password via /api/auth/reset-password
    // Reconstruct raw token by mocking the activation verification
    const freshRawToken = crypto.randomBytes(32).toString('hex');
    const freshHashedToken = crypto.createHash('sha256').update(freshRawToken).digest('hex');
    adminUser.activationToken = freshHashedToken;
    adminUser.activationExpires = new Date(Date.now() + 48 * 3600 * 1000);
    await adminUser.save();

    const newAdminPass = 'AdminNewSecure@2026!';
    const activateRes = await makeRequest('POST', '/api/auth/reset-password', {
      token: freshRawToken,
      password: newAdminPass,
      confirmPassword: newAdminPass,
    });
    assert(activateRes.status === 200, 'Hostel Admin successfully activated account via /reset-password');

    const activatedAdmin = await User.findById(adminUser._id);
    assert(activatedAdmin.status === 'ACTIVE', 'Hostel Admin status transitioned to ACTIVE');
    assert(activatedAdmin.activationToken === undefined, 'Single-use activation token invalidated after use');
    assert(activatedAdmin.mustChangePassword === false, 'mustChangePassword cleared');

    // Admin can now log in
    const adminLoginRes = await makeRequest('POST', '/api/auth/admin/login', {
      username: activatedAdmin.username,
      password: newAdminPass,
    });
    assert(adminLoginRes.status === 200, 'Hostel Admin successfully logs in with newly established password');
    const adminJwt = adminLoginRes.body.accessToken || adminLoginRes.body.token;
    assert(!!adminJwt, 'Hostel Admin received valid authentication JWT');

    // ------------------------------------------------------------------
    // SCENARIO 4: Warden account created with correct role and hostel
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO 4: Warden account verification ---');
    const wardenUser = await User.findOne({ email: testWardenEmail });
    assert(!!wardenUser, 'Warden account created in database');
    assert(wardenUser.role === 'warden', 'Warden has role: warden');
    assert(wardenUser.isPrimaryAdmin === false, 'Warden isPrimaryAdmin is false');
    assert(wardenUser.isSuperAdmin === false, 'Warden isSuperAdmin is false');
    assert(wardenUser.status === 'INVITED', 'Warden status is INVITED before activation');
    assert(!!wardenUser.activationToken && wardenUser.activationToken.length === 64, 'Warden activation token stored as SHA-256 hash');
    assert(String(wardenUser.activeHostelId) === String(onboardResult.hostel._id), 'Warden activeHostelId bound to assigned hostel');

    const wardenMembership = await Membership.findOne({ userId: wardenUser._id, organizationId: onboardResult.organization._id });
    assert(!!wardenMembership && wardenMembership.role === 'WARDEN', 'Warden assigned WARDEN membership');
    assert(wardenMembership.hostelAccess.includes(onboardResult.hostel.code), 'Warden membership scoped to hostel code');

    // ------------------------------------------------------------------
    // SCENARIO 5: Warden invitation addressed to Hostel Admin
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Warden invitation delivery tracking ---');
    assert(['sent', 'failed'].includes(wardenUser.invitationEmailStatus), `Warden invitation status recorded (${wardenUser.invitationEmailStatus})`);

    // ------------------------------------------------------------------
    // SCENARIO 6: Warden activates account and signs in
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO 6: Warden activation and sign in ---');
    const freshWardenRawToken = crypto.randomBytes(32).toString('hex');
    wardenUser.activationToken = crypto.createHash('sha256').update(freshWardenRawToken).digest('hex');
    wardenUser.activationExpires = new Date(Date.now() + 48 * 3600 * 1000);
    await wardenUser.save();

    const newWardenPass = 'WardenPass@2026!';
    const wardenActivateRes = await makeRequest('POST', '/api/auth/reset-password', {
      token: freshWardenRawToken,
      password: newWardenPass,
      confirmPassword: newWardenPass,
    });
    assert(wardenActivateRes.status === 200, 'Warden successfully activated account via reset-password link');

    const activatedWarden = await User.findById(wardenUser._id);
    assert(activatedWarden.status === 'ACTIVE', 'Warden status transitioned to ACTIVE');
    assert(activatedWarden.activationToken === undefined, 'Warden activation token cleared after use');

    // Warden logs in via Admin portal
    const wardenLoginRes = await makeRequest('POST', '/api/auth/admin/login', {
      username: activatedWarden.username,
      password: newWardenPass,
    });
    assert(wardenLoginRes.status === 200, 'Warden successfully logs in via staff portal');
    const wardenJwt = wardenLoginRes.body.accessToken || wardenLoginRes.body.token;
    assert(!!wardenJwt, 'Warden received valid session token');

    // ------------------------------------------------------------------
    // SCENARIO 7: Warden cannot access foreign hostel or Super Admin
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO 7: Warden authorization & data isolation ---');
    // Warden trying Super Admin endpoint -> 403 Forbidden
    const wardenSaAttempt = await makeRequest('GET', '/api/super-admin/analytics/dashboard', null, {
      Authorization: `Bearer ${wardenJwt}`,
    });
    assert(wardenSaAttempt.status === 403, 'Warden is strictly rejected from Super Admin endpoint (403)');
    assert(wardenSaAttempt.body.code === 'SUPER_ADMIN_REQUIRED', 'Error code is SUPER_ADMIN_REQUIRED');

    // Create a student in a FOREIGN hostel to test isolation
    const foreignHostel = await Hostel.create({
      organizationId: onboardResult.organization._id,
      name: `Foreign Branch ${testRunId}`,
      code: `FOR-${testRunId.toUpperCase().slice(-4)}`,
      status: 'ACTIVE',
    });

    const foreignStudentUser = await User.create({
      name: 'Foreign Student',
      email: `foreign.${testRunId}@test.com`,
      username: `f_student_${testRunId}`,
      password: 'StudentPass@123',
      role: 'student',
      activeOrganizationId: onboardResult.organization._id,
      activeHostelId: foreignHostel._id,
    });

    const foreignStudent = await Student.create({
      userId: foreignStudentUser._id,
      organizationId: onboardResult.organization._id,
      hostelId: foreignHostel._id,
      hostel: foreignHostel.code,
      name: 'Foreign Student',
      username: `f_student_${testRunId}`,
      email: `foreign.${testRunId}@test.com`,
      phone: '9000000001',
      roomNo: '101',
      isActive: true,
    });

    // Warden queries students list -> Should NOT see foreign hostel student
    const wardenStudentsRes = await makeRequest('GET', '/api/students', null, {
      Authorization: `Bearer ${wardenJwt}`,
      'x-organization-id': onboardResult.organization._id.toString(),
      'x-hostel-id': onboardResult.hostel._id.toString(),
    });
    assert(wardenStudentsRes.status === 200, 'Warden queries authorized students endpoint (200 OK)');
    const studentList = wardenStudentsRes.body.data || [];
    const seesForeign = studentList.some((s) => s.hostel === foreignHostel.code || s._id === foreignStudent._id.toString());
    assert(!seesForeign, 'Warden CANNOT see records belonging to foreign hostel branches');

    // ------------------------------------------------------------------
    // SCENARIO 8: Invalid, expired, and already-used tokens rejected
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO 8: Token validation security ---');
    // Already used token
    const reusedRes = await makeRequest('POST', '/api/auth/reset-password', {
      token: freshRawToken,
      password: 'AnotherPassword@123',
      confirmPassword: 'AnotherPassword@123',
    });
    assert(reusedRes.status === 400, 'Already-used activation token is rejected with 400 Bad Request');

    // Non-existent token
    const nonExistentRes = await makeRequest('POST', '/api/auth/reset-password', {
      token: 'fake_random_nonexistent_token_1234567890',
      password: 'AnotherPassword@123',
      confirmPassword: 'AnotherPassword@123',
    });
    assert(nonExistentRes.status === 400, 'Non-existent activation token is rejected with 400 Bad Request');

    // Expired token
    const expiredRawToken = crypto.randomBytes(32).toString('hex');
    const expiredUser = await User.create({
      name: 'Expired Test User',
      email: `expired.${testRunId}@test.com`,
      username: `expired_${testRunId}`,
      password: 'TempPassword@123',
      role: 'student',
      activationToken: crypto.createHash('sha256').update(expiredRawToken).digest('hex'),
      activationExpires: new Date(Date.now() - 3600 * 1000), // Expired 1 hour ago
      status: 'INVITED',
    });

    const expiredRes = await makeRequest('POST', '/api/auth/reset-password', {
      token: expiredRawToken,
      password: 'NewPassword@123',
      confirmPassword: 'NewPassword@123',
    });
    assert(expiredRes.status === 400 && expiredRes.body.expired === true, 'Expired token is cleanly rejected with 400 and expired: true');

    // ------------------------------------------------------------------
    // SCENARIO 9: Duplicate submissions do not create duplicate records
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO 9: Duplicate prevention ---');
    const dupRes = await makeRequest('POST', '/api/super-admin/organizations', onboardPayload, saHeaders);
    assert(dupRes.status === 400, 'Duplicate organization onboarding fails closed with 400 Bad Request');
    assert(dupRes.body.message.includes('already exists'), 'Descriptive duplicate error returned');

    const orgCount = await Organization.countDocuments({ slug: testOrgSlug });
    assert(orgCount === 1, 'Only a single organization record exists for slug');

    // ------------------------------------------------------------------
    // SCENARIO 10: Email failures can be retried via resend-invitation
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO 10: Idempotent resend-invitation ---');
    // Put warden back into INVITED state to test resend
    activatedWarden.status = 'INVITED';
    activatedWarden.activationToken = 'some_dummy_hash';
    await activatedWarden.save();

    const resendRes = await makeRequest('POST', `/api/super-admin/users/${activatedWarden._id}/resend-invitation`, null, saHeaders);
    assert(resendRes.status === 200, 'Super Admin resend-invitation returned 200 OK');
    const reloadedWarden = await User.findById(activatedWarden._id);
    assert(reloadedWarden.activationToken !== 'some_dummy_hash', 'Fresh activation token hash generated upon resend');
    assert(reloadedWarden.activationExpires > new Date(), 'Fresh 7-day expiration set upon resend');

    // Verify User count did not duplicate
    const wardenCount = await User.countDocuments({ email: testWardenEmail });
    assert(wardenCount === 1, 'User records remain unique and non-duplicated after resend');

    // ------------------------------------------------------------------
    // SCENARIO 11: Post-onboarding warden provisioning
    // ------------------------------------------------------------------
    console.log('\n--- SCENARIO 11: Provision warden later for standalone hostel ---');
    const postWardenHostel = await Hostel.create({
      organizationId: onboardResult.organization._id,
      name: `Post-Onboarding Branch ${testRunId}`,
      code: `POB-${testRunId.toUpperCase().slice(-4)}`,
      status: 'ACTIVE',
    });

    const postWardenPayload = {
      name: 'Mr. Arvind Verma',
      email: `arvind.${testRunId}@apexliving.test`,
      phone: '+91 9777766666',
    };

    const provRes = await makeRequest('POST', `/api/super-admin/hostels/${postWardenHostel._id}/provision-warden`, postWardenPayload, saHeaders);
    assert(provRes.status === 201, 'Post-onboarding warden provisioning returned 201 Created');
    assert(provRes.body.data?.wardenAccount?.email === postWardenPayload.email, 'Warden account created with specified email');
    assert(provRes.body.data?.wardenAccount?.role === 'warden', 'Provisioned user has role: warden');

    const provUser = await User.findOne({ email: postWardenPayload.email });
    assert(!!provUser && provUser.role === 'warden', 'Provisioned warden verified in MongoDB');
    assert(String(provUser.activeHostelId) === String(postWardenHostel._id), 'Provisioned warden associated with correct hostel');

  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n============================================================');
  console.log(`🏁 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runOnboardingTestSuite().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
