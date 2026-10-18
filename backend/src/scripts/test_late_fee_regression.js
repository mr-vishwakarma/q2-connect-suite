require('dotenv').config();
const assert = require('assert');
const mongoose = require('mongoose');
const {
  calculateLateFeeBreakdown,
  calculateCycleDueDate,
  getNextMonthlyDueDate,
  calculateBillingPeriod,
} = require('../utils/billingCycle');
const feeService = require('../services/fee.service');
const Student = require('../models/Student');
const { getSenderAddress } = require('../utils/email');

async function runLateFeeRegressionTests() {
  console.log('================================================================');
  console.log('🧪 Q2 CONNECT SUITE — LATE FEE & BILLING ENGINE REGRESSION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      passed++;
      console.log(`  ✅ PASS: ${name}`);
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      passed++;
      console.log(`  ✅ PASS: ${name}`);
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
    }
  }

  // --- SECTION 1: CALCULATION ENGINE POLYMORPHIC & BOUNDARY TESTS ---
  console.log('📦 SECTION 1: LATE-FEE CALCULATION ENGINE & GRACE PERIOD');

  const dueDate = new Date('2026-10-05T00:00:00.000Z');
  const grace = 5;
  const rate = 20;

  test('On Due Date (10/05): late fee is 0, isOverdue is false', () => {
    const res = calculateLateFeeBreakdown(dueDate, grace, rate, new Date('2026-10-05'));
    assert.strictEqual(res.overdueDays, 0);
    assert.strictEqual(res.chargeableDays, 0);
    assert.strictEqual(res.lateFee, 0);
    assert.strictEqual(res.isOverdue, false);
  });

  test('During Grace Period (10/10, Day 5 of grace): late fee is 0, isOverdue is false', () => {
    const res = calculateLateFeeBreakdown(dueDate, grace, rate, new Date('2026-10-10'));
    assert.strictEqual(res.overdueDays, 5);
    assert.strictEqual(res.chargeableDays, 0);
    assert.strictEqual(res.lateFee, 0);
    assert.strictEqual(res.isOverdue, false);
  });

  test('Day after Grace ends (10/11, Day 6): exactly 1 chargeable day penalty (₹20)', () => {
    const res = calculateLateFeeBreakdown(dueDate, grace, rate, new Date('2026-10-11'));
    assert.strictEqual(res.overdueDays, 6);
    assert.strictEqual(res.chargeableDays, 1);
    assert.strictEqual(res.lateFee, 20);
    assert.strictEqual(res.isOverdue, true);
  });

  test('7 days past Grace (10/17, Day 12 overdue): exactly 7 chargeable days penalty (₹140)', () => {
    const res = calculateLateFeeBreakdown(dueDate, grace, rate, new Date('2026-10-17'));
    assert.strictEqual(res.overdueDays, 12);
    assert.strictEqual(res.chargeableDays, 7);
    assert.strictEqual(res.lateFee, 140);
    assert.strictEqual(res.isOverdue, true);
  });

  test('Polymorphic Options Object invocation produces identical results as positional', () => {
    const objRes = calculateLateFeeBreakdown({
      dueDate,
      asOfDate: new Date('2026-10-17'),
      gracePeriodDays: grace,
      lateFeePerDay: rate,
    });
    assert.strictEqual(objRes.overdueDays, 12);
    assert.strictEqual(objRes.chargeableDays, 7);
    assert.strictEqual(objRes.lateFee, 140);
    assert.strictEqual(objRes.isOverdue, true);
  });

  test('Paid Fee freezes historical late fee and does not accumulate further penalties', () => {
    const res = calculateLateFeeBreakdown({
      dueDate,
      asOfDate: new Date('2026-10-17'),
      gracePeriodDays: grace,
      lateFeePerDay: rate,
      isPaid: true,
      historicalLateFee: 50,
    });
    assert.strictEqual(res.lateFee, 50);
    assert.strictEqual(res.isOverdue, false);
    assert.strictEqual(res.chargeableDays, 0);
  });

  // --- SECTION 2: JOINING DATE & RECURRING BILLING CYCLES ---
  console.log('\n📅 SECTION 2: JOINING DATE & RECURRING CYCLE ANCHORS');

  test('Student joining on 05/10/2026: cycle 0 is 05/10/2026, cycle 1 is 05/11/2026', () => {
    const c0 = calculateCycleDueDate('2026-10-05', 0);
    const c1 = calculateCycleDueDate('2026-10-05', 1);
    const c2 = calculateCycleDueDate('2026-10-05', 2);

    assert.strictEqual(c0.getDate(), 5);
    assert.strictEqual(c0.getMonth(), 9); // October
    assert.strictEqual(c1.getDate(), 5);
    assert.strictEqual(c1.getMonth(), 10); // November
    assert.strictEqual(c2.getDate(), 5);
    assert.strictEqual(c2.getMonth(), 11); // December
  });

  test('Student joining on 31/01/2026: Feb clamped to 28, March restores to 31', () => {
    const c0 = calculateCycleDueDate('2026-01-31', 0);
    const c1 = calculateCycleDueDate('2026-01-31', 1); // Feb 2026
    const c2 = calculateCycleDueDate('2026-01-31', 2); // Mar 2026

    assert.strictEqual(c0.getDate(), 31);
    assert.strictEqual(c1.getDate(), 28);
    assert.strictEqual(c1.getMonth(), 1); // February
    assert.strictEqual(c2.getDate(), 31);
    assert.strictEqual(c2.getMonth(), 2); // March
  });

  // --- SECTION 3: SENDER IDENTITY GUARANTEE ---
  console.log('\n📧 SECTION 3: GLOBAL SENDER IDENTITY ENFORCEMENT');

  test('getSenderAddress strictly sends from authenticated mayurvish2003@gmail.com', () => {
    const sender = getSenderAddress();
    assert(sender.includes('mayurvish2003@gmail.com'), `Sender must include mayurvish2003@gmail.com. Received: ${sender}`);
    assert(!sender.includes('noreply@q2connect.com'), 'Must never send from unroutable noreply@q2connect.com');
  });

  // --- SECTION 4: INTEGRATED FEE SERVICE WITH ATLAS ---
  console.log('\n🏦 SECTION 4: AUTHORITATIVE FEE SERVICE ATLAS INTEGRATION');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 30000 });

  await testAsync('feeService.calculatePayableFee correctly derives late fee for student Karan', async () => {
    const karan = await Student.findOne({ name: 'Karan' }).lean();
    assert(karan, 'Student Karan must exist in Atlas');

    const res = await feeService.calculatePayableFee({
      studentId: karan._id,
      feeMonth: 'October 2026',
      asOfDate: new Date('2026-10-17'),
    });

    assert.strictEqual(res.baseFee, 8000);
    assert.strictEqual(res.applicableLateFee, 140, 'Karan October late fee must be exactly ₹140');
    assert.strictEqual(res.overdueDays, 12);
    assert.strictEqual(res.chargeableDays, 7);
    assert.strictEqual(res.isOverdue, true);
    assert.strictEqual(res.totalPayable, 8140);
  });

  await mongoose.disconnect();

  console.log('\n================================================================');
  console.log(`📊 REGRESSION SUITE: ${passed}/${total} TESTS PASSED`);
  console.log('================================================================\n');

  process.exit(passed === total ? 0 : 1);
}

runLateFeeRegressionTests().catch((err) => {
  console.error('Fatal regression runner error:', err);
  process.exit(1);
});
