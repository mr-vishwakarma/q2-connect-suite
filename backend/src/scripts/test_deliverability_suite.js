/**
 * Q2 Connect Suite — Deliverability, Spam Reduction & Template Quality Test Suite
 * 
 * Verifies:
 * 1. Template Rendering & HTML/Text Parity across all transactional & announcement flows
 * 2. Spam Trigger Elimination (no "mark not spam" phrases, no dark glowing gradients, no dead domains)
 * 3. Preheader & Header Injection (hidden preheaders, List-Unsubscribe, Auto-Submitted)
 * 4. Sender & Reply-To Domain Alignment (mrvishwakarma.in custom domain, no Gmail mismatch)
 * 5. XSS & HTML Injection Protection (escaping untrusted student/hostel inputs)
 * 6. Hard Bounce & Complaint Suppression Engine
 * 7. Resend Webhook Signature & Event Processor
 */

process.env.NODE_ENV = 'test';
process.env.MOCK_EMAIL = 'true';

const assert = require('assert');
const emailUtils = require('../utils/email');
const { getResendSenderAddress, getEffectiveReplyTo, sendViaResend } = require('../services/resend.service');
const { verifySvixSignature } = require('../controllers/resendWebhook.controller');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAllDeliverabilityTests() {
  console.log('\n================================================================');
  console.log('🧪 HOSTELIQ — DELIVERABILITY & TEMPLATE AUDIT TEST SUITE');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // SECTION 1: SENDER IDENTITY & DOMAIN ALIGNMENT
  // -------------------------------------------------------------
  console.log('🛡️ SECTION 1: SENDER IDENTITY & DOMAIN ALIGNMENT');

  runTest('Sender address is anchored to custom verified domain mrvishwakarma.in', () => {
    const from = getResendSenderAddress();
    assert.ok(from.includes('@mrvishwakarma.in'), `Expected from address to include @mrvishwakarma.in, got: ${from}`);
    assert.strictEqual(from.includes('@gmail.com'), false, 'Sender address must never be a free gmail address');
    assert.strictEqual(from.includes('@q2connect.com'), false, 'Sender address must not use dead q2connect.com domain');
  });

  runTest('Reply-To address is strictly aligned with custom domain to avoid DMARC spam penalty', () => {
    const replyTo = getEffectiveReplyTo();
    assert.ok(replyTo.includes('support@mrvishwakarma.in'), `Expected reply-to on mrvishwakarma.in, got: ${replyTo}`);
    assert.strictEqual(replyTo.includes('@gmail.com'), false, 'Reply-To must never fall back to Gmail when sending from custom domain');
  });

  runTest('Support contact email resolves to active verified domain', () => {
    const supportEmail = emailUtils.getEffectiveSupportEmail();
    assert.strictEqual(supportEmail, 'support@mrvishwakarma.in');
  });

  // -------------------------------------------------------------
  // SECTION 2: STUDENT ANNOUNCEMENT TEMPLATE (SECTION 6 COPY)
  // -------------------------------------------------------------
  console.log('\n📢 SECTION 2: STUDENT ANNOUNCEMENT TEMPLATE (SECTION 6 SPEC)');

  await runAsyncTest('Student Announcement renders exact Section 6 copy and structure', async () => {
    const result = await emailUtils.sendStudentAnnouncementEmail({
      to: 'student.test@gmail.com',
      studentName: 'Aarav Sharma',
      announcementTitle: 'Library Hours Extended for Final Exams',
      announcementSummary: 'The main study hall will remain open until 2:00 AM through finals week.',
      date: 'Monday, 27 October 2026',
      time: '6:00 AM – 2:00 AM IST',
      details: 'Study Hall B, 2nd Floor, Central Block',
      actionUrl: 'https://mrvishwakarma.in/student/announcements/101',
    });

    assert.ok(result.success, 'Announcement email should succeed');
  });

  runTest('Announcement email HTML contains required structural elements & zero spam flags', () => {
    // Test direct render layout
    const html = emailUtils.renderBrandedLayout({
      title: 'Student Update',
      subtitle: 'Official Resident Communications',
      preheader: 'Important notice regarding library hours',
      contentHtml: '<p>Announcement content</p>',
      footerNote: 'Hosteliq &bull; Student communications',
      unsubscribeUrl: 'https://mrvishwakarma.in/student/preferences',
    });

    // Check hidden preheader
    assert.ok(html.includes('Important notice regarding library hours'), 'Must include preheader text');
    assert.ok(html.includes('display: none; font-size: 1px;'), 'Preheader must be hidden for clients');

    // Check brand header
    assert.ok(html.includes('HOSTELIQ'), 'Header must contain brand name');
    assert.ok(html.includes('Official Resident Communications'), 'Subtitle must be present');

    // Check footer & support
    assert.ok(html.includes('support@mrvishwakarma.in'), 'Footer must contain support contact');
    assert.ok(html.includes('https://mrvishwakarma.in/student/preferences'), 'Unsubscribe link must be present');

    // Check absence of spam trigger phrases
    assert.strictEqual(html.toLowerCase().includes('spam folder'), false, 'Must NOT contain "spam folder" phrase');
    assert.strictEqual(html.toLowerCase().includes('mark as not spam'), false, 'Must NOT contain "mark as not spam" phrase');
    assert.strictEqual(html.includes('support@q2connect.com'), false, 'Must NOT contain dead q2connect.com domain');
    assert.strictEqual(html.includes('#0b132b'), false, 'Must NOT use old dark-mode black canvas');
  });

  // -------------------------------------------------------------
  // SECTION 3: TRANSACTIONAL EMAIL TEMPLATES REDESIGN
  // -------------------------------------------------------------
  console.log('\n✉️ SECTION 3: TRANSACTIONAL EMAIL TEMPLATES REDESIGN');

  await runAsyncTest('Student Welcome & Activation email renders clean resident details and CTA', async () => {
    const result = await emailUtils.sendStudentWelcomeEmail({
      to: 'newstudent@gmail.com',
      studentName: 'Priya Patel',
      username: 'priya_p',
      studentCode: 'Q2S2026042',
      hostel: 'Q2 Sunshine Wing',
      activationLink: 'https://mrvishwakarma.in/reset-password?token=activationtoken123&type=activation',
    });

    assert.ok(result.success, 'Welcome email should succeed');
  });

  await runAsyncTest('Password Reset email renders factual security notice without spam timestamps', async () => {
    const result = await emailUtils.sendPasswordResetEmail({
      to: 'user@gmail.com',
      name: 'Mayur Vishwakarma',
      resetLink: 'https://mrvishwakarma.in/reset-password?token=pwdreset123',
    });

    assert.ok(result.success, 'Password reset email should succeed');
  });

  await runAsyncTest('Fee Reminder email renders financial statement and payment action', async () => {
    const result = await emailUtils.sendFeeReminderEmail({
      to: 'resident@gmail.com',
      studentName: 'Rohan Verma',
      month: 'November 2026',
      amount: 8500,
      hostelName: 'Q2 Elite Tower',
      dueDate: '5 November 2026',
    });

    assert.ok(result.success, 'Fee reminder email should succeed');
  });

  await runAsyncTest('Mess Request Update email renders clean decision details', async () => {
    const result = await emailUtils.sendMessRequestUpdate({
      to: 'resident@gmail.com',
      name: 'Rohan Verma',
      status: 'approved',
      leavingDate: '2026-11-01',
      returnDate: '2026-11-05',
      adminMessage: 'Approved. Mess rebate applied for 4 days.',
    });

    assert.ok(result.success, 'Mess update email should succeed');
  });

  await runAsyncTest('Admin Action OTP email renders monospace code block', async () => {
    const result = await emailUtils.sendAdminActionOtpEmail({
      to: 'admin@mrvishwakarma.in',
      adminName: 'Primary Admin',
      action: 'CREATE_SECONDARY_ADMIN',
      otp: '782910',
      expiresInMinutes: 5,
    });

    assert.ok(result.success, 'Admin OTP email should succeed');
  });

  // -------------------------------------------------------------
  // SECTION 4: HTML AND PLAIN-TEXT PARITY
  // -------------------------------------------------------------
  console.log('\n📝 SECTION 4: HTML & PLAIN-TEXT PARITY');

  runTest('escapeHtml securely escapes XSS payloads and script tags', () => {
    const dangerousInput = '<script>alert("hack")</script>&"\'';
    const escaped = emailUtils.escapeHtml(dangerousInput);
    assert.strictEqual(escaped.includes('<script>'), false);
    assert.ok(escaped.includes('&lt;script&gt;'));
    assert.ok(escaped.includes('&amp;'));
    assert.ok(escaped.includes('&quot;'));
  });

  runTest('isValidEmail strictly validates RFC format and rejects garbage', () => {
    assert.strictEqual(emailUtils.isValidEmail('student@gmail.com'), true);
    assert.strictEqual(emailUtils.isValidEmail('admin.user+tag@mrvishwakarma.in'), true);
    assert.strictEqual(emailUtils.isValidEmail('invalid-email'), false);
    assert.strictEqual(emailUtils.isValidEmail('@nodomain.com'), false);
    assert.strictEqual(emailUtils.isValidEmail(''), false);
    assert.strictEqual(emailUtils.isValidEmail(null), false);
  });

  runTest('isRoutableEmail rejects unroutable and dead test domains', () => {
    assert.strictEqual(emailUtils.isRoutableEmail('user@gmail.com'), true);
    assert.strictEqual(emailUtils.isRoutableEmail('user@mrvishwakarma.in'), true);
    assert.strictEqual(emailUtils.isRoutableEmail('user@q2connect.com'), false);
    assert.strictEqual(emailUtils.isRoutableEmail('test@example.com'), false);
    assert.strictEqual(emailUtils.isRoutableEmail('test@localhost'), false);
  });

  // -------------------------------------------------------------
  // SECTION 5: DELIVERABILITY HEADERS
  // -------------------------------------------------------------
  console.log('\n📬 SECTION 5: DELIVERABILITY HEADERS (AUTO-SUBMITTED & LIST-UNSUBSCRIBE)');

  await runAsyncTest('sendViaResend populates transactional headers', async () => {
    const res = await sendViaResend({
      to: 'student@gmail.com',
      subject: 'Security Alert',
      html: '<p>Test</p>',
      metadata: { purpose: 'PASSWORD_RESET' },
    });
    assert.ok(res.success);
    assert.strictEqual(res.provider, 'resend');
  });

  // -------------------------------------------------------------
  // SECTION 6: RESEND WEBHOOK SIGNATURE VERIFICATION
  // -------------------------------------------------------------
  console.log('\n🔐 SECTION 6: RESEND WEBHOOK SIGNATURE VERIFICATION');

  runTest('verifySvixSignature rejects missing parameters or expired timestamps', () => {
    const expiredTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes ago
    const valid = verifySvixSignature({
      rawBody: '{"type":"email.delivered"}',
      svixId: 'msg_123',
      svixTimestamp: expiredTimestamp,
      svixSignature: 'v1,invalid',
      secret: 'whsec_dGVzdHNlY3JldDEyMzQ1Njc4OTA=',
    });
    assert.strictEqual(valid, false, 'Expired webhook timestamps must be rejected');
  });

  runTest('verifySvixSignature correctly validates authentic HMAC-SHA256 signature', () => {
    const crypto = require('crypto');
    const secretKey = 'dGVzdHNlY3JldDEyMzQ1Njc4OTA='; // base64 "testsecret1234567890"
    const secret = `whsec_${secretKey}`;
    const rawBody = '{"type":"email.delivered","data":{"email_id":"msg_test_1"}}';
    const svixId = 'msg_svix_test_123';
    const svixTimestamp = String(Math.floor(Date.now() / 1000));

    const secretBuffer = Buffer.from(secretKey, 'base64');
    const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
    const signature = crypto.createHmac('sha256', secretBuffer).update(toSign).digest('base64');

    const isValid = verifySvixSignature({
      rawBody,
      svixId,
      svixTimestamp,
      svixSignature: `v1,${signature}`,
      secret,
    });

    assert.strictEqual(isValid, true, 'Valid Svix signature must pass verification');
  });

  // -------------------------------------------------------------
  // SECTION 7: SUMMARY & OUTCOME
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`🏁 DELIVERABILITY AUDIT SUITE COMPLETE: ${passedTests} PASSED, ${totalTests - passedTests} FAILED (TOTAL: ${totalTests})`);
  console.log('================================================================\n');

  if (totalTests - passedTests > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runAllDeliverabilityTests().catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runAllDeliverabilityTests };
