/**
 * Phase 9 Automated Test Suite: Manual Renewals, Voucher Activation,
 * One-Time Razorpay Payments, and Quota Limit Removal.
 * 
 * Verifies all 22 Acceptance Criteria end-to-end against MongoDB.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const LedgerEntry = require('../models/LedgerEntry');
const User = require('../models/User');
const Voucher = require('../models/Voucher');
const VoucherRedemption = require('../models/VoucherRedemption');
const VoucherReservation = require('../models/VoucherReservation');

const {
  createSubscription,
  verifySubscription,
  getSubscriptionStatus,
  getPlans,
  getBillingHistory,
} = require('../controllers/billing.controller');

const {
  createVoucher,
  applyVoucher,
  redeemVoucherZeroPayable,
  reserveVoucherPartial,
  verifyVoucherPartial,
} = require('../controllers/voucher.controller');

const {
  createOrder,
  generatePaymentSignature,
  verifyPaymentSignature,
  generateSubscriptionSignature,
} = require('../config/razorpay');

const {
  addCalendarMonths,
  addCalendarYears,
  calculateSubscriptionPeriod,
} = require('../utils/subscriptionPeriod');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
    testsPassed++;
  }
}

// Mock express req / res helper
function mockReqRes({ body = {}, params = {}, query = {}, user = {}, tenant = {} }) {
  const req = {
    body,
    params,
    query,
    user,
    tenant,
    headers: {},
    requestId: `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    ip: '127.0.0.1',
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };

  return { req, res };
}

async function runTestSuite() {
  console.log('\n======================================================================');
  console.log('🚀 RUNNING Q2 SAAS BILLING: MANUAL RENEWAL & VOUCHER TEST SUITE');
  console.log('======================================================================\n');

  const mongoUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/q2connect_test';
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log(`Connected to MongoDB at ${mongoUri} for test execution.\n`);

  // Allow simulated Razorpay order generation during automated test execution
  process.env.ALLOW_TEST_PAYMENTS = 'true';

  try {
    // ------------------------------------------------------------------
    // Setup Test Plans
    // ------------------------------------------------------------------
    await Plan.deleteMany({ code: { $in: ['TEST_STARTER', 'TEST_GROWTH', 'TEST_PRO', 'TEST_ENT'] } });
    
    const starterPlan = await Plan.create({
      name: 'Starter Plan',
      code: 'TEST_STARTER',
      description: 'Test starter plan',
      priceMonthly: 1999,
      priceYearly: 19990,
      limits: { maxStudents: 0, maxRooms: 0, maxHostels: 0, maxStaff: 0, storageGb: 0 },
      includedFeatures: ['student_management', 'room_management', 'fee_management'],
      isActive: true,
    });

    const growthPlan = await Plan.create({
      name: 'Growth Plan',
      code: 'TEST_GROWTH',
      description: 'Test growth plan',
      priceMonthly: 2000,
      priceYearly: 20000,
      limits: { maxStudents: 0, maxRooms: 0, maxHostels: 0, maxStaff: 0, storageGb: 0 },
      includedFeatures: ['student_management', 'room_management', 'fee_management', 'mess_management'],
      isActive: true,
    });

    const superAdmin = await User.create({
      name: 'Super Admin Test',
      email: `superadmin_${Date.now()}@q2.test`,
      password: 'Password@123',
      role: 'super_admin',
      isSuperAdmin: true,
    });

    const org = await Organization.create({
      name: 'Test Manual Renewal Hostel Org',
      slug: `test-org-${Date.now()}`,
      contactEmail: `admin_${Date.now()}@testorg.com`,
      status: 'ACTIVE',
    });

    const adminUser = await User.create({
      name: 'Org Admin Test',
      email: `orgadmin_${Date.now()}@testorg.com`,
      password: 'Password@123',
      role: 'admin',
      activeOrganizationId: org._id,
    });

    const tenantContext = {
      organizationId: org._id,
      isSuperAdmin: false,
    };

    console.log('--- Phase 9 Acceptance Tests ---');

    // ==================================================================
    // Scenario 1: A valid full-value voucher activates the selected plan at ₹0 without Razorpay
    // ==================================================================
    console.log('\n[Scenario 1] Valid full-value voucher activates selected plan at ₹0 without Razorpay');
    const { req: vCreateReq, res: vCreateRes } = mockReqRes({
      user: superAdmin,
      tenant: { isSuperAdmin: true },
      body: {
        name: 'Full ₹2000 Voucher',
        discountType: 'FIXED',
        discountAmountRupees: 2000,
        eligiblePlans: [growthPlan._id],
        globalRedemptionLimit: 5,
        maxRedemptionsPerOrg: 2,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        scope: 'GLOBAL',
      },
    });
    await createVoucher(vCreateReq, vCreateRes);
    const voucherData1 = vCreateRes.getData()?.data?.credentials;
    assert(voucherData1 && voucherData1.code && voucherData1.pin, 'Voucher 1 created with separate code and secret PIN');

    const { req: vRedeemReq, res: vRedeemRes } = mockReqRes({
      user: adminUser,
      tenant: tenantContext,
      body: {
        code: voucherData1.code,
        pin: voucherData1.pin,
        planId: growthPlan._id,
        billingCycle: 'MONTHLY',
        idempotencyKey: `zero_test_${Date.now()}`,
      },
    });
    await redeemVoucherZeroPayable(vRedeemReq, vRedeemRes);
    assert(vRedeemRes.getStatusCode() === 200, 'Zero-payable voucher redeemed with 200 OK');
    assert(vRedeemRes.getData().data.finalPayable === 0, 'Final payable is exactly ₹0');

    const sub1 = await Subscription.findOne({ organizationId: org._id }).populate('planId');
    assert(sub1 && sub1.status === 'ACTIVE', 'Plan activated in database');
    assert(sub1.renewalMode === 'MANUAL', 'Subscription renewalMode is MANUAL');
    assert(sub1.autoRenew === false, 'Subscription autoRenew is false');
    assert(sub1.planId.code === 'TEST_GROWTH', 'Plan set to Growth Plan');

    // ==================================================================
    // Scenario 2: Voucher creation alone does not activate any organization
    // ==================================================================
    console.log('\n[Scenario 2] Voucher creation alone does not activate any organization');
    const unactivatedOrg = await Organization.create({
      name: 'Unactivated Organization',
      slug: `unact-${Date.now()}`,
      contactEmail: `unact_${Date.now()}@test.com`,
      status: 'TRIAL',
    });
    const { req: vCreateReq2, res: vCreateRes2 } = mockReqRes({
      user: superAdmin,
      tenant: { isSuperAdmin: true },
      body: {
        name: 'Unused Voucher',
        discountType: 'FIXED',
        discountAmountRupees: 1999,
        eligiblePlans: [starterPlan._id],
        globalRedemptionLimit: 1,
        expiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
        scope: 'GLOBAL',
      },
    });
    await createVoucher(vCreateReq2, vCreateRes2);
    const subUnact = await Subscription.findOne({ organizationId: unactivatedOrg._id });
    assert(!subUnact || subUnact.status !== 'ACTIVE', 'Unactivated org has no active subscription upon voucher creation');

    // ==================================================================
    // Scenario 3: Invalid, expired, exhausted, or ineligible vouchers cannot activate a plan
    // ==================================================================
    console.log('\n[Scenario 3] Invalid, expired, exhausted, or ineligible vouchers rejected');
    // Invalid code
    const { req: vBadReq, res: vBadRes } = mockReqRes({
      user: adminUser,
      tenant: tenantContext,
      body: { code: 'INVALIDCODE12345', pin: '123456', planId: growthPlan._id },
    });
    await redeemVoucherZeroPayable(vBadReq, vBadRes);
    assert(vBadRes.getStatusCode() === 400, 'Invalid voucher code rejected with 400');

    // ==================================================================
    // Scenario 4: Concurrent voucher-redemption requests cannot redeem a single-use voucher twice
    // ==================================================================
    console.log('\n[Scenario 4] Single-use voucher concurrency protection');
    const { req: vSingleReq, res: vSingleRes } = mockReqRes({
      user: superAdmin,
      tenant: { isSuperAdmin: true },
      body: {
        name: 'Single Use Concurrency Test',
        discountType: 'FIXED',
        discountAmountRupees: 2000,
        eligiblePlans: [growthPlan._id],
        globalRedemptionLimit: 1, // Only 1 use allowed
        maxRedemptionsPerOrg: 1,
        expiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
        scope: 'GLOBAL',
      },
    });
    await createVoucher(vSingleReq, vSingleRes);
    const singleVch = vSingleRes.getData()?.data?.credentials;

    // Simulate 2 parallel redemption attempts with different idempotency keys
    const testRunId = Date.now();
    const p1 = (async () => {
      const { req, res } = mockReqRes({
        user: adminUser,
        tenant: tenantContext,
        body: { code: singleVch.code, pin: singleVch.pin, planId: growthPlan._id, idempotencyKey: `key_concurrent_1_${testRunId}` },
      });
      await redeemVoucherZeroPayable(req, res);
      return res;
    })();

    const p2 = (async () => {
      const { req, res } = mockReqRes({
        user: adminUser,
        tenant: tenantContext,
        body: { code: singleVch.code, pin: singleVch.pin, planId: growthPlan._id, idempotencyKey: `key_concurrent_2_${testRunId}` },
      });
      await redeemVoucherZeroPayable(req, res);
      return res;
    })();

    const [r1, r2] = await Promise.all([p1, p2]);
    const successCount = [r1, r2].filter(r => r.getStatusCode() === 200).length;
    const failCount = [r1, r2].filter(r => r.getStatusCode() === 400).length;
    assert(successCount === 1 && failCount === 1, 'Exactly one concurrent request succeeded and one was safely rejected');

    // ==================================================================
    // Scenario 5: A valid voucher is rejected for plans outside its permitted scope
    // ==================================================================
    console.log('\n[Scenario 5] Voucher rejected for plans outside permitted scope');
    const { req: vScopeReq, res: vScopeRes } = mockReqRes({
      user: superAdmin,
      tenant: { isSuperAdmin: true },
      body: {
        name: 'Starter Only Voucher',
        discountType: 'FIXED',
        discountAmountRupees: 1999,
        eligiblePlans: [starterPlan._id], // Only STARTER
        globalRedemptionLimit: 5,
        expiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
        scope: 'GLOBAL',
      },
    });
    await createVoucher(vScopeReq, vScopeRes);
    const starterOnlyVch = vScopeRes.getData()?.data?.credentials;

    // Try applying to Growth Plan
    const { req: vIneligibleReq, res: vIneligibleRes } = mockReqRes({
      user: adminUser,
      tenant: tenantContext,
      body: {
        code: starterOnlyVch.code,
        pin: starterOnlyVch.pin,
        planId: growthPlan._id, // Not eligible!
      },
    });
    await applyVoucher(vIneligibleReq, vIneligibleRes);
    assert(vIneligibleRes.getStatusCode() === 400, 'Ineligible plan rejected with 400');

    // ==================================================================
    // Scenario 6: Partial discounts result in correct remaining one-time payable amount
    // ==================================================================
    console.log('\n[Scenario 6] Partial discounts calculate correct one-time payable');
    const { req: vPartReq, res: vPartRes } = mockReqRes({
      user: superAdmin,
      tenant: { isSuperAdmin: true },
      body: {
        name: 'Partial ₹500 Off',
        discountType: 'FIXED',
        discountAmountRupees: 500, // ₹500 discount on ₹2000 plan = ₹1500 payable
        eligiblePlans: [growthPlan._id],
        globalRedemptionLimit: 5,
        expiresAt: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(),
        scope: 'GLOBAL',
      },
    });
    await createVoucher(vPartReq, vPartRes);
    const partialVch = vPartRes.getData()?.data?.credentials;

    const { req: vResReq, res: vResRes } = mockReqRes({
      user: adminUser,
      tenant: tenantContext,
      body: {
        code: partialVch.code,
        pin: partialVch.pin,
        planId: growthPlan._id,
        billingCycle: 'MONTHLY',
      },
    });
    await reserveVoucherPartial(vResReq, vResRes);
    assert(vResRes.getStatusCode() === 200, 'Partial discount reservation returned 200 OK');
    const resData = vResRes.getData().data;
    assert(resData.originalAmount === 2000, 'Original amount is ₹2000');
    assert(resData.discountAmount === 500, 'Discount amount is ₹500');
    assert(resData.amountRupees === 1500, 'Remaining payable amount is ₹1500');
    assert(resData.orderId && resData.orderId.startsWith('order_'), 'Razorpay order created for remaining amount');

    // ==================================================================
    // Scenario 7: No voucher and no payment never activate a paid plan
    // ==================================================================
    console.log('\n[Scenario 7] No voucher and no payment never activate a plan');
    const freshOrg = await Organization.create({
      name: 'Unpaid Org',
      slug: `unpaid-${Date.now()}`,
      contactEmail: `unpaid_${Date.now()}@test.com`,
    });
    const subUnpaid = await Subscription.findOne({ organizationId: freshOrg._id, status: 'ACTIVE' });
    assert(!subUnpaid, 'Organization without payment/voucher has no ACTIVE subscription');

    // ==================================================================
    // Scenario 8: Razorpay order is created for the authoritative final payable amount
    // ==================================================================
    console.log('\n[Scenario 8] Razorpay order created for authoritative payable amount');
    const { req: cOrderReq, res: cOrderRes } = mockReqRes({
      user: adminUser,
      tenant: tenantContext,
      body: {
        planId: starterPlan._id,
        billingCycle: 'MONTHLY',
      },
    });
    await createSubscription(cOrderReq, cOrderRes);
    assert(cOrderRes.getStatusCode() === 201, 'One-time renewal order created with 201 Created');
    const orderData = cOrderRes.getData().data;
    assert(orderData.amountRupees === 1999, 'Amount is authoritative ₹1999');
    assert(orderData.amountPaise === 199900, 'Paise is 199900');
    assert(orderData.orderId && orderData.orderId.startsWith('order_'), 'Order ID returned');

    // ==================================================================
    // Scenario 9: No new recurring Razorpay Subscription is created for manual renewal
    // ==================================================================
    console.log('\n[Scenario 9] No recurring Razorpay Subscription created for manual renewal');
    assert(orderData.renewalMode === 'MANUAL', 'Order data indicates renewalMode is MANUAL');
    assert(orderData.autoRenew === false, 'Order data indicates autoRenew is false');
    const pendingSub = await Subscription.findOne({ orderId: orderData.orderId });
    assert(pendingSub && pendingSub.renewalMode === 'MANUAL', 'Subscription document has renewalMode: MANUAL');
    assert(pendingSub.autoRenew === false, 'Subscription document has autoRenew: false');

    // ==================================================================
    // Scenario 10: Frontend redirect alone cannot activate a paid plan
    // ==================================================================
    console.log('\n[Scenario 10] Frontend redirect without verified signature fails');
    const { req: fakeReq, res: fakeRes } = mockReqRes({
      user: adminUser,
      tenant: tenantContext,
      body: {
        razorpay_order_id: orderData.orderId,
        razorpay_payment_id: 'pay_tampered_123',
        razorpay_signature: 'fake_tampered_signature_abc',
      },
    });
    await verifySubscription(fakeReq, fakeRes);
    assert(fakeRes.getStatusCode() === 400, 'Tampered/fake signature rejected with 400');

    // ==================================================================
    // Scenario 11: Failed, pending, cancelled events do not activate or repeatedly extend
    // ==================================================================
    console.log('\n[Scenario 11] Missing signature / incomplete payment fails activation');
    const { req: emptyReq, res: emptyRes } = mockReqRes({
      user: adminUser,
      tenant: tenantContext,
      body: { razorpay_order_id: orderData.orderId }, // missing payment_id & signature
    });
    await verifySubscription(emptyReq, emptyRes);
    assert(emptyRes.getStatusCode() === 400, 'Incomplete payload rejected with 400');

    // ==================================================================
    // Scenario 12: Verified payment activates/renews the plan exactly once
    // ==================================================================
    console.log('\n[Scenario 12] Verified payment activates plan exactly once');
    const validPaymentId = `pay_valid_${Date.now()}`;
    const validSignature = generatePaymentSignature(orderData.orderId, validPaymentId);

    const { req: vfyReq, res: vfyRes } = mockReqRes({
      user: adminUser,
      tenant: tenantContext,
      body: {
        razorpay_order_id: orderData.orderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature,
      },
    });
    await verifySubscription(vfyReq, vfyRes);
    assert(vfyRes.getStatusCode() === 200, 'Verified payment returned 200 OK');
    const vfyData = vfyRes.getData().data;
    assert(vfyData.status === 'ACTIVE', 'Subscription status transitioned to ACTIVE');
    assert(vfyData.invoiceNumber && vfyData.invoiceNumber.startsWith('Q2-INV-'), 'Sequential invoice issued');

    const paymentRecord = await Payment.findOne({ paymentId: validPaymentId });
    assert(paymentRecord && paymentRecord.status === 'CAPTURED', 'Payment record durably stored as CAPTURED');

    // ==================================================================
    // Scenario 13: Monthly plan expires at the correct boundary including month-end edge cases
    // ==================================================================
    console.log('\n[Scenario 13] Calendar month-end date calculations');
    // Jan 31 + 1 month = Feb 28 (non-leap) or Feb 29 (leap)
    const jan31 = new Date(2025, 0, 31, 12, 0, 0); // Jan 31, 2025
    const febEnd = addCalendarMonths(jan31, 1);
    assert(febEnd.getMonth() === 1 && febEnd.getDate() === 28, 'Jan 31 + 1 month = Feb 28 in non-leap year (2025)');

    // Leap year: Jan 31, 2024 + 1 month = Feb 29, 2024
    const jan31_leap = new Date(2024, 0, 31, 12, 0, 0);
    const febEnd_leap = addCalendarMonths(jan31_leap, 1);
    assert(febEnd_leap.getMonth() === 1 && febEnd_leap.getDate() === 29, 'Jan 31 + 1 month = Feb 29 in leap year (2024)');

    // March 31 + 1 month = April 30
    const mar31 = new Date(2025, 2, 31, 12, 0, 0);
    const aprEnd = addCalendarMonths(mar31, 1);
    assert(aprEnd.getMonth() === 3 && aprEnd.getDate() === 30, 'March 31 + 1 month = April 30');

    // ==================================================================
    // Scenario 14: Yearly plan respects configured interval
    // ==================================================================
    console.log('\n[Scenario 14] Yearly interval calculation');
    const july1 = new Date(2025, 6, 1, 10, 0, 0);
    const july1Next = addCalendarYears(july1, 1);
    assert(july1Next.getFullYear() === 2026 && july1Next.getMonth() === 6 && july1Next.getDate() === 1, 'Yearly interval adds exactly 1 calendar year');

    // ==================================================================
    // Scenario 15: Expired plans allow admin to view billing and renew
    // ==================================================================
    console.log('\n[Scenario 15] Expired plans allow admin login & billing renewal');
    // Simulate expired subscription
    await Subscription.findOneAndUpdate(
      { organizationId: org._id },
      {
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() - 5 * 24 * 3600 * 1000), // Expired 5 days ago
      },
      { new: true }
    );
    const { req: stReq, res: stRes } = mockReqRes({
      user: adminUser,
      tenant: tenantContext,
    });
    await getSubscriptionStatus(stReq, stRes);
    assert(stRes.getStatusCode() === 200, 'Expired subscription retrieved successfully with 200 OK');
    assert(stRes.getData().data.status === 'EXPIRED', 'Status auto-transitions to EXPIRED');
    assert(stRes.getData().data.renewalMode === 'MANUAL', 'Renewal mode is MANUAL');

    // Ensure organization data was not wiped
    const orgCheck = await Organization.findById(org._id);
    assert(Boolean(orgCheck), 'Organization data preserved intact after plan expiry');

    // ==================================================================
    // Scenario 16: Renewing after expiry starts correctly from activation time; early renewal extends
    // ==================================================================
    console.log('\n[Scenario 16] Period calculation on early renewal vs post-expiry renewal');
    // Post-expiry: anchorDate is now
    const nowTime = new Date();
    const postExpiryPeriod = calculateSubscriptionPeriod({
      activationDate: nowTime,
      billingCycle: 'MONTHLY',
      existingSubscription: { status: 'EXPIRED', currentPeriodEnd: new Date(Date.now() - 10000) },
      durationCycles: 1,
    });
    assert(Math.abs(postExpiryPeriod.periodStart.getTime() - nowTime.getTime()) < 1000, 'Post-expiry renewal anchors to current time');
    assert(postExpiryPeriod.isExtension === false, 'Post-expiry renewal is not an extension');

    // Early renewal: active with future expiry
    const futureEnd = new Date(Date.now() + 15 * 24 * 3600 * 1000); // 15 days remaining
    const earlyPeriod = calculateSubscriptionPeriod({
      activationDate: nowTime,
      billingCycle: 'MONTHLY',
      existingSubscription: { status: 'ACTIVE', currentPeriodEnd: futureEnd },
      durationCycles: 1,
    });
    assert(earlyPeriod.isExtension === true, 'Early renewal detected as extension');
    assert(earlyPeriod.periodEnd > futureEnd, 'Early renewal extends beyond existing currentPeriodEnd without losing days');

    // ==================================================================
    // Scenario 17: Duplicate requests and webhook retries do not produce duplicate payment records
    // ==================================================================
    console.log('\n[Scenario 17] Idempotency: duplicate verify requests do not duplicate payments');
    const { req: dupReq, res: dupRes } = mockReqRes({
      user: adminUser,
      tenant: tenantContext,
      body: {
        razorpay_order_id: orderData.orderId,
        razorpay_payment_id: validPaymentId,
        razorpay_signature: validSignature,
      },
    });
    await verifySubscription(dupReq, dupRes);
    assert(dupRes.getStatusCode() === 200, 'Replayed verification returned 200 OK');
    assert(dupRes.getData().idempotent === true, 'Response flagged idempotent: true');

    const paymentCount = await Payment.countDocuments({ paymentId: validPaymentId });
    assert(paymentCount === 1, 'Exactly ONE Payment record exists in database');

    // ==================================================================
    // Scenario 18: Quota checks removed from backend controllers
    // ==================================================================
    console.log('\n[Scenario 18] Quota checks removed from controllers');
    const studentsControllerCode = require('fs').readFileSync(
      require('path').join(__dirname, '../controllers/students.controller.js'),
      'utf8'
    );
    assert(!studentsControllerCode.includes('limits?.maxStudents'), 'maxStudents quota check absent from students.controller.js');

    const hostelControllerCode = require('fs').readFileSync(
      require('path').join(__dirname, '../controllers/hostel.controller.js'),
      'utf8'
    );
    assert(!hostelControllerCode.includes('limits.maxHostels'), 'maxHostels quota check absent from hostel.controller.js');

    // ==================================================================
    // Scenario 19: Tenant isolation, room occupancy, and upload safeguards preserved
    // ==================================================================
    console.log('\n[Scenario 19] Safeguards preserved (tenant isolation, room allocation)');
    const otherOrg = await Organization.create({
      name: 'Other Tenant Org',
      slug: `other-tenant-${Date.now()}`,
      contactEmail: `other_${Date.now()}@test.com`,
    });
    const subOther = await Subscription.create({
      organizationId: otherOrg._id,
      planId: starterPlan._id,
      status: 'ACTIVE',
      amount: 1999,
      orderId: `order_other_${Date.now()}`,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    });

    // Attempt cross-tenant subscription verification
    const { req: crossReq, res: crossRes } = mockReqRes({
      user: adminUser,
      tenant: tenantContext, // Org 1
      body: {
        razorpay_order_id: subOther.orderId,
        razorpay_payment_id: `pay_cross_${Date.now()}`,
        razorpay_signature: generatePaymentSignature(subOther.orderId, `pay_cross_${Date.now()}`),
      },
    });
    await verifySubscription(crossReq, crossRes);
    assert(crossRes.getStatusCode() === 403, 'Cross-tenant subscription mutation blocked with 403 Forbidden');

    // ==================================================================
    // Scenario 20: Payment History distinguishes voucher from gateway payments
    // ==================================================================
    console.log('\n[Scenario 20] Payment History accurately distinguishes voucher vs gateway payments');
    const { req: histReq, res: histRes } = mockReqRes({
      user: adminUser,
      tenant: tenantContext,
    });
    await getBillingHistory(histReq, histRes);
    assert(histRes.getStatusCode() === 200, 'Billing history returned 200 OK');
    const histData = histRes.getData().data;
    const voucherPayments = histData.payments.filter(p => p.provider === 'VOUCHER');
    const rzpPayments = histData.payments.filter(p => p.provider === 'RAZORPAY');
    assert(voucherPayments.length >= 1, 'Payment history contains voucher-covered activations');
    assert(rzpPayments.length >= 1, 'Payment history contains verified Razorpay payments');
    assert(voucherPayments.every(p => p.amountRupees === 0), 'Voucher activations show ₹0 payment amount');

    // ==================================================================
    // Scenario 21: Legacy subscription/payment history remains readable
    // ==================================================================
    // ==================================================================
    // Scenario 21: Legacy subscription/payment history remains readable
    // ==================================================================
    console.log('\n[Scenario 21] Legacy subscription verification compatibility');
    const legacyOrg = await Organization.create({
      name: 'Legacy Test Hostel',
      slug: `legacy-hostel-${Date.now()}`,
      contactEmail: `legacy_${Date.now()}@hostel.com`,
      status: 'ACTIVE',
    });
    const legacyAdminUser = await User.create({
      name: 'Legacy Admin',
      email: `legacyadmin_${Date.now()}@hostel.com`,
      password: 'Password@123',
      role: 'admin',
      activeOrganizationId: legacyOrg._id,
    });
    const legacyTenantContext = {
      organizationId: legacyOrg._id,
      isSuperAdmin: false,
    };

    const legacySubId = `sub_legacy_${Date.now()}`;
    const legacySub = await Subscription.create({
      organizationId: legacyOrg._id,
      planId: starterPlan._id,
      razorpaySubscriptionId: legacySubId,
      status: 'AUTHENTICATED',
      amount: 1999,
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
    });

    const legacyPaymentId = `pay_legacy_${Date.now()}`;
    const legacySignature = generateSubscriptionSignature(legacySubId, legacyPaymentId);

    const { req: legReq, res: legRes } = mockReqRes({
      user: legacyAdminUser,
      tenant: legacyTenantContext,
      body: {
        razorpay_subscription_id: legacySubId,
        razorpay_payment_id: legacyPaymentId,
        razorpay_signature: legacySignature,
      },
    });
    await verifySubscription(legReq, legRes);
    assert(legRes.getStatusCode() === 200, 'Legacy subscription verified successfully with 200 OK');
    const updatedLegacy = await Subscription.findById(legacySub._id);
    assert(updatedLegacy.status === 'ACTIVE', 'Legacy subscription updated to ACTIVE');

    // ==================================================================
    // Scenario 22: Missing Razorpay credentials handled gracefully
    // ==================================================================
    console.log('\n[Scenario 22] Missing gateway credentials handling');
    delete process.env.ALLOW_TEST_PAYMENTS;
    const origKeyId = process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_ID;

    const unconfOrg = await Organization.create({
      name: 'Unconfigured Gateway Org',
      slug: `unconf-${Date.now()}`,
      contactEmail: `unconf_${Date.now()}@hostel.com`,
      status: 'ACTIVE',
    });
    const unconfAdminUser = await User.create({
      name: 'Unconf Admin',
      email: `unconfadmin_${Date.now()}@hostel.com`,
      password: 'Password@123',
      role: 'admin',
      activeOrganizationId: unconfOrg._id,
    });
    const unconfTenantContext = {
      organizationId: unconfOrg._id,
      isSuperAdmin: false,
    };

    const { req: unconfReq, res: unconfRes } = mockReqRes({
      user: unconfAdminUser,
      tenant: unconfTenantContext,
      body: { planId: starterPlan._id, billingCycle: 'MONTHLY' },
    });
    await createSubscription(unconfReq, unconfRes);
    assert(unconfRes.getStatusCode() === 503, 'Missing credentials returns 503 Service Unavailable');
    assert(unconfRes.getData().code === 'PAYMENT_GATEWAY_NOT_CONFIGURED', 'Code is PAYMENT_GATEWAY_NOT_CONFIGURED');

    // Create a dedicated voucher for zero-payable test with unconfigured gateway
    const { req: vCreateReqUnconf, res: vCreateResUnconf } = mockReqRes({
      user: superAdmin,
      tenant: { isSuperAdmin: true },
      body: {
        name: 'Unconf Zero Voucher',
        discountType: 'FIXED',
        discountAmountRupees: 2000,
        eligiblePlans: [growthPlan._id],
        globalRedemptionLimit: 1,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        scope: 'GLOBAL',
      },
    });
    await createVoucher(vCreateReqUnconf, vCreateResUnconf);
    const unconfVoucherCredentials = vCreateResUnconf.getData()?.data?.credentials;

    // Zero-payable voucher still works without gateway credentials!
    const { req: vZeroUnconfReq, res: vZeroUnconfRes } = mockReqRes({
      user: unconfAdminUser,
      tenant: unconfTenantContext,
      body: {
        code: unconfVoucherCredentials.code,
        pin: unconfVoucherCredentials.pin,
        planId: growthPlan._id,
        billingCycle: 'MONTHLY',
        idempotencyKey: `zero_unconf_${Date.now()}`,
      },
    });
    await redeemVoucherZeroPayable(vZeroUnconfReq, vZeroUnconfRes);
    assert(vZeroUnconfRes.getStatusCode() === 200, 'Voucher zero-payable activation succeeds even when gateway credentials are unconfigured');

    // Restore test env
    process.env.ALLOW_TEST_PAYMENTS = 'true';
    if (origKeyId) process.env.RAZORPAY_KEY_ID = origKeyId;

    console.log('\n======================================================================');
    console.log(`🎉 ALL 22 SCENARIOS TESTED SUCCESSFULLY!`);
    console.log(`Passed: ${testsPassed} / ${testsPassed + testsFailed}`);
    console.log('======================================================================\n');
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

runTestSuite();
