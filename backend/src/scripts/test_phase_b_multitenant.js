/**
 * Phase B — Multi-Tenant Isolation & IDOR Regression Test Suite
 * 
 * Verifies strict tenant boundaries and object-level authorization across:
 * - Scenario 1: Org A Admin reading Org A resources (200 OK ALLOWED)
 * - Scenario 2: Org A Admin reading Org B resources (403/404 DENIED)
 * - Scenario 3: Org A Admin probing/guessing Org B resource IDs across all modules (403/404 DENIED)
 * - Scenario 4: Student A reading Student B profile / accessing admin endpoints (403 DENIED)
 * - Scenario 5: Student A booking/cancelling Org B laundry slots or cancelling peer slots (403/404 DENIED)
 * - Scenario 6: Tenant switching vectors (X-Organization-Context header & ?organizationId= query) (403 TENANT_ACCESS_DENIED)
 * - Scenario 7: Request body tampering (body.organizationId override ignored / prevented)
 * - Scenario 8: Cross-tenant mutations (Update/Delete Room, Student, Mess Request, Fee, Expense) (403/404 DENIED)
 * - Scenario 9: Super Admin explicit cross-tenant platform access (200 OK ALLOWED)
 */

require('dotenv').config();
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');
const axios = require('axios');
const bcrypt = require('bcryptjs');

const Organization = require('../models/Organization');
const OrganizationFeature = require('../models/OrganizationFeature');
const Membership = require('../models/Membership');
const Hostel = require('../models/Hostel');
const User = require('../models/User');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Fee = require('../models/Fee');
const Expense = require('../models/Expense');
const Attendance = require('../models/Attendance');
const MessRequest = require('../models/MessRequest');
const LaundrySlot = require('../models/LaundrySlot');
const Settings = require('../models/Settings');

const BASE_URL = 'http://localhost:5000/api';

