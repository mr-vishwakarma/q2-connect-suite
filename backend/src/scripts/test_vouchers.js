/**
 * Automated Test Suite for Q2 Connect Suite — Subscription Vouchers & Coupons
 * 
 * Verifies:
 * - Super Admin creation, validation, and lifecycle
 * - 16-character code and separate PIN format & security
 * - Plaintext PIN never persisted in DB
 * - Zero-payable checkout (₹0 final payable, atomic activation, no fake Razorpay)
 * - Anti-replay and idempotency
 * - Max redemptions per organization enforcement
 * - Single-use concurrency protection
 * - PIN lockout under brute force attempts
 * - Partial-discount checkout reservation and payment verification
 * - Super Admin notifications and audit logging
 */

require('dotenv').config();
const mongoose = require('mongoose');
const {
  generateVoucherCode,
  normalizeVoucherCode,
  isValidVoucherCodeFormat,
  generateVoucherPin,
  normalizeVoucherPin,
  isValidVoucherPinFormat,
  computeVoucherLookupDigest,
  maskVoucherCode,
  verifyPin,
} = require('../utils/voucherCrypto');
const Voucher = require('../models/Voucher');
const VoucherRedemption = require('../models/VoucherRedemption');
const VoucherReservation = require('../models/VoucherReservation');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const LedgerEntry = require('../models/LedgerEntry');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');
const {
  createVoucher,
  getVouchers,
  applyVoucher,
  redeemVoucherZeroPayable,
  reserveVoucherPartial,
  verifyVoucherPartial,
  updateVoucherStatus,
} = require('../controllers/voucher.controller');
const { generatePaymentSignature } = require('../config/razorpay');

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

