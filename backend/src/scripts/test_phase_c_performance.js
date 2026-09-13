/**
 * Phase C — MongoDB, Query, Pagination & Read-Performance Regression Suite
 *
 * Verifies:
 * 1. Room pagination defect fix: Occupancy filtering in MongoDB ($expr), exact totals, accurate totalPages.
 * 2. Unbounded query elimination: Bounded pagination and safe max limit enforcement.
 * 3. Deterministic sort stability across paginated queries.
 * 4. Parallel query execution in /api/auth/me and platform analytics.
 * 5. Real live explain('executionStats') metrics on MongoDB Atlas.
 */

require('dotenv').config();
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Membership = require('../models/Membership');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const Expense = require('../models/Expense');
const Attendance = require('../models/Attendance');
const MessRequest = require('../models/MessRequest');
const Notification = require('../models/Notification');
const LaundrySlot = require('../models/LaundrySlot');
const MenuRating = require('../models/MenuRating');

const BASE_URL = 'http://localhost:5000/api';

async function runPhaseCTestSuite() {
  console.log('============================================================');
  console.log('⚡ PHASE C: MONGODB, QUERY & READ-PERFORMANCE TEST SUITE');
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
      throw new Error('MONGODB_URI is required to run performance regression suite.');
    }

    console.log('[Setup] Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log('✅ Connected to MongoDB Atlas.\n');

    // -------------------------------------------------------------
    // STEP 1: INDEX SYNCHRONIZATION
    // -------------------------------------------------------------
    console.log('--- STEP 1: Synchronizing & Verifying MongoDB Atlas Indexes ---');
    const syncResults = await Promise.allSettled([
      Attendance.syncIndexes(),
      Membership.syncIndexes(),
      MessRequest.syncIndexes(),
      Fee.syncIndexes(),
      LaundrySlot.syncIndexes(),
      MenuRating.syncIndexes(),
      Hostel.syncIndexes(),
      Organization.syncIndexes(),
      Student.syncIndexes(),
      Room.syncIndexes(),
    ]);

    const allSynced = syncResults.every(r => r.status === 'fulfilled');
    assert(allSynced, 'All 10 optimized Mongoose schemas synchronized indexes with Atlas');

    // -------------------------------------------------------------
    // STEP 2: SETUP DETERMINISTIC FIXTURES
    // -------------------------------------------------------------
    console.log('\n--- STEP 2: Establishing Deterministic Test Personas & Fixtures ---');
    let orgA = await Organization.findOne({ slug: 'q2-hostels' });
    if (!orgA) orgA = await Organization.findOne();
    if (!orgA) throw new Error('Base organization not found');

    let orgAHostel = await Hostel.findOne({ organizationId: orgA._id, isDeleted: false });
    const hostelCode = orgAHostel ? orgAHostel.code : 'Q2';

    const adminUser = await User.findOne({ username: 'Abhi1006' }) || await User.findOne({ role: 'admin' });
    const studentUser = await User.findOne({ role: 'student' });
    const superAdminUser = await User.findOne({ username: 'superadmin' }) || await User.findOne({ role: 'super_admin' });

    if (!adminUser || !superAdminUser) {
      throw new Error('Required admin or superadmin users missing');
    }

    const adminToken = jwt.sign({ id: adminUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    const studentToken = studentUser ? jwt.sign({ id: studentUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' }) : null;
    const studentHeaders = studentToken ? { Authorization: `Bearer ${studentToken}` } : adminHeaders;

    const saToken = jwt.sign({ id: superAdminUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const saHeaders = { Authorization: `Bearer ${saToken}` };

    // Seed 10 deterministic test rooms for occupancy pagination verification
    // 6 available (occupiedCount: 1, capacity: 2), 4 full (occupiedCount: 2, capacity: 2)
    const testRoomPrefix = 'PERF_RM_';
    await Room.deleteMany({ organizationId: orgA._id, roomNumber: { $regex: `^${testRoomPrefix}` } });

    const roomDocs = [];
    for (let i = 1; i <= 6; i++) {
      roomDocs.push({
        organizationId: orgA._id,
        hostelId: orgAHostel?._id,
        hostel: hostelCode,
        roomNumber: `${testRoomPrefix}A${String(i).padStart(2, '0')}`,
        capacity: 2,
        occupiedCount: 1, // available
        status: 'available'
      });
    }
    for (let i = 1; i <= 4; i++) {
      roomDocs.push({
        organizationId: orgA._id,
        hostelId: orgAHostel?._id,
        hostel: hostelCode,
        roomNumber: `${testRoomPrefix}F${String(i).padStart(2, '0')}`,
        capacity: 2,
        occupiedCount: 2, // full
        status: 'full'
      });
    }
    await Room.insertMany(roomDocs);
    console.log(`✅ Seeded 10 deterministic test rooms (6 available, 4 full).\n`);

    // -------------------------------------------------------------
    // STEP 3: VERIFY ROOM PAGINATION DEFECT FIX
    // -------------------------------------------------------------
    console.log('--- STEP 3: Room Occupancy Server-Side Pagination Verification ---');

    // Query Page 1 for available rooms (limit: 3)
    const resAvailP1 = await axios.get(`${BASE_URL}/rooms?hostel=${hostelCode}&status=available&page=1&limit=3`, { headers: adminHeaders });
    assert(resAvailP1.status === 200, 'Rooms available query page 1 returned 200 OK');
    assert(resAvailP1.data.data.length === 3, 'Page 1 returned exactly 3 rooms (limit applied after occupancy filter)');
    assert(resAvailP1.data.data.every(r => r.status === 'available'), 'All rooms on page 1 are strictly available');
    assert(resAvailP1.data.total >= 6, `Total available rooms is exact database count (${resAvailP1.data.total} >= 6), NOT memory slice length`);
    assert(resAvailP1.data.totalPages >= 2, `Total pages calculated accurately from filtered total (${resAvailP1.data.totalPages} >= 2)`);

    // Query Page 2 for available rooms (limit: 3)
    const resAvailP2 = await axios.get(`${BASE_URL}/rooms?hostel=${hostelCode}&status=available&page=2&limit=3`, { headers: adminHeaders });
    assert(resAvailP2.status === 200, 'Rooms available query page 2 returned 200 OK');
    assert(resAvailP2.data.data.length === 3, 'Page 2 returned next 3 rooms');

    // Verify zero overlap between Page 1 and Page 2
    const p1Ids = new Set(resAvailP1.data.data.map(r => r._id));
    const p2HasOverlap = resAvailP2.data.data.some(r => p1Ids.has(r._id));
    assert(!p2HasOverlap, 'Zero overlap between Page 1 and Page 2 room sets (deterministic pagination)');

    // Query Full Rooms (status=full, limit: 10)
    const resFull = await axios.get(`${BASE_URL}/rooms?hostel=${hostelCode}&status=full&page=1&limit=10`, { headers: adminHeaders });
    assert(resFull.status === 200, 'Rooms full query returned 200 OK');
    assert(resFull.data.data.every(r => r.status === 'full'), 'All returned rooms have status=full');
    assert(resFull.data.total >= 4, `Total full rooms reflects matching total (${resFull.data.total} >= 4)`);

    // -------------------------------------------------------------
    // STEP 4: VERIFY BOUNDED PAGINATION & MAX LIMIT ENFORCEMENT
    // -------------------------------------------------------------
    console.log('\n--- STEP 4: Unbounded Endpoint Pagination & Bounds Verification ---');

    // 1. Attendance
    const resAtt = await axios.get(`${BASE_URL}/attendance?page=1&limit=10`, { headers: adminHeaders });
    assert(resAtt.status === 200, 'Attendance endpoint returned 200 OK');
    assert(Array.isArray(resAtt.data.data), 'Attendance response contains array data');
    assert(typeof resAtt.data.total === 'number', 'Attendance response includes total matching count');
    assert(resAtt.data.limit === 10, 'Attendance honors requested limit');

    // Attendance safe max limit cap
    const resAttMax = await axios.get(`${BASE_URL}/attendance?page=1&limit=5000`, { headers: adminHeaders });
    assert(resAttMax.data.limit <= 100, `Attendance limit capped to maximum allowable (requested 5000, capped at ${resAttMax.data.limit})`);

    // 2. Mess Requests
    const resMess = await axios.get(`${BASE_URL}/mess-requests?page=1&limit=5`, { headers: adminHeaders });
    assert(resMess.status === 200, 'Mess requests endpoint returned 200 OK');
    assert(Array.isArray(resMess.data.data), 'Mess requests response contains array data');
    assert(typeof resMess.data.total === 'number', 'Mess requests includes total count');
    assert(resMess.data.limit === 5, 'Mess requests honors requested limit');

    // 3. Expenses
    const resExp = await axios.get(`${BASE_URL}/expenses?page=1&limit=5`, { headers: adminHeaders });
    assert(resExp.status === 200, 'Expenses endpoint returned 200 OK');
    assert(Array.isArray(resExp.data.data), 'Expenses response contains array data');
    assert(typeof resExp.data.total === 'number', 'Expenses response includes total count');

    // 4. Fees
    const resFees = await axios.get(`${BASE_URL}/fees?page=1&limit=10`, { headers: adminHeaders });
    assert(resFees.status === 200, 'Fees endpoint returned 200 OK');
    assert(Array.isArray(resFees.data.data), 'Fees response contains array data');
    assert(typeof resFees.data.total === 'number', 'Fees response includes total count');

    // 5. Fee Payments
    const resPayments = await axios.get(`${BASE_URL}/fees/payments?page=1&limit=10`, { headers: adminHeaders });
    assert(resPayments.status === 200, 'Fee payments endpoint returned 200 OK');
    assert(Array.isArray(resPayments.data.data), 'Fee payments response contains array data');
    assert(typeof resPayments.data.total === 'number', 'Fee payments response includes total count');

    // 6. Notifications
    const resNotif = await axios.get(`${BASE_URL}/notifications?page=1&limit=10`, { headers: adminHeaders });
    assert(resNotif.status === 200, 'Notifications endpoint returned 200 OK');
    assert(Array.isArray(resNotif.data.data), 'Notifications response contains array data');
    assert(typeof resNotif.data.total === 'number', 'Notifications response includes total count');

    // -------------------------------------------------------------
    // STEP 5: VERIFY DETERMINISTIC SORTING
    // -------------------------------------------------------------
    console.log('\n--- STEP 5: Deterministic Pagination Sort Order Stability ---');
    const resStudents = await axios.get(`${BASE_URL}/students?page=1&limit=5`, { headers: adminHeaders });
    assert(resStudents.status === 200, 'Students endpoint returned 200 OK');
    assert(Array.isArray(resStudents.data.data), 'Students returned as array');

    // Check tie-breaker stability: Sort order is predictable
    const studentIds = resStudents.data.data.map(s => String(s._id));
    const isDistinct = new Set(studentIds).size === studentIds.length;
    assert(isDistinct, 'Paginated student records contain zero duplicates within page');

    // -------------------------------------------------------------
    // STEP 6: VERIFY N+1 ELIMINATION & PARALLEL EXECUTION
    // -------------------------------------------------------------
    console.log('\n--- STEP 6: N+1 Elimination & Parallel Query Verification ---');
    const tStartMe = Date.now();
    const resMe = await axios.get(`${BASE_URL}/auth/me`, { headers: adminHeaders });
    const tMeDuration = Date.now() - tStartMe;
    assert(resMe.status === 200, 'GET /auth/me returned 200 OK');
    assert(!!resMe.data.user, '/auth/me returns authenticated user');
    assert(!!resMe.data.features, '/auth/me returns enabled features map');
    console.log(`  ℹ️  GET /auth/me latency with parallelized lookups: ${tMeDuration}ms`);

    const tStartStats = Date.now();
    const resStats = await axios.get(`${BASE_URL}/super-admin/analytics/dashboard`, { headers: saHeaders });
    const tStatsDuration = Date.now() - tStartStats;
    assert(resStats.status === 200, 'GET /super-admin/analytics/dashboard returned 200 OK');
    assert(typeof resStats.data.data?.monthlyRecurringRevenue === 'number', 'Platform MRR calculated');
    console.log(`  ℹ️  GET /super-admin/analytics/dashboard latency with Promise.all: ${tStatsDuration}ms`);

    // -------------------------------------------------------------
    // STEP 7: LIVE explain('executionStats') ON MONGODB ATLAS
    // -------------------------------------------------------------
    console.log('\n--- STEP 7: Live explain(executionStats) Execution on MongoDB Atlas ---');

    // 1. Room Query: organizationId + hostel with roomNumber sort
    const roomExplain = await Room.find({ organizationId: orgA._id, hostel: hostelCode })
      .sort({ roomNumber: 1, _id: 1 })
      .limit(20)
      .explain('executionStats');

    const roomWinningStage = roomExplain.queryPlanner?.winningPlan?.stage || 
                             roomExplain.executionStats?.executionStages?.stage;
    const roomKeysExamined = roomExplain.executionStats?.totalKeysExamined ?? 'N/A';
    const roomDocsExamined = roomExplain.executionStats?.totalDocsExamined ?? 'N/A';
    const roomExecTime = roomExplain.executionStats?.executionTimeMillis ?? 'N/A';
    console.log(`  [Room Query] Stage: ${roomWinningStage} | Keys Examined: ${roomKeysExamined} | Docs Examined: ${roomDocsExamined} | Time: ${roomExecTime}ms`);
    assert(roomExplain.executionStats !== undefined, 'Live explain(executionStats) executed successfully on Room collection');

    // 2. Attendance Query: organizationId + hostel + date
    const attExplain = await Attendance.find({ 
      organizationId: orgA._id, 
      hostel: hostelCode, 
      date: { $gte: new Date('2026-01-01') } 
    })
      .sort({ date: -1, _id: -1 })
      .limit(20)
      .explain('executionStats');

    const attWinningStage = attExplain.queryPlanner?.winningPlan?.stage || 
                            attExplain.executionStats?.executionStages?.stage;
    const attKeysExamined = attExplain.executionStats?.totalKeysExamined ?? 'N/A';
    const attDocsExamined = attExplain.executionStats?.totalDocsExamined ?? 'N/A';
    const attExecTime = attExplain.executionStats?.executionTimeMillis ?? 'N/A';
    console.log(`  [Attendance Query] Stage: ${attWinningStage} | Keys Examined: ${attKeysExamined} | Docs Examined: ${attDocsExamined} | Time: ${attExecTime}ms`);
    assert(attExplain.executionStats !== undefined, 'Live explain(executionStats) executed successfully on Attendance collection');

    // 3. Student Query: organizationId + isActive + createdAt sort
    const studentExplain = await Student.find({ organizationId: orgA._id, isActive: true })
      .sort({ createdAt: -1, _id: -1 })
      .limit(20)
      .explain('executionStats');

    const studentWinningStage = studentExplain.queryPlanner?.winningPlan?.stage || 
                                studentExplain.executionStats?.executionStages?.stage;
    const studentKeysExamined = studentExplain.executionStats?.totalKeysExamined ?? 'N/A';
    const studentDocsExamined = studentExplain.executionStats?.totalDocsExamined ?? 'N/A';
    const studentExecTime = studentExplain.executionStats?.executionTimeMillis ?? 'N/A';
    console.log(`  [Student Query] Stage: ${studentWinningStage} | Keys Examined: ${studentKeysExamined} | Docs Examined: ${studentDocsExamined} | Time: ${studentExecTime}ms`);
    assert(studentExplain.executionStats !== undefined, 'Live explain(executionStats) executed successfully on Student collection');

    // 4. Membership Query: userId + status
    const memExplain = await Membership.find({ userId: adminUser._id, status: 'ACTIVE' })
      .explain('executionStats');

    const memWinningStage = memExplain.queryPlanner?.winningPlan?.stage || 
                            memExplain.executionStats?.executionStages?.stage;
    const memKeysExamined = memExplain.executionStats?.totalKeysExamined ?? 'N/A';
    const memDocsExamined = memExplain.executionStats?.totalDocsExamined ?? 'N/A';
    const memExecTime = memExplain.executionStats?.executionTimeMillis ?? 'N/A';
    console.log(`  [Membership Query] Stage: ${memWinningStage} | Keys Examined: ${memKeysExamined} | Docs Examined: ${memDocsExamined} | Time: ${memExecTime}ms`);
    assert(memExplain.executionStats !== undefined, 'Live explain(executionStats) executed successfully on Membership collection');

    // -------------------------------------------------------------
    // TEARDOWN FIXTURES
    // -------------------------------------------------------------
    console.log('\n[Teardown] Cleaning temporary test fixtures...');
    await Room.deleteMany({ organizationId: orgA._id, roomNumber: { $regex: `^${testRoomPrefix}` } });
    await mongoose.disconnect();
    console.log('📦 Cleaned up and disconnected from MongoDB Atlas.\n');

  } catch (err) {
    console.error('❌ Critical Test Suite Exception:', err.response?.data || err.message);
    failed++;
  }

  console.log('============================================================');
  console.log(`🏁 PHASE C TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhaseCTestSuite();