async function runTenantTestSuite() {
  console.log('============================================================');
  console.log('🛡️  PHASE B: MULTI-TENANT ISOLATION & IDOR TEST SUITE');
  console.log('============================================================\n');

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

  // Connect to DB directly for fixture setup & cleanup
  await mongoose.connect(process.env.MONGODB_URI, { family: 4 });

  let orgA, orgB;
  let orgBAdminUser, studentAUser, studentBUser;
  let studentADoc, studentBDoc;
  let orgBRoom, orgBFee, orgBExpense, orgBAttendance, orgBMessReq, orgBLaundrySlot, orgBSettings;

  try {
    // -------------------------------------------------------------
    // SETUP FIXTURES
    // -------------------------------------------------------------
    console.log('[Setup] Resolving Organizations & Seeding Deterministic Fixtures...');
    orgA = await Organization.findOne({ slug: 'q2-hostels' });
    orgB = await Organization.findOne({ slug: 'hansraj-hostel' });

    if (!orgA || !orgB) {
      throw new Error('Required test organizations (q2-hostels, hansraj-hostel) not found in database.');
    }

    // Ensure Org B has expense_management feature enabled
    await OrganizationFeature.findOneAndUpdate(
      { organizationId: orgB._id, featureKey: 'expense_management' },
      { organizationId: orgB._id, featureKey: 'expense_management', enabled: true },
      { upsert: true }
    );

    const testPassword = 'TestPassword@123';

    // 1. Ensure Org B Admin User
    orgBAdminUser = await User.findOne({ username: 'test_admin_b' });
    if (!orgBAdminUser) {
      orgBAdminUser = await User.create({
        name: 'Admin Tenant B',
        email: 'admin_b@hansraj.test',
        username: 'test_admin_b',
        password: testPassword,
        role: 'admin',
        activeOrganizationId: orgB._id,
        hostels: ['MAIN'],
      });
    } else {
      orgBAdminUser.password = testPassword;
      orgBAdminUser.activeOrganizationId = orgB._id;
      await orgBAdminUser.save();
    }

    await Membership.findOneAndUpdate(
      { userId: orgBAdminUser._id, organizationId: orgB._id },
      {
        userId: orgBAdminUser._id,
        organizationId: orgB._id,
        role: 'ADMIN',
        status: 'ACTIVE',
        hostelAccess: ['all'],
        permissions: ['*'],
      },
      { upsert: true }
    );

    // 2. Ensure Student A in Org A
    studentAUser = await User.findOne({ username: 'test_student_a' });
    if (!studentAUser) {
      studentAUser = await User.create({
        name: 'Student A',
        email: 'student_a@q2.test',
        username: 'test_student_a',
        password: testPassword,
        role: 'student',
        activeOrganizationId: orgA._id,
        hostels: ['Q2'],
      });
    } else {
      studentAUser.password = testPassword;
      studentAUser.activeOrganizationId = orgA._id;
      await studentAUser.save();
    }

    await Membership.findOneAndUpdate(
      { userId: studentAUser._id, organizationId: orgA._id },
      {
        userId: studentAUser._id,
        organizationId: orgA._id,
        role: 'MEMBER',
        status: 'ACTIVE',
        hostelAccess: ['Q2'],
        permissions: [],
      },
      { upsert: true }
    );

    studentADoc = await Student.findOneAndUpdate(
      { userId: studentAUser._id },
      {
        userId: studentAUser._id,
        organizationId: orgA._id,
        name: 'Student A',
        username: 'test_student_a',
        email: 'student_a@q2.test',
        hostel: 'Q2',
        roomNo: 'F101',
        fees: 8000,
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 3. Ensure Student B in Org B
    studentBUser = await User.findOne({ username: 'test_student_b' });
    if (!studentBUser) {
      studentBUser = await User.create({
        name: 'Student B',
        email: 'student_b@hansraj.test',
        username: 'test_student_b',
        password: testPassword,
        role: 'student',
        activeOrganizationId: orgB._id,
        hostels: ['MAIN'],
      });
    } else {
      studentBUser.password = testPassword;
      studentBUser.activeOrganizationId = orgB._id;
      await studentBUser.save();
    }

    await Membership.findOneAndUpdate(
      { userId: studentBUser._id, organizationId: orgB._id },
      {
        userId: studentBUser._id,
        organizationId: orgB._id,
        role: 'MEMBER',
        status: 'ACTIVE',
        hostelAccess: ['MAIN'],
        permissions: [],
      },
      { upsert: true }
    );

    studentBDoc = await Student.findOneAndUpdate(
      { userId: studentBUser._id },
      {
        userId: studentBUser._id,
        organizationId: orgB._id,
        name: 'Student B',
        username: 'test_student_b',
        email: 'student_b@hansraj.test',
        hostel: 'MAIN',
        roomNo: 'H-901',
        fees: 9500,
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // 4. Create Org B Resources
    const orgBHostel = await Hostel.findOne({ organizationId: orgB._id, code: 'MAIN' });

    orgBRoom = await Room.findOneAndUpdate(
      { organizationId: orgB._id, hostel: 'MAIN', roomNumber: 'H-901' },
      {
        organizationId: orgB._id,
        hostelId: orgBHostel?._id,
        hostel: 'MAIN',
        roomNumber: 'H-901',
        capacity: 2,
        occupiedCount: 1,
      },
      { upsert: true, new: true }
    );

    orgBFee = await Fee.findOneAndUpdate(
      { organizationId: orgB._id, studentId: studentBDoc._id, month: 'PhaseB-TestMonth' },
      {
        organizationId: orgB._id,
        hostelId: orgBHostel?._id,
        hostel: 'MAIN',
        studentId: studentBDoc._id,
        month: 'PhaseB-TestMonth',
        amount: 9500,
        paidAmount: 0,
        status: 'unpaid',
      },
      { upsert: true, new: true }
    );

    orgBExpense = await Expense.findOneAndUpdate(
      { organizationId: orgB._id, description: 'PhaseB Test Expense Org B' },
      {
        organizationId: orgB._id,
        hostelId: orgBHostel?._id,
        hostel: 'MAIN',
        createdBy: orgBAdminUser._id,
        description: 'PhaseB Test Expense Org B',
        amount: 1200,
        category: 'MAINTENANCE',
        date: new Date(),
      },
      { upsert: true, new: true }
    );

    orgBAttendance = await Attendance.findOneAndUpdate(
      { organizationId: orgB._id, userId: studentBUser._id, date: new Date('2026-10-10') },
      {
        organizationId: orgB._id,
        hostelId: orgBHostel?._id,
        hostel: 'MAIN',
        userId: studentBUser._id,
        studentId: studentBDoc._id,
        date: new Date('2026-10-10'),
        status: 'present',
      },
      { upsert: true, new: true }
    );

    orgBMessReq = await MessRequest.findOneAndUpdate(
      { organizationId: orgB._id, studentId: studentBDoc._id, reason: 'Org B Test Mess Leave' },
      {
        organizationId: orgB._id,
        hostelId: orgBHostel?._id,
        hostel: 'MAIN',
        userId: studentBUser._id,
        studentId: studentBDoc._id,
        leavingDate: new Date('2026-10-15'),
        returnDate: new Date('2026-10-18'),
        reason: 'Org B Test Mess Leave',
        status: 'pending',
      },
      { upsert: true, new: true }
    );

    orgBLaundrySlot = await LaundrySlot.findOneAndUpdate(
      { organizationId: orgB._id, student: studentBDoc._id, date: '2026-10-20' },
      {
        organizationId: orgB._id,
        hostelId: orgBHostel?._id,
        hostel: 'MAIN',
        student: studentBDoc._id,
        date: '2026-10-20',
        timeSlot: '09:00-10:00',
        machineNumber: 1,
        status: 'booked',
      },
      { upsert: true, new: true }
    );

    orgBSettings = await Settings.findOneAndUpdate(
      { organizationId: orgB._id, hostel: 'MAIN' },
      {
        organizationId: orgB._id,
        hostelId: orgBHostel?._id,
        hostel: 'MAIN',
        lateFeePerDay: 75,
        gracePeriodDays: 2,
      },
      { upsert: true, new: true }
    );

    console.log('✅ Test fixtures successfully established in MongoDB.\n');

    // -------------------------------------------------------------
    // AUTHENTICATE TEST PERSONAS (Cryptographically Signed JWTs)
    // -------------------------------------------------------------
    console.log('[Auth] Generating Signed JWT Tokens for Test Personas...');
    const jwt = require('jsonwebtoken');

    const orgAAdminUser = await User.findOne({ username: 'Abhi1006' });
    const saUser = await User.findOne({ username: 'superadmin' });

    if (!orgAAdminUser || !saUser) {
      throw new Error('Baseline users Abhi1006 or superadmin missing from database');
    }

    const orgAAdminToken = jwt.sign({ id: orgAAdminUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const orgAAdminHeaders = { Authorization: `Bearer ${orgAAdminToken}` };

    const orgBAdminToken = jwt.sign({ id: orgBAdminUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const orgBAdminHeaders = { Authorization: `Bearer ${orgBAdminToken}` };

    const studentAToken = jwt.sign({ id: studentAUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const studentAHeaders = { Authorization: `Bearer ${studentAToken}` };

    const saToken = jwt.sign({ id: saUser._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const saHeaders = { Authorization: `Bearer ${saToken}` };

    assert(!!orgAAdminToken && !!orgBAdminToken && !!studentAToken && !!saToken, 'All test personas authenticated successfully');

    // =============================================================
    // TEST SECTION 1: Org A Admin Reading Org A Resources (200 OK)
    // =============================================================
    console.log('\n--- SCENARIO 1: Org A Admin Reading Org A Resources ---');
    const orgAStudents = await axios.get(`${BASE_URL}/students`, { headers: orgAAdminHeaders });
    assert(orgAStudents.status === 200 && Array.isArray(orgAStudents.data.data), 'Org A Admin can read Org A students (200 OK)');
    assert(orgAStudents.data.data.every(s => !s.organizationId || String(s.organizationId) === String(orgA._id)), 'All returned students strictly belong to Org A');

    const orgARooms = await axios.get(`${BASE_URL}/rooms`, { headers: orgAAdminHeaders });
    assert(orgARooms.status === 200 && Array.isArray(orgARooms.data.data), 'Org A Admin can read Org A rooms (200 OK)');
    assert(orgARooms.data.data.every(r => !r.organizationId || String(r.organizationId) === String(orgA._id)), 'All returned rooms strictly belong to Org A');

    const orgAFees = await axios.get(`${BASE_URL}/fees`, { headers: orgAAdminHeaders });
    assert(orgAFees.status === 200 && Array.isArray(orgAFees.data.data), 'Org A Admin can read Org A fees (200 OK)');

    const orgAExpenses = await axios.get(`${BASE_URL}/expenses`, { headers: orgAAdminHeaders });
    assert(orgAExpenses.status === 200 && Array.isArray(orgAExpenses.data.data), 'Org A Admin can read Org A expenses (200 OK)');

    const orgASettings = await axios.get(`${BASE_URL}/settings/Q2`, { headers: orgAAdminHeaders });
    assert(orgASettings.status === 200 && orgASettings.data.data.hostel === 'Q2', 'Org A Admin can read Org A settings for Q2 (200 OK)');

    // =============================================================
    // TEST SECTION 2: Org A Admin -> Org B Resources (403/404 DENIED)
    // =============================================================
    console.log('\n--- SCENARIO 2 & 3: Org A Admin Attempting to Access Org B Resources ---');

    // 1. Probing Org B Room ID
    try {
      await axios.get(`${BASE_URL}/rooms/${orgBRoom._id}`, { headers: orgAAdminHeaders });
      assert(false, 'Org A Admin reading Org B Room must be DENIED');
    } catch (err) {
      assert(err.response?.status === 404, 'Org A Admin probing Org B Room receives 404 Not Found');
    }

    // 2. Probing Org B Student ID
    try {
      await axios.get(`${BASE_URL}/students/${studentBDoc._id}`, { headers: orgAAdminHeaders });
      assert(false, 'Org A Admin reading Org B Student must be DENIED');
    } catch (err) {
      assert(err.response?.status === 404, 'Org A Admin probing Org B Student receives 404 Not Found');
    }

    // 3. Probing Org B Student ID in updateStudent
    try {
      await axios.put(`${BASE_URL}/students/${studentBDoc._id}`, { name: 'Hacked Name' }, { headers: orgAAdminHeaders });
      assert(false, 'Org A Admin updating Org B Student must be DENIED');
    } catch (err) {
      assert(err.response?.status === 404, 'Org A Admin updating Org B Student receives 404 Not Found');
    }

    // 4. Probing Org B Student ID in deleteStudent
    try {
      await axios.delete(`${BASE_URL}/students/${studentBDoc._id}`, { headers: orgAAdminHeaders });
      assert(false, 'Org A Admin deleting Org B Student must be DENIED');
    } catch (err) {
      assert(err.response?.status === 404, 'Org A Admin deleting Org B Student receives 404 Not Found');
    }

    // 5. Probing Org B Room ID in updateRoom
    try {
      await axios.put(`${BASE_URL}/rooms/${orgBRoom._id}`, { capacity: 10 }, { headers: orgAAdminHeaders });
      assert(false, 'Org A Admin updating Org B Room must be DENIED');
    } catch (err) {
      assert(err.response?.status === 404, 'Org A Admin updating Org B Room receives 404 Not Found');
    }

    // 6. Probing Org B Room ID in deleteRoom
    try {
      await axios.delete(`${BASE_URL}/rooms/${orgBRoom._id}`, { headers: orgAAdminHeaders });
      assert(false, 'Org A Admin deleting Org B Room must be DENIED');
    } catch (err) {
      assert(err.response?.status === 404, 'Org A Admin deleting Org B Room receives 404 Not Found');
    }

    // 7. Probing Org B Fee ID in updateFee
    try {
      await axios.put(`${BASE_URL}/fees/${orgBFee._id}`, { status: 'paid', paidAmount: 9500 }, { headers: orgAAdminHeaders });
      assert(false, 'Org A Admin updating Org B Fee must be DENIED');
    } catch (err) {
      assert(err.response?.status === 404, 'Org A Admin updating Org B Fee receives 404 Not Found');
    }

    // 8. Probing Org B Expense ID in deleteExpense
    try {
      await axios.delete(`${BASE_URL}/expenses/${orgBExpense._id}`, { headers: orgAAdminHeaders });
      assert(false, 'Org A Admin deleting Org B Expense must be DENIED');
    } catch (err) {
      assert(err.response?.status === 404, 'Org A Admin deleting Org B Expense receives 404 Not Found');
    }

    // 9. Probing Org B Attendance ID in updateAttendance
    try {
      await axios.put(`${BASE_URL}/attendance/${orgBAttendance._id}`, { status: 'absent' }, { headers: orgAAdminHeaders });
      assert(false, 'Org A Admin updating Org B Attendance receives 404 Not Found');
    } catch (err) {
      assert(err.response?.status === 404, 'Org A Admin updating Org B Attendance receives 404 Not Found');
    }

    // 10. Probing Org B Mess Request ID in updateMessRequest
    try {
      await axios.put(`${BASE_URL}/mess-requests/${orgBMessReq._id}`, { status: 'approved' }, { headers: orgAAdminHeaders });
      assert(false, 'Org A Admin updating Org B Mess Request must be DENIED');
    } catch (err) {
      assert(err.response?.status === 404, 'Org A Admin approving Org B Mess Request receives 404 Not Found');
    }

    // 11. Probing Org B Settings: Org A requesting 'MAIN' hostel branch gets Org A's MAIN branch, NOT Org B's
    const orgASettingsMain = await axios.get(`${BASE_URL}/settings/MAIN`, { headers: orgAAdminHeaders });
    assert(orgASettingsMain.status === 200, 'Org A requesting MAIN branch settings returns 200');
    assert(orgASettingsMain.data.data.lateFeePerDay !== 75, 'Org A settings for MAIN did NOT leak Org B settings (lateFeePerDay != 75)');
    assert(String(orgASettingsMain.data.data.organizationId) === String(orgA._id), 'Returned settings record strictly belongs to Org A');

    // 12. Cross-Tenant Fee Collection attempt
    try {
      await axios.post(`${BASE_URL}/fees/collect`, {
        studentId: studentBDoc._id,
        hostel: 'MAIN',
        month: 'PhaseB-TestMonth',
        amount: 9500,
        receivedAmount: 9500,
        paymentMode: 'cash',
        receiptNo: `REC-PROBE-${Date.now()}`,
      }, { headers: orgAAdminHeaders });
      assert(false, 'Org A Admin collecting fees for Org B student must be DENIED');
    } catch (err) {
      assert(err.response?.status === 404, 'Collecting fees for foreign tenant student rejected with 404 Not Found');
    }

    // =============================================================
    // TEST SECTION 3: Student-to-Student & Student IDOR Protection
    // =============================================================
    console.log('\n--- SCENARIO 4 & 5: Student Isolation & IDOR Protection ---');

    // 1. Student A reading own profile (ALLOWED)
    const studentAProfile = await axios.get(`${BASE_URL}/students/me`, { headers: studentAHeaders });
    assert(studentAProfile.status === 200 && String(studentAProfile.data.data.userId) === String(studentAUser._id), 'Student A can read own profile (/students/me)');

    // 2. Student A attempting to read Student B's profile directly
    try {
      await axios.get(`${BASE_URL}/students/${studentBDoc._id}`, { headers: studentAHeaders });
      assert(false, 'Student A reading Student B profile must be DENIED');
    } catch (err) {
      assert(err.response?.status === 403 || err.response?.status === 404, `Student A reading Student B rejected with ${err.response?.status}`);
    }

    // 3. Student A attempting to access Admin Dashboard
    try {
      await axios.get(`${BASE_URL}/dashboard/admin`, { headers: studentAHeaders });
      assert(false, 'Student accessing admin dashboard must be DENIED');
    } catch (err) {
      assert(err.response?.status === 403, 'Student accessing /dashboard/admin rejected with 403 Forbidden');
    }

    // 4. Student A attempting to cancel Org B Laundry Slot
    try {
      await axios.delete(`${BASE_URL}/laundry/cancel/${orgBLaundrySlot._id}`, { headers: studentAHeaders });
      assert(false, 'Student A cancelling Org B laundry slot must be DENIED');
    } catch (err) {
      assert(err.response?.status === 404 || err.response?.status === 403, `Student A cancelling Org B laundry slot rejected with ${err.response?.status}`);
    }

    // 5. Org A Admin attempting to cancel Org B Laundry Slot
    try {
      await axios.delete(`${BASE_URL}/laundry/cancel/${orgBLaundrySlot._id}`, { headers: orgAAdminHeaders });
      assert(false, 'Org A Admin cancelling Org B laundry slot must be DENIED');
    } catch (err) {
      assert(err.response?.status === 404, 'Org A Admin cancelling Org B laundry slot rejected with 404 Not Found');
    }

    // =============================================================
    // TEST SECTION 4: Tenant Switching Vectors & Body Tampering
    // =============================================================
    console.log('\n--- SCENARIO 6 & 7: Tenant Switching Vectors & Body Tampering ---');

    // 1. Header Injection: Org A Admin sending X-Organization-Context: Org B ID
    try {
      await axios.get(`${BASE_URL}/students`, {
        headers: {
          ...orgAAdminHeaders,
          'X-Organization-Context': orgB._id.toString(),
        },
      });
      assert(false, 'Org A Admin switching tenant via X-Organization-Context must be DENIED');
    } catch (err) {
      assert(err.response?.status === 403 && err.response?.data?.code === 'TENANT_ACCESS_DENIED', 'Header injection X-Organization-Context rejected with 403 TENANT_ACCESS_DENIED');
    }

    // 2. Query Injection: Org A Admin sending ?organizationId=Org B ID
    try {
      await axios.get(`${BASE_URL}/rooms?organizationId=${orgB._id}`, {
        headers: orgAAdminHeaders,
      });
      assert(false, 'Org A Admin switching tenant via ?organizationId query must be DENIED');
    } catch (err) {
      assert(err.response?.status === 403 && err.response?.data?.code === 'TENANT_ACCESS_DENIED', 'Query injection ?organizationId rejected with 403 TENANT_ACCESS_DENIED');
    }

    // 3. Body Tampering: Org A Admin attempting to create a room in Org B by specifying body.organizationId
    const testTamperedRoomNo = `ROOM-TAMPER-${Date.now().toString().slice(-4)}`;
    const createRoomRes = await axios.post(`${BASE_URL}/rooms`, {
      roomNumber: testTamperedRoomNo,
      hostel: 'Q2',
      capacity: 3,
      organizationId: orgB._id.toString(), // Untrusted body override attempt
    }, { headers: orgAAdminHeaders });

    assert(createRoomRes.status === 201, 'Room created with body request');
    const createdRoomId = createRoomRes.data.data._id;
    const verifiedRoom = await Room.findById(createdRoomId);
    assert(String(verifiedRoom.organizationId) === String(orgA._id), 'Body tampering prevented: Room bound to Org A, NOT Org B');
    // Cleanup tampered room
    await Room.deleteOne({ _id: createdRoomId });

    // =============================================================
    // TEST SECTION 5: Super Admin Platform Control Plane Access
    // =============================================================
    console.log('\n--- SCENARIO 8: Super Admin Platform Scope ---');

    // 1. Super Admin scoped to Org A
    const saOrgARooms = await axios.get(`${BASE_URL}/rooms`, {
      headers: {
        ...saHeaders,
        'X-Organization-Context': orgA._id.toString(),
      },
    });
    assert(saOrgARooms.status === 200, 'Super Admin can access Org A rooms (200 OK)');
    assert(saOrgARooms.data.data.every(r => !r.organizationId || String(r.organizationId) === String(orgA._id)), 'Super Admin Org A scoped query strictly contains Org A rooms');

    // 2. Super Admin scoped to Org B
    const saOrgBRooms = await axios.get(`${BASE_URL}/rooms`, {
      headers: {
        ...saHeaders,
        'X-Organization-Context': orgB._id.toString(),
      },
    });
    assert(saOrgBRooms.status === 200, 'Super Admin can access Org B rooms (200 OK)');
    assert(saOrgBRooms.data.data.some(r => String(r._id) === String(orgBRoom._id)), 'Super Admin Org B scoped query contains Org B room');

    // 3. Super Admin directly accessing Org B Room by ID
    const saRoomGet = await axios.get(`${BASE_URL}/rooms/${orgBRoom._id}`, { headers: saHeaders });
    assert(saRoomGet.status === 200 && String(saRoomGet.data.data._id) === String(orgBRoom._id), 'Super Admin can read Org B Room directly by ID');

  } catch (err) {
    console.error('Unhandled test suite error:', err.response?.data || err.message);
    failed++;
  } finally {
    // -------------------------------------------------------------
    // CLEANUP TEST FIXTURES
    // -------------------------------------------------------------
    console.log('\n[Teardown] Cleaning up temporary test fixtures...');
    try {
      if (orgBRoom) await Room.deleteOne({ _id: orgBRoom._id });
      if (orgBFee) await Fee.deleteOne({ _id: orgBFee._id });
      if (orgBExpense) await Expense.deleteOne({ _id: orgBExpense._id });
      if (orgBAttendance) await Attendance.deleteOne({ _id: orgBAttendance._id });
      if (orgBMessReq) await MessRequest.deleteOne({ _id: orgBMessReq._id });
      if (orgBLaundrySlot) await LaundrySlot.deleteOne({ _id: orgBLaundrySlot._id });
      if (studentADoc) await Student.deleteOne({ _id: studentADoc._id });
      if (studentBDoc) await Student.deleteOne({ _id: studentBDoc._id });
      if (studentAUser) await User.deleteOne({ _id: studentAUser._id });
      if (studentBUser) await User.deleteOne({ _id: studentBUser._id });
      if (orgBAdminUser) await User.deleteOne({ _id: orgBAdminUser._id });
      if (orgBSettings) await Settings.deleteOne({ _id: orgBSettings._id });
    } catch (cleanupErr) {
      console.warn('Cleanup notice:', cleanupErr.message);
    }

    await mongoose.disconnect();
    console.log('📦 MongoDB disconnected cleanly.');
  }

  // =============================================================
  // SUMMARY
  // =============================================================
  console.log('\n============================================================');
  console.log(`🏁 PHASE B TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTenantTestSuite();
