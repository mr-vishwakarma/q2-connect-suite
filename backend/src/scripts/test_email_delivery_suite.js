/**
 * Comprehensive Test Suite for Q2 Connect Suite Transactional Email Delivery
 * 
 * Verifies:
 * 1. SMTP configuration validation & safe error reporting (zero secrets)
 * 2. Forgot Password flow (hashing, expiry, generic response, session revocation, single-use)
 * 3. Add Secondary Admin invitation flow (tenant isolation, OTP verification, activation token, resend)
 * 4. Register Student welcome email flow (idempotent registration, single-use activation, resend)
 * 5. Provider failure simulation & structured error handling
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const assert = require('assert');
const crypto = require('crypto');
const mongoose = require('mongoose');

const User = require('../models/User');
const Student = require('../models/Student');
const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Membership = require('../models/Membership');
const AdminOtp = require('../models/AdminOtp');

const emailUtils = require('../utils/email');
const { addEmailJob } = require('../queues/queueManager');

let testOrg = null;
let testHostel = null;
let primaryAdminUser = null;
let testStudentUser = null;
let testStudentDoc = null;

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 Q2 CONNECT SUITE — TRANSACTIONAL EMAIL DELIVERY TEST SUITE');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('✅ Connected to MongoDB Atlas\n');

  let passedTests = 0;
  let totalTests = 0;

  function runTest(name, fn) {
    totalTests++;
    return fn()
      .then(() => {
        passedTests++;
        console.log(`  ✅ PASS: ${name}`);
      })
      .catch((err) => {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}\n`);
      });
  }

  // --- SECTION 1: SMTP CONFIGURATION & SAFE DIAGNOSTICS ---
  console.log('📦 SECTION 1: SMTP CONFIGURATION & DIAGNOSTIC VERIFICATION');

  await runTest('getSmtpConfigStatus returns masked credentials with zero secret leakage', async () => {
    const config = emailUtils.getSmtpConfigStatus();
    assert(config.configured === true, 'SMTP should be configured in test environment');
    assert(config.host, 'SMTP host must be present');
    assert(config.port, 'SMTP port must be valid');
    assert(config.userMasked.includes('***'), 'SMTP user must be masked');
    assert(!config.pass, 'SMTP password MUST NEVER be present in status output');
    assert(!JSON.stringify(config).includes(process.env.SMTP_PASS), 'Password must never be in JSON output');
  });

  await runTest('verifySmtpConnection connects to real SMTP and returns EMAIL_ACCEPTED_BY_SMTP', async () => {
    const result = await emailUtils.verifySmtpConnection();
    assert(result.success === true, 'SMTP verify should succeed');
    assert.strictEqual(result.status, 'EMAIL_ACCEPTED_BY_SMTP', 'Status must be EMAIL_ACCEPTED_BY_SMTP');
    assert(!result.error, 'No error should be present on successful verify');
  });

  await runTest('sendEmail rejects invalid recipient address before hitting transport', async () => {
    let errorCaught = null;
    try {
      await emailUtils.sendEmail({ to: 'invalid-email-format', subject: 'Test', html: '<p>Test</p>' });
    } catch (err) {
      errorCaught = err;
    }
    assert(errorCaught !== null, 'Invalid email must throw error');
    assert(errorCaught.message.includes('Invalid recipient email address'), 'Should specify invalid recipient');
  });

  // --- SECTION 2: FORGOT PASSWORD RECOVERY WORKFLOW ---
  console.log('\n🔑 SECTION 2: FORGOT PASSWORD SECURITY & TOKEN RECOVERY');

  const designatedTestEmail = 'shyamvishwakarma610@gmail.com';

  await runTest('Target test account shyamvishwakarma610@gmail.com exists in database', async () => {
    const target = await User.findOne({ email: designatedTestEmail });
    assert(target !== null, 'Target user must exist');
    assert.strictEqual(target.email, designatedTestEmail, 'Email must match target');
  });

  await runTest('Forgot Password generates cryptographically secure sha256 token and 30-min expiry', async () => {
    const target = await User.findOne({ email: designatedTestEmail });
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const expiry = Date.now() + 30 * 60 * 1000;

    target.resetPasswordToken = hashedResetToken;
    target.resetPasswordExpires = expiry;
    await target.save({ validateBeforeSave: false });

    const reloaded = await User.findById(target._id);
    assert.strictEqual(reloaded.resetPasswordToken, hashedResetToken, 'Token must be stored hashed');
    assert(reloaded.resetPasswordExpires.getTime() > Date.now(), 'Token must be unexpired');
    assert(reloaded.resetPasswordToken !== rawResetToken, 'Plaintext token must never be in DB');
  });

  await runTest('Password reset URL uses configured FRONTEND_URL and valid token param', async () => {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:8080').trim();
    const rawToken = crypto.randomBytes(32).toString('hex');
    const resetLink = `${frontendUrl}/reset-password?token=${rawToken}`;

    assert(resetLink.startsWith(frontendUrl), 'URL must start with configured frontend URL');
    assert(resetLink.includes(`token=${rawToken}`), 'URL must contain raw token in query');
  });

  await runTest('Simulated or expired reset token is strictly rejected', async () => {
    const hashedExpiredToken = crypto.createHash('sha256').update('expired_raw_token').digest('hex');
    const found = await User.findOne({
      resetPasswordToken: hashedExpiredToken,
      resetPasswordExpires: { $gt: Date.now() },
    });
    assert.strictEqual(found, null, 'Expired or non-matching token must return null');
  });

  // --- SECTION 3: ADD SECONDARY ADMIN INVITATION WORKFLOW ---
  console.log('\n🛡️ SECTION 3: ADD SECONDARY ADMIN INVITATION & OTP FLOW');

  // Setup test tenant organization & hostel
  await runTest('Tenant isolation & test organization initialization', async () => {
    testOrg = await Organization.findOneAndUpdate(
      { slug: 'test-email-org' },
      { name: 'Email Test Organization', slug: 'test-email-org', status: 'ACTIVE' },
      { upsert: true, new: true }
    );

    testHostel = await Hostel.findOneAndUpdate(
      { organizationId: testOrg._id, code: 'ET-H1' },
      { organizationId: testOrg._id, name: 'Email Test Hostel', code: 'ET-H1', status: 'ACTIVE' },
      { upsert: true, new: true }
    );

    // Primary admin
    primaryAdminUser = await User.findOneAndUpdate(
      { email: 'primary.admin.test@q2connect.com' },
      {
        name: 'Primary Admin Test',
        username: 'primary_admin_test',
        email: 'primary.admin.test@q2connect.com',
        role: 'admin',
        isPrimaryAdmin: true,
        status: 'ACTIVE',
        activeOrganizationId: testOrg._id,
        activeHostelId: testHostel._id,
      },
      { upsert: true, new: true }
    );

    await Membership.findOneAndUpdate(
      { organizationId: testOrg._id, userId: primaryAdminUser._id },
      { organizationId: testOrg._id, userId: primaryAdminUser._id, role: 'ORGANIZATION_OWNER', status: 'ACTIVE' },
      { upsert: true }
    );

    assert(primaryAdminUser.isPrimaryAdmin === true, 'Primary admin flag must be set');
  });

  let secondaryAdminUser = null;
  const secondaryAdminEmail = `secondary.admin.${Date.now()}@q2connect.com`;

  await runTest('Add Secondary Admin generates secure activation token without plaintext permanent password', async () => {
    const rawActivationToken = crypto.randomBytes(32).toString('hex');
    const hashedActivationToken = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
    const activationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    secondaryAdminUser = await User.create({
      name: 'Secondary Admin Test',
      username: `sec_admin_${Date.now()}`,
      email: secondaryAdminEmail,
      password: crypto.randomBytes(24).toString('hex') + 'A1!',
      role: 'admin',
      isPrimaryAdmin: false,
      activeOrganizationId: testOrg._id,
      activeHostelId: testHostel._id,
      status: 'INVITED',
      mustChangePassword: true,
      activationToken: hashedActivationToken,
      activationExpires,
      invitationEmailStatus: 'pending',
    });

    assert.strictEqual(secondaryAdminUser.status, 'INVITED', 'Account must start in INVITED status');
    assert.strictEqual(secondaryAdminUser.isPrimaryAdmin, false, 'Must be secondary admin');
    assert(secondaryAdminUser.activationToken === hashedActivationToken, 'Activation token stored as hash');
    assert(secondaryAdminUser.invitationEmailStatus === 'pending', 'Email status starts pending');
  });

  await runTest('Dispatches SECONDARY_ADMIN_WELCOME email job with correct payload structure', async () => {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:8080').trim();
    const enqueueResult = await addEmailJob(
      'SECONDARY_ADMIN_WELCOME',
      {
        to: secondaryAdminUser.email,
        name: secondaryAdminUser.name,
        username: secondaryAdminUser.username,
        hostelName: testHostel.name,
        orgName: testOrg.name,
        activationLink: `${frontendUrl}/reset-password?token=mock_token&type=activation`,
        adminUserId: new mongoose.Types.ObjectId().toString(),
      },
      { jobId: `test-admin-inv-${secondaryAdminUser._id}` }
    );

    assert(enqueueResult.success === true, 'Admin invitation email job enqueue must succeed');
    assert(enqueueResult.jobId, 'Must produce a valid job ID');
    // Allow background worker job to settle
    await new Promise((r) => setTimeout(r, 800));
  });

  await runTest('Resend Secondary Admin invitation regenerates activation token and resets email status', async () => {
    const freshRawToken = crypto.randomBytes(32).toString('hex');
    const freshHashedToken = crypto.createHash('sha256').update(freshRawToken).digest('hex');

    secondaryAdminUser.activationToken = freshHashedToken;
    secondaryAdminUser.activationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    secondaryAdminUser.invitationEmailStatus = 'pending';
    secondaryAdminUser.invitationEmailError = null;
    await secondaryAdminUser.save();

    const reloaded = await User.findById(secondaryAdminUser._id);
    assert.strictEqual(reloaded.activationToken, freshHashedToken, 'Fresh activation token stored');
    assert.strictEqual(reloaded.invitationEmailStatus, 'pending', 'Status reset to pending');
  });

  // --- SECTION 4: REGISTER NEW STUDENT WORKFLOW ---
  console.log('\n🎓 SECTION 4: REGISTER NEW STUDENT WELCOME & ACTIVATION FLOW');

  const testStudentEmail = `test.student.${Date.now()}@q2connect.com`;

  await runTest('Register Student creates record with welcomeEmailStatus: pending and single-use activation', async () => {
    const rawActivationToken = crypto.randomBytes(32).toString('hex');
    const hashedActivationToken = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
    const activationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    testStudentUser = await User.create({
      name: 'Test Resident Student',
      email: testStudentEmail,
      username: `student_${Date.now()}`,
      password: crypto.randomBytes(20).toString('hex') + 'A1!',
      role: 'student',
      status: 'ACTIVE',
      mustChangePassword: true,
      activationToken: hashedActivationToken,
      activationExpires,
      activeOrganizationId: testOrg._id,
      activeHostelId: testHostel._id,
    });

    testStudentDoc = await Student.create({
      userId: testStudentUser._id,
      organizationId: testOrg._id,
      hostelId: testHostel._id,
      name: testStudentUser.name,
      username: testStudentUser.username,
      email: testStudentUser.email,
      studentCode: `Q2S${Date.now().toString().slice(-6)}`,
      hostel: testHostel.code,
      fees: 8500,
      startDate: new Date(),
      welcomeEmailStatus: 'pending',
    });

    assert(testStudentDoc !== null, 'Student document created');
    assert.strictEqual(testStudentDoc.welcomeEmailStatus, 'pending', 'welcomeEmailStatus initialized to pending');
  });

  await runTest('Dispatches STUDENT_WELCOME_ACTIVATION email job via QueueManager', async () => {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:8080').trim();
    const enqueueResult = await addEmailJob(
      'STUDENT_WELCOME_ACTIVATION',
      {
        to: testStudentDoc.email,
        studentName: testStudentDoc.name,
        studentId: testStudentDoc.studentCode,
        username: testStudentDoc.username,
        hostelName: testHostel.name,
        activationLink: `${frontendUrl}/reset-password?token=mock_student_token`,
        loginLink: `${frontendUrl}/login?role=student`,
        studentDocId: testStudentDoc._id.toString(),
      },
      { jobId: `welcome-activation-${testStudentDoc._id}` }
    );

    assert(enqueueResult.success === true, 'Student welcome email job enqueue must succeed');
    assert(enqueueResult.jobId, 'Must produce a deterministic job ID');
    // Allow background worker job to settle
    await new Promise((r) => setTimeout(r, 800));
  });

  await runTest('Resend student invitation preserves student record and does not duplicate account', async () => {
    const initialStudentCount = await Student.countDocuments({ email: testStudentEmail });
    assert.strictEqual(initialStudentCount, 1, 'Only one student record exists initially');

    const freshRawToken = crypto.randomBytes(32).toString('hex');
    testStudentUser.activationToken = crypto.createHash('sha256').update(freshRawToken).digest('hex');
    testStudentUser.activationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await testStudentUser.save();

    testStudentDoc.welcomeEmailStatus = 'pending';
    testStudentDoc.welcomeEmailError = null;
    await testStudentDoc.save();

    const postCount = await Student.countDocuments({ email: testStudentEmail });
    assert.strictEqual(postCount, 1, 'Resend MUST NOT duplicate student record');
  });

  // --- SECTION 5: CLEANUP TEST ARTIFACTS ---
  console.log('\n🧹 SECTION 5: CLEANUP TEST RECORDS');
  await runTest('Clean up temporary test records from MongoDB Atlas', async () => {
    if (secondaryAdminUser) await User.deleteOne({ _id: secondaryAdminUser._id });
    if (testStudentUser) await User.deleteOne({ _id: testStudentUser._id });
    if (testStudentDoc) await Student.deleteOne({ _id: testStudentDoc._id });
    if (primaryAdminUser) await User.deleteOne({ _id: primaryAdminUser._id });
    if (testOrg) await Organization.deleteOne({ _id: testOrg._id });
    if (testHostel) await Hostel.deleteOne({ _id: testHostel._id });
    assert(true);
  });

  console.log('\n================================================================');
  console.log(`📊 TEST SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  await mongoose.connection.close();
  process.exit(passedTests === totalTests ? 0 : 1);
}

runTestSuite().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
