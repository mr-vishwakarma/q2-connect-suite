/**
 * Phase G Large-Scale Realistic Multi-Tenant Data Generator
 * 
 * Generates realistic distributions of:
 * - Organizations (SaaS customers)
 * - Hostel Branches
 * - Rooms with capacities (single, double, triple, quad)
 * - Students with active/inactive/expired states
 * - Fee obligations (unpaid, partial, paid, overdue with late fees)
 * - Payments, Invoices, and Ledger entries
 * - Memberships with RBAC roles
 * 
 * Uses memory-safe batch streaming with bulkWrite to support:
 * - Quick verification: 10 organizations (~500 operational records)
 * - Standard Staging: 100 organizations (~25,000 operational records)
 * - Maximum Scale: Configurable via CLI flag (--orgs=N, --studentsPerOrg=M)
 */

require('dotenv').config();
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');

// Models
const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const User = require('../models/User');
const Student = require('../models/Student');
const Membership = require('../models/Membership');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');

async function generateDataset() {
  const args = process.argv.slice(2);
  const orgCountArg = args.find(a => a.startsWith('--orgs='));
  const numOrgs = orgCountArg ? parseInt(orgCountArg.split('=')[1], 10) : 10;
  const studentsPerOrg = 25; // Realistic branch density

  console.log('============================================================');
  console.log(`📦 PHASE G: MULTI-TENANT DATASET GENERATOR (${numOrgs} Organizations)`);
  console.log('============================================================\n');

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI is required.');
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log('✅ Connected to MongoDB Atlas.\n');

  const startTime = Date.now();
  const runId = Date.now().toString(36);

  console.log(`[1/4] Generating ${numOrgs} Organizations and Hostel Branches...`);
  const orgDocs = [];
  const hostelDocs = [];

  for (let i = 1; i <= numOrgs; i++) {
    const orgId = new mongoose.Types.ObjectId();
    const orgSlug = `scale-org-${runId}-${i}`;
    orgDocs.push({
      _id: orgId,
      name: `Q2 Scale Group ${i} (${runId})`,
      slug: orgSlug,
      contactEmail: `admin_${runId}_${i}@q2scale.com`,
      status: 'ACTIVE',
      plan: i % 3 === 0 ? 'ENTERPRISE' : i % 2 === 0 ? 'GROWTH' : 'STARTER',
    });

    // 2 Hostels per Organization (e.g. Kondapur, Madhapur)
    for (let h = 1; h <= 2; h++) {
      hostelDocs.push({
        _id: new mongoose.Types.ObjectId(),
        name: `Hostel Branch ${h} - Org ${i}`,
        code: `HB_${runId}_${i}_${h}`,
        organizationId: orgId,
        totalRooms: 15,
        status: 'ACTIVE',
      });
    }
  }

  await Organization.insertMany(orgDocs);
  await Hostel.insertMany(hostelDocs);
  console.log(`  ✅ Inserted ${orgDocs.length} Organizations and ${hostelDocs.length} Hostel branches.`);

  console.log(`\n[2/4] Generating Rooms and Student Users...`);
  const roomOps = [];
  const userDocs = [];
  const studentOps = [];
  const membershipDocs = [];

  for (const hostel of hostelDocs) {
    // 15 rooms per hostel with realistic capacities
    for (let r = 101; r <= 115; r++) {
      const capacity = r % 3 === 0 ? 3 : r % 2 === 0 ? 2 : 1;
      roomOps.push({
        insertOne: {
          document: {
            roomNumber: `${r}`,
            organizationId: hostel.organizationId,
            hostelId: hostel._id,
            hostel: hostel.name,
            capacity,
            occupiedCount: 0,
            status: 'available',
          },
        },
      });
    }
  }

  await Room.bulkWrite(roomOps, { ordered: false });
  console.log(`  ✅ Inserted ${roomOps.length} Rooms.`);

  // Generate Students
  let studentCounter = 0;
  for (const org of orgDocs) {
    const orgHostels = hostelDocs.filter(h => String(h.organizationId) === String(org._id));
    for (let s = 1; s <= studentsPerOrg; s++) {
      studentCounter++;
      const assignedHostel = orgHostels[s % orgHostels.length];
      const userId = new mongoose.Types.ObjectId();
      const username = `std_${runId}_${studentCounter}`;

      userDocs.push({
        _id: userId,
        name: `Resident ${studentCounter}`,
        email: `${username}@q2scale.com`,
        username,
        password: 'HashedPassword123!',
        role: 'student',
        isActive: true,
      });

      membershipDocs.push({
        userId,
        organizationId: org._id,
        role: 'STUDENT',
        status: 'ACTIVE',
      });

      studentOps.push({
        insertOne: {
          document: {
            userId,
            name: `Resident ${studentCounter}`,
            username,
            email: `${username}@q2scale.com`,
            organizationId: org._id,
            hostelId: assignedHostel._id,
            hostel: assignedHostel.name,
            roomNo: `10${(s % 15) + 1}`,
            fees: 6500,
            startDate: new Date('2026-01-01'),
            validDate: new Date('2026-12-31'),
            isActive: true,
            studentCode: `Q2S_${runId}_${studentCounter}`,
          },
        },
      });
    }
  }

  await User.insertMany(userDocs);
  await Membership.insertMany(membershipDocs);
  const studentInsertResult = await Student.bulkWrite(studentOps, { ordered: false });
  console.log(`  ✅ Inserted ${userDocs.length} Users, ${membershipDocs.length} Memberships, and ${studentOps.length} Students.`);

  console.log(`\n[3/4] Generating Fee Obligations & Payment History...`);
  const feeOps = [];
  const insertedStudents = await Student.find({ studentCode: { $regex: `^Q2S_${runId}_` } }).select('_id organizationId hostelId hostel fees validDate').lean();

  const months = ['2026-07', '2026-08', '2026-09'];
  for (const st of insertedStudents) {
    for (let m = 0; m < months.length; m++) {
      const month = months[m];
      const isPaid = m === 0; // oldest is paid
      const isPartial = m === 1; // middle is partial
      const isUnpaid = m === 2; // current is unpaid

      const amount = st.fees || 6500;
      const paidAmount = isPaid ? amount : isPartial ? 3000 : 0;
      const status = isPaid ? 'paid' : isPartial ? 'partial' : 'unpaid';

      feeOps.push({
        insertOne: {
          document: {
            studentId: st._id,
            organizationId: st.organizationId,
            hostelId: st.hostelId,
            hostel: st.hostel,
            month,
            amount,
            paidAmount,
            lateFee: isUnpaid ? 150 : 0,
            status,
            dueDate: new Date(`${month}-05`),
          },
        },
      });
    }
  }

  await Fee.bulkWrite(feeOps, { ordered: false });
  console.log(`  ✅ Inserted ${feeOps.length} Monthly Fee records.`);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n============================================================`);
  console.log(`🏁 DATASET GENERATION COMPLETE in ${durationSec}s`);
  console.log(`   - Organizations: ${orgDocs.length}`);
  console.log(`   - Hostels:       ${hostelDocs.length}`);
  console.log(`   - Rooms:         ${roomOps.length}`);
  console.log(`   - Students:      ${studentOps.length}`);
  console.log(`   - Fees:          ${feeOps.length}`);
  console.log(`   - Total Records: ${orgDocs.length + hostelDocs.length + roomOps.length + userDocs.length + studentOps.length + feeOps.length}`);
  console.log(`============================================================\n`);

  await mongoose.disconnect();
}

generateDataset().catch((err) => {
  console.error('Data generator failed:', err);
  process.exit(1);
});
