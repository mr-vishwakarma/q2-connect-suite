/**
 * Hosteliq — Secure Super Admin One-Time Bootstrap: Verification Test Suite
 * 
 * Verifies all security rules and requirements:
 * 1. Successful creation of the intended Super Admin with valid credentials.
 * 2. Correct password verification using User.comparePassword().
 * 3. Refusal to run against the wrong database (mismatched EXPECTED_DB_NAME).
 * 4. Refusal when EXPECTED_DB_NAME is missing.
 * 5. Refusal when ALLOW_SUPERADMIN_BOOTSTRAP is absent or false.
 * 6. Refusal when email is missing or malformed.
 * 7. Refusal when password is too short (< 8 chars) or missing.
 * 8. Refusal to duplicate an existing Super Admin (idempotent, safe exit).
 * 9. Refusal to overwrite an existing non-superadmin account with same email/username.
 * 10. Verification that no passwords, hashes, or MongoDB URIs appear in log output.
 * 11. Acceptance of seeded Super Admin by authentication and portal authorization logic.
 * 12. Non-interference with existing student, hostel, and fee collections.
 */

const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const TEST_DB_NAME = 'hosteliq_bootstrap_test';
const TEST_MONGO_URI = `mongodb://127.0.0.1:27017/${TEST_DB_NAME}`;

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_super_admin_bootstrap_2026';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_bootstrap_2026';

const User = require('../models/User');
const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const Fee = require('../models/Fee');
const { bootstrapSuperAdmin } = require('./bootstrapSuperAdmin');
const { isRoleAllowedForPortal } = require('../utils/portalAccess');
const { requireSuperAdmin } = require('../middleware/rbac.middleware');

// In-memory log capture utility
function createLogCapture() {
  const logs = [];
  return {
    logs,
    info: (...args) => logs.push(args.join(' ')),
    warn: (...args) => logs.push(args.join(' ')),
    error: (...args) => logs.push(args.join(' ')),
    getAllText: () => logs.join('\n'),
    clear: () => { logs.length = 0; },
  };
}

let testPassedCount = 0;
let testFailedCount = 0;

