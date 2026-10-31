/**
 * Hosteliq — Secure One-Time Super Admin Bootstrap CLI
 * 
 * Provisions the initial Super Administrator in a target Hosteliq MongoDB database.
 * 
 * Safety Guarantees:
 * 1. Strict Database Verification: Verifies mongoose.connection.name matches EXPECTED_DB_NAME.
 * 2. Explicit Authorization: Refuses to run unless ALLOW_SUPERADMIN_BOOTSTRAP=true.
 * 3. Secret Redaction: Never logs or prints passwords, credentials, or MongoDB connection strings.
 * 4. Model Integrity: Uses the existing User model and pre-save bcrypt hashing (salt 12).
 * 5. Idempotent / Non-Destructive: Detects existing Super Admin and exits safely without duplicates.
 * 6. Conflict Protection: Detects if the email/username belongs to another user and refuses to overwrite.
 * 7. Verification Self-Check: Validates password matching and portal authorization before exiting.
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Attempt to load bootstrap-specific environment file if present
const bootstrapEnvPath = path.join(__dirname, '../../.env.bootstrap');
if (fs.existsSync(bootstrapEnvPath)) {
  require('dotenv').config({ path: bootstrapEnvPath });
}
// Load standard backend .env as fallback
const standardEnvPath = path.join(__dirname, '../../.env');
if (fs.existsSync(standardEnvPath)) {
  require('dotenv').config({ path: standardEnvPath });
}

const User = require('../models/User');
const { isRoleAllowedForPortal } = require('../utils/portalAccess');

/**
 * Validates email format according to standard RFC pattern
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Validates username format
 */
function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  const trimmed = username.trim();
  return trimmed.length >= 3 && /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Core bootstrap logic
 * 
 * @param {Object} options Configuration overrides (for programmatic and test execution)
 * @returns {Promise<{ success: boolean, user?: Object, message?: string }>}
 */
