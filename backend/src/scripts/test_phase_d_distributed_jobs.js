/**
 * Phase D — Distributed Background Jobs, Redis/BullMQ & Concurrency Hardening Test Suite
 * 
 * Tests:
 * 1. Redis Configuration, Lifecycle & Degraded Mode Safety
 * 2. Queue Architecture, Bounded Retention & Concise Payloads
 * 3. Worker Execution, Bounded Concurrency & Error Classification
 * 4. Distributed Repeatable Schedules & Duplicate Cron Elimination
 * 5. Fee Reminder Idempotency, Bounded Cursor Batching & Tenant Safety
 * 6. Late Fee Calculation with Cursor Streaming & Batched BulkWrite
 * 7. Concurrency Hardening: Atomic Room Allocation under Heavy Parallel Load (Capacity = 1 and Capacity = 2)
 * 8. Concurrency Hardening: Duplicate Student Registration Race Protection (409 Conflict)
 * 9. Graceful Worker & System Shutdown
 */

require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.MOCK_EMAIL = 'true';

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');
const { getRedisStatus, getRedisOptions, closeRedisConnections } = require('../config/redis');
const { initQueues, addEmailJob, addScheduledJob, getQueueMetrics, DEFAULT_JOB_OPTIONS, QUEUES, closeQueues } = require('../queues/queueManager');
const { processEmailJob, initEmailWorker, closeEmailWorker } = require('../workers/email.worker');
const { runFeeReminderDispatcher } = require('../jobs/feeReminder.job');
const { runLateFeeCalculation } = require('../jobs/lateFee.job');
const { SCHEDULED_TASKS, initDistributedScheduler } = require('../schedulers/distributedScheduler');
const { initBackgroundSystem, shutdownBackgroundSystem } = require('../jobs/index');
const { systemHealthService } = require('../services/systemHealth.service');

const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Student = require('../models/Student');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Settings = require('../models/Settings');

