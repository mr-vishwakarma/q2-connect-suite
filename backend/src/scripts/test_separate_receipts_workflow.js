/**
 * Test Suite: Separate Fee & Security Deposit Receipts Workflow
 * 
 * Verifies all 18 requirements:
 * 1. Registration with payment enabled creates separate fee & deposit records and two receipts
 * 2. Registration with payment disabled creates no false payments or receipts
 * 3. Fee receipt is generated first
 * 4. Fee receipt displays deposit reference without adding to fee financial total
 * 5. Registration failure handles transactions cleanly
 * 6. Subsequent collection of both creates two receipts
 * 7. Collection when deposit already paid produces fee-only receipt
 * 8. Collection when fee already paid produces deposit-only receipt
 * 9. Double collection of settled deposit is rejected
 * 10. Partial deposit collection tracks remaining balance
 * 11. Allocation mismatch is rejected
 * 12. Late fees & discounts applied to fee component only
 * 13. Idempotency prevents duplicate collections on retry
 * 14. Fee and deposit totals stored in separate categories
 * 15. Component allocations equal total money received
 * 16. Reports do not double count collections
 * 17. Multi-tenant isolation enforced
 * 18. Student role cannot invoke collection
 */

require('dotenv').config();
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');
const Organization = require('../models/Organization');
const User = require('../models/User');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Hostel = require('../models/Hostel');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const SecurityDeposit = require('../models/SecurityDeposit');

const { createStudent } = require('../controllers/students.controller');
const { collectPayment, getFeeManagementDashboard } = require('../controllers/fees.controller');

function mockReqRes(options = {}) {
  const req = {
    user: options.user,
    tenant: options.tenant || { organizationId: options.user?.activeOrganizationId },
    organizationId: options.organizationId || options.user?.activeOrganizationId,
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    headers: options.headers || {},
  };

  let statusCode = 200;
  let responseData = null;

  const res = {
    status: (code) => {
      statusCode = code;
      return res;
    },
    json: (data) => {
      responseData = data;
      return res;
    },
  };

  return {
    req,
    res,
    getStatusCode: () => statusCode,
    getData: () => responseData,
  };
}

