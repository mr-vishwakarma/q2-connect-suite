/**
 * Phase 14 — Comprehensive End-to-End Integration & Regression Test Suite
 * Unified Plans & Pricing, Tenant Onboarding, Voucher Activation, Trials,
 * Prorated Upgrades, Scheduled Downgrades, Pricing Snapshots, Security & Reconciliation
 *
 * Covers all 12 Scenarios (A–L) against a local MongoDB instance via full Express routes.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const http = require('http');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');

const Plan = require('../models/Plan');
const Organization = require('../models/Organization');
const Subscription = require('../models/Subscription');
const Hostel = require('../models/Hostel');
const User = require('../models/User');
const Membership = require('../models/Membership');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const LedgerEntry = require('../models/LedgerEntry');
const OrganizationFeature = require('../models/OrganizationFeature');
const Voucher = require('../models/Voucher');
const VoucherRedemption = require('../models/VoucherRedemption');
const AuditLog = require('../models/AuditLog');
const WebhookEvent = require('../models/WebhookEvent');

const authRoutes = require('../routes/auth.routes');
const superAdminRoutes = require('../routes/superAdmin.routes');
const { superAdminVoucherRoutes, checkoutVoucherRoutes } = require('../routes/voucher.routes');
const billingRoutes = require('../routes/billing.routes');
const webhookRoutes = require('../routes/webhook.routes');
const studentsRoutes = require('../routes/students.routes');
const hostelsRoutes = require('../routes/hostels.routes');
const feesRoutes = require('../routes/fees.routes');

const { generatePaymentSignature, generateWebhookSignature } = require('../config/razorpay');
const { runReconciliation } = require('./reconcile_subscriptions_and_plans');

const TEST_PORT = 5099;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
    throw new Error(`Assertion failed: ${message}`);
  } else {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  }
}

function makeRequest(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
    const bodyString = body !== null && body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
    const reqHeaders = {
      ...(bodyString ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyString) } : {}),
      ...headers,
    };

    const req = http.request(
      url,
      { method, headers: reqHeaders, timeout: 10000 },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : {};
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout calling ${method} ${reqPath}`));
    });

    if (bodyString) req.write(bodyString);
    req.end();
  });
}

async function runE2ESuite() {
  console.log('\n======================================================================');
  console.log('🚀 RUNNING UNIFIED PLANS, ONBOARDING & SUBSCRIPTION LIFECYCLE E2E SUITE');
  console.log('======================================================================\n');

  process.env.ALLOW_TEST_PAYMENTS = 'true';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-key';
  process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret_123456';

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/q2connect_test_unified_e2e';
  if (!mongoUri.includes('127.0.0.1') && !mongoUri.includes('localhost')) {
    throw new Error(`Refusing to run destructive E2E test against non-local MongoDB: ${mongoUri}`);
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 8000 });
  await mongoose.connection.dropDatabase();
  console.log(`Connected cleanly to dedicated local test DB (${mongoUri})\n`);

  // Build realistic Express test server
  const app = express();
  app.use((req, res, next) => {
    req.requestId = `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    next();
  });
  app.use(
    express.json({
      limit: '5mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    })
  );
  app.use('/api/auth', authRoutes);
  app.use('/api/super-admin', superAdminRoutes);
  app.use('/api/super-admin/vouchers', superAdminVoucherRoutes);
  app.use('/api/billing', billingRoutes);
  app.use('/api/billing/vouchers', checkoutVoucherRoutes);
  app.use('/api/subscriptions', billingRoutes);
  app.use('/api/webhooks', webhookRoutes);
  app.use('/api/students', studentsRoutes);
  app.use('/api/hostels', hostelsRoutes);
  app.use('/api/fees', feesRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  try {
    // Create & login Super Admin
    const saPass = 'SuperAdmin@2026!';
    const saUser = await User.create({
      name: 'Platform Super Admin',
      email: 'superadmin@hosteliq.test',
      username: 'superadmin_e2e',
      password: saPass,
      role: 'super_admin',
      isSuperAdmin: true,
      isActive: true,
      status: 'ACTIVE',
    });

    const saLoginRes = await makeRequest('POST', '/api/auth/super-admin/login', {
      username: saUser.username,
      password: saPass,
    });
    assert(saLoginRes.status === 200 && Boolean(saLoginRes.body.accessToken), 'Super Admin authenticated cleanly');
    const saHeaders = { Authorization: `Bearer ${saLoginRes.body.accessToken}` };

    // =========================================================================
    // SCENARIO A: Authoritative Plan Catalog & Correct ₹4,999 Plan Assignment
    // =========================================================================
    console.log('\n--- [Scenario A] Authoritative Plan Catalog & ₹4,999 Annual Plan Onboarding ---');

    const starterRes = await makeRequest(
      'POST',
      '/api/super-admin/plans',
      {
        name: 'Starter Nano',
        code: 'STARTER',
        description: 'Basic single branch starter',
        priceMonthly: 199,
        priceYearly: 1990,
        allowedBillingCycles: ['MONTHLY', 'YEARLY'],
        trialEligible: true,
        trialDays: 14,
        sortOrder: 1,
        limits: { maxStudents: 2, maxRooms: 20, maxHostels: 1, maxStaff: 3, storageGb: 2 },
        includedFeatures: ['student_management', 'room_management', 'fee_management'],
        status: 'ACTIVE',
      },
      saHeaders
    );
    assert(starterRes.status === 201, 'Created ₹199 Starter plan in Super Admin catalog');
    const starterPlan = starterRes.body.data;

    const midRes = await makeRequest(
      'POST',
      '/api/super-admin/plans',
      {
        name: 'Mid Tier Hostel',
        code: 'MID_TIER',
        description: 'Standard hostel tier',
        priceMonthly: 1999,
        priceYearly: 19990,
        allowedBillingCycles: ['MONTHLY', 'YEARLY'],
        trialEligible: true,
        trialDays: 14,
        sortOrder: 2,
        limits: { maxStudents: 150, maxRooms: 60, maxHostels: 2, maxStaff: 8, storageGb: 5 },
        includedFeatures: ['student_management', 'room_management', 'fee_management', 'mess_management'],
        status: 'ACTIVE',
      },
      saHeaders
    );
    assert(midRes.status === 201, 'Created ₹1,999 Mid Tier plan in Super Admin catalog');
    const midPlan = midRes.body.data;

    const scaleRes = await makeRequest(
      'POST',
      '/api/super-admin/plans',
      {
        name: 'Scale Annual Plan',
        code: 'SCALE_4999',
        description: 'High-value annual tier',
        priceMonthly: 699,
        priceYearly: 4999,
        allowedBillingCycles: ['MONTHLY', 'YEARLY'],
        trialEligible: true,
        trialDays: 14,
        sortOrder: 3,
        limits: { maxStudents: 500, maxRooms: 200, maxHostels: 5, maxStaff: 20, storageGb: 25 },
        includedFeatures: [
          'student_management',
          'room_management',
          'fee_management',
          'mess_management',
          'expense_management',
          'advanced_analytics',
        ],
        status: 'ACTIVE',
      },
      saHeaders
    );
    assert(scaleRes.status === 201, 'Created ₹4,999 Scale Annual plan in Super Admin catalog');
    const scalePlan = scaleRes.body.data;

    const noTrialRes = await makeRequest(
      'POST',
      '/api/super-admin/plans',
      {
        name: 'Enterprise Dedicated',
        code: 'ENT_NOTRIAL',
        description: 'Enterprise without self-serve trial',
        priceMonthly: 9999,
        priceYearly: 99990,
        allowedBillingCycles: ['YEARLY'],
        trialEligible: false,
        trialDays: 0,
        sortOrder: 4,
        limits: { maxStudents: 0, maxRooms: 0, maxHostels: 0, maxStaff: 0, storageGb: 100 },
        includedFeatures: ['student_management', 'room_management', 'fee_management', 'api_access'],
        status: 'ACTIVE',
      },
      saHeaders
    );
    assert(noTrialRes.status === 201, 'Created Enterprise Dedicated plan (YEARLY-only, trialEligible=false)');
    const noTrialPlan = noTrialRes.body.data;

    const archivedRes = await makeRequest(
      'POST',
      '/api/super-admin/plans',
      {
        name: 'Legacy Archived Plan',
        code: 'LEGACY_ARC',
        priceMonthly: 777,
        priceYearly: 7770,
        status: 'ARCHIVED',
      },
      saHeaders
    );
    assert(archivedRes.status === 201, 'Created archived plan for visibility boundary check');
    const archivedPlan = archivedRes.body.data;

    // Verify GET /api/billing/plans excludes ARCHIVED plan and exposes active catalog plans
    const publicPlansRes = await makeRequest('GET', '/api/billing/plans');
    assert(publicPlansRes.status === 200, 'Public GET /api/billing/plans returns 200 OK');
    const publicCodes = (publicPlansRes.body.data || []).map((p) => p.code);
    assert(
      publicCodes.includes('STARTER') &&
        publicCodes.includes('MID_TIER') &&
        publicCodes.includes('SCALE_4999') &&
        !publicCodes.includes('LEGACY_ARC'),
      'Published catalog includes all active plans and hides ARCHIVED plan'
    );

    // Selecting ARCHIVED plan during onboarding MUST fail
    const badOnboardRes = await makeRequest(
      'POST',
      '/api/super-admin/organizations',
      {
        name: 'Invalid Archive Org',
        contactEmail: 'invalid-arc@test.com',
        adminName: 'Inv',
        adminEmail: 'inv-admin@test.com',
        planId: archivedPlan._id,
        billingCycle: 'MONTHLY',
      },
      saHeaders
    );
    assert(badOnboardRes.status === 400, 'Onboarding with ARCHIVED plan is rejected with 400');

    // Onboard Org A selecting Scale Annual Plan (₹4,999 YEARLY)
    const orgARes = await makeRequest(
      'POST',
      '/api/super-admin/organizations',
      {
        name: 'Alpha Residency Network',
        slug: 'alpha-residency',
        contactEmail: 'alpha@residency.test',
        branchName: 'Alpha Main Campus',
        branchCode: 'ALPHA1',
        adminName: 'Vikram Alpha',
        adminEmail: 'admin.alpha@residency.test',
        planId: scalePlan._id,
        billingCycle: 'YEARLY',
        activationMode: 'PENDING',
      },
      saHeaders
    );
    assert(orgARes.status === 201, 'Onboarded Org A with Scale Annual Plan (201 Created)');
    const orgA = orgARes.body.data.organization;
    const subACreated = orgARes.body.data.subscription;
    assert(
      String(subACreated.planId) === String(scalePlan._id) &&
        subACreated.agreedPriceRupees === 4999 &&
        subACreated.billingCycle === 'YEARLY' &&
        subACreated.status === 'PENDING_PAYMENT' &&
        subACreated.pricingSnapshot?.planName === 'Scale Annual Plan' &&
        subACreated.pricingSnapshot?.agreedPriceRupees === 4999,
      'Onboarding saved exact Scale Annual Plan ID, YEARLY cycle, ₹4,999 agreedPriceRupees, and immutable pricingSnapshot (no Starter substitution)'
    );

    // Super Admin initiates & verifies online payment for Org A
    const initPayARes = await makeRequest(
      'POST',
      `/api/super-admin/organizations/${orgA._id}/subscription/initiate-payment`,
      { planId: scalePlan._id, billingCycle: 'YEARLY' },
      saHeaders
    );
    assert(
      initPayARes.status === 201 && initPayARes.body.data.amountRupees === 4999,
      'Super Admin payment order initiated at authoritative ₹4,999'
    );
    const payAId = `pay_alpha_${Date.now()}`;
    const sigA = generatePaymentSignature(initPayARes.body.data.orderId, payAId);

    const vfyPayARes = await makeRequest(
      'POST',
      `/api/super-admin/organizations/${orgA._id}/subscription/verify-payment`,
      {
        razorpay_order_id: initPayARes.body.data.orderId,
        razorpay_payment_id: payAId,
        razorpay_signature: sigA,
      },
      saHeaders
    );
    assert(
      vfyPayARes.status === 200 &&
        vfyPayARes.body.data.status === 'ACTIVE' &&
        vfyPayARes.body.data.agreedPriceRupees === 4999 &&
        vfyPayARes.body.data.planName === 'Scale Annual Plan',
      'Payment verification activated Org A Scale Annual Plan (₹4,999)'
    );

    // Activate Admin A account and log in as Hostel Admin A
    const adminUserA = await User.findOne({ email: 'admin.alpha@residency.test' });
    const rawTokenA = crypto.randomBytes(32).toString('hex');
    adminUserA.activationToken = crypto.createHash('sha256').update(rawTokenA).digest('hex');
    adminUserA.activationExpires = new Date(Date.now() + 24 * 3600 * 1000);
    await adminUserA.save();

    const actAdminARes = await makeRequest('POST', '/api/auth/reset-password', {
      token: rawTokenA,
      password: 'AlphaPassword@2026!',
      confirmPassword: 'AlphaPassword@2026!',
    });
    assert(actAdminARes.status === 200, 'Hostel Admin A activated account');

    const loginAdminARes = await makeRequest('POST', '/api/auth/admin/login', {
      username: adminUserA.username,
      password: 'AlphaPassword@2026!',
    });
    assert(loginAdminARes.status === 200, 'Hostel Admin A logged in');
    const adminAHeaders = { Authorization: `Bearer ${loginAdminARes.body.accessToken}` };

    const adminASubRes = await makeRequest('GET', '/api/billing/subscription', null, adminAHeaders);
    assert(
      adminASubRes.status === 200 &&
        adminASubRes.body.data.planId?.name === 'Scale Annual Plan' &&
        adminASubRes.body.data.pricingSnapshot?.agreedPriceRupees === 4999 &&
        adminASubRes.body.data.agreedPriceRupees === 4999 &&
        adminASubRes.body.data.billingCycle === 'YEARLY' &&
        adminASubRes.body.data.status === 'ACTIVE',
      'Hostel Admin Billing displays exact Scale Annual Plan & ₹4,999 (ZERO Starter/₹199 mismatch)'
    );

    const saOrgDetailRes = await makeRequest('GET', `/api/super-admin/organizations/${orgA._id}`, null, saHeaders);
    const saSubDetailRes = await makeRequest(
      'GET',
      `/api/super-admin/subscriptions/${subACreated._id}`,
      null,
      saHeaders
    );
    assert(
      saOrgDetailRes.body.data.subscription?.agreedPriceRupees === 4999 &&
        saSubDetailRes.body.data.subscription?.pricingSnapshot?.planName === 'Scale Annual Plan',
      'Super Admin Org Detail & Subscription Detail consistently reflect ₹4,999 Scale Annual Plan'
    );

    // =========================================================================
    // SCENARIO B: Mid Tier Plan (₹1,999 Monthly) Consistency
    // =========================================================================
    console.log('\n--- [Scenario B] ₹1,999 Monthly Plan Onboarding & Self-Serve Activation ---');
    const orgBRes = await makeRequest(
      'POST',
      '/api/super-admin/organizations',
      {
        name: 'Beta Living Spaces',
        slug: 'beta-living',
        contactEmail: 'beta@living.test',
        branchName: 'Beta Block A',
        branchCode: 'BETA1',
        adminName: 'Riya Beta',
        adminEmail: 'admin.beta@living.test',
        planId: midPlan._id,
        billingCycle: 'MONTHLY',
        activationMode: 'PENDING',
      },
      saHeaders
    );
    assert(orgBRes.status === 201, 'Onboarded Org B with Mid Tier Plan (₹1,999 MONTHLY)');
    const orgB = orgBRes.body.data.organization;

    const adminUserB = await User.findOne({ email: 'admin.beta@living.test' });
    const rawTokenB = crypto.randomBytes(32).toString('hex');
    adminUserB.activationToken = crypto.createHash('sha256').update(rawTokenB).digest('hex');
    adminUserB.activationExpires = new Date(Date.now() + 24 * 3600 * 1000);
    await adminUserB.save();
    await makeRequest('POST', '/api/auth/reset-password', {
      token: rawTokenB,
      password: 'BetaPassword@2026!',
      confirmPassword: 'BetaPassword@2026!',
    });
    const loginAdminBRes = await makeRequest('POST', '/api/auth/admin/login', {
      username: adminUserB.username,
      password: 'BetaPassword@2026!',
    });
    const adminBHeaders = { Authorization: `Bearer ${loginAdminBRes.body.accessToken}` };

    const adminBSubBeforePay = await makeRequest('GET', '/api/billing/subscription', null, adminBHeaders);
    assert(
      adminBSubBeforePay.body.data.status === 'PENDING_PAYMENT' &&
        adminBSubBeforePay.body.data.planId?.code === 'MID_TIER' &&
        adminBSubBeforePay.body.data.agreedPriceRupees === 1999 &&
        adminBSubBeforePay.body.data.availableActions?.isPendingPayment === true,
      'Hostel Admin B sees PENDING_PAYMENT status on exact selected ₹1,999 Mid Tier plan'
    );

    const createPayBRes = await makeRequest(
      'POST',
      '/api/billing/subscriptions/create',
      { planId: midPlan._id, billingCycle: 'MONTHLY' },
      adminBHeaders
    );
    assert(createPayBRes.status === 201 && createPayBRes.body.data.amountRupees === 1999, 'Admin B order created for ₹1,999');

    const payBId = `pay_beta_${Date.now()}`;
    const vfyBRes = await makeRequest(
      'POST',
      '/api/billing/subscriptions/verify',
      {
        razorpay_order_id: createPayBRes.body.data.orderId,
        razorpay_payment_id: payBId,
        razorpay_signature: generatePaymentSignature(createPayBRes.body.data.orderId, payBId),
      },
      adminBHeaders
    );
    assert(
      vfyBRes.status === 200 &&
        vfyBRes.body.data.status === 'ACTIVE' &&
        vfyBRes.body.data.agreedPriceRupees === 1999 &&
        vfyBRes.body.data.planName === 'Mid Tier Hostel',
      'Admin B payment verification activated ₹1,999 Mid Tier Hostel plan'
    );

    // =========================================================================
    // SCENARIO C: Online Payment Failure & Webhook Verification/Idempotency
    // =========================================================================
    console.log('\n--- [Scenario C] Payment Failure Protection & Webhook Idempotency ---');
    const orgCRes = await makeRequest(
      'POST',
      '/api/super-admin/organizations',
      {
        name: 'Gamma Dorms',
        slug: 'gamma-dorms',
        contactEmail: 'gamma@dorms.test',
        branchName: 'Gamma Wing',
        branchCode: 'GAMMA1',
        adminName: 'Karan Gamma',
        adminEmail: 'admin.gamma@dorms.test',
        planId: midPlan._id,
        billingCycle: 'MONTHLY',
        activationMode: 'PENDING',
      },
      saHeaders
    );
    const orgC = orgCRes.body.data.organization;
    const initCRes = await makeRequest(
      'POST',
      `/api/super-admin/organizations/${orgC._id}/subscription/initiate-payment`,
      { planId: midPlan._id, billingCycle: 'MONTHLY' },
      saHeaders
    );
    const orderC = initCRes.body.data.orderId;

    // Record failure -> must NOT activate subscription
    const failCRes = await makeRequest(
      'POST',
      `/api/super-admin/organizations/${orgC._id}/subscription/payment-failed`,
      { orderId: orderC, code: 'GATEWAY_DISMISSED', reason: 'User closed checkout window' },
      saHeaders
    );
    assert(failCRes.status === 200 && failCRes.body.data.subscriptionStatus === 'PAYMENT_FAILED', 'Failure transitions pending sub to PAYMENT_FAILED without activating');
    const failedPayC = await Payment.findOne({ orderId: orderC });
    const orgCCheck = await Organization.findById(orgC._id);
    assert(failedPayC?.status === 'FAILED' && orgCCheck?.status !== 'ACTIVE', 'Payment recorded FAILED and org remains non-ACTIVE');

    // Re-initiate and verify via Razorpay webhook + duplicate delivery
    const initC2Res = await makeRequest(
      'POST',
      `/api/super-admin/organizations/${orgC._id}/subscription/initiate-payment`,
      { planId: midPlan._id, billingCycle: 'MONTHLY' },
      saHeaders
    );
    const orderC2 = initC2Res.body.data.orderId;
    const whPaymentId = `pay_wh_${Date.now()}`;
    const whPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: whPaymentId,
            order_id: orderC2,
            amount: 199900,
            currency: 'INR',
            method: 'upi',
          },
        },
      },
    };
    const whRaw = JSON.stringify(whPayload);
    const whSig = generateWebhookSignature(whRaw, process.env.RAZORPAY_WEBHOOK_SECRET);

    // Forged webhook rejected
    const badWhRes = await makeRequest('POST', '/api/webhooks/razorpay', whPayload, {
      'x-razorpay-signature': 'forged_sig',
      'x-razorpay-event-id': `ev_bad_${Date.now()}`,
    });
    assert(badWhRes.status === 400, 'Forged webhook signature rejected with 400');

    // Valid webhook activates cleanly; duplicate event suppressed
    const evIdC = `ev_good_${Date.now()}`;
    const goodWh1 = await makeRequest('POST', '/api/webhooks/razorpay', whPayload, {
      'x-razorpay-signature': whSig,
      'x-razorpay-event-id': evIdC,
    });
    const goodWh2 = await makeRequest('POST', '/api/webhooks/razorpay', whPayload, {
      'x-razorpay-signature': whSig,
      'x-razorpay-event-id': evIdC,
    });
    const subCAfterWh = await Subscription.findOne({ organizationId: orgC._id });
    const invCountC = await Invoice.countDocuments({ organizationId: orgC._id });
    assert(
      goodWh1.status === 200 &&
        goodWh2.status === 200 &&
        goodWh2.body.duplicate === true &&
        subCAfterWh?.status === 'ACTIVE' &&
        invCountC === 1,
      'Webhook activated Org C exactly once with duplicate retry safely suppressed (1 Invoice)'
    );

    // =========================================================================
    // SCENARIO D & E: Voucher Types (ACTIVATION, TRIAL, DISCOUNT) & Security
    // =========================================================================
    console.log('\n--- [Scenario D & E] Vouchers (ACTIVATION, TRIAL, DISCOUNT), Pin Lockout & Concurrency ---');

    // Onboard Org D (Pending) & Org E (Pending)
    const orgDRes = await makeRequest(
      'POST',
      '/api/super-admin/organizations',
      {
        name: 'Delta Suites',
        slug: 'delta-suites',
        contactEmail: 'delta@suites.test',
        branchName: 'Delta Hall',
        branchCode: 'DELTA1',
        adminName: 'Neha Delta',
        adminEmail: 'admin.delta@suites.test',
        planId: scalePlan._id,
        billingCycle: 'YEARLY',
        activationMode: 'PENDING',
      },
      saHeaders
    );
    const orgD = orgDRes.body.data.organization;

    const orgERes = await makeRequest(
      'POST',
      '/api/super-admin/organizations',
      {
        name: 'Epsilon CoLive',
        slug: 'epsilon-colive',
        contactEmail: 'epsilon@colive.test',
        branchName: 'Epsilon Tower',
        branchCode: 'EPS1',
        adminName: 'Rohan Epsilon',
        adminEmail: 'admin.epsilon@colive.test',
        planId: midPlan._id,
        billingCycle: 'MONTHLY',
        activationMode: 'PENDING',
      },
      saHeaders
    );
    const orgE = orgERes.body.data.organization;

    // 1. ACTIVATION Voucher
    const actVchRes = await makeRequest(
      'POST',
      '/api/super-admin/vouchers',
      {
        name: 'Scale 60-Day Activation',
        voucherType: 'ACTIVATION',
        activationDurationDays: 60,
        eligiblePlans: [scalePlan._id],
        globalRedemptionLimit: 1,
        maxRedemptionsPerOrg: 1,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        scope: 'GLOBAL',
      },
      saHeaders
    );
    assert(actVchRes.status === 201, 'Super Admin created ACTIVATION voucher');
    const actCreds = actVchRes.body.data.credentials;

    // Ensure Super Admin list endpoint NEVER leaks PIN hashes or plaintext PIN
    const vchListRes = await makeRequest('GET', '/api/super-admin/vouchers', null, saHeaders);
    assert(
      !JSON.stringify(vchListRes.body).includes(actCreds.pin) &&
        !JSON.stringify(vchListRes.body).includes('pinVerifier') &&
        !JSON.stringify(vchListRes.body).includes('codeDigest'),
      'Voucher list API never exposes plaintext PIN, pinVerifier, or codeDigest'
    );

    // Concurrent redemption race on globalRedemptionLimit: 1
    const [race1, race2] = await Promise.all([
      makeRequest(
        'POST',
        `/api/super-admin/organizations/${orgD._id}/subscription/voucher/redeem`,
        {
          code: actCreds.code,
          pin: actCreds.pin,
          planId: scalePlan._id,
          billingCycle: 'YEARLY',
          idempotencyKey: `race_1_${Date.now()}`,
        },
        saHeaders
      ),
      makeRequest(
        'POST',
        `/api/super-admin/organizations/${orgD._id}/subscription/voucher/redeem`,
        {
          code: actCreds.code,
          pin: actCreds.pin,
          planId: scalePlan._id,
          billingCycle: 'YEARLY',
          idempotencyKey: `race_2_${Date.now()}`,
        },
        saHeaders
      ),
    ]);
    const okRaces = [race1, race2].filter((r) => r.status === 200);
    const badRaces = [race1, race2].filter((r) => r.status === 400);
    assert(
      okRaces.length === 1 && badRaces.length === 1 && okRaces[0].body.data.status === 'ACTIVE',
      'Parallel single-use ACTIVATION voucher redemption allows exactly 1 activation and blocks duplicate'
    );

    const subD = await Subscription.findOne({ organizationId: orgD._id }).populate('planId');
    assert(
      subD?.activationMethod === 'VOUCHER' && subD?.planId?.code === 'SCALE_4999' && subD?.agreedPriceRupees === 4999,
      'Org D subscription activated via VOUCHER preserving Scale Annual Plan & ₹4,999 snapshot'
    );

    // 2. TRIAL Voucher -> MUST NOT create Payment or Invoice
    const trialVchRes = await makeRequest(
      'POST',
      '/api/super-admin/vouchers',
      {
        name: 'VIP 21-Day Trial Pass',
        voucherType: 'TRIAL',
        trialDaysGranted: 21,
        eligiblePlans: [midPlan._id],
        globalRedemptionLimit: 2,
        maxRedemptionsPerOrg: 1,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        scope: 'GLOBAL',
      },
      saHeaders
    );
    assert(trialVchRes.status === 201, 'Super Admin created TRIAL voucher (21 days)');
    const trialCreds = trialVchRes.body.data.credentials;

    // Preview wrong plan rejected
    const wrongPlanVch = await makeRequest(
      'POST',
      `/api/super-admin/organizations/${orgE._id}/subscription/voucher/preview`,
      { code: trialCreds.code, pin: trialCreds.pin, planId: starterPlan._id, billingCycle: 'MONTHLY' },
      saHeaders
    );
    assert(wrongPlanVch.status === 400, 'Voucher rejected when applied to ineligible plan');

    // Redeem TRIAL voucher on Org E
    const redeemTrialVch = await makeRequest(
      'POST',
      `/api/super-admin/organizations/${orgE._id}/subscription/voucher/redeem`,
      {
        code: trialCreds.code,
        pin: trialCreds.pin,
        planId: midPlan._id,
        billingCycle: 'MONTHLY',
        idempotencyKey: `trial_vch_${Date.now()}`,
      },
      saHeaders
    );
    const payCountE = await Payment.countDocuments({ organizationId: orgE._id, billingDomain: 'SAAS' });
    const invCountE = await Invoice.countDocuments({ organizationId: orgE._id });
    assert(
      redeemTrialVch.status === 200 &&
        redeemTrialVch.body.data.status === 'TRIAL' &&
        redeemTrialVch.body.data.trialDaysGranted === 21 &&
        payCountE === 0 &&
        invCountE === 0,
      'TRIAL voucher entered TRIAL state cleanly (21 days) with ZERO fake Payment or Invoice records'
    );

    // 3. DISCOUNT Voucher Partial Checkout & PIN Brute-Force Lockout
    const discVchRes = await makeRequest(
      'POST',
      '/api/super-admin/vouchers',
      {
        name: '₹500 Off Launch',
        voucherType: 'DISCOUNT',
        discountAmountRupees: 500,
        eligiblePlans: [midPlan._id],
        globalRedemptionLimit: 5,
        maxRedemptionsPerOrg: 1,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        scope: 'GLOBAL',
      },
      saHeaders
    );
    const discCreds = discVchRes.body.data.credentials;

    const reservePart = await makeRequest(
      'POST',
      `/api/super-admin/organizations/${orgE._id}/subscription/voucher/reserve-partial`,
      { code: discCreds.code, pin: discCreds.pin, planId: midPlan._id, billingCycle: 'MONTHLY' },
      saHeaders
    );
    assert(
      reservePart.status === 200 &&
        reservePart.body.data.originalAmount === 1999 &&
        reservePart.body.data.discountAmount === 500 &&
        reservePart.body.data.amountRupees === 1499,
      'Partial DISCOUNT voucher reserves ₹500 off ₹1,999 = ₹1,499 payable'
    );

    const partPayId = `pay_part_${Date.now()}`;
    const vfyPart = await makeRequest(
      'POST',
      `/api/super-admin/organizations/${orgE._id}/subscription/voucher/verify-partial`,
      {
        checkoutSessionId: reservePart.body.data.checkoutSessionId,
        razorpay_order_id: reservePart.body.data.orderId,
        razorpay_payment_id: partPayId,
        razorpay_signature: generatePaymentSignature(reservePart.body.data.orderId, partPayId),
      },
      saHeaders
    );
    const invPart = await Invoice.findOne({ organizationId: orgE._id });
    assert(
      vfyPart.status === 200 &&
        vfyPart.body.data.status === 'ACTIVE' &&
        invPart?.originalAmountRupees === 1999 &&
        invPart?.discountRupees === 500 &&
        invPart?.totalRupees === 1499,
      'Partial DISCOUNT voucher verification activated Org E and generated accurate ₹1,499 invoice'
    );

    // Wrong PIN brute force lockout
    const lockVchRes = await makeRequest(
      'POST',
      '/api/super-admin/vouchers',
      {
        name: 'Brute Force Lock Test',
        voucherType: 'DISCOUNT',
        discountAmountRupees: 200,
        expiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
        scope: 'GLOBAL',
      },
      saHeaders
    );
    const lockCreds = lockVchRes.body.data.credentials;
    for (let i = 0; i < 5; i++) {
      await makeRequest(
        'POST',
        '/api/billing/vouchers/apply',
        { code: lockCreds.code, pin: '000000', planId: midPlan._id, billingCycle: 'MONTHLY' },
        adminBHeaders
      );
    }
    const lockedGoodPinAttempt = await makeRequest(
      'POST',
      '/api/billing/vouchers/apply',
      { code: lockCreds.code, pin: lockCreds.pin, planId: midPlan._id, billingCycle: 'MONTHLY' },
      adminBHeaders
    );
    assert(
      lockedGoodPinAttempt.status === 400,
      '5 wrong PIN attempts lock voucher so even valid PIN is rejected during cooldown'
    );

    // =========================================================================
    // SCENARIO F: Free Trial Eligibility, Activation & Trial->Paid Conversion
    // =========================================================================
    console.log('\n--- [Scenario F] Free Trial Eligibility, No Renew on Trial, & Conversion ---');
    const orgFRes = await makeRequest(
      'POST',
      '/api/super-admin/organizations',
      {
        name: 'Zeta Residences',
        slug: 'zeta-res',
        contactEmail: 'zeta@res.test',
        branchName: 'Zeta Main',
        branchCode: 'ZETA1',
        adminName: 'Tara Zeta',
        adminEmail: 'admin.zeta@res.test',
        planId: noTrialPlan._id,
        billingCycle: 'YEARLY',
        activationMode: 'FREE_TRIAL',
      },
      saHeaders
    );
    assert(
      orgFRes.status === 400 && /not permitted/i.test(orgFRes.body.message || ''),
      'Trial request rejected cleanly for plan with trialEligible=false'
    );

    // Onboard Zeta on eligible Mid Tier initially Pending, then Admin F activates trial
    const orgF2Res = await makeRequest(
      'POST',
      '/api/super-admin/organizations',
      {
        name: 'Zeta Eligible Residences',
        slug: 'zeta-eligible',
        contactEmail: 'zeta2@res.test',
        branchName: 'Zeta Main',
        branchCode: 'ZETA2',
        adminName: 'Tara Zeta',
        adminEmail: 'admin.zeta2@res.test',
        planId: midPlan._id,
        billingCycle: 'MONTHLY',
        activationMode: 'PENDING',
      },
      saHeaders
    );
    assert(orgF2Res.status === 201, 'Onboarded Zeta Eligible as PENDING_PAYMENT');
    const adminUserF = await User.findOne({ email: 'admin.zeta2@res.test' });
    const rawTokenF = crypto.randomBytes(32).toString('hex');
    adminUserF.activationToken = crypto.createHash('sha256').update(rawTokenF).digest('hex');
    adminUserF.activationExpires = new Date(Date.now() + 24 * 3600 * 1000);
    await adminUserF.save();
    await makeRequest('POST', '/api/auth/reset-password', {
      token: rawTokenF,
      password: 'ZetaPassword@2026!',
      confirmPassword: 'ZetaPassword@2026!',
    });
    const loginF = await makeRequest('POST', '/api/auth/admin/login', {
      username: adminUserF.username,
      password: 'ZetaPassword@2026!',
    });
    const adminFHeaders = { Authorization: `Bearer ${loginF.body.accessToken}` };

    const startTrialRes = await makeRequest(
      'POST',
      '/api/billing/subscription/trial',
      { planId: midPlan._id, billingCycle: 'MONTHLY' },
      adminFHeaders
    );
    assert(startTrialRes.status === 200, 'Hostel Admin F started 14-day configured Free Trial');

    const trialStatusRes = await makeRequest('GET', '/api/billing/subscription', null, adminFHeaders);
    const trialActions = trialStatusRes.body.data?.availableActions || {};
    assert(
      trialStatusRes.body.data.status === 'TRIAL' &&
        trialStatusRes.body.data.activationMethod === 'FREE_TRIAL' &&
        trialActions.isTrial === true &&
        trialActions.canRenew === false &&
        trialActions.canActivatePlan === true &&
        trialActions.canApplyVoucher === true,
      'TRIAL state exposes Activate Plan & Apply Voucher and strictly sets canRenew=false'
    );

    // Convert TRIAL -> Paid ACTIVE via online payment
    const convOrderRes = await makeRequest(
      'POST',
      '/api/billing/subscriptions/create',
      { planId: midPlan._id, billingCycle: 'MONTHLY', intent: 'ACTIVATION' },
      adminFHeaders
    );
    const convPayId = `pay_conv_${Date.now()}`;
    const convVfyRes = await makeRequest(
      'POST',
      '/api/billing/subscriptions/verify',
      {
        razorpay_order_id: convOrderRes.body.data.orderId,
        razorpay_payment_id: convPayId,
        razorpay_signature: generatePaymentSignature(convOrderRes.body.data.orderId, convPayId),
      },
      adminFHeaders
    );
    const postConvSub = await makeRequest('GET', '/api/billing/subscription', null, adminFHeaders);
    assert(
      convVfyRes.status === 200 &&
        postConvSub.body.data.status === 'ACTIVE' &&
        postConvSub.body.data.availableActions?.canRenew === true,
      'Trial converted cleanly to paid ACTIVE subscription and unlocks canRenew=true'
    );

    // =========================================================================
    // SCENARIO G: Upgrade with Server Proration Quote & Entitlement Sync
    // =========================================================================
    console.log('\n--- [Scenario G] Upgrade with Proration Quote & Feature Sync ---');
    const upgQuoteRes = await makeRequest(
      'POST',
      '/api/billing/subscription/upgrade/preview',
      { targetPlanId: scalePlan._id, billingCycle: 'YEARLY' },
      adminBHeaders
    );
    assert(
      upgQuoteRes.status === 200 &&
        upgQuoteRes.body.data.targetPriceRupees === 4999 &&
        upgQuoteRes.body.data.prorationCreditRupees > 0 &&
        upgQuoteRes.body.data.finalPayableRupees < 4999 &&
        upgQuoteRes.body.data.addedFeatures?.includes('advanced_analytics'),
      `Upgrade quote computed proration credit (₹${upgQuoteRes.body.data.prorationCreditRupees}) -> payable ₹${upgQuoteRes.body.data.finalPayableRupees} & addedFeatures`
    );

    const createUpgRes = await makeRequest(
      'POST',
      '/api/billing/subscriptions/create',
      { planId: scalePlan._id, billingCycle: 'YEARLY', intent: 'UPGRADE' },
      adminBHeaders
    );
    const upgPayId = `pay_upg_${Date.now()}`;
    const vfyUpgRes = await makeRequest(
      'POST',
      '/api/billing/subscriptions/verify',
      {
        razorpay_order_id: createUpgRes.body.data.orderId,
        razorpay_payment_id: upgPayId,
        razorpay_signature: generatePaymentSignature(createUpgRes.body.data.orderId, upgPayId),
      },
      adminBHeaders
    );
    const orgBAnalyticsFeat = await OrganizationFeature.findOne({
      organizationId: orgB._id,
      featureKey: 'advanced_analytics',
    });
    assert(
      vfyUpgRes.status === 200 &&
        vfyUpgRes.body.data.planName === 'Scale Annual Plan' &&
        vfyUpgRes.body.data.agreedPriceRupees === 4999 &&
        orgBAnalyticsFeat?.enabled === true,
      'Upgrade completed immediately, synced new features (advanced_analytics), and updated pricingSnapshot'
    );

    // =========================================================================
    // SCENARIO H: Scheduled Next-Cycle Downgrade + Capacity Warnings + Auto-Apply
    // =========================================================================
    console.log('\n--- [Scenario H] Next-Cycle Scheduled Downgrade & Capacity Warnings ---');
    // Seed 3 active students under Org B (Starter limit is maxStudents=2!)
    const hostelB = await Hostel.findOne({ organizationId: orgB._id });
    for (let i = 1; i <= 3; i++) {
      const sUser = await User.create({
        name: `Downgrade Test Student ${i}`,
        email: `stud${i}_${Date.now()}@beta.test`,
        username: `dg_stud_${i}_${Date.now()}`,
        password: 'Password@123',
        role: 'student',
        activeOrganizationId: orgB._id,
        activeHostelId: hostelB._id,
        isActive: true,
        status: 'ACTIVE',
      });
      await Student.create({
        userId: sUser._id,
        organizationId: orgB._id,
        hostelId: hostelB._id,
        hostel: hostelB.code,
        name: sUser.name,
        username: sUser.username,
        email: sUser.email,
        phone: `900000000${i}`,
        roomNo: `10${i}`,
        isActive: true,
      });
    }

    const dgWarnRes = await makeRequest(
      'POST',
      '/api/billing/subscription/downgrade',
      { targetPlanId: starterPlan._id, billingCycle: 'MONTHLY', confirmOverCapacity: false },
      adminBHeaders
    );
    assert(
      dgWarnRes.status === 200 &&
        dgWarnRes.body.data.requiresConfirmation === true &&
        dgWarnRes.body.data.capacityWarnings?.length > 0,
      'Over-capacity downgrade returns capacityWarnings and requiresConfirmation=true before mutating'
    );

    const dgConfirmRes = await makeRequest(
      'POST',
      '/api/billing/subscription/downgrade',
      { targetPlanId: starterPlan._id, billingCycle: 'MONTHLY', confirmOverCapacity: true },
      adminBHeaders
    );
    assert(
      dgConfirmRes.status === 200 &&
        dgConfirmRes.body.data.scheduled === true &&
        dgConfirmRes.body.data.scheduledPlanChange?.status === 'SCHEDULED',
      'Confirmed downgrade schedules next-cycle change while preserving active Scale access'
    );

    // Cancel scheduled downgrade -> then re-schedule -> mature past effectiveDate -> verify auto-apply
    const dgCancelRes = await makeRequest('DELETE', '/api/billing/subscription/downgrade', null, adminBHeaders);
    assert(dgCancelRes.status === 200, 'Hostel Admin can cancel scheduled downgrade');

    await makeRequest(
      'POST',
      '/api/billing/subscription/downgrade',
      { targetPlanId: starterPlan._id, billingCycle: 'MONTHLY', confirmOverCapacity: true },
      adminBHeaders
    );
    await Subscription.findOneAndUpdate(
      { organizationId: orgB._id },
      { $set: { 'scheduledPlanChange.effectiveDate': new Date(Date.now() - 60000) } }
    );
    const subBPostMaturity = await makeRequest('GET', '/api/billing/subscription', null, adminBHeaders);
    assert(
      subBPostMaturity.body.data.planId?.code === 'STARTER' &&
        subBPostMaturity.body.data.scheduledPlanChange?.status === 'APPLIED',
      'Matured scheduled downgrade automatically transitions plan at cycle boundary'
    );

    // =========================================================================
    // SCENARIO I: Renewal Extension vs Expired Reactivation
    // =========================================================================
    console.log('\n--- [Scenario I] Active Renewal Extension & Expired Reactivation ---');
    const subABeforeRenew = await Subscription.findOne({ organizationId: orgA._id });
    const oldEndA = new Date(subABeforeRenew.currentPeriodEnd);

    const renewOrderRes = await makeRequest(
      'POST',
      '/api/billing/subscriptions/create',
      { planId: scalePlan._id, billingCycle: 'YEARLY', intent: 'RENEWAL' },
      adminAHeaders
    );
    const renewPayId = `pay_renew_${Date.now()}`;
    const vfyRenewRes = await makeRequest(
      'POST',
      '/api/billing/subscriptions/verify',
      {
        razorpay_order_id: renewOrderRes.body.data.orderId,
        razorpay_payment_id: renewPayId,
        razorpay_signature: generatePaymentSignature(renewOrderRes.body.data.orderId, renewPayId),
      },
      adminAHeaders
    );
    assert(
      vfyRenewRes.status === 200 && new Date(vfyRenewRes.body.data.currentPeriodEnd) > oldEndA,
      'Early renewal extends monotonically beyond existing currentPeriodEnd'
    );

    // Simulate realistic past-due expiry on Org D -> GET transitions to EXPIRED -> test reactivation
    await Subscription.findOneAndUpdate(
      { organizationId: orgD._id },
      {
        $set: {
          status: 'ACTIVE',
          currentPeriodStart: new Date(Date.now() - 368 * 24 * 3600 * 1000),
          currentPeriodEnd: new Date(Date.now() - 48 * 3600 * 1000),
        },
      }
    );
    const subDExpiredCheck = await makeRequest(
      'GET',
      `/api/billing/subscription?organizationId=${orgD._id}`,
      null,
      saHeaders
    );
    assert(
      subDExpiredCheck.status === 200 && subDExpiredCheck.body.data.status === 'EXPIRED',
      'Past-due active subscription auto-transitions to EXPIRED cleanly'
    );

    const reactivateRes = await makeRequest(
      'POST',
      `/api/super-admin/organizations/${orgD._id}/subscription/initiate-payment`,
      { planId: scalePlan._id, billingCycle: 'YEARLY', intent: 'RENEWAL' },
      saHeaders
    );
    const reactPayId = `pay_react_${Date.now()}`;
    const reactVfyRes = await makeRequest(
      'POST',
      `/api/super-admin/organizations/${orgD._id}/subscription/verify-payment`,
      {
        razorpay_order_id: reactivateRes.body.data.orderId,
        razorpay_payment_id: reactPayId,
        razorpay_signature: generatePaymentSignature(reactivateRes.body.data.orderId, reactPayId),
      },
      saHeaders
    );
    assert(
      reactVfyRes.status === 200 &&
        reactVfyRes.body.data.status === 'ACTIVE' &&
        new Date(reactVfyRes.body.data.currentPeriodEnd) > new Date(),
      'Expired subscription reactivates cleanly to ACTIVE anchored from current date'
    );

    // =========================================================================
    // SCENARIO J: Catalog Price Update Snapshot Protection & Reconciliation
    // =========================================================================
    console.log('\n--- [Scenario J] Historical Pricing Snapshot Protection & Data Reconciliation ---');
    // Update Scale Annual price from 4999 to 6999 in catalog
    const updPriceRes = await makeRequest(
      'PUT',
      `/api/super-admin/plans/${scalePlan._id}`,
      { priceYearly: 6999 },
      saHeaders
    );
    assert(updPriceRes.status === 200 && updPriceRes.body.data.priceYearly === 6999, 'Super Admin updated Scale Annual catalog price to ₹6,999');

    // Org A (existing contract) MUST preserve agreedPriceRupees: 4999
    const orgAAfterPriceChange = await makeRequest('GET', '/api/billing/subscription', null, adminAHeaders);
    assert(
      orgAAfterPriceChange.body.data.agreedPriceRupees === 4999 &&
        orgAAfterPriceChange.body.data.pricingSnapshot?.agreedPriceRupees === 4999,
      'Existing Org A preserves grandfathered ₹4,999 agreedPriceRupees after catalog price change'
    );

    // New Org G onboarded on Scale Annual gets newly published ₹6,999 price
    const orgGRes = await makeRequest(
      'POST',
      '/api/super-admin/organizations',
      {
        name: 'New Price Org G',
        slug: 'org-g-new-price',
        contactEmail: 'g@newprice.test',
        branchName: 'G Main',
        branchCode: 'GMAIN1',
        adminName: 'Admin G',
        adminEmail: 'admin.g@newprice.test',
        planId: scalePlan._id,
        billingCycle: 'YEARLY',
        activationMode: 'PENDING',
      },
      saHeaders
    );
    assert(
      orgGRes.status === 201 && orgGRes.body.data.subscription?.agreedPriceRupees === 6999,
      'New Org G onboarded after catalog update receives new ₹6,999 pricing'
    );

    // Reconciliation script test: corrupt a synthetic subscription back to Starter/₹199 while having a ₹4,999 Payment for Scale Plan
    const syntheticOrg = await Organization.create({
      name: 'Corrupted Starter Mismatch Org',
      slug: `corrupt-mismatch-${Date.now()}`,
      contactEmail: 'corrupt@mismatch.test',
      status: 'ACTIVE',
    });
    const corruptSub = await Subscription.create({
      organizationId: syntheticOrg._id,
      planId: starterPlan._id, // BUG: Assigned Starter despite Scale payment
      status: 'ACTIVE',
      activationMethod: 'ONLINE_PAYMENT',
      billingCycle: 'YEARLY',
      agreedPriceRupees: 199,
      amount: 199,
      amountPaise: 19900,
      currentPeriodStart: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      currentPeriodEnd: new Date(Date.now() + 360 * 24 * 3600 * 1000),
    });
    const histPay = await Payment.create({
      organizationId: syntheticOrg._id,
      billingDomain: 'SAAS',
      subscriptionId: corruptSub._id,
      planId: scalePlan._id,
      orderId: `order_hist_${Date.now()}`,
      paymentId: `pay_hist_${Date.now()}`,
      amountPaise: 499900,
      amountRupees: 4999,
      status: 'CAPTURED',
      provider: 'RAZORPAY',
      billingCycle: 'YEARLY',
      capturedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000),
    });
    await Invoice.create({
      organizationId: syntheticOrg._id,
      paymentId: histPay._id,
      subscriptionId: corruptSub._id,
      invoiceNumber: `Q2-INV-HIST-${Date.now()}`,
      invoiceType: 'SAAS_INVOICE',
      subtotalRupees: 4999,
      totalRupees: 4999,
      status: 'PAID',
    });

    const dryReport = await runReconciliation({ dryRun: true, quiet: true });
    const corruptFinding = dryReport.anomalies.find((a) => a.organizationId === String(syntheticOrg._id));
    const subStillCorruptAfterDry = await Subscription.findById(corruptSub._id);
    assert(
      Boolean(corruptFinding) &&
        corruptFinding.categories.includes('UNEXPECTED_DEFAULT_STARTER') &&
        String(subStillCorruptAfterDry.planId) === String(starterPlan._id),
      'Reconciliation --dry-run detected UNEXPECTED_DEFAULT_STARTER with zero database mutations'
    );

    const applyReport = await runReconciliation({ dryRun: false, quiet: true });
    const subAfterApply = await Subscription.findById(corruptSub._id);
    const orgAfterApply = await Organization.findById(syntheticOrg._id);
    const histPayUntouched = await Payment.findById(histPay._id);
    assert(
      applyReport.summary.reconciledSubscriptions >= 1 &&
        String(subAfterApply.planId) === String(scalePlan._id) &&
        subAfterApply.agreedPriceRupees === 4999 &&
        String(orgAfterApply.subscriptionId) === String(corruptSub._id) &&
        histPayUntouched.amountRupees === 4999,
      'Reconciliation --apply repaired planId, agreedPriceRupees & org backref while keeping historical Payment/Invoice intact'
    );

    // =========================================================================
    // SCENARIO K: Strict RBAC & Multi-Tenant Isolation
    // =========================================================================
    console.log('\n--- [Scenario K] Student Denial (403) & Cross-Tenant Isolation ---');
    const studentPass = 'StudentPass@2026!';
    const studentUser = await User.create({
      name: 'Student Security Check',
      email: 'student.sec@residency.test',
      username: 'stud_sec_e2e',
      password: studentPass,
      role: 'student',
      activeOrganizationId: orgA._id,
      isActive: true,
      status: 'ACTIVE',
    });
    const studLoginRes = await makeRequest('POST', '/api/auth/login', {
      username: studentUser.username,
      password: studentPass,
    });
    assert(
      studLoginRes.status === 200,
      `Student logged into student portal cleanly (got ${studLoginRes.status})`
    );
    const studHeaders = { Authorization: `Bearer ${studLoginRes.body.accessToken}` };

    const studEndpoints = [
      ['GET', '/api/billing/subscription'],
      ['GET', '/api/billing/history'],
      ['POST', '/api/billing/subscriptions/create', { planId: midPlan._id }],
      ['POST', '/api/billing/subscription/trial', { planId: midPlan._id }],
      ['POST', '/api/billing/subscription/upgrade/preview', { targetPlanId: scalePlan._id }],
      ['POST', '/api/billing/subscription/downgrade', { targetPlanId: starterPlan._id }],
      ['POST', '/api/billing/vouchers/apply', { code: discCreds.code, pin: discCreds.pin, planId: midPlan._id }],
      ['GET', '/api/super-admin/subscriptions'],
    ];
    for (const [m, p, b] of studEndpoints) {
      const r = await makeRequest(m, p, b || null, studHeaders);
      assert(r.status === 403, `Student blocked with 403 on ${m} ${p}`);
    }

    // Hostel Admin A blocked from global Super Admin subscriptions and cannot access Org B via header override or foreign order
    const adminASuperBlock = await makeRequest('GET', '/api/super-admin/subscriptions', null, adminAHeaders);
    assert(adminASuperBlock.status === 403, 'Hostel Admin blocked (403) from Super Admin subscriptions');

    const crossHeaderOverride = await makeRequest(
      'GET',
      '/api/billing/subscription',
      null,
      { ...adminAHeaders, 'x-organization-id': String(orgB._id) }
    );
    assert(
      crossHeaderOverride.status === 403,
      'Cross-tenant x-organization-id override attempt by Hostel Admin A rejected with 403'
    );

    const subBDoc = await Subscription.findOne({ organizationId: orgB._id });
    const crossVerifyAttempt = await makeRequest(
      'POST',
      '/api/billing/subscriptions/verify',
      {
        razorpay_order_id: subBDoc.orderId,
        razorpay_payment_id: `pay_cross_evil_${Date.now()}`,
        razorpay_signature: generatePaymentSignature(subBDoc.orderId, `pay_cross_evil_${Date.now()}`),
      },
      adminAHeaders
    );
    assert(crossVerifyAttempt.status === 403, 'Cross-tenant payment verification blocked with 403');

    // =========================================================================
    // SCENARIO L: Core Hostel/Student/Fee Operations Regression Check
    // =========================================================================
    console.log('\n--- [Scenario L] Core Student, Hostel & Fee Endpoints Regression Check ---');
    const hostelsCheck = await makeRequest('GET', '/api/hostels', null, adminAHeaders);
    const studentsCheck = await makeRequest('GET', '/api/students', null, adminAHeaders);
    const feesCheck = await makeRequest('GET', '/api/fees', null, adminAHeaders);
    assert(
      hostelsCheck.status === 200 && studentsCheck.status === 200 && feesCheck.status === 200,
      `Hostels (${hostelsCheck.status}), Students (${studentsCheck.status}), and Fees (${feesCheck.status}) endpoints respond cleanly (200 OK) with zero quota/billing regression`
    );

    console.log('\n======================================================================');
    console.log(`🎉 E2E VERIFICATION COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================================\n');
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runE2ESuite()
  .then(() => process.exit(failed > 0 ? 1 : 0))
  .catch((err) => {
    console.error('❌ E2E Suite fatal failure:', err);
    process.exit(1);
  });