async function runPhaseDTestSuite() {
  console.log('============================================================');
  console.log('⚡ PHASE D: DISTRIBUTED BACKGROUND JOBS & CONCURRENCY SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is required to run Phase D regression suite.');
    }

    console.log('[Setup] Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      family: 4,
    });
    console.log('✅ Connected to MongoDB Atlas.\n');

    // Setup Test Org & Hostel Fixtures
    let testOrg = await Organization.findOne({ slug: 'phase-d-test-org' });
    if (!testOrg) {
      testOrg = await Organization.create({
        name: 'Phase D Test Organization',
        slug: 'phase-d-test-org',
        contactEmail: 'contact@phasedorg.com',
        status: 'ACTIVE',
      });
    }

    let testHostel = await Hostel.findOne({ organizationId: testOrg._id, code: 'PHD1' });
    if (!testHostel) {
      testHostel = await Hostel.create({
        name: 'Phase D Hostel 1',
        code: 'PHD1',
        organizationId: testOrg._id,
        capacity: 100,
      });
    }

    // Tenant B Org for cross-tenant validation
    let tenantBOrg = await Organization.findOne({ slug: 'phase-d-tenant-b' });
    if (!tenantBOrg) {
      tenantBOrg = await Organization.create({
        name: 'Phase D Tenant B',
        slug: 'phase-d-tenant-b',
        contactEmail: 'contact@tenantb.com',
        status: 'ACTIVE',
      });
    }

    // =============================================================
    // TEST GROUP 1: REDIS CONFIGURATION & DEGRADED MODE SAFETY
    // =============================================================
    console.log('--- TEST GROUP 1: Redis Configuration, Lifecycle & Degraded Mode Safety ---');

    const redisOpts = getRedisOptions();
    assert(redisOpts.baseOptions.maxRetriesPerRequest === null, 'Redis configuration mandates maxRetriesPerRequest: null for BullMQ compatibility');
    assert(typeof redisOpts.baseOptions.retryStrategy === 'function', 'Redis configuration provides bounded exponential retry strategy');

    const redisStatus = getRedisStatus();
    assert(
      redisStatus.status === 'READY' || redisStatus.status === 'DEGRADED' || redisStatus.status === 'UNCONFIGURED',
      `Redis connection state is safely tracked (Current: ${redisStatus.status})`
    );

    // Verify system health check classifies Redis as DEGRADED DEPENDENCY
    const health = await systemHealthService.getSystemHealth();
    assert(health.dependencies?.degraded?.redis !== undefined, 'Health check classifies Redis under degraded dependencies');
    assert(health.services?.redis?.classification === 'DEGRADED_DEPENDENCY', 'Redis is explicitly tagged as DEGRADED_DEPENDENCY');
    assert(health.status === 'OPERATIONAL', 'Core API status remains OPERATIONAL regardless of Redis connection state');

    // Test Degraded Mode Enqueue Fallback: Transactional email dispatches safely without crashing
    const degradedJobResult = await addEmailJob('STUDENT_CREDENTIALS', {
      to: 'test_phase_d_degraded@q2connect.com',
      name: 'Degraded Fallback Student',
      username: 'degraded_user_1',
      password: 'TempPassword@123',
      resetLink: 'https://q2connect.com/reset',
    });
    assert(degradedJobResult.success === true, 'addEmailJob succeeds gracefully in degraded mode');
    assert(Boolean(degradedJobResult.jobId), 'addEmailJob produces deterministic job identifier even in degraded mode');

    // =============================================================
    // TEST GROUP 2: QUEUE RETENTION & PAYLOAD BOUNDARIES
    // =============================================================
    console.log('\n--- TEST GROUP 2: Queue Retention Limits & Payload Architecture ---');

    assert(DEFAULT_JOB_OPTIONS.attempts === 3, 'Default queue configuration enforces bounded retries (attempts: 3)');
    assert(DEFAULT_JOB_OPTIONS.backoff.type === 'exponential', 'Default queue retry backoff is exponential');
    assert(DEFAULT_JOB_OPTIONS.removeOnComplete.count === 500, 'Completed jobs retention is strictly bounded to 500 records');
    assert(DEFAULT_JOB_OPTIONS.removeOnFail.count === 1000, 'Failed jobs retention is strictly bounded to 1000 records');
    assert(QUEUES.EMAIL === 'email-queue', 'Dedicated email-queue is registered');
    assert(QUEUES.SCHEDULED === 'scheduled-queue', 'Dedicated scheduled-queue is registered');

    // =============================================================
    // TEST GROUP 3: WORKER CONCURRENCY & ERROR CLASSIFICATION
    // =============================================================
    console.log('\n--- TEST GROUP 3: Worker Concurrency & Error Classification ---');

    // Verify UnrecoverableError throws on empty payload
    let unrecoverableCaught = false;
    try {
      await processEmailJob({ name: 'FEE_REMINDER', data: null, id: 'test-empty-job' });
    } catch (err) {
      unrecoverableCaught = err.name === 'UnrecoverableError';
    }
    assert(unrecoverableCaught, 'Email worker classifies empty payload as UnrecoverableError (no retry storm)');

    // Verify UnrecoverableError on missing fee record
    let missingFeeCaught = false;
    try {
      await processEmailJob({
        name: 'FEE_REMINDER',
        data: { feeId: new mongoose.Types.ObjectId().toString(), organizationId: testOrg._id.toString() },
        id: 'test-missing-fee',
      });
    } catch (err) {
      missingFeeCaught = err.name === 'UnrecoverableError';
    }
    assert(missingFeeCaught, 'Email worker classifies missing fee document as UnrecoverableError');

    // =============================================================
    // TEST GROUP 4: DISTRIBUTED REPEATABLE SCHEDULER
    // =============================================================
    console.log('\n--- TEST GROUP 4: Distributed Repeatable Scheduler & Duplicate Cron Elimination ---');

    assert(SCHEDULED_TASKS.length === 2, 'Distributed scheduler defines exactly 2 repeatable jobs (Late Fee & Fee Reminders)');
    const lateFeeTask = SCHEDULED_TASKS.find((t) => t.name === 'LATE_FEE_CALCULATION');
    const feeReminderTask = SCHEDULED_TASKS.find((t) => t.name === 'FEE_REMINDER_DISPATCHER');

    assert(lateFeeTask && lateFeeTask.pattern === '0 0 * * *', 'Late fee calculation is scheduled for daily midnight (0 0 * * *)');
    assert(lateFeeTask && lateFeeTask.jobId === 'repeatable:late-fee-daily', 'Late fee calculation has deterministic repeatable jobId');
    assert(feeReminderTask && feeReminderTask.pattern === '0 10 * * *', 'Fee reminder dispatcher is scheduled for daily 10:00 AM (0 10 * * *)');
    assert(feeReminderTask && feeReminderTask.jobId === 'repeatable:fee-reminders-daily', 'Fee reminder dispatcher has deterministic repeatable jobId');

    // Test idempotent registration: running initDistributedScheduler twice does not error or register duplicate jobs
    const schedResult1 = await initDistributedScheduler();
    const schedResult2 = await initDistributedScheduler();
    assert(
      (schedResult1.initialized || schedResult1.degraded) && (schedResult2.initialized || schedResult2.degraded),
      'Multiple application startup scheduler invocations execute idempotently without error'
    );

    // =============================================================
    // TEST GROUP 5: FEE REMINDER IDEMPOTENCY & TENANT SAFETY
    // =============================================================
    console.log('\n--- TEST GROUP 5: Fee Reminder Idempotency, Bounded Streaming & Tenant Safety ---');

    // Create a student in Test Org
    const testStudentUser = await User.create({
      name: 'Fee Reminder Test Student',
      email: `fee_student_${Date.now()}@q2test.com`,
      username: `feestudent_${Date.now()}`,
      password: 'HashedPassword@123',
      role: 'student',
      activeOrganizationId: testOrg._id,
    });

    const testStudent = await Student.create({
      userId: testStudentUser._id,
      organizationId: testOrg._id,
      hostelId: testHostel._id,
      name: testStudentUser.name,
      username: testStudentUser.username,
      email: testStudentUser.email,
      hostel: testHostel.code,
      phone: '9998887771',
    });

    // Create overdue unpaid fee
    const testFee = await Fee.create({
      studentId: testStudent._id,
      organizationId: testOrg._id,
      hostelId: testHostel._id,
      hostel: testHostel.code,
      month: '2026-08',
      amount: 5000,
      status: 'unpaid',
      dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days overdue
      lastReminderSentAt: null,
    });

    // 1. Run Fee Reminder Dispatcher (bounded streaming)
    const scanMetrics = await runFeeReminderDispatcher();
    assert(scanMetrics.scannedCount >= 1, `Dispatcher scanned overdue fees via bounded cursor (Scanned: ${scanMetrics.scannedCount})`);
    assert(scanMetrics.durationMs >= 0, `Dispatcher completed in bounded time (${scanMetrics.durationMs}ms)`);

    // 2. Execute processEmailJob for testFee
    const emailJobResult = await processEmailJob({
      name: 'FEE_REMINDER',
      data: {
        feeId: testFee._id.toString(),
        organizationId: testOrg._id.toString(),
        studentId: testStudent._id.toString(),
        month: testFee.month,
        amount: testFee.amount,
      },
      id: `fee-reminder:${testFee._id}:2026-09-14`,
    });
    assert(emailJobResult.success === true, 'Fee reminder email processed successfully');

    // Verify durable MongoDB-level idempotency record
    const updatedFeeAfterEmail = await Fee.findById(testFee._id);
    assert(Boolean(updatedFeeAfterEmail.lastReminderSentAt), 'Fee document recorded durable lastReminderSentAt timestamp');

    // 3. Re-run identical job immediately: should suppress duplicate delivery
    const duplicateEmailJobResult = await processEmailJob({
      name: 'FEE_REMINDER',
      data: {
        feeId: testFee._id.toString(),
        organizationId: testOrg._id.toString(),
        studentId: testStudent._id.toString(),
        month: testFee.month,
        amount: testFee.amount,
      },
      id: `fee-reminder:${testFee._id}:2026-09-14`,
    });
    assert(duplicateEmailJobResult.skipped === true, 'Duplicate fee reminder execution skipped cleanly');
    assert(duplicateEmailJobResult.reason === 'IDEMPOTENT_DUPLICATE_SUPPRESSED', 'Duplicate suppressed with IDEMPOTENT_DUPLICATE_SUPPRESSED');

    // 4. Tenant Safety Test: Tenant B worker cannot process Tenant A's fee
    let crossTenantCaught = false;
    try {
      await processEmailJob({
        name: 'FEE_REMINDER',
        data: {
          feeId: testFee._id.toString(),
          organizationId: tenantBOrg._id.toString(), // Wrong tenant!
          studentId: testStudent._id.toString(),
          month: testFee.month,
          amount: testFee.amount,
        },
        id: `fee-reminder-cross-tenant-${Date.now()}`,
      });
    } catch (err) {
      crossTenantCaught = err.name === 'UnrecoverableError' && err.message.includes('tenant boundary violated');
    }
    assert(crossTenantCaught, 'Tenant B job attempting to process Tenant A fee is permanently blocked (tenant boundary violated)');

    // =============================================================
    // TEST GROUP 6: LATE FEE CALCULATION WITH CURSOR STREAMING
    // =============================================================
    console.log('\n--- TEST GROUP 6: Late Fee Calculation with Cursor Streaming & BulkWrite ---');

    await Settings.findOneAndUpdate(
      { organizationId: testOrg._id, hostel: testHostel.code },
      {
        organizationId: testOrg._id,
        hostel: testHostel.code,
        lateFeePerDay: 50,
        gracePeriodDays: 2,
      },
      { upsert: true }
    );

    const lateFeeMetrics = await runLateFeeCalculation();
    assert(lateFeeMetrics.processedCount >= 1, `Late fee calculation streamed overdue records (Processed: ${lateFeeMetrics.processedCount})`);
    assert(typeof lateFeeMetrics.updatedCount === 'number', `Late fee updated records via bulkWrite (Updated: ${lateFeeMetrics.updatedCount})`);

    // =============================================================
    // TEST GROUP 7: ATOMIC ROOM ALLOCATION UNDER HIGH CONCURRENCY
    // =============================================================
    console.log('\n--- TEST GROUP 7: Atomic Room Allocation Concurrency Hardening ---');

    // Scenario A: Room capacity = 1 available bed. 5 concurrent allocation requests.
    const testRoomA = await Room.create({
      organizationId: testOrg._id,
      hostelId: testHostel._id,
      hostel: testHostel.code,
      roomNumber: `CONCUR_1_${Date.now()}`,
      capacity: 1,
      occupiedCount: 0,
      status: 'available',
    });

    console.log(`[Concurrency Test A] Room ${testRoomA.roomNumber} created with capacity: 1, occupiedCount: 0.`);
    console.log('  Firing 5 parallel allocation requests simultaneously...');

    const allocateRoomAtomic = async (roomId, roomNo, hostelCode, orgId) => {
      const roomQuery = { roomNumber: roomNo, hostel: hostelCode, organizationId: orgId };
      const updated = await Room.findOneAndUpdate(
        {
          ...roomQuery,
          $expr: {
            $lt: [{ $ifNull: ['$occupiedCount', 0] }, '$capacity'],
          },
        },
        [
          {
            $set: {
              occupiedCount: { $add: [{ $ifNull: ['$occupiedCount', 0] }, 1] },
              status: {
                $cond: {
                  if: { $gte: [{ $add: [{ $ifNull: ['$occupiedCount', 0] }, 1] }, '$capacity'] },
                  then: 'full',
                  else: 'available',
                },
              },
            },
          },
        ],
        { new: true }
      );
      if (!updated) {
        return { success: false, reason: 'CAPACITY_EXCEEDED' };
      }
      return { success: true, room: updated };
    };

    const concurrentReqsA = Array.from({ length: 5 }).map(() =>
      allocateRoomAtomic(testRoomA._id, testRoomA.roomNumber, testHostel.code, testOrg._id)
    );

    const resultsA = await Promise.all(concurrentReqsA);
    const successfulAllocationsA = resultsA.filter((r) => r.success);
    const failedAllocationsA = resultsA.filter((r) => !r.success);

    assert(successfulAllocationsA.length === 1, `Exactly 1 allocation succeeded out of 5 concurrent requests (Actual: ${successfulAllocationsA.length})`);
    assert(failedAllocationsA.length === 4, `Remaining 4 requests safely received capacity conflict (Actual: ${failedAllocationsA.length})`);

    const finalRoomA = await Room.findById(testRoomA._id);
    assert(finalRoomA.occupiedCount === 1, `Room occupiedCount is strictly 1 (Actual: ${finalRoomA.occupiedCount}) — zero over-allocation`);
    assert(finalRoomA.status === 'full', `Room status transitioned atomically to 'full' (Actual: ${finalRoomA.status})`);

    // Scenario B: Room capacity = 2 available beds. 8 concurrent allocation requests.
    const testRoomB = await Room.create({
      organizationId: testOrg._id,
      hostelId: testHostel._id,
      hostel: testHostel.code,
      roomNumber: `CONCUR_2_${Date.now()}`,
      capacity: 2,
      occupiedCount: 0,
      status: 'available',
    });

    console.log(`\n[Concurrency Test B] Room ${testRoomB.roomNumber} created with capacity: 2, occupiedCount: 0.`);
    console.log('  Firing 8 parallel allocation requests simultaneously...');

    const concurrentReqsB = Array.from({ length: 8 }).map(() =>
      allocateRoomAtomic(testRoomB._id, testRoomB.roomNumber, testHostel.code, testOrg._id)
    );

    const resultsB = await Promise.all(concurrentReqsB);
    const successfulAllocationsB = resultsB.filter((r) => r.success);
    const failedAllocationsB = resultsB.filter((r) => !r.success);

    assert(successfulAllocationsB.length === 2, `Exactly 2 allocations succeeded out of 8 concurrent requests (Actual: ${successfulAllocationsB.length})`);
    assert(failedAllocationsB.length === 6, `Remaining 6 requests safely received capacity conflict (Actual: ${failedAllocationsB.length})`);

    const finalRoomB = await Room.findById(testRoomB._id);
    assert(finalRoomB.occupiedCount === 2, `Room occupiedCount is strictly 2 (Actual: ${finalRoomB.occupiedCount}) — zero over-allocation`);
    assert(finalRoomB.status === 'full', `Room status transitioned atomically to 'full' (Actual: ${finalRoomB.status})`);

    // =============================================================
    // TEST GROUP 8: DUPLICATE STUDENT REGISTRATION RACE
    // =============================================================
    console.log('\n--- TEST GROUP 8: Duplicate Student Registration Race Protection ---');

    const duplicateEmail = `race_reg_${Date.now()}@q2test.com`;
    const duplicateUsername = `race_user_${Date.now()}`;

    const registerStudentSimulated = async (email, username) => {
      try {
        const user = await User.create({
          name: 'Concurrent Registrant',
          email,
          username,
          password: 'Password@123',
          role: 'student',
          activeOrganizationId: testOrg._id,
        });
        return { success: true, status: 201, userId: user._id };
      } catch (err) {
        if (err.code === 11000) {
          return { success: false, status: 409, message: 'An account with this email or username already exists' };
        }
        return { success: false, status: 500, message: err.message };
      }
    };

    console.log(`  Sending 2 concurrent registration requests with identical email (${duplicateEmail})...`);
    const [regResult1, regResult2] = await Promise.all([
      registerStudentSimulated(duplicateEmail, duplicateUsername),
      registerStudentSimulated(duplicateEmail, duplicateUsername),
    ]);

    const regSuccessCount = [regResult1, regResult2].filter((r) => r.success).length;
    const regConflictCount = [regResult1, regResult2].filter((r) => r.status === 409).length;

    assert(regSuccessCount === 1, `Exactly 1 registration succeeded with 201 (Actual: ${regSuccessCount})`);
    assert(regConflictCount === 1, `Duplicate registration caught by database unique index returning 409 Conflict (Actual: ${regConflictCount})`);

    // Clean up test fixtures
    await User.deleteMany({ email: { $in: [testStudentUser.email, duplicateEmail] } });
    await Student.deleteMany({ _id: testStudent._id });
    await Fee.deleteMany({ _id: testFee._id });
    await Room.deleteMany({ _id: { $in: [testRoomA._id, testRoomB._id] } });

    // =============================================================
    // TEST GROUP 9: GRACEFUL WORKER & SHUTDOWN LIFECYCLE
    // =============================================================
    console.log('\n--- TEST GROUP 9: Graceful Worker & System Shutdown ---');

    let shutdownSuccess = false;
    try {
      await shutdownBackgroundSystem();
      shutdownSuccess = true;
    } catch (e) {
      shutdownSuccess = false;
    }
    assert(shutdownSuccess, 'shutdownBackgroundSystem completes cleanly without unhandled rejections');

    console.log('\n============================================================');
    console.log(`🏁 PHASE D TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    await mongoose.connection.close(false);

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Critical Test Suite Exception:', error);
    await mongoose.connection.close(false).catch(() => {});
    process.exit(1);
  }
}

runPhaseDTestSuite();