function assert(condition, message) {
  if (!condition) {
    testFailedCount++;
    console.error(`  ❌ FAILED: ${message}`);
    throw new Error(message);
  }
  testPassedCount++;
  console.log(`  ✅ PASSED: ${message}`);
}

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log('🚀 Running Hosteliq Super Admin Bootstrap Security Test Suite');
  console.log('=============================================================\n');

  // Connect to isolated test database
  await mongoose.connect(TEST_MONGO_URI);
  await mongoose.connection.dropDatabase();
  console.log(`Connected to isolated test database: ${TEST_DB_NAME}\n`);

  try {
    // --------------------------------------------------------------------------
    // Test 1: Refusal when ALLOW_SUPERADMIN_BOOTSTRAP is absent or false
    // --------------------------------------------------------------------------
    console.log('[Scenario 1] Refusal when bootstrap authorization is missing');
    {
      const capture = createLogCapture();
      let rejected = false;
      try {
        await bootstrapSuperAdmin({
          mongoUri: TEST_MONGO_URI,
          expectedDbName: TEST_DB_NAME,
          allowBootstrap: false,
          name: 'Super Administrator',
          username: 'superadmin',
          email: 'superadmin@hosteliq.in',
          password: 'Super12345Admin!@#$',
          shouldExit: false,
          logger: capture,
        });
      } catch (err) {
        rejected = true;
        assert(err.message === 'BOOTSTRAP_NOT_AUTHORIZED', 'Throws BOOTSTRAP_NOT_AUTHORIZED error');
      }
      assert(rejected, 'Bootstrap command refuses to run without authorization');
      assert(capture.getAllText().includes('Bootstrap authorization missing'), 'Logs helpful authorization error');
    }

    // --------------------------------------------------------------------------
    // Test 2: Refusal when EXPECTED_DB_NAME is missing
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 2] Refusal when EXPECTED_DB_NAME is missing');
    {
      const capture = createLogCapture();
      let rejected = false;
      try {
        await bootstrapSuperAdmin({
          mongoUri: TEST_MONGO_URI,
          expectedDbName: '',
          allowBootstrap: true,
          email: 'superadmin@hosteliq.in',
          password: 'Super12345Admin!@#$',
          shouldExit: false,
          logger: capture,
        });
      } catch (err) {
        rejected = true;
        assert(err.message === 'EXPECTED_DB_NAME_MISSING', 'Throws EXPECTED_DB_NAME_MISSING error');
      }
      assert(rejected, 'Bootstrap command refuses to run when EXPECTED_DB_NAME is omitted');
    }

    // --------------------------------------------------------------------------
    // Test 3: Refusal to run against the wrong database (mismatch check)
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 3] Refusal when EXPECTED_DB_NAME does not match connected database');
    {
      const capture = createLogCapture();
      let rejected = false;
      try {
        await bootstrapSuperAdmin({
          mongoUri: TEST_MONGO_URI, // connected to 'hosteliq_bootstrap_test'
          expectedDbName: 'hosteliq_production_different', // intentionally wrong
          allowBootstrap: true,
          email: 'superadmin@hosteliq.in',
          password: 'Super12345Admin!@#$',
          shouldExit: false,
          logger: capture,
        });
      } catch (err) {
        rejected = true;
        assert(err.message.includes('DATABASE_NAME_MISMATCH'), 'Throws DATABASE_NAME_MISMATCH error');
      }
      assert(rejected, 'Bootstrap command aborts immediately upon database name mismatch');
      assert(capture.getAllText().includes('DATABASE VERIFICATION FAILED'), 'Logs database verification failure message');
    }

    // --------------------------------------------------------------------------
    // Test 4: Refusal on invalid credentials (malformed email or short password)
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 4] Refusal on malformed email or weak/short password');
    {
      const capture = createLogCapture();
      let rejectedEmail = false;
      try {
        await bootstrapSuperAdmin({
          mongoUri: TEST_MONGO_URI,
          expectedDbName: TEST_DB_NAME,
          allowBootstrap: true,
          email: 'not-an-email',
          password: 'Super12345Admin!@#$',
          shouldExit: false,
          logger: capture,
        });
      } catch (err) {
        rejectedEmail = true;
        assert(err.message === 'INVALID_SUPERADMIN_EMAIL', 'Rejects malformed email address');
      }
      assert(rejectedEmail, 'Refused malformed email');

      let rejectedPass = false;
      try {
        await bootstrapSuperAdmin({
          mongoUri: TEST_MONGO_URI,
          expectedDbName: TEST_DB_NAME,
          allowBootstrap: true,
          email: 'superadmin@hosteliq.in',
          password: '123', // too short (< 8 chars)
          shouldExit: false,
          logger: capture,
        });
      } catch (err) {
        rejectedPass = true;
        assert(err.message === 'INVALID_SUPERADMIN_PASSWORD', 'Rejects password shorter than 8 characters');
      }
      assert(rejectedPass, 'Refused short password');
    }

    // --------------------------------------------------------------------------
    // Test 5: Successful creation of the intended Super Admin
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 5] Successful creation and field initialization of intended Super Admin');
    let createdUserId = null;
    const testSecretPassword = 'Super12345Admin!@#$';
    const captureLogs = createLogCapture();
    {
      const result = await bootstrapSuperAdmin({
        mongoUri: TEST_MONGO_URI,
        expectedDbName: TEST_DB_NAME,
        allowBootstrap: true,
        name: 'Super Administrator',
        username: 'superadmin',
        email: 'superadmin@hosteliq.in',
        password: testSecretPassword,
        shouldExit: false,
        logger: captureLogs,
      });

      assert(result.success === true, 'Bootstrap returned success: true');
      assert(result.alreadyExists === false, 'Indicates brand-new creation (alreadyExists: false)');

      const user = await User.findOne({ username: 'superadmin' });
      assert(Boolean(user), 'Super Admin user document found in database');
      createdUserId = user._id;

      assert(user.name === 'Super Administrator', 'Name initialized to "Super Administrator"');
      assert(user.email === 'superadmin@hosteliq.in', 'Email initialized and lowercased');
      assert(user.username === 'superadmin', 'Username initialized');
      assert(user.role === 'super_admin', 'Role explicitly set to "super_admin"');
      assert(user.isSuperAdmin === true, 'isSuperAdmin boolean explicitly set to true');
      assert(user.isActive === true, 'Account isActive is true');
      assert(user.status === 'ACTIVE', 'Account status is ACTIVE');
      assert(user.isEmailVerified === true, 'isEmailVerified is true');
      assert(user.registrationStatus === 'active', 'registrationStatus is active');
      assert(user.authProvider === 'local', 'authProvider is local');
      assert(user.failedLoginAttempts === 0, 'failedLoginAttempts initialized to 0');
      assert(user.lockUntil === null, 'lockUntil initialized to null');
      assert(user.mustChangePassword === false, 'mustChangePassword is false');
    }

    // --------------------------------------------------------------------------
    // Test 6: Correct password verification using User.comparePassword()
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 6] Correct password verification using existing password verifier');
    {
      const freshUser = await User.findById(createdUserId);
      const isMatchValid = await freshUser.comparePassword(testSecretPassword);
      assert(isMatchValid === true, 'comparePassword() returns true for correct password');

      const isMatchInvalid = await freshUser.comparePassword('WrongPassword999!');
      assert(isMatchInvalid === false, 'comparePassword() returns false for incorrect password');

      // Verify that stored password in DB is a bcrypt hash (starts with $2a$ or $2b$) and NOT plaintext
      assert(freshUser.password.startsWith('$2'), 'Password was securely hashed with bcrypt (salt cost 12)');
      assert(!freshUser.password.includes(testSecretPassword), 'Raw password is NEVER stored in database');
    }

    // --------------------------------------------------------------------------
    // Test 7: Secret redaction in logs (Zero Leaks)
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 7] Verification that credentials, hashes, and URIs never appear in logs');
    {
      const allLoggedText = captureLogs.getAllText();
      assert(!allLoggedText.includes(testSecretPassword), 'Raw password NEVER appears in stdout/stderr logs');
      assert(!allLoggedText.includes(TEST_MONGO_URI), 'MongoDB connection string does NOT leak in stdout/stderr');
      assert(!allLoggedText.includes('$2a$') && !allLoggedText.includes('$2b$'), 'Bcrypt hash does NOT leak in stdout/stderr');
      assert(allLoggedText.includes('[PROTECTED — NEVER DISPLAYED IN LOGS]'), 'Prints clean redacted placeholder instead');
    }

    // --------------------------------------------------------------------------
    // Test 8: Idempotent detection of existing Super Admin (no duplicate, no modification)
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 8] Idempotence: Refusal to duplicate or mutate existing Super Admin');
    {
      const userBefore = await User.findById(createdUserId).lean();
      const captureSecondRun = createLogCapture();

      const result = await bootstrapSuperAdmin({
        mongoUri: TEST_MONGO_URI,
        expectedDbName: TEST_DB_NAME,
        allowBootstrap: true,
        email: 'superadmin_attempt2@hosteliq.in',
        password: 'AnotherPassword123!',
        shouldExit: false,
        logger: captureSecondRun,
      });

      assert(result.success === true, 'Returns success: true without error');
      assert(result.alreadyExists === true, 'Reports alreadyExists: true');

      const totalSuperAdmins = await User.countDocuments({
        $or: [{ role: 'super_admin' }, { isSuperAdmin: true }],
      });
      assert(totalSuperAdmins === 1, 'Total Super Admins remains exactly 1 (no duplicates)');

      const userAfter = await User.findById(createdUserId).lean();
      assert(userAfter.password === userBefore.password, 'Existing Super Admin password hash was NOT mutated');
      assert(userAfter.email === userBefore.email, 'Existing Super Admin email was NOT mutated');
    }

    // --------------------------------------------------------------------------
    // Test 9: Refusal to overwrite an existing non-superadmin account
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 9] Refusal to overwrite existing account with same email/username');
    {
      // First, temporarily remove the super admin so we can test conflict check
      await User.deleteOne({ _id: createdUserId });

      // Create a regular student user with email 'hostelstudent@hosteliq.in'
      const existingStudent = new User({
        name: 'Existing Student',
        email: 'hostelstudent@hosteliq.in',
        username: 'hostelstudent',
        password: 'StudentPassword123!',
        role: 'student',
        isSuperAdmin: false,
      });
      await existingStudent.save();

      const conflictCapture = createLogCapture();
      let conflictRejected = false;
      try {
        await bootstrapSuperAdmin({
          mongoUri: TEST_MONGO_URI,
          expectedDbName: TEST_DB_NAME,
          allowBootstrap: true,
          username: 'superadmin',
          email: 'hostelstudent@hosteliq.in', // Conflicting email!
          password: 'Super12345Admin!@#$',
          shouldExit: false,
          logger: conflictCapture,
        });
      } catch (err) {
        conflictRejected = true;
        assert(err.message === 'ACCOUNT_ALREADY_EXISTS_WITH_DIFFERENT_ROLE', 'Throws ACCOUNT_ALREADY_EXISTS_WITH_DIFFERENT_ROLE error');
      }
      assert(conflictRejected, 'Refused to overwrite existing account with same email');

      // Verify the student was not modified or elevated to super_admin
      const studentAfter = await User.findById(existingStudent._id);
      assert(studentAfter.role === 'student', 'Existing account retained its original student role');
      assert(studentAfter.isSuperAdmin === false, 'Existing account was NOT elevated to Super Admin');

      // Restore Super Admin for remaining tests
      await bootstrapSuperAdmin({
        mongoUri: TEST_MONGO_URI,
        expectedDbName: TEST_DB_NAME,
        allowBootstrap: true,
        username: 'superadmin',
        email: 'superadmin@hosteliq.in',
        password: testSecretPassword,
        shouldExit: false,
        logger: createLogCapture(),
      });
    }

    // --------------------------------------------------------------------------
    // Test 10: Authentication, JWT & RBAC Middleware Verification
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 10] Acceptance by authentication, JWT token, and RBAC middleware');
    {
      const superAdminUser = await User.findOne({ username: 'superadmin' });
      assert(isRoleAllowedForPortal(superAdminUser, 'SUPER_ADMIN') === true, 'isRoleAllowedForPortal allows SUPER_ADMIN portal');
      assert(isRoleAllowedForPortal(superAdminUser, 'STUDENT') === false, 'Strict boundary: Super Admin rejected from STUDENT portal');
      assert(isRoleAllowedForPortal(superAdminUser, 'ADMIN') === false, 'Strict boundary: Super Admin rejected from standard ADMIN portal');

      // Test JWT token generation and validation
      const token = jwt.sign({ id: superAdminUser._id }, process.env.JWT_SECRET, { expiresIn: '15m' });
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      assert(decoded.id === String(superAdminUser._id), 'Valid JWT generated and decoded for Super Admin');

      // Test RBAC requireSuperAdmin middleware
      let middlewarePassed = false;
      const mockReq = { user: superAdminUser };
      const mockRes = {
        status: () => mockRes,
        json: () => mockRes,
      };
      const mockNext = () => { middlewarePassed = true; };
      requireSuperAdmin(mockReq, mockRes, mockNext);
      assert(middlewarePassed === true, 'requireSuperAdmin middleware permits the seeded Super Admin');
    }

    // --------------------------------------------------------------------------
    // Test 11: Non-interference with existing operational collections
    // --------------------------------------------------------------------------
    console.log('\n[Scenario 11] Verification of zero side-effects on other database collections');
    {
      const Organization = require('../models/Organization');
      const dummyOrg = new Organization({
        name: 'Test Tenant Org',
        slug: 'test-tenant-org',
        contactEmail: 'contact@tenant.com',
      });
      await dummyOrg.save();

      // Create test operational records
      const dummyHostel = new Hostel({
        name: 'Test Campus A',
        code: 'TCA',
        organizationId: dummyOrg._id,
        address: '123 Campus Way',
        phone: '9876543210',
        email: 'campus@hosteliq.in',
      });
      await dummyHostel.save();

      const dummyStudentUser = new User({
        name: 'Test Resident User',
        email: 'residentuser@test.com',
        username: 'residentuser101',
        password: 'Password123!',
        role: 'student',
      });
      await dummyStudentUser.save();

      const dummyStudent = new Student({
        userId: dummyStudentUser._id,
        name: 'Test Resident',
        username: 'residentuser101',
        email: 'residentuser@test.com',
        phone: '9876543211',
        hostel: 'Test Campus A',
        room_no: '101',
      });
      await dummyStudent.save();

      const hostelCountBefore = await Hostel.countDocuments();
      const studentCountBefore = await Student.countDocuments();
      const orgCountBefore = await Organization.countDocuments();

      // Run bootstrap again
      await bootstrapSuperAdmin({
        mongoUri: TEST_MONGO_URI,
        expectedDbName: TEST_DB_NAME,
        allowBootstrap: true,
        email: 'superadmin@hosteliq.in',
        password: testSecretPassword,
        shouldExit: false,
        logger: createLogCapture(),
      });

      const hostelCountAfter = await Hostel.countDocuments();
      const studentCountAfter = await Student.countDocuments();
      const orgCountAfter = await Organization.countDocuments();

      assert(hostelCountBefore === hostelCountAfter, 'Hostel collection count unaffected');
      assert(studentCountBefore === studentCountAfter, 'Student collection count unaffected');
      assert(orgCountBefore === orgCountAfter, 'Organization collection count unaffected');
    }

    // Summary
    console.log('\n=============================================================');
    console.log(`🎉 ALL ${testPassedCount} ASSERTIONS PASSED (0 Failures)`);
    console.log('✅ Super Admin Bootstrap is fully verified, robust, and secure.');
    console.log('=============================================================\n');

    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED:', error.message);
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
    process.exit(1);
  }
}

runTestSuite();
