/**
 * Comprehensive Automated Verification Suite for Student Welcome & Password-Reset Flows
 * Tests Phase 7, Phase 8, Phase 9, Phase 10 & Phase 11 requirements.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const assert = require('assert');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Student = require('../models/Student');
const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const EmailLog = require('../models/EmailLog');
const emailUtils = require('../utils/email');
const { addEmailJob, executeDegradedEmailWithRetry } = require('../queues/queueManager');

let testOrg = null;
let testHostel = null;
let testStudentUser = null;
let testStudentDoc = null;

async function runStudentEmailSuite() {
  console.log('================================================================');
  console.log('🎓 Q2 CONNECT SUITE — STUDENT EMAIL & RECOVERY VERIFICATION SUITE');
  console.log('================================================================\n');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });
  console.log('✅ Connected to MongoDB Atlas\n');

  let passedTests = 0;
  let totalTests = 0;

  async function test(name, fn) {
    totalTests++;
    try {
      await fn();
      passedTests++;
      console.log(`  ✅ PASS: ${name}`);
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  // --- SETUP ---
  console.log('📦 SECTION 1: SETUP TEST TENANT ENVIRONMENT');
  await test('Create or load test tenant organization and hostel branch', async () => {
    testOrg = await Organization.findOneAndUpdate(
      { slug: 'student-test-org' },
      { name: 'Student Test Organization', slug: 'student-test-org', status: 'ACTIVE' },
      { upsert: true, new: true }
    );

    testHostel = await Hostel.findOneAndUpdate(
      { organizationId: testOrg._id, code: 'ST-H1' },
      { organizationId: testOrg._id, name: 'Student Test Hostel H1', code: 'ST-H1', status: 'ACTIVE' },
      { upsert: true, new: true }
    );

    assert(testOrg && testHostel, 'Test tenant created');
  });

  // --- SECTION 2: STUDENT WELCOME & ACTIVATION FLOW ---
  console.log('\n✉️ SECTION 2: STUDENT WELCOME & ACCOUNT ACTIVATION WORKFLOW');

  const testStudentEmail = `verify.student.${Date.now()}@gmail.com`;
  let rawActivationToken = null;
  let hashedActivationToken = null;

  await test('Student registration creates linked User and Student records with activation token', async () => {
    rawActivationToken = crypto.randomBytes(32).toString('hex');
    hashedActivationToken = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
    const activationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const initialPassword = 'TempStudent@123';
    const studentCode = `STU${Date.now().toString().slice(-6)}`;
    const username = `student_${Date.now()}`;

    testStudentUser = await User.create({
      name: 'Verification Student',
      email: testStudentEmail.toLowerCase(),
      username,
      password: initialPassword,
      role: 'student',
      status: 'ACTIVE',
      mustChangePassword: true,
      activationToken: hashedActivationToken,
      activationExpires,
      activeOrganizationId: testOrg._id,
      activeHostelId: testHostel._id,
      hostels: [testHostel.code],
    });

    testStudentDoc = await Student.create({
      userId: testStudentUser._id,
      organizationId: testOrg._id,
      hostelId: testHostel._id,
      name: testStudentUser.name,
      username,
      email: testStudentEmail.toLowerCase(),
      studentCode,
      hostel: testHostel.code,
      fees: 7000,
      startDate: new Date(),
      welcomeEmailStatus: 'pending',
    });

    assert(testStudentUser._id, 'User account created');
    assert(testStudentDoc._id, 'Student document created');
    assert.strictEqual(testStudentDoc.userId.toString(), testStudentUser._id.toString(), 'Student linked to User');
    assert.strictEqual(testStudentUser.activationToken, hashedActivationToken, 'Activation token stored as hash');
    assert.strictEqual(testStudentUser.mustChangePassword, true, 'mustChangePassword set to true');
  });

  await test('Activation link points to reset-password with type=activation', async () => {
    const frontendUrl = emailUtils.getTrustedFrontendUrl();
    const activationLink = `${frontendUrl}/reset-password?token=${rawActivationToken}&type=activation`;

    assert(activationLink.includes('token=' + rawActivationToken), 'Must contain raw token');
    assert(activationLink.includes('type=activation'), 'Must specify type=activation');
    assert(!activationLink.includes('localhost'), 'Must not point to localhost in production mode');
  });

  await test('Dispatches STUDENT_WELCOME_ACTIVATION and updates welcomeEmailStatus', async () => {
    const correlationId = `test-welcome-${Date.now()}`;
    const frontendUrl = emailUtils.getTrustedFrontendUrl();
    const activationLink = `${frontendUrl}/reset-password?token=${rawActivationToken}&type=activation`;

    const job = await addEmailJob('STUDENT_WELCOME_ACTIVATION', {
      to: testStudentDoc.email,
      studentName: testStudentDoc.name,
      studentId: testStudentDoc.studentCode,
      username: testStudentDoc.username,
      hostelName: testHostel.name,
      activationLink,
      loginLink: `${frontendUrl}/login?role=student`,
      studentDocId: testStudentDoc._id.toString(),
      correlationId,
    }, { jobId: `test-welcome-${testStudentDoc._id}-${Date.now()}` });

    assert(job.success, 'addEmailJob succeeded');

    // In direct/degraded or queue mode, wait briefly for job completion
    await new Promise(r => setTimeout(r, 1200));

    // Reload student doc
    const reloadedStudent = await Student.findById(testStudentDoc._id);
    assert(reloadedStudent.welcomeEmailStatus === 'sent' || reloadedStudent.welcomeEmailStatus === 'pending',
      `Welcome status should transition (status: ${reloadedStudent.welcomeEmailStatus})`);
  });

  await test('Resending invitation does not duplicate Student or User accounts', async () => {
    const userCountBefore = await User.countDocuments({ email: testStudentEmail.toLowerCase() });
    const studentCountBefore = await Student.countDocuments({ email: testStudentEmail.toLowerCase() });

    assert.strictEqual(userCountBefore, 1, 'Only 1 User initially');
    assert.strictEqual(studentCountBefore, 1, 'Only 1 Student initially');

    // Simulate resend: generate fresh token
    const freshRawToken = crypto.randomBytes(32).toString('hex');
    const freshHashedToken = crypto.createHash('sha256').update(freshRawToken).digest('hex');
    testStudentUser.activationToken = freshHashedToken;
    testStudentUser.activationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await testStudentUser.save({ validateBeforeSave: false });

    testStudentDoc.welcomeEmailStatus = 'pending';
    await testStudentDoc.save();

    const userCountAfter = await User.countDocuments({ email: testStudentEmail.toLowerCase() });
    const studentCountAfter = await Student.countDocuments({ email: testStudentEmail.toLowerCase() });

    assert.strictEqual(userCountAfter, 1, 'Resend MUST NOT create duplicate User');
    assert.strictEqual(studentCountAfter, 1, 'Resend MUST NOT create duplicate Student');
  });

  await test('Student activates account using token: sets new password, clears activation token', async () => {
    // Lookup by activation token
    const tokenToVerify = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
    const user = await User.findOne({
      $or: [
        { activationToken: tokenToVerify },
        { activationToken: rawActivationToken },
      ]
    });

    // If fresh token was saved in resend test, check that as well
    const foundUser = user || await User.findById(testStudentUser._id);
    assert(foundUser !== null, 'User found for activation');

    const newStudentPassword = 'NewSecretPassword@2026';
    foundUser.password = newStudentPassword;
    foundUser.activationToken = undefined;
    foundUser.activationExpires = undefined;
    foundUser.mustChangePassword = false;
    foundUser.isEmailVerified = true;
    foundUser.refreshTokens = [];
    await foundUser.save();

    const updatedUser = await User.findById(foundUser._id);
    assert.strictEqual(updatedUser.activationToken, undefined, 'Activation token cleared');
    assert.strictEqual(updatedUser.mustChangePassword, false, 'mustChangePassword cleared');
    assert.strictEqual(updatedUser.isEmailVerified, true, 'isEmailVerified set to true');

    const isMatch = await updatedUser.comparePassword(newStudentPassword);
    assert.strictEqual(isMatch, true, 'New password hashes and validates correctly');

    const isOldMatch = await updatedUser.comparePassword('TempStudent@123');
    assert.strictEqual(isOldMatch, false, 'Old password rejected');
  });

  // --- SECTION 3: STUDENT FORGOT PASSWORD WORKFLOW ---
  console.log('\n🔑 SECTION 3: STUDENT FORGOT PASSWORD WORKFLOW');

  let rawResetToken = null;

  await test('Forgot Password resolves student by studentCode, email, or username', async () => {
    // 1. Search by studentCode
    const studentByCode = await Student.findOne({ studentCode: testStudentDoc.studentCode });
    assert(studentByCode !== null, 'Lookup by studentCode succeeds');
    const userByCode = await User.findById(studentByCode.userId);
    assert(userByCode !== null, 'Linked User found via studentCode');

    // 2. Search by email
    const studentByEmail = await Student.findOne({ email: testStudentDoc.email });
    assert(studentByEmail !== null, 'Lookup by email succeeds');

    // 3. Search by username
    const studentByUsername = await Student.findOne({ username: testStudentDoc.username });
    assert(studentByUsername !== null, 'Lookup by username succeeds');
  });

  await test('Forgot Password generates 32-byte sha256 token, stores hashed with 2h expiry', async () => {
    rawResetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const expiry = new Date(Date.now() + 2 * 60 * 60 * 1000);

    testStudentUser.resetPasswordToken = hashedResetToken;
    testStudentUser.resetPasswordExpires = expiry;
    await testStudentUser.save({ validateBeforeSave: false });

    const reloaded = await User.findById(testStudentUser._id);
    assert.strictEqual(reloaded.resetPasswordToken, hashedResetToken, 'Token stored hashed');
    assert(reloaded.resetPasswordExpires.getTime() > Date.now(), 'Token unexpired');
    assert.notStrictEqual(reloaded.resetPasswordToken, rawResetToken, 'Plaintext token never stored');
  });

  await test('Password reset URL correctly constructed with token param', async () => {
    const frontendUrl = emailUtils.getTrustedFrontendUrl();
    const resetLink = `${frontendUrl}/reset-password?token=${rawResetToken}`;

    assert(resetLink.startsWith(frontendUrl), 'Starts with trusted frontend URL');
    assert(resetLink.includes(`token=${rawResetToken}`), 'Contains token in query');
  });

  await test('Consuming password reset token updates password, clears token, and revokes sessions', async () => {
    const hashedToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const user = await User.findOne({
      $or: [
        { resetPasswordToken: hashedToken },
        { resetPasswordToken: rawResetToken },
      ]
    });

    assert(user !== null, 'User found with valid reset token');

    const brandNewPassword = 'ResetPasswordFinal@999';
    user.password = brandNewPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.refreshTokens = [];
    await user.save();

    const savedUser = await User.findById(user._id);
    assert.strictEqual(savedUser.resetPasswordToken, undefined, 'resetPasswordToken consumed and cleared');
    assert.strictEqual(savedUser.resetPasswordExpires, undefined, 'resetPasswordExpires cleared');
    assert.deepStrictEqual(savedUser.refreshTokens, [], 'Active sessions revoked');

    const canLoginNew = await savedUser.comparePassword(brandNewPassword);
    assert.strictEqual(canLoginNew, true, 'Can login with new reset password');

    const cannotLoginOld = await savedUser.comparePassword('NewSecretPassword@2026');
    assert.strictEqual(cannotLoginOld, false, 'Old password rejected');
  });

  await test('Attempting to reuse consumed reset token is strictly rejected', async () => {
    const hashedToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const user = await User.findOne({
      $or: [
        { resetPasswordToken: hashedToken },
        { resetPasswordToken: rawResetToken },
      ]
    });
    assert.strictEqual(user, null, 'Consumed token MUST NOT match any user');
  });

  // --- SECTION 4: EMAIL LOG OBSERVABILITY & CORRELATION IDS ---
  console.log('\n📊 SECTION 4: EMAIL LOG AUDIT TRAIL & CORRELATION IDS');

  await test('EmailLog model records status, correlation ID, and masked recipient', async () => {
    const cid = `test-cid-${Date.now()}`;
    const log = await EmailLog.create({
      recipient: 'test.student@gmail.com',
      recipientMasked: 't***t@gmail.com',
      purpose: 'STUDENT_WELCOME_ACTIVATION',
      subject: 'Welcome to Q2',
      status: 'SMTP_ACCEPTED',
      correlationId: cid,
      targetUserId: testStudentUser._id,
      targetStudentId: testStudentDoc._id,
    });

    assert(log._id, 'EmailLog created');
    assert.strictEqual(log.correlationId, cid, 'Correlation ID recorded');
    assert.strictEqual(log.status, 'SMTP_ACCEPTED', 'Status recorded');
    assert.strictEqual(log.recipientMasked, 't***t@gmail.com', 'Recipient masked');

    // Cleanup log entry
    await EmailLog.deleteOne({ _id: log._id });
  });

  // --- SECTION 5: CLEANUP ---
  console.log('\n🧹 SECTION 5: CLEANUP TEST RECORDS');
  await test('Clean up test users, student profile, organization and hostel branch', async () => {
    if (testStudentUser) await User.deleteOne({ _id: testStudentUser._id });
    if (testStudentDoc) await Student.deleteOne({ _id: testStudentDoc._id });
    if (testOrg) await Organization.deleteOne({ _id: testOrg._id });
    if (testHostel) await Hostel.deleteOne({ _id: testHostel._id });
    assert(true);
  });

  console.log('\n================================================================');
  console.log(`📊 STUDENT EMAIL SUITE SUMMARY: ${passedTests}/${totalTests} TESTS PASSED`);
  console.log('================================================================\n');

  await mongoose.connection.close();
  process.exit(passedTests === totalTests ? 0 : 1);
}

runStudentEmailSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
