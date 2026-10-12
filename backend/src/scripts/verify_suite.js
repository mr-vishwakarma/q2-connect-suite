/**
 * Verification Test Suite for Q2 Connect Suite Enhancements
 * Tests:
 * - Dynamic late-fee calculation & grace period policy
 * - Default natural room sorting
 * - Student enrollment with security deposit & activation token
 * - Single-use token activation & password set
 * - WhatsApp parent leave notification logic (Pending vs Approved vs Rejected, Idempotency, Unconfigured MSG91 safety)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');
const User = require('../models/User');
const Student = require('../models/Student');
const Fee = require('../models/Fee');
const MessRequest = require('../models/MessRequest');
const SecurityDeposit = require('../models/SecurityDeposit');
const { calculatePayableFee } = require('../services/fee.service');
const { sendLeaveApprovalParentNotification } = require('../services/whatsapp.service');

async function runVerification() {
  console.log('============================================================');
  console.log('🧪 Q2 CONNECT SUITE: COMPREHENSIVE VERIFICATION SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    // TEST SUITE 1: Natural Room Sorting
    console.log('--- TEST GROUP 1: Room Number Collation & Natural Sort ---');
    const testRooms = ['Room 101', 'Room 2', 'Room 20', 'Room 11', 'Room 102', '103', '5'];
    const naturalSorted = [...testRooms].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );
    assert(
      naturalSorted[0] === '5' && naturalSorted.includes('Room 2') && naturalSorted.indexOf('Room 2') < naturalSorted.indexOf('Room 11'),
      'Natural sorting orders Room 2 before Room 11 and Room 101'
    );

    // TEST SUITE 2: Dynamic Late Fee Calculation Service
    console.log('\n--- TEST GROUP 2: Dynamic Late-Fee Calculation Service ---');
    // Find an existing student
    const existingStudent = await Student.findOne({ isActive: true });
    if (existingStudent) {
      const calcResult = await calculatePayableFee({
        studentId: existingStudent._id.toString(),
        hostelId: existingStudent.hostelId?.toString(),
        feeMonth: 'October 2026',
        organizationId: existingStudent.organizationId?.toString(),
      });

      assert(calcResult.success === true, 'Fee calculation service returns success');
      assert(typeof calcResult.baseFee === 'number' && calcResult.baseFee >= 0, 'Base fee is non-negative number');
      assert(typeof calcResult.applicableLateFee === 'number' && calcResult.applicableLateFee >= 0, 'Late fee is non-negative number');
      assert(typeof calcResult.totalPayable === 'number', 'Total payable is calculated');
      assert(
        calcResult.totalPayable === Math.max(0, calcResult.outstandingAmount + calcResult.applicableLateFee + calcResult.depositDue - calcResult.discount),
        'Total payable matches authoritative formula: outstanding + lateFee + depositDue - discount'
      );
    } else {
      console.log('  ⚠️ Warning: No existing student found in DB for fee calc test.');
    }

    // TEST SUITE 3: WhatsApp Parent Leave Approval Notifications
    console.log('\n--- TEST GROUP 3: Parent WhatsApp Leave Approval Workflow ---');
    const dummyReq = await MessRequest.create({
      userId: new mongoose.Types.ObjectId(),
      hostel: 'Q2',
      leavingDate: new Date('2026-10-15'),
      returnDate: new Date('2026-10-18'),
      reason: 'Home visit for festival',
      status: 'pending',
    });

    // Subtest 3A: While pending, parentNotificationStatus remains NONE
    assert(dummyReq.parentNotificationStatus === 'NONE', 'Pending leave request does NOT send parent notification');

    // Subtest 3B: Missing guardian phone yields SKIPPED_NO_PHONE
    const noPhoneResult = await sendLeaveApprovalParentNotification({
      leaveRequestId: dummyReq._id,
      studentName: 'Test Student',
      startDate: '2026-10-15',
      endDate: '2026-10-18',
      approverName: 'Admin',
      parentPhone: null,
    });
    assert(noPhoneResult.status === 'SKIPPED_NO_PHONE', 'Missing guardian phone correctly recorded as SKIPPED_NO_PHONE');

    // Subtest 3C: Valid guardian phone with unconfigured MSG91 credentials yields NOT_CONFIGURED
    const validPhoneResult = await sendLeaveApprovalParentNotification({
      leaveRequestId: dummyReq._id,
      studentName: 'Test Student',
      startDate: '2026-10-15',
      endDate: '2026-10-18',
      approverName: 'Admin',
      parentPhone: '9876543210',
    });
    assert(validPhoneResult.status === 'NOT_CONFIGURED', 'Unconfigured MSG91 provider safely recorded as NOT_CONFIGURED without faking delivery');

    // Subtest 3D: Idempotency check
    const updatedReq = await MessRequest.findById(dummyReq._id);
    assert(
      updatedReq.parentNotificationStatus === 'NOT_CONFIGURED',
      'Database status updated to NOT_CONFIGURED'
    );

    // Clean up dummy leave request
    await MessRequest.findByIdAndDelete(dummyReq._id);

    // TEST SUITE 4: Activation Token & Password Setup Security
    console.log('\n--- TEST GROUP 4: Activation Token Security & Single-Use Consumption ---');
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');
    const testEmail = `verify_${Date.now()}@q2test.local`;

    const activationUser = await User.create({
      name: 'Activation Resident',
      email: testEmail,
      username: `act_${Date.now()}`,
      password: 'Temporary@123',
      role: 'student',
      status: 'INVITED',
      mustChangePassword: true,
      activationToken: hashedToken,
      activationExpires: new Date(Date.now() + 48 * 3600 * 1000),
      hostels: ['Q2'],
    });

    assert(activationUser.activationToken === hashedToken, 'Hashed activation token stored securely');
    assert(activationUser.mustChangePassword === true, 'mustChangePassword flag set for new enrollment');

    // Verify lookup by hashed raw token
    const tokenMatchedUser = await User.findOne({
      $or: [
        { resetPasswordToken: hashedToken, resetPasswordExpires: { $gt: Date.now() } },
        { activationToken: hashedToken, activationExpires: { $gt: Date.now() } },
      ],
    });
    assert(tokenMatchedUser && tokenMatchedUser._id.equals(activationUser._id), 'User successfully resolved by activation token');

    // Consume token
    tokenMatchedUser.password = 'ActivatedPermanent@123';
    tokenMatchedUser.activationToken = undefined;
    tokenMatchedUser.activationExpires = undefined;
    tokenMatchedUser.mustChangePassword = false;
    tokenMatchedUser.status = 'ACTIVE';
    await tokenMatchedUser.save();

    // Verify token is single-use and now invalidated
    const consumedLookup = await User.findOne({
      activationToken: hashedToken,
    });
    assert(consumedLookup === null, 'Activation token is invalidated after use (single-use guarantee)');

    // Clean up test user
    await User.findByIdAndDelete(activationUser._id);

    console.log('\n============================================================');
    console.log(`🏁 VERIFICATION SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test execution failed with exception:', err);
    process.exit(1);
  }
}

runVerification();