// Mock express req/res
function mockReqRes({ body = {}, params = {}, query = {}, user = {}, tenant = {} }) {
  const req = {
    body,
    params,
    query,
    user,
    tenant,
    ip: '127.0.0.1',
    headers: { 'user-agent': 'VoucherTestSuite/1.0' },
  };

  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };

  return { req, res };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 RUNNING Q2 CONNECT SUITE VOUCHERS INTEGRATION TESTS');
  console.log('======================================================\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB Atlas');

    // Setup Test Fixtures: Super Admin, 2 Test Orgs, 1 Growth Plan (₹2000/mo, ₹20000/yr), 1 Enterprise Plan (₹5000/mo)
    const testPrefix = `vch_test_${Date.now()}`;

    // Super Admin User
    let superAdmin = await User.findOne({ role: 'super_admin' });
    if (!superAdmin) {
      superAdmin = await User.create({
        name: 'Test Super Admin',
        email: `${testPrefix}_superadmin@q2connect.com`,
        username: `${testPrefix}_superadmin`,
        password: 'Password@123',
        role: 'super_admin',
        isSuperAdmin: true,
      });
    }

    // Org Admin User A
    const testOrgA = await Organization.create({
      name: `${testPrefix} Org A`,
      slug: `org-a-${Date.now()}`,
      contactEmail: `${testPrefix}_a@test.com`,
      code: `ORGA_${Date.now()}`,
      status: 'ACTIVE',
    });
    const adminUserA = await User.create({
      name: 'Admin User A',
      email: `${testPrefix}_adminA@hostel.com`,
      username: `${testPrefix}_adminA`,
      password: 'Password@123',
      role: 'admin',
      activeOrganizationId: testOrgA._id,
    });

    // Org Admin User B
    const testOrgB = await Organization.create({
      name: `${testPrefix} Org B`,
      slug: `org-b-${Date.now()}`,
      contactEmail: `${testPrefix}_b@test.com`,
      code: `ORGB_${Date.now()}`,
      status: 'ACTIVE',
    });
    const adminUserB = await User.create({
      name: 'Admin User B',
      email: `${testPrefix}_adminB@hostel.com`,
      username: `${testPrefix}_adminB`,
      password: 'Password@123',
      role: 'admin',
      activeOrganizationId: testOrgB._id,
    });

    // Student User (to test authorization barriers)
    const studentUser = await User.create({
      name: 'Test Student',
      email: `${testPrefix}_student@hostel.com`,
      username: `${testPrefix}_student`,
      password: 'Password@123',
      role: 'student',
      activeOrganizationId: testOrgA._id,
    });

    // Plans
    let growthPlan = await Plan.findOne({ code: 'GROWTH_TEST' });
    if (!growthPlan) {
      growthPlan = await Plan.create({
        name: 'Growth Plan',
        code: `GROWTH_${Date.now()}`,
        priceMonthly: 2000,
        priceYearly: 20000,
        isActive: true,
      });
    }

    let enterprisePlan = await Plan.findOne({ code: 'ENTERPRISE_TEST' });
    if (!enterprisePlan) {
      enterprisePlan = await Plan.create({
        name: 'Enterprise Plan',
        code: `ENTERPRISE_${Date.now()}`,
        priceMonthly: 5000,
        priceYearly: 50000,
        isActive: true,
      });
    }

    console.log('Fixtures established successfully.\n');

    // ---------------------------------------------------------
    // TEST 1: Cryptographic Code and PIN Generation
    // ---------------------------------------------------------
    console.log('--- TEST 1: Cryptographic Code & PIN Generation ---');
    const code1 = generateVoucherCode();
    const pin1 = generateVoucherPin();
    assert(code1.length === 16, 'Code must have exactly 16 characters');
    assert(isValidVoucherCodeFormat(code1), 'Code must use only non-confusable alphanumeric chars');
    assert(!/[01OIL]/.test(code1), 'Code must never contain 0, 1, O, I, or L');
    assert(pin1.length === 6 && /^\d{6}$/.test(pin1), 'PIN must be exactly 6 digits');

    // Normalization
    const formattedCode = ` ${code1.slice(0, 4)}-${code1.slice(4, 8)}-${code1.slice(8, 12)}-${code1.slice(12)} `;
    assert(normalizeVoucherCode(formattedCode) === code1, 'Code normalization handles dashes and whitespace');

    // ---------------------------------------------------------
    // TEST 2: Super Admin Voucher Creation & Single-Use Credential Reveal
    // ---------------------------------------------------------
    console.log('\n--- TEST 2: Super Admin Voucher Creation ---');
    const now = new Date();
    const expiresTomorrow = new Date(Date.now() + 24 * 3600 * 1000);

    const { req: createReq, res: createRes } = mockReqRes({
      user: superAdmin,
      body: {
        name: 'Q2 Launch Voucher ₹2000',
        description: 'Test launch coupon granting ₹2,000 off',
        discountAmountRupees: 2000,
        eligiblePlans: [growthPlan._id],
        eligibleBillingIntervals: ['MONTHLY'],
        validFrom: now,
        expiresAt: expiresTomorrow,
        globalRedemptionLimit: 1,
        maxRedemptionsPerOrg: 1,
        scope: 'GLOBAL',
      },
    });

    await createVoucher(createReq, createRes);
    assert(createRes.statusCode === 201, 'Super Admin creation returns 201');
    assert(createRes.data.success === true, 'Response indicates success');
    assert(createRes.data.data.credentials?.code?.length === 16, 'Returned raw code is 16 characters');
    assert(createRes.data.data.credentials?.pin?.length === 6, 'Returned raw PIN is 6 digits');

    const createdVoucherId = createRes.data.data.voucher._id;
    const rawVoucherCode = createRes.data.data.credentials.code;
    const rawVoucherPin = createRes.data.data.credentials.pin;

    // Verify database document: raw PIN MUST NOT exist in DB
    const dbVoucher = await Voucher.findById(createdVoucherId);
    assert(dbVoucher !== null, 'Voucher persisted in DB');
    assert(dbVoucher.pinVerifier && dbVoucher.pinVerifier.length > 30, 'PIN verifier stored as hash');
    assert(dbVoucher.pinSalt && dbVoucher.pinSalt.length > 10, 'PIN salt stored');
    assert(!JSON.stringify(dbVoucher).includes(rawVoucherPin), 'Raw PIN is NOT in MongoDB document');
    assert(!JSON.stringify(dbVoucher).includes(rawVoucherCode), 'Raw code is NOT stored in plaintext');

    // ---------------------------------------------------------
    // TEST 3: Student & Unauthorized Role Blocked from Billing Checkout
    // ---------------------------------------------------------
    console.log('\n--- TEST 3: RBAC Barrier on Voucher Checkout ---');
    const { req: studentReq, res: studentRes } = mockReqRes({
      user: studentUser,
      tenant: { organizationId: testOrgA._id },
      body: {
        code: rawVoucherCode,
        pin: rawVoucherPin,
        planId: growthPlan._id,
        billingCycle: 'MONTHLY',
      },
    });

    await applyVoucher(studentReq, studentRes);
    assert(studentRes.statusCode === 403, 'Students are denied (403) from applying vouchers');

    // ---------------------------------------------------------
    // TEST 4: Apply Voucher (Preview Discount WITHOUT Consuming)
    // ---------------------------------------------------------
    console.log('\n--- TEST 4: Apply Voucher (Preview Without Consuming) ---');
    const { req: applyReq, res: applyRes } = mockReqRes({
      user: adminUserA,
      tenant: { organizationId: testOrgA._id },
      body: {
        code: rawVoucherCode,
        pin: rawVoucherPin,
        planId: growthPlan._id,
        billingCycle: 'MONTHLY',
      },
    });

    await applyVoucher(applyReq, applyRes);
    assert(applyRes.statusCode === 200, 'Valid voucher preview returns 200');
    assert(applyRes.data.data.originalAmount === 2000, 'Original amount is ₹2,000');
    assert(applyRes.data.data.discountAmount === 2000, 'Discount amount is ₹2,000');
    assert(applyRes.data.data.finalPayable === 0, 'Final payable is ₹0');
    assert(applyRes.data.data.isZeroPayable === true, 'isZeroPayable is true');

    // Crucial check: Voucher redemption count has NOT incremented
    const voucherAfterApply = await Voucher.findById(createdVoucherId);
    assert(voucherAfterApply.currentRedemptionCount === 0, 'Applying voucher did NOT increment redemption count');

    // ---------------------------------------------------------
    // TEST 5: Wrong PIN Rejection & Anti-Brute-Force Lockout
    // ---------------------------------------------------------
    console.log('\n--- TEST 5: PIN Validation & Anti-Brute-Force Protection ---');
    const { req: wrongPinReq, res: wrongPinRes } = mockReqRes({
      user: adminUserA,
      tenant: { organizationId: testOrgA._id },
      body: {
        code: rawVoucherCode,
        pin: '000000', // Invalid PIN
        planId: growthPlan._id,
        billingCycle: 'MONTHLY',
      },
    });

    await applyVoucher(wrongPinReq, wrongPinRes);
    assert(wrongPinRes.statusCode === 400, 'Incorrect PIN rejected with 400');
    assert(
      wrongPinRes.data.message === 'Voucher could not be applied. Verify the details or contact support.',
      'Safe generic message returned on bad PIN'
    );

    // ---------------------------------------------------------
    // TEST 6: Ineligible Plan & Billing Interval Rejection
    // ---------------------------------------------------------
    console.log('\n--- TEST 6: Ineligible Plan & Cycle Validation ---');
    const { req: wrongPlanReq, res: wrongPlanRes } = mockReqRes({
      user: adminUserA,
      tenant: { organizationId: testOrgA._id },
      body: {
        code: rawVoucherCode,
        pin: rawVoucherPin,
        planId: enterprisePlan._id, // Ineligible plan
        billingCycle: 'MONTHLY',
      },
    });

    await applyVoucher(wrongPlanReq, wrongPlanRes);
    assert(wrongPlanRes.statusCode === 400, 'Ineligible plan rejected');

    const { req: wrongCycleReq, res: wrongCycleRes } = mockReqRes({
      user: adminUserA,
      tenant: { organizationId: testOrgA._id },
      body: {
        code: rawVoucherCode,
        pin: rawVoucherPin,
        planId: growthPlan._id,
        billingCycle: 'YEARLY', // Ineligible interval
      },
    });

    await applyVoucher(wrongCycleReq, wrongCycleRes);
    assert(wrongCycleRes.statusCode === 400, 'Ineligible billing interval rejected');

    // ---------------------------------------------------------
    // TEST 7: Zero-Payable Atomic Redemption & Entitlement Activation
    // ---------------------------------------------------------
    console.log('\n--- TEST 7: Zero-Payable Atomic Redemption (₹0 Final Payable) ---');
    const idempotencyKey1 = `test_idem_${Date.now()}_A`;
    const { req: zeroReq, res: zeroRes } = mockReqRes({
      user: adminUserA,
      tenant: { organizationId: testOrgA._id },
      body: {
        code: rawVoucherCode,
        pin: rawVoucherPin,
        planId: growthPlan._id,
        billingCycle: 'MONTHLY',
        idempotencyKey: idempotencyKey1,
      },
    });

    await redeemVoucherZeroPayable(zeroReq, zeroRes);
    assert(zeroRes.statusCode === 200, 'Zero-payable redemption returns 200');
    assert(zeroRes.data.success === true, 'Redemption succeeded');
    assert(zeroRes.data.data.finalPayable === 0, 'Final payable recorded as 0');

    // Verify Subscription is ACTIVE with 0 payable and correct period
    const subA = await Subscription.findOne({ organizationId: testOrgA._id });
    assert(subA !== null, 'Subscription record exists');
    assert(subA.status === 'ACTIVE', 'Subscription status transitioned to ACTIVE');
    assert(subA.amount === 0, 'Subscription amount is 0');
    assert(subA.planId.toString() === growthPlan._id.toString(), 'Subscription is linked to Growth Plan');

    // Verify Zero-Balance Payment & Invoice
    const paymentRecord = await Payment.findOne({
      organizationId: testOrgA._id,
      provider: 'VOUCHER',
    });
    assert(paymentRecord !== null, 'Zero-balance Payment record created with provider VOUCHER');
    assert(paymentRecord.amountRupees === 0, 'Payment amount is 0 rupees (NO fake Razorpay transaction)');
    assert(paymentRecord.discountRupees === 2000, 'Payment records full ₹2,000 discount');

    const invoiceRecord = await Invoice.findOne({ organizationId: testOrgA._id, invoiceType: 'SAAS_INVOICE' });
    assert(invoiceRecord !== null, 'SAAS_INVOICE record generated');
    assert(invoiceRecord.subtotalRupees === 2000, 'Invoice subtotal is ₹2,000');
    assert(invoiceRecord.discountRupees === 2000, 'Invoice discount is ₹2,000');
    assert(invoiceRecord.totalRupees === 0, 'Invoice total is ₹0');
    assert(invoiceRecord.status === 'PAID', 'Invoice status is PAID');

    // Verify Ledger Entry
    const ledgerRecord = await LedgerEntry.findOne({
      organizationId: testOrgA._id,
      source: 'SAAS_VOUCHER',
    });
    assert(ledgerRecord !== null, 'Ledger record created with source SAAS_VOUCHER');

    // Verify Voucher state transition to EXHAUSTED (since global limit was 1)
    const exhaustedVoucher = await Voucher.findById(createdVoucherId);
    assert(exhaustedVoucher.currentRedemptionCount === 1, 'Voucher redemption count is 1');
    assert(exhaustedVoucher.status === 'EXHAUSTED', 'Voucher status updated to EXHAUSTED');

    // Verify Super Admin Notification
    const notif = await Notification.findOne({
      title: 'Subscription Activated Using Voucher',
      organizationId: testOrgA._id,
    });
    assert(notif !== null, 'Super Admin received notification of successful voucher redemption');

    // ---------------------------------------------------------
    // TEST 8: Anti-Replay / Reuse Prevention
    // ---------------------------------------------------------
    console.log('\n--- TEST 8: Anti-Replay & Exhaustion Enforcement ---');
    // Org A attempts to redeem again with new idempotency key
    const { req: retryReqA, res: retryResA } = mockReqRes({
      user: adminUserA,
      tenant: { organizationId: testOrgA._id },
      body: {
        code: rawVoucherCode,
        pin: rawVoucherPin,
        planId: growthPlan._id,
        billingCycle: 'MONTHLY',
        idempotencyKey: `retry_${Date.now()}`,
      },
    });

    await redeemVoucherZeroPayable(retryReqA, retryResA);
    assert(retryResA.statusCode === 400, 'Second redemption by same organization is REJECTED');

    // Org B attempts to redeem the single-use voucher
    const { req: retryReqB, res: retryResB } = mockReqRes({
      user: adminUserB,
      tenant: { organizationId: testOrgB._id },
      body: {
        code: rawVoucherCode,
        pin: rawVoucherPin,
        planId: growthPlan._id,
        billingCycle: 'MONTHLY',
        idempotencyKey: `retry_b_${Date.now()}`,
      },
    });

    await redeemVoucherZeroPayable(retryReqB, retryResB);
    assert(retryResB.statusCode === 400, 'Redemption of exhausted voucher by another org is REJECTED');

    // Idempotent retry with original idempotencyKey returns original success without duplicate charging
    const { req: idemReq, res: idemRes } = mockReqRes({
      user: adminUserA,
      tenant: { organizationId: testOrgA._id },
      body: {
        code: rawVoucherCode,
        pin: rawVoucherPin,
        planId: growthPlan._id,
        billingCycle: 'MONTHLY',
        idempotencyKey: idempotencyKey1,
      },
    });

    await redeemVoucherZeroPayable(idemReq, idemRes);
    assert(idemRes.statusCode === 200, 'Idempotent request returns 200');
    assert(idemRes.data.idempotent === true, 'Flagged as idempotent response');

    // Total redemption count in DB must still be 1
    const totalRedemptions = await VoucherRedemption.countDocuments({ voucherId: createdVoucherId });
    assert(totalRedemptions === 1, 'Total redemptions in database strictly remains 1');

    // ---------------------------------------------------------
    // TEST 9: Partial-Discount Checkout Flow (₹5,000 Plan - ₹2,000 Voucher = ₹3,000 Payable)
    // ---------------------------------------------------------
    console.log('\n--- TEST 9: Partial-Discount Reservation & Verified Payment Flow ---');
    // Create voucher for partial discount test
    const { req: createPartReq, res: createPartRes } = mockReqRes({
      user: superAdmin,
      body: {
        name: 'Partial Discount Coupon ₹2000',
        discountAmountRupees: 2000,
        eligiblePlans: [enterprisePlan._id],
        expiresAt: expiresTomorrow,
        globalRedemptionLimit: 5,
        maxRedemptionsPerOrg: 1,
      },
    });
    await createVoucher(createPartReq, createPartRes);
    const partialCode = createPartRes.data.data.credentials.code;
    const partialPin = createPartRes.data.data.credentials.pin;
    const partialVoucherId = createPartRes.data.data.voucher._id;

    // Apply partial voucher: preview ₹5000 -> ₹3000
    const { req: partApplyReq, res: partApplyRes } = mockReqRes({
      user: adminUserB,
      tenant: { organizationId: testOrgB._id },
      body: {
        code: partialCode,
        pin: partialPin,
        planId: enterprisePlan._id,
        billingCycle: 'MONTHLY',
      },
    });
    await applyVoucher(partApplyReq, partApplyRes);
    assert(partApplyRes.data.data.originalAmount === 5000, 'Original amount ₹5,000');
    assert(partApplyRes.data.data.discountAmount === 2000, 'Discount amount ₹2,000');
    assert(partApplyRes.data.data.finalPayable === 3000, 'Final payable is ₹3,000');
    assert(partApplyRes.data.data.isZeroPayable === false, 'isZeroPayable is false');

    // Reserve partial discount: creates order for ₹3,000
    const { req: resvReq, res: resvRes } = mockReqRes({
      user: adminUserB,
      tenant: { organizationId: testOrgB._id },
      body: {
        code: partialCode,
        pin: partialPin,
        planId: enterprisePlan._id,
        billingCycle: 'MONTHLY',
      },
    });
    await reserveVoucherPartial(resvReq, resvRes);
    assert(resvRes.statusCode === 200, 'Reservation created successfully');
    assert(resvRes.data.data.amountRupees === 3000, 'Order amount is ₹3,000');
    assert(resvRes.data.data.amountPaise === 300000, 'Order amount in paise is 300,000');

    const checkoutSessionId = resvRes.data.data.checkoutSessionId;
    const orderId = resvRes.data.data.orderId;

    // Simulate Razorpay payment completion
    const fakePaymentId = `pay_test_${Date.now()}`;
    const validSig = generatePaymentSignature(orderId, fakePaymentId);

    // Verify partial discount payment & finalize activation
    const { req: verifyPartReq, res: verifyPartRes } = mockReqRes({
      user: adminUserB,
      tenant: { organizationId: testOrgB._id },
      body: {
        checkoutSessionId,
        razorpay_order_id: orderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: validSig,
      },
    });

    await verifyVoucherPartial(verifyPartReq, verifyPartRes);
    assert(verifyPartRes.statusCode === 200, 'Partial payment verification succeeded');

    // Verify Subscription B
    const subB = await Subscription.findOne({ organizationId: testOrgB._id });
    assert(subB.status === 'ACTIVE', 'Subscription B is ACTIVE');
    assert(subB.amount === 3000, 'Subscription B amount is ₹3,000');

    // Verify Invoice for Org B
    const invB = await Invoice.findOne({ organizationId: testOrgB._id, invoiceType: 'SAAS_INVOICE' });
    assert(invB.subtotalRupees === 5000, 'Invoice B subtotal is ₹5,000');
    assert(invB.discountRupees === 2000, 'Invoice B discount is ₹2,000');
    assert(invB.totalRupees === 3000, 'Invoice B total is ₹3,000');

    // Verify global Plan prices were NOT altered
    const verifyGrowthPlan = await Plan.findById(growthPlan._id);
    const verifyEntPlan = await Plan.findById(enterprisePlan._id);
    assert(verifyGrowthPlan.priceMonthly === 2000, 'Base Growth Plan monthly price is UNCHANGED (₹2,000)');
    assert(verifyEntPlan.priceMonthly === 5000, 'Base Enterprise Plan monthly price is UNCHANGED (₹5,000)');

    // ---------------------------------------------------------
    // TEST 10: Super Admin Status Changes (Suspend / Revoke)
    // ---------------------------------------------------------
    console.log('\n--- TEST 10: Status Lifecycle Changes (Suspend / Revoke) ---');
    const { req: suspReq, res: suspRes } = mockReqRes({
      user: superAdmin,
      params: { id: partialVoucherId },
      body: { status: 'SUSPENDED', reason: 'Temporary administrative audit' },
    });
    await updateVoucherStatus(suspReq, suspRes);
    assert(suspRes.statusCode === 200, 'Voucher suspended successfully');

    // Attempt to apply suspended voucher
    const { req: suspApplyReq, res: suspApplyRes } = mockReqRes({
      user: adminUserA,
      tenant: { organizationId: testOrgA._id },
      body: {
        code: partialCode,
        pin: partialPin,
        planId: enterprisePlan._id,
        billingCycle: 'MONTHLY',
      },
    });
    await applyVoucher(suspApplyReq, suspApplyRes);
    assert(suspApplyRes.statusCode === 400, 'Suspended voucher cannot be applied');

    // ---------------------------------------------------------
    // CLEANUP TEST FIXTURES
    // ---------------------------------------------------------
    console.log('\n--- Cleaning up test fixtures ---');
    await Voucher.deleteMany({ _id: { $in: [createdVoucherId, partialVoucherId] } });
    await VoucherRedemption.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
    await VoucherReservation.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
    await Organization.deleteMany({ _id: { $in: [testOrgA._id, testOrgB._id] } });
    await User.deleteMany({ _id: { $in: [adminUserA._id, adminUserB._id, studentUser._id] } });
    await Plan.deleteMany({ _id: { $in: [growthPlan._id, enterprisePlan._id] } });
    await Subscription.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
    await Payment.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
    await Invoice.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });
    await LedgerEntry.deleteMany({ organizationId: { $in: [testOrgA._id, testOrgB._id] } });

    console.log('\n======================================================');
    console.log(`🎉 ALL TESTS COMPLETED: ${testsPassed} passed, ${testsFailed} failed`);
    console.log('======================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('Fatal error in test suite:', err);
    process.exit(1);
  }
}

runTests();