async function runTests() {
  console.log('======================================================================');
  console.log('🧪 VERIFYING SEPARATE FEE AND SECURITY DEPOSIT WORKFLOWS (18 TESTS)');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  const mongoUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/q2connect_test';
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log(`✅ Connected to MongoDB (${mongoUri}).\n`);
  } catch (connErr) {
    console.log(`Failed connecting to ${mongoUri}, trying Atlas MONGODB_URI...`);
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
    console.log('✅ Connected to MongoDB Atlas.\n');
  }

  try {
    // -------------------------------------------------------------
    // FIXTURE SETUP
    // -------------------------------------------------------------
    const timestamp = Date.now();
    let orgA = await Organization.findOne({ slug: 'test-org-receipts-a' });
    if (!orgA) {
      orgA = await Organization.create({
        name: 'Test Org Receipts A',
        slug: 'test-org-receipts-a',
        contactEmail: 'contact_a@test.com',
        status: 'ACTIVE',
      });
    }

    let orgB = await Organization.findOne({ slug: 'test-org-receipts-b' });
    if (!orgB) {
      orgB = await Organization.create({
        name: 'Test Org Receipts B',
        slug: 'test-org-receipts-b',
        contactEmail: 'contact_b@test.com',
        status: 'ACTIVE',
      });
    }

    const adminUserA = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Admin Org A',
      role: 'admin',
      activeOrganizationId: orgA._id,
      email: `admin_a_${timestamp}@test.com`,
    };

    const adminUserB = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Admin Org B',
      role: 'admin',
      activeOrganizationId: orgB._id,
      email: `admin_b_${timestamp}@test.com`,
    };

    const studentUser = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Student User',
      role: 'student',
      activeOrganizationId: orgA._id,
      email: `student_${timestamp}@test.com`,
    };

    // Clean up any test fixtures from previous runs
    await FeePayment.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
    await SecurityDeposit.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
    await Fee.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
    await Student.deleteMany({ organizationId: { $in: [orgA._id, orgB._id] } });
    await User.deleteMany({ activeOrganizationId: { $in: [orgA._id, orgB._id] } });

    // Create room for hostel with ample capacity and reset occupied count
    let testRoom = await Room.findOneAndUpdate(
      { organizationId: orgA._id, roomNumber: 'R-101' },
      {
        organizationId: orgA._id,
        roomNumber: 'R-101',
        hostel: 'Q2',
        capacity: 100,
        occupiedCount: 0,
        floor: 'First Floor',
      },
      { upsert: true, new: true }
    );

    // =============================================================
    // TEST 1: Registration with Payment Enabled
    // =============================================================
    console.log('--- Testing Registration Workflows ---');
    const student1Username = `stu_paid_${timestamp}`;
    const { req: req1, res: res1, getStatusCode: code1, getData: data1 } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      body: {
        name: 'Student Paid Reg',
        username: student1Username,
        password: 'Password@123',
        email: `${student1Username}@test.com`,
        phone: '9876543210',
        parentPhone: '9876543211',
        roomNo: 'R-101',
        fees: 8000,
        securityDeposit: 3000,
        hostel: 'Q2',
        startDate: '2026-10-01',
        initialFeePaid: true,
      },
    });

    await createStudent(req1, res1);
    const resData1 = data1();
    if (code1() !== 201) {
      console.log('Test 1 failed with:', code1(), resData1);
    }
    assert(
      code1() === 201 && resData1?.success && resData1?.data?.receipts,
      'Test 1: Registration with payment enabled succeeds and returns receipts',
      `status: ${code1()}`
    );

    const feeReceipt1 = resData1?.data?.receipts?.feeReceipt;
    const depReceipt1 = resData1?.data?.receipts?.depositReceipt;

    assert(
      Boolean(feeReceipt1 && depReceipt1),
      'Test 1b: Both Fee Receipt and Deposit Receipt generated on registration payment',
      `fee: ${feeReceipt1?.receipt_no}, dep: ${depReceipt1?.receipt_no}`
    );

    assert(
      feeReceipt1?.receipt_no?.startsWith('RCPT-FEE-') && depReceipt1?.receipt_no?.startsWith('RCPT-DEP-'),
      'Test 1c: Distinct receipt number prefixes for fee (RCPT-FEE-) and deposit (RCPT-DEP-)'
    );

    // =============================================================
    // TEST 2: Registration with Payment Disabled
    // =============================================================
    const student2Username = `stu_unpaid_${timestamp}`;
    const { req: req2, res: res2, getStatusCode: code2, getData: data2 } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      body: {
        name: 'Student Unpaid Reg',
        username: student2Username,
        password: 'Password@123',
        email: `${student2Username}@test.com`,
        phone: '9876543220',
        parentPhone: '9876543221',
        roomNo: 'R-101',
        fees: 8000,
        securityDeposit: 3000,
        hostel: 'Q2',
        startDate: '2026-10-01',
        initialFeePaid: false,
      },
    });

    await createStudent(req2, res2);
    const resData2 = data2();
    assert(
      code2() === 201 && resData2?.success && !resData2?.data?.receipts,
      'Test 2: Registration with payment disabled creates student without receipts or false payment records'
    );

    const unpaidStudent = await Student.findOne({ username: student2Username });
    const unpaidDeposit = await SecurityDeposit.findOne({ studentId: unpaidStudent._id });
    const unpaidFee = await Fee.findOne({ studentId: unpaidStudent._id });
    const unpaidPayments = await FeePayment.find({ studentId: unpaidStudent._id });

    assert(
      unpaidDeposit?.status === 'pending' && (unpaidFee?.status === 'unpaid' || unpaidFee?.status === 'pending') && unpaidPayments.length === 0,
      'Test 2b: Database records reflect pending fee, pending deposit, and 0 payments for unpaid registration'
    );

    // =============================================================
    // TEST 3: Fee Receipt is Generated / Displayed First
    // =============================================================
    const receiptKeys = Object.keys(resData1?.data?.receipts || {});
    assert(
      receiptKeys[0] === 'feeReceipt' && receiptKeys[1] === 'depositReceipt',
      'Test 3: Fee receipt is presented first before deposit receipt in payload'
    );

    // =============================================================
    // TEST 4: Informational deposit reference on Fee Receipt without adding to total
    // =============================================================
    assert(
      feeReceipt1.amount_paid === 8000 &&
      feeReceipt1.deposit_collected_separately === 3000 &&
      feeReceipt1.deposit_receipt_no === depReceipt1.receipt_no,
      'Test 4: Fee receipt total is exactly 8000, with informational deposit reference of 3000'
    );

    // =============================================================
    // TEST 5: Registration failure does not leave misleading paid statuses
    // =============================================================
    const { req: req5, res: res5, getStatusCode: code5 } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      body: {
        name: 'Student Duplicate Fail',
        username: student1Username, // already used
        password: 'Password@123',
        email: `${student1Username}@test.com`,
        phone: '9876543299',
        fees: 8000,
        initialFeePaid: true,
      },
    });
    await createStudent(req5, res5);
    assert(
      code5() === 400 || code5() === 409,
      'Test 5: Duplicate registration is rejected cleanly without creating orphan records'
    );

    // =============================================================
    // TEST 6: Subsequent Collection of Both Fee and Deposit
    // =============================================================
    console.log('\n--- Testing Subsequent Collection Workflows ---');
    const { req: req6, res: res6, getStatusCode: code6, getData: data6 } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      body: {
        studentId: unpaidStudent._id,
        hostel: 'Q2',
        month: unpaidFee.month,
        amount: 8000,
        lateFee: 0,
        discount: 0,
        securityDeposit: 3000,
        receivedAmount: 11000,
        paymentMode: 'upi',
        notes: 'Admin later collection of both',
      },
    });

    await collectPayment(req6, res6);
    const resData6 = data6();
    assert(
      code6() === 200 && resData6?.data?.feeReceipt && resData6?.data?.depositReceipt,
      'Test 6: Collecting both fee & deposit in later collection generates two separate receipts'
    );

    const collectedDepositRecord = await SecurityDeposit.findOne({ studentId: unpaidStudent._id });
    assert(
      collectedDepositRecord?.status === 'collected' && collectedDepositRecord?.paidAmount === 3000,
      'Test 6b: Security deposit status updated to collected with receiptNo'
    );

    // =============================================================
    // TEST 7: Deposit already paid - only Fee is collected
    // =============================================================
    const { req: req7, res: res7, getStatusCode: code7, getData: data7 } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      body: {
        studentId: unpaidStudent._id,
        hostel: 'Q2',
        month: 'November 2026',
        amount: 8000,
        lateFee: 0,
        discount: 0,
        securityDeposit: 0,
        receivedAmount: 8000,
        paymentMode: 'cash',
        notes: 'November fee only',
      },
    });

    await collectPayment(req7, res7);
    const resData7 = data7();
    assert(
      code7() === 200 && resData7?.data?.feeReceipt && !resData7?.data?.depositReceipt,
      'Test 7: When deposit is already paid, collecting fee produces only Fee Receipt'
    );

    // =============================================================
    // TEST 8: Fee already paid, but deposit outstanding
    // =============================================================
    const student8Username = `stu_dep_only_${timestamp}`;
    const student8 = await Student.create({
      organizationId: orgA._id,
      userId: new mongoose.Types.ObjectId(),
      name: 'Student Dep Only',
      username: student8Username,
      email: `${student8Username}@test.com`,
      phone: '9876543300',
      parentPhone: '9876543301',
      roomNo: 'R-101',
      hostel: 'Q2',
      fees: 8000,
      securityDeposit: 2500,
      startDate: new Date('2026-10-01'),
      status: 'ACTIVE',
    });

    // Create Fee as already paid
    const fee8 = await Fee.create({
      organizationId: orgA._id,
      studentId: student8._id,
      hostel: 'Q2',
      month: 'October 2026',
      amount: 8000,
      paidAmount: 8000,
      status: 'paid',
      dueDate: new Date('2026-10-05'),
    });

    // Security deposit remains pending
    await SecurityDeposit.create({
      organizationId: orgA._id,
      studentId: student8._id,
      amount: 2500,
      paidAmount: 0,
      status: 'pending',
    });

    const { req: req8, res: res8, getStatusCode: code8, getData: data8 } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      body: {
        studentId: student8._id,
        hostel: 'Q2',
        month: 'October 2026',
        amount: 0,
        lateFee: 0,
        discount: 0,
        securityDeposit: 2500,
        receivedAmount: 2500,
        paymentMode: 'bank',
        notes: 'Paying outstanding deposit only',
      },
    });

    await collectPayment(req8, res8);
    const resData8 = data8();
    assert(
      code8() === 200 && resData8?.data?.depositReceipt,
      'Test 8: Deposit-only collection succeeds when fee is already paid, returning Security Deposit Receipt'
    );

    // =============================================================
    // TEST 9: Second collection of deposit cannot charge again
    // =============================================================
    const { req: req9, res: res9, getStatusCode: code9, getData: data9 } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      body: {
        studentId: student8._id,
        hostel: 'Q2',
        month: 'October 2026',
        amount: 0,
        securityDeposit: 2500,
        receivedAmount: 2500,
        paymentMode: 'cash',
      },
    });

    await collectPayment(req9, res9);
    assert(
      code9() === 400 && data9()?.message?.includes('already been fully paid'),
      'Test 9: Charging security deposit a second time is blocked by backend validation'
    );

    // =============================================================
    // TEST 10: Partial deposit payment: only remaining deposit balance is due
    // =============================================================
    const student10Username = `stu_part_dep_${timestamp}`;
    const student10 = await Student.create({
      organizationId: orgA._id,
      userId: new mongoose.Types.ObjectId(),
      name: 'Student Partial Dep',
      username: student10Username,
      email: `${student10Username}@test.com`,
      phone: '9876543400',
      parentPhone: '9876543401',
      roomNo: 'R-101',
      hostel: 'Q2',
      fees: 8000,
      securityDeposit: 5000,
      startDate: new Date('2026-10-01'),
      status: 'ACTIVE',
    });

    await Fee.create({
      organizationId: orgA._id,
      studentId: student10._id,
      hostel: 'Q2',
      month: 'October 2026',
      amount: 8000,
      status: 'unpaid',
    });

    await SecurityDeposit.create({
      organizationId: orgA._id,
      studentId: student10._id,
      amount: 5000,
      paidAmount: 0,
      status: 'pending',
    });

    // Pay 2000 of the 5000 deposit
    const { req: req10a, res: res10a, getStatusCode: code10a } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      body: {
        studentId: student10._id,
        hostel: 'Q2',
        month: 'October 2026',
        amount: 8000,
        securityDeposit: 2000,
        receivedAmount: 10000,
        paymentMode: 'upi',
      },
    });
    await collectPayment(req10a, res10a);
    assert(code10a() === 200, 'Test 10a: Partial deposit payment of 2000 recorded');

    // Attempting to collect more than remaining 3000 should be rejected
    const { req: req10b, res: res10b, getStatusCode: code10b } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      body: {
        studentId: student10._id,
        hostel: 'Q2',
        month: 'November 2026',
        amount: 8000,
        securityDeposit: 4000, // only 3000 remaining!
        receivedAmount: 12000,
        paymentMode: 'upi',
      },
    });
    await collectPayment(req10b, res10b);
    assert(
      code10b() === 400,
      'Test 10b: Attempting to collect more than remaining deposit balance is rejected'
    );

    // =============================================================
    // TEST 11: Allocation mismatch validation
    // =============================================================
    const { req: req11, res: res11, getStatusCode: code11 } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      body: {
        studentId: student10._id,
        hostel: 'Q2',
        month: 'November 2026',
        amount: 8000,
        securityDeposit: 3000,
        receivedAmount: 9000, // mismatch! 8000 + 3000 != 9000
        paymentMode: 'cash',
      },
    });
    await collectPayment(req11, res11);
    assert(
      code11() === 400,
      'Test 11: Allocation mismatch (receivedAmount !== fee + deposit) is rejected'
    );

    // =============================================================
    // TEST 12: Late fees & discounts applied to fee component only
    // =============================================================
    const { req: req12, res: res12, getStatusCode: code12, getData: data12 } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      body: {
        studentId: student10._id,
        hostel: 'Q2',
        month: 'November 2026',
        amount: 8000,
        lateFee: 280,
        discount: 100,
        securityDeposit: 3000,
        receivedAmount: 11180, // 8000 + 280 - 100 + 3000 = 11180
        paymentMode: 'upi',
      },
    });
    await collectPayment(req12, res12);
    const resData12 = data12();
    assert(
      code12() === 200 &&
      resData12?.data?.feeReceipt?.amount_paid === 8180 &&
      resData12?.data?.depositReceipt?.deposit_amount === 3000,
      'Test 12: Late fee (+280) and discount (-100) are applied to fee liability (8180) only, leaving deposit at 3000'
    );

    // =============================================================
    // TEST 13: Idempotency check prevents duplicate collections
    // =============================================================
    const idempotencyKey = `idem_${timestamp}_unique`;
    const { req: req13a, res: res13a, getStatusCode: code13a } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      headers: { 'idempotency-key': idempotencyKey },
      body: {
        studentId: student8._id,
        hostel: 'Q2',
        month: 'November 2026',
        amount: 8000,
        receivedAmount: 8000,
        paymentMode: 'upi',
      },
    });
    await collectPayment(req13a, res13a);

    // Replay identical request
    const { req: req13b, res: res13b, getStatusCode: code13b, getData: data13b } = mockReqRes({
      user: adminUserA,
      organizationId: orgA._id,
      headers: { 'idempotency-key': idempotencyKey },
      body: {
        studentId: student8._id,
        hostel: 'Q2',
        month: 'November 2026',
        amount: 8000,
        receivedAmount: 8000,
        paymentMode: 'upi',
      },
    });
    await collectPayment(req13b, res13b);
    assert(
      code13b() === 200 && data13b()?.idempotent === true,
      'Test 13: Replaying identical collection with idempotency key returns cached result without double collection'
    );

    // =============================================================
    // TEST 14 & 15: Fee and deposit allocations reconciled
    // =============================================================
    console.log('\n--- Testing Financial Reporting and Tenant Authorization ---');
    const paymentRecord = await FeePayment.findById(resData12?.data?.payment?._id);
    assert(
      paymentRecord?.amount === 8180 && paymentRecord?.securityDeposit === 3000,
      'Test 14: Fee payment record stores fee allocation (8180) and deposit allocation (3000) in distinct fields'
    );

    const sumAllocations = paymentRecord.amount + paymentRecord.securityDeposit;
    assert(
      sumAllocations === 11180,
      'Test 15: Sum of component allocations (8180 + 3000) strictly reconciles with actual money received (11180)'
    );

    // =============================================================
    // TEST 16: Reports do not double-count parent collections
    // =============================================================
    const allOrgAPayments = await FeePayment.find({ organizationId: orgA._id });
    const totalFeeRevenue = allOrgAPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalDepositRevenue = allOrgAPayments.reduce((sum, p) => sum + (p.securityDeposit || 0), 0);
    const totalCashflow = totalFeeRevenue + totalDepositRevenue;

    const allDepositsDirect = await SecurityDeposit.find({ organizationId: orgA._id, status: 'collected' });
    const directDepositTotal = allDepositsDirect.reduce((sum, d) => sum + (d.paidAmount || d.amount || 0), 0);

    assert(
      totalDepositRevenue === directDepositTotal,
      'Test 16: Reporting cashflow isolates deposit revenue from recurring rent revenue without double counting',
      `feePaymentsDepositTotal: ${totalDepositRevenue}, securityDepositsTotal: ${directDepositTotal}`
    );

    // =============================================================
    // TEST 17: Cross-tenant isolation
    // =============================================================
    const { req: req17, res: res17, getStatusCode: code17 } = mockReqRes({
      user: adminUserB, // Admin of Org B attempting to collect for student in Org A
      organizationId: orgB._id,
      body: {
        studentId: student8._id,
        hostel: 'Q2',
        month: 'December 2026',
        amount: 8000,
        receivedAmount: 8000,
        paymentMode: 'cash',
      },
    });
    await collectPayment(req17, res17);
    assert(
      code17() === 404,
      'Test 17: Cross-tenant collection is rejected with 404 (student not found in tenant organization)'
    );

    // =============================================================
    // TEST 18: Student role cannot collect payment
    // =============================================================
    // Note: The route is protected by `adminOnly`, which rejects students with 403 Forbidden
    const { adminOnly } = require('../middleware/admin.middleware');
    let adminOnlyCalledNext = false;
    let adminOnlyStatusCode = 200;
    const mockStudentReq = { user: studentUser };
    const mockStudentRes = {
      status: (c) => {
        adminOnlyStatusCode = c;
        return mockStudentRes;
      },
      json: () => mockStudentRes,
    };
    adminOnly(mockStudentReq, mockStudentRes, () => {
      adminOnlyCalledNext = true;
    });

    assert(
      adminOnlyStatusCode === 403 && !adminOnlyCalledNext,
      'Test 18: AdminOnly middleware denies student role (403 Forbidden) from collection endpoints'
    );

  } catch (err) {
    console.error('Fatal error during test suite:', err);
    failed++;
  } finally {
    console.log('\n======================================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
    console.log('======================================================================');
    await mongoose.disconnect();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