async function bootstrapSuperAdmin(options = {}) {
  const logger = options.logger || console;
  const shouldExit = options.shouldExit !== undefined ? options.shouldExit : true;

  // 1. Resolve configuration (options take precedence over process.env)
  const mongoUri = options.mongoUri || process.env.MONGODB_URI;
  const expectedDbName = (options.expectedDbName || process.env.EXPECTED_DB_NAME || '').trim();
  const allowBootstrap = options.allowBootstrap !== undefined
    ? options.allowBootstrap
    : (process.env.ALLOW_SUPERADMIN_BOOTSTRAP === 'true' || process.env.BOOTSTRAP_SUPERADMIN === 'true');
  
  const superAdminName = (options.name || process.env.SUPERADMIN_NAME || 'Super Administrator').trim();
  const superAdminUsername = (options.username || process.env.SUPERADMIN_USERNAME || 'superadmin').trim();
  const superAdminEmail = (options.email || process.env.SUPERADMIN_EMAIL || '').trim().toLowerCase();
  const superAdminPassword = options.password || process.env.SUPERADMIN_PASSWORD;

  // 2. Validate Authorization Guard
  if (!allowBootstrap) {
    const errorMsg = '❌ FATAL: Bootstrap authorization missing. ALLOW_SUPERADMIN_BOOTSTRAP=true must be set in your environment to permit Super Admin initialization.';
    logger.error(errorMsg);
    if (shouldExit) process.exit(1);
    throw new Error('BOOTSTRAP_NOT_AUTHORIZED');
  }

  // 3. Validate Expected Database Name Guard
  if (!expectedDbName) {
    const errorMsg = '❌ FATAL: EXPECTED_DB_NAME environment variable is required (e.g. EXPECTED_DB_NAME=hosteliq_prodtest) to prevent accidental operations on unintended databases.';
    logger.error(errorMsg);
    if (shouldExit) process.exit(1);
    throw new Error('EXPECTED_DB_NAME_MISSING');
  }

  // 4. Validate MongoDB Connection URI
  if (!mongoUri || !mongoUri.trim()) {
    const errorMsg = '❌ FATAL: MONGODB_URI environment variable is required.';
    logger.error(errorMsg);
    if (shouldExit) process.exit(1);
    throw new Error('MONGODB_URI_MISSING');
  }

  // 5. Validate Input Credentials
  if (!superAdminEmail || !isValidEmail(superAdminEmail)) {
    const errorMsg = `❌ VALIDATION ERROR: A valid SUPERADMIN_EMAIL is required (received: "${superAdminEmail || ''}").`;
    logger.error(errorMsg);
    if (shouldExit) process.exit(1);
    throw new Error('INVALID_SUPERADMIN_EMAIL');
  }

  if (!isValidUsername(superAdminUsername)) {
    const errorMsg = `❌ VALIDATION ERROR: SUPERADMIN_USERNAME must be at least 3 characters and contain only alphanumeric, underscores, or hyphens (received: "${superAdminUsername}").`;
    logger.error(errorMsg);
    if (shouldExit) process.exit(1);
    throw new Error('INVALID_SUPERADMIN_USERNAME');
  }

  if (!superAdminPassword || typeof superAdminPassword !== 'string' || superAdminPassword.length < 8) {
    const errorMsg = '❌ VALIDATION ERROR: SUPERADMIN_PASSWORD is required and must be at least 8 characters long.';
    logger.error(errorMsg);
    if (shouldExit) process.exit(1);
    throw new Error('INVALID_SUPERADMIN_PASSWORD');
  }

  // 6. Connect to Target Database (manage connection lifecycle)
  let localConnection = false;
  if (mongoose.connection.readyState === 0) {
    localConnection = true;
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 15000,
      });
    } catch (connErr) {
      logger.error(`❌ DATABASE CONNECTION FAILED: Unable to reach MongoDB host. (${connErr.message})`);
      if (shouldExit) process.exit(1);
      throw connErr;
    }
  }

  try {
    // 7. Verify Active Database Name Against Expected Database
    const actualDbName = (mongoose.connection.name || (mongoose.connection.db && mongoose.connection.db.databaseName) || '').trim();
    if (actualDbName.toLowerCase() !== expectedDbName.toLowerCase()) {
      logger.error(`❌ DATABASE VERIFICATION FAILED: Connected to database "${actualDbName}", but expected "${expectedDbName}". Refusing to run.`);
      if (localConnection) await mongoose.disconnect();
      if (shouldExit) process.exit(1);
      throw new Error(`DATABASE_NAME_MISMATCH: Connected to "${actualDbName}", expected "${expectedDbName}"`);
    }

    // 8. Detect Existing Super Admin (Idempotence & Safety)
    const existingSuperAdmin = await User.findOne({
      $or: [
        { role: 'super_admin' },
        { isSuperAdmin: true },
      ],
    });

    if (existingSuperAdmin) {
      logger.info(`ℹ️ A Super Administrator already exists in database "${actualDbName}" (ID: ${existingSuperAdmin._id}, username: ${existingSuperAdmin.username}, email: ${existingSuperAdmin.email}).`);
      logger.info('🛡️ Exiting safely without creating duplicate or unexpectedly modifying existing account.');
      if (localConnection) await mongoose.disconnect();
      if (shouldExit) process.exit(0);
      return {
        success: true,
        alreadyExists: true,
        user: existingSuperAdmin.toJSON(),
        message: 'Super Admin already exists. No modifications made.',
      };
    }

    // 9. Detect Email or Username Conflict with Existing Accounts
    const conflictingUser = await User.findOne({
      $or: [
        { email: superAdminEmail },
        { username: superAdminUsername },
      ],
    });

    if (conflictingUser) {
      logger.error(`❌ CONFLICT DETECTED: An existing account with username "${superAdminUsername}" or email "${superAdminEmail}" already exists (ID: ${conflictingUser._id}, Role: ${conflictingUser.role}). Refusing to overwrite.`);
      if (localConnection) await mongoose.disconnect();
      if (shouldExit) process.exit(1);
      throw new Error('ACCOUNT_ALREADY_EXISTS_WITH_DIFFERENT_ROLE');
    }

    // 10. Create New Super Administrator
    const superAdmin = new User({
      name: superAdminName,
      email: superAdminEmail,
      username: superAdminUsername,
      password: superAdminPassword, // Triggers pre-save hook: bcrypt.hash(password, 12)
      role: 'super_admin',
      isSuperAdmin: true,
      isActive: true,
      status: 'ACTIVE',
      isEmailVerified: true,
      isPhoneVerified: true,
      registrationStatus: 'active',
      authProvider: 'local',
      failedLoginAttempts: 0,
      lockUntil: null,
      mustChangePassword: false,
    });

    await superAdmin.save();

    // 11. Verification Self-Check: Verify Password, Flags, and Portal Access
    const freshUser = await User.findById(superAdmin._id);
    if (!freshUser) {
      throw new Error('DATABASE_VERIFICATION_ERROR: Seeded user could not be retrieved.');
    }

    const isPasswordValid = await freshUser.comparePassword(superAdminPassword);
    if (!isPasswordValid) {
      throw new Error('SECURITY_SELF_CHECK_FAILED: Password hash comparison test failed.');
    }

    if (freshUser.role !== 'super_admin' || freshUser.isSuperAdmin !== true) {
      throw new Error('ROLE_VERIFICATION_FAILED: Super Admin role flags were not properly persisted.');
    }

    if (!isRoleAllowedForPortal(freshUser, 'SUPER_ADMIN')) {
      throw new Error('PORTAL_ACCESS_VERIFICATION_FAILED: User was rejected by portal authorization rules.');
    }

    // 12. Output Clean Success Report (Zero Leaks: No Passwords, Hashes, or URIs)
    logger.info('\n=============================================================');
    logger.info('✅ Hosteliq Super Administrator Initialized Successfully');
    logger.info('=============================================================');
    logger.info(`Target Database:   ${actualDbName}`);
    logger.info(`User ID:           ${freshUser._id}`);
    logger.info(`Name:              ${freshUser.name}`);
    logger.info(`Username:          ${freshUser.username}`);
    logger.info(`Email:             ${freshUser.email}`);
    logger.info(`Role:              ${freshUser.role}`);
    logger.info(`Status:            ${freshUser.status}`);
    logger.info(`isSuperAdmin:      ${freshUser.isSuperAdmin}`);
    logger.info(`Portal Access:     SUPER_ADMIN (Authorized ✅)`);
    logger.info(`Password Check:    Verified with bcrypt (Cost Factor: 12) ✅`);
    logger.info('Credential Secret: [PROTECTED — NEVER DISPLAYED IN LOGS]');
    logger.info('=============================================================\n');

    if (localConnection) await mongoose.disconnect();
    if (shouldExit) process.exit(0);

    return {
      success: true,
      alreadyExists: false,
      user: freshUser.toJSON(),
      message: 'Super Administrator created and verified successfully.',
    };
  } catch (err) {
    if (localConnection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    throw err;
  }
}

// CLI Execution Entry Point
if (require.main === module) {
  // Parse simple CLI flags if provided (--email, --username, --password, --expected-db)
  const args = process.argv.slice(2);
  const cliOptions = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) {
      cliOptions.email = args[++i];
    } else if (args[i] === '--username' && args[i + 1]) {
      cliOptions.username = args[++i];
    } else if (args[i] === '--password' && args[i + 1]) {
      cliOptions.password = args[++i];
    } else if (args[i] === '--expected-db' && args[i + 1]) {
      cliOptions.expectedDbName = args[++i];
    } else if (args[i] === '--name' && args[i + 1]) {
      cliOptions.name = args[++i];
    }
  }

  bootstrapSuperAdmin(cliOptions).catch((err) => {
    console.error(`❌ Bootstrap execution failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  bootstrapSuperAdmin,
  isValidEmail,
  isValidUsername,
};
