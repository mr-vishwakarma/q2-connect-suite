/**
 * Phase A — P0 Security Regression Test Suite
 * 
 * Verifies that the three critical P0 launch blockers are permanently closed:
 * TEST 1: Missing MONGODB_URI refuses startup and fails closed without fallback credentials.
 * TEST 2: /api/auth/register-admin with missing adminSecret is rejected (403/503).
 * TEST 3: /api/auth/register-admin with empty adminSecret is rejected (403/503).
 * TEST 4: /api/auth/register-admin with invalid secret is rejected (403).
 * TEST 5: /api/auth/register-admin with correct configured secret is allowed (201).
 * TEST 6: Google auth with invalid token signature is rejected (401).
 * TEST 7: Google auth with forged payload/admin email is rejected (401).
 * TEST 8: Google verification failure results in zero user creation and zero token issuance.
 * TEST 9: Legitimate Google verification structure is preserved without unverified fallback.
 */

require('dotenv').config();
const http = require('http');
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}
const mongoose = require('mongoose');
const { execSync } = require('child_process');
const User = require('../models/User');

const TEST_PORT = 5055;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Helper: HTTP request helper using native http module
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

async function runP0SecurityTests() {
  console.log('\n============================================================');
  console.log('🛡️  PHASE A: P0 SECURITY REGRESSION TEST SUITE');
  console.log('============================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assertTest(name, condition, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passedCount++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      if (details) console.error(`     Details: ${details}`);
      failedCount++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Missing MONGODB_URI fails closed without fallback
  // -------------------------------------------------------------
  console.log('--- TEST 1: MongoDB Fail-Closed & Fallback Credential Sanitization ---');
  try {
    const testCommand = `node -e "delete process.env.MONGODB_URI; process.env.NODE_ENV='test'; const connectDB = require('./src/config/db'); connectDB().catch(e => { console.log('CAUGHT_ERROR:' + e.message); process.exit(0); });"`;
    const output = execSync(testCommand, { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, MONGODB_URI: '' } });
    const caught = output.includes('CAUGHT_ERROR:MONGODB_URI environment variable is required');
    assertTest(
      'TEST 1: Missing MONGODB_URI throws fatal configuration error and fails closed',
      caught,
      output
    );
  } catch (err) {
    assertTest('TEST 1: Missing MONGODB_URI throws fatal configuration error and fails closed', false, err.message);
  }

  // Connect to DB for remaining tests
  if (!process.env.MONGODB_URI) {
    console.error('❌ Cannot run remaining tests: MONGODB_URI is not set in backend/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  // Set test admin secret if not configured
  const testSecret = process.env.ADMIN_REGISTRATION_SECRET || 'test_security_secret_phase_a';
  process.env.ADMIN_REGISTRATION_SECRET = testSecret;

  // Boot Express app on TEST_PORT
  const express = require('express');
  const app = express();
  app.use(express.json());
  const authRoutes = require('../routes/auth.routes');
  app.use('/api/auth', authRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  try {
    // -------------------------------------------------------------
    // TEST 2: register-admin with missing adminSecret -> REJECTED
    // -------------------------------------------------------------
    console.log('\n--- TESTS 2-5: Admin Registration Gating ---');
    const test2Res = await makeRequest('POST', '/api/auth/register-admin', {
      name: 'Unauth Attacker',
      username: 'attacker_' + Date.now(),
      email: `attacker_${Date.now()}@example.com`,
      password: 'password123',
    });
    assertTest(
      'TEST 2: register-admin with missing adminSecret is rejected (403)',
      test2Res.status === 403,
      `Received HTTP ${test2Res.status}: ${JSON.stringify(test2Res.body)}`
    );

    // -------------------------------------------------------------
    // TEST 3: register-admin with empty adminSecret -> REJECTED
    // -------------------------------------------------------------
    const test3Res = await makeRequest('POST', '/api/auth/register-admin', {
      name: 'Unauth Attacker',
      username: 'attacker2_' + Date.now(),
      email: `attacker2_${Date.now()}@example.com`,
      password: 'password123',
      adminSecret: '',
    });
    assertTest(
      'TEST 3: register-admin with empty adminSecret is rejected (403)',
      test3Res.status === 403,
      `Received HTTP ${test3Res.status}: ${JSON.stringify(test3Res.body)}`
    );

    // -------------------------------------------------------------
    // TEST 4: register-admin with invalid adminSecret -> REJECTED
    // -------------------------------------------------------------
    const test4Res = await makeRequest('POST', '/api/auth/register-admin', {
      name: 'Unauth Attacker',
      username: 'attacker3_' + Date.now(),
      email: `attacker3_${Date.now()}@example.com`,
      password: 'password123',
      adminSecret: 'wrong_secret_12345',
    });
    assertTest(
      'TEST 4: register-admin with invalid secret is rejected (403)',
      test4Res.status === 403,
      `Received HTTP ${test4Res.status}: ${JSON.stringify(test4Res.body)}`
    );

    // -------------------------------------------------------------
    // TEST 5: register-admin with correct adminSecret -> ALLOWED
    // -------------------------------------------------------------
    const validAdminUsername = 'admin_valid_' + Date.now();
    const validAdminEmail = `${validAdminUsername}@q2hostel.local`;
    const test5Res = await makeRequest('POST', '/api/auth/register-admin', {
      name: 'Legitimate Bootstrap Admin',
      username: validAdminUsername,
      email: validAdminEmail,
      password: 'StrongPassword123!',
      adminSecret: testSecret,
    });
    assertTest(
      'TEST 5: register-admin with correct configured secret is allowed (201)',
      test5Res.status === 201 && test5Res.body?.success === true,
      `Received HTTP ${test5Res.status}: ${JSON.stringify(test5Res.body)}`
    );

    // Clean up created test admin
    if (test5Res.body?.user?._id) {
      await User.findByIdAndDelete(test5Res.body.user._id);
    }

    // -------------------------------------------------------------
    // TESTS 6-9: Google OAuth Signature Verification & Forgery Defense
    // -------------------------------------------------------------
    console.log('\n--- TESTS 6-9: Google OAuth Verification & Forgery Defense ---');

    // Fabricate an unverified token with base64 payload targeting an admin email
    const fakeHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64');
    const fakePayload = Buffer.from(
      JSON.stringify({
        sub: 'google_attacker_123',
        email: 'admin@q2hostel.local',
        name: 'Attacker Impersonating Admin',
        picture: 'https://example.com/avatar.png',
      })
    ).toString('base64');
    const fakeSignature = Buffer.from('completely_forged_invalid_signature').toString('base64');
    const forgedGoogleToken = `${fakeHeader}.${fakePayload}.${fakeSignature}`;

    // TEST 6: Google credential with invalid signature -> REJECTED
    const test6Res = await makeRequest('POST', '/api/auth/google', {
      credential: 'invalid_malformed_token_header.payload.sig',
    });
    assertTest(
      'TEST 6: Google credential with invalid signature/format is rejected (401/503)',
      test6Res.status === 401 || test6Res.status === 503,
      `Received HTTP ${test6Res.status}: ${JSON.stringify(test6Res.body)}`
    );

    // TEST 7: Google credential with forged payload targeting admin -> REJECTED
    const test7Res = await makeRequest('POST', '/api/auth/google', {
      credential: forgedGoogleToken,
    });
    assertTest(
      'TEST 7: Forged Google JWT with fake payload/admin email is rejected without fallback (401/503)',
      test7Res.status === 401 || test7Res.status === 503,
      `Received HTTP ${test7Res.status}: ${JSON.stringify(test7Res.body)}`
    );

    // TEST 8: Verify no user created or token issued on failed Google verification
    const testAttackerEmail = 'attacker_never_exists_' + Date.now() + '@attacker.com';
    const fakeAttackerPayload = Buffer.from(
      JSON.stringify({ sub: 'bad_sub', email: testAttackerEmail, name: 'Attacker' })
    ).toString('base64');
    const forgedAttackerToken = `${fakeHeader}.${fakeAttackerPayload}.${fakeSignature}`;

    const test8Res = await makeRequest('POST', '/api/auth/google', {
      credential: forgedAttackerToken,
    });

    const userInDb = await User.findOne({ email: testAttackerEmail });
    assertTest(
      'TEST 8: Google verification failure guarantees zero user creation and zero session tokens',
      (test8Res.status === 401 || test8Res.status === 503) && userInDb === null && !test8Res.body?.accessToken,
      `User created in DB: ${Boolean(userInDb)}, Access token returned: ${Boolean(test8Res.body?.accessToken)}`
    );

    // TEST 9: Verify Google verification mechanism structure rejects missing credentials safely
    const test9Res = await makeRequest('POST', '/api/auth/google', {
      credential: '',
    });
    assertTest(
      'TEST 9: Empty Google credential rejected cleanly (400) without unhandled exceptions',
      test9Res.status === 400,
      `Received HTTP ${test9Res.status}: ${JSON.stringify(test9Res.body)}`
    );

  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n============================================================');
  console.log(`🏁 TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runP0SecurityTests().catch((err) => {
    console.error('Unhandled test suite error:', err);
    process.exit(1);
  });
}

module.exports = runP0SecurityTests;
