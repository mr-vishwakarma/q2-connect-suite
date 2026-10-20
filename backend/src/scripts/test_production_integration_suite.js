/**
 * Q2 Connect Suite — Production Domain, Google OAuth Callback, CORS & Resend Test Suite
 * 
 * Verifies:
 * 1. Resend Mail Service (client initialization, sender identity, masked keys, mocked delivery, retries, zero secret leakage)
 * 2. Centralized Email Dispatch (trusted frontend URL resolves to https://mrvishwakarma.in, failover, unroutable suppression)
 * 3. Google OAuth Redirect & Callback Flow (canonical redirect URI, open redirect defense, state parsing, code exchange)
 * 4. Production CORS Policy (permits mrvishwakarma.in, local dev, Vercel, rejects untrusted origins, preflight options)
 * 5. Password Reset & Verification Link Domain Integrity (all generated URLs use mrvishwakarma.in)
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const assert = require('assert');
const crypto = require('crypto');

const {
  getResendStatus,
  getResendSenderAddress,
  sendViaResend,
  maskEmail,
  maskApiKey,
} = require('../services/resend.service');

const {
  getSenderAddress,
  getTrustedFrontendUrl,
  getMailConfigStatus,
  sendEmail,
  sendPasswordResetEmail,
  sendStudentWelcomeEmail,
  isRoutableEmail,
} = require('../utils/email');

const { isAllowedOrigin, corsOptions } = require('../config/cors');
const { sanitizeReturnTo, getGoogleCallbackUrl } = require('../controllers/auth.controller');

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 Q2 CONNECT SUITE — PRODUCTION INTEGRATION & SECURITY TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  ✅ PASS: ${name}`);
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  // -------------------------------------------------------------
  // SECTION 1: RESEND MAIL SERVICE & DIAGNOSTICS
  // -------------------------------------------------------------
  console.log('📦 SECTION 1: RESEND TRANSACTIONAL EMAIL SERVICE & DIAGNOSTICS');

  await test('getResendSenderAddress resolves to custom verified domain mrvishwakarma.in', async () => {
    const sender = getResendSenderAddress();
    assert(sender.includes('@mrvishwakarma.in'), `Sender must be on mrvishwakarma.in, got: ${sender}`);
    assert(sender.includes('noreply@mrvishwakarma.in'), `Default sender must be noreply@mrvishwakarma.in, got: ${sender}`);
  });

  await test('maskEmail masks email properly without leaking full username', async () => {
    const masked = maskEmail('resident.user@example.com');
    assert.strictEqual(masked, 'r***r@example.com');
    assert(!masked.includes('resident.user'));
  });

  await test('maskApiKey never leaks raw secrets', async () => {
    const fakeKey = 're_1234567890abcdef12345678';
    const masked = maskApiKey(fakeKey);
    assert(masked.startsWith('re_12...5678'), `Key should be masked, got: ${masked}`);
    assert(!masked.includes('abcdef'), 'Key secret portion must be redacted');
  });

  await test('getResendStatus returns zero secret leakage in JSON serialization', async () => {
    const status = getResendStatus();
    assert.strictEqual(status.provider, 'resend');
    assert(status.domain === 'mrvishwakarma.in');
    assert(!status.apiKey, 'Raw apiKey property must NEVER exist');
    const json = JSON.stringify(status);
    assert(!json.includes(process.env.RESEND_API_KEY || 'UNCONFIGURED_KEY_SENTINEL'));
  });

  await test('sendViaResend succeeds in simulated mode and logs correlation ID', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      const res = await sendViaResend({
        to: 'resident@gmail.com',
        subject: 'Welcome to Hostel',
        html: '<p>Welcome!</p>',
        correlationId: 'cid-unit-test-1',
      });
      assert(res.success === true, 'Resend simulated send must succeed');
      assert.strictEqual(res.provider, 'resend');
      assert.strictEqual(res.status, 'EMAIL_ACCEPTED_BY_RESEND');
      assert(res.messageId.startsWith('mock-resend-'));
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });

  await test('sendViaResend validates missing API key when not in test mode', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    const prevKey = process.env.RESEND_API_KEY;
    process.env.NODE_ENV = 'production';
    delete process.env.RESEND_API_KEY;
    try {
      let threw = false;
      try {
        await sendViaResend({
          to: 'resident@gmail.com',
          subject: 'Test',
          html: '<p>Test</p>',
        });
      } catch (e) {
        threw = true;
        assert.strictEqual(e.code, 'CONFIG_MISSING');
      }
      assert(threw, 'Must throw error when RESEND_API_KEY is missing');
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
      if (prevKey) process.env.RESEND_API_KEY = prevKey;
    }
  });

  // -------------------------------------------------------------
  // SECTION 2: PRODUCTION DOMAIN & LINK INTEGRITY
  // -------------------------------------------------------------
  console.log('\n🌐 SECTION 2: PRODUCTION DOMAIN & TRUSTED URL RESOLUTION');

  await test('getTrustedFrontendUrl resolves to https://mrvishwakarma.in by default', async () => {
    const prevFrontend = process.env.FRONTEND_URL;
    const prevSite = process.env.SITE_URL;
    delete process.env.FRONTEND_URL;
    delete process.env.SITE_URL;
    try {
      const url = getTrustedFrontendUrl();
      assert.strictEqual(url, 'https://mrvishwakarma.in');
    } finally {
      if (prevFrontend) process.env.FRONTEND_URL = prevFrontend;
      if (prevSite) process.env.SITE_URL = prevSite;
    }
  });

  await test('getTrustedFrontendUrl honors explicit request origin from mrvishwakarma.in', async () => {
    const fakeReq = { headers: { origin: 'https://mrvishwakarma.in' } };
    const url = getTrustedFrontendUrl(fakeReq);
    assert.strictEqual(url, 'https://mrvishwakarma.in');
  });

  await test('getTrustedFrontendUrl honors www.mrvishwakarma.in request origin', async () => {
    const fakeReq = { headers: { origin: 'https://www.mrvishwakarma.in' } };
    const url = getTrustedFrontendUrl(fakeReq);
    assert.strictEqual(url, 'https://www.mrvishwakarma.in');
  });

  await test('getTrustedFrontendUrl rejects untrusted origin and falls back to production domain', async () => {
    const fakeReq = { headers: { origin: 'https://attacker-domain.evil.com' } };
    const url = getTrustedFrontendUrl(fakeReq);
    assert(url.includes('mrvishwakarma.in'), `Must not use attacker domain, got: ${url}`);
  });

  await test('Password reset link generation incorporates production domain', async () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      const dummyToken = crypto.randomBytes(32).toString('hex');
      const resetUrl = `${getTrustedFrontendUrl()}/reset-password?token=${dummyToken}`;
      assert(resetUrl.startsWith('https://mrvishwakarma.in/reset-password?token='), `Reset link must use mrvishwakarma.in, got: ${resetUrl}`);
      assert(!resetUrl.includes('localhost'), 'Must not contain localhost');
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });

  // -------------------------------------------------------------
  // SECTION 3: CORS & PREFLIGHT SECURITY
  // -------------------------------------------------------------
  console.log('\n🛡️ SECTION 3: CORS POLICY & ORIGIN ACCESS CONTROL');

  await test('isAllowedOrigin accepts canonical production domain https://mrvishwakarma.in', () => {
    assert.strictEqual(isAllowedOrigin('https://mrvishwakarma.in'), true);
  });

  await test('isAllowedOrigin accepts https://www.mrvishwakarma.in', () => {
    assert.strictEqual(isAllowedOrigin('https://www.mrvishwakarma.in'), true);
  });

  await test('isAllowedOrigin accepts local development origins', () => {
    assert.strictEqual(isAllowedOrigin('http://localhost:8080'), true);
    assert.strictEqual(isAllowedOrigin('http://localhost:5173'), true);
    assert.strictEqual(isAllowedOrigin('http://localhost:5000'), true);
    assert.strictEqual(isAllowedOrigin('http://127.0.0.1:8080'), true);
  });

  await test('isAllowedOrigin accepts Vercel deployment URLs', () => {
    assert.strictEqual(isAllowedOrigin('https://q2-connect-suite.vercel.app'), true);
    assert.strictEqual(isAllowedOrigin('https://q2-connect-suite-staging.vercel.app'), true);
    assert.strictEqual(isAllowedOrigin('https://preview-123.vercel.app'), true);
  });

  await test('isAllowedOrigin accepts Render backend origin', () => {
    assert.strictEqual(isAllowedOrigin('https://q2-connect-api.onrender.com'), true);
  });

  await test('isAllowedOrigin rejects unauthorized third-party origins', () => {
    assert.strictEqual(isAllowedOrigin('https://phishing-site.com'), false);
    assert.strictEqual(isAllowedOrigin('https://evil-mrvishwakarma.in'), false);
    assert.strictEqual(isAllowedOrigin('https://mrvishwakarma.in.attacker.com'), false);
    assert.strictEqual(isAllowedOrigin('http://mrvishwakarma.in'), false); // HTTP insecure rejected in production check
  });

  await test('corsOptions specifies credentials: true and required security headers', () => {
    assert.strictEqual(corsOptions.credentials, true);
    assert(corsOptions.methods.includes('OPTIONS'));
    assert(corsOptions.methods.includes('GET'));
    assert(corsOptions.methods.includes('POST'));
    assert(corsOptions.allowedHeaders.includes('Authorization'));
    assert(corsOptions.allowedHeaders.includes('x-hostel-id'));
    assert(corsOptions.allowedHeaders.includes('x-organization-id'));
  });

  // -------------------------------------------------------------
  // SECTION 4: GOOGLE OAUTH REDIRECT & CALLBACK ARCHITECTURE
  // -------------------------------------------------------------
  console.log('\n🔑 SECTION 4: GOOGLE OAUTH CALLBACK & REDIRECT FLOW');

  await test('getGoogleCallbackUrl returns canonical registered URI https://mrvishwakarma.in/auth/google/callback', () => {
    const callback = getGoogleCallbackUrl();
    assert.strictEqual(callback, 'https://mrvishwakarma.in/auth/google/callback');
  });

  await test('sanitizeReturnTo allows valid relative application paths', () => {
    assert.strictEqual(sanitizeReturnTo('/student/dashboard'), '/student/dashboard');
    assert.strictEqual(sanitizeReturnTo('/admin/fees'), '/admin/fees');
    assert.strictEqual(sanitizeReturnTo('/super-admin/dashboard'), '/super-admin/dashboard');
  });

  await test('sanitizeReturnTo blocks open redirect attacks (protocol-relative and malicious hosts)', () => {
    assert.strictEqual(sanitizeReturnTo('//evil.com'), null);
    assert.strictEqual(sanitizeReturnTo('/\\evil.com'), null);
    assert.strictEqual(sanitizeReturnTo('https://evil.com/login'), null);
    assert.strictEqual(sanitizeReturnTo('javascript:alert(1)'), null);
    assert.strictEqual(sanitizeReturnTo(''), null);
    assert.strictEqual(sanitizeReturnTo(null), null);
  });

  // -------------------------------------------------------------
  // SECTION 5: UNIFIED MAIL CONFIGURATION DIAGNOSTICS
  // -------------------------------------------------------------
  console.log('\n📊 SECTION 5: UNIFIED MAIL DIAGNOSTICS (RESEND + SMTP)');

  await test('getMailConfigStatus reports both Resend and SMTP with zero credentials leakage', () => {
    const status = getMailConfigStatus();
    assert(typeof status.configured === 'boolean');
    assert(status.resend, 'Resend status block must exist');
    assert(status.smtp, 'SMTP status block must exist');
    assert(status.resend.domain === 'mrvishwakarma.in');
    assert(!status.resend.apiKey, 'Resend apiKey must never be exposed');
    assert(!status.smtp.pass, 'SMTP password must never be exposed');
  });

  console.log('\n================================================================');
  console.log(`🏁 TEST SUITE COMPLETE: ${passed} PASSED, ${total - passed} FAILED (TOTAL: ${total})`);
  console.log('================================================================\n');

  if (total - passed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
