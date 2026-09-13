require('dotenv').config();
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');
const connectDB = require('../config/db');

const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Settings = require('../models/Settings');
const LaundrySlot = require('../models/LaundrySlot');
const MenuRating = require('../models/MenuRating');
const Room = require('../models/Room');
const MessRequest = require('../models/MessRequest');
const Attendance = require('../models/Attendance');
const Notification = require('../models/Notification');
const Student = require('../models/Student');
const User = require('../models/User');

async function runMigration() {
  console.log('============================================================');
  console.log('🔄 PHASE B: TENANT DATA MIGRATION & RECONCILIATION SCAN');
  console.log('============================================================\n');

  await connectDB();

  // Find primary default organization
  const defaultOrg =
    (await Organization.findOne({ slug: 'q2-hostels' })) ||
    (await Organization.findOne({ status: 'ACTIVE' }));

  if (!defaultOrg) {
    console.error('❌ No active organization found in database!');
    process.exit(1);
  }
  console.log(`🏢 Default Organization for legacy reconciliation: "${defaultOrg.name}" (${defaultOrg._id})`);

  // Cache hostels by code
  const allHostels = await Hostel.find();
  console.log(`🏨 Found ${allHostels.length} hostels across platform.`);

  // 1. Settings Migration
  console.log('\n--- 1. Reconciling Settings ---');
  const settingsDocs = await Settings.find({
    $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
  });
  console.log(`Settings needing organizationId: ${settingsDocs.length}`);
  for (const s of settingsDocs) {
    const matchedHostel = allHostels.find(
      (h) => h.code.toLowerCase() === (s.hostel || '').toLowerCase()
    );
    const orgId = matchedHostel ? matchedHostel.organizationId : defaultOrg._id;
    const hostelId = matchedHostel ? matchedHostel._id : null;
    await Settings.updateOne(
      { _id: s._id },
      { $set: { organizationId: orgId, hostelId: hostelId } }
    );
    console.log(`  Updated Settings for hostel "${s.hostel}" -> orgId: ${orgId}`);
  }

  // 2. LaundrySlot Migration
  console.log('\n--- 2. Reconciling Laundry Slots ---');
  const laundryDocs = await LaundrySlot.find({
    $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
  });
  console.log(`LaundrySlots needing organizationId: ${laundryDocs.length}`);
  for (const slot of laundryDocs) {
    let orgId = defaultOrg._id;
    let hostelId = null;
    if (slot.student) {
      const student = await Student.findById(slot.student);
      if (student && student.organizationId) {
        orgId = student.organizationId;
        hostelId = student.hostelId || null;
      }
    }
    if (!hostelId && slot.hostel) {
      const matchedHostel = allHostels.find(
        (h) =>
          h.code.toLowerCase() === slot.hostel.toLowerCase() &&
          h.organizationId.toString() === orgId.toString()
      );
      if (matchedHostel) hostelId = matchedHostel._id;
    }
    await LaundrySlot.updateOne(
      { _id: slot._id },
      { $set: { organizationId: orgId, hostelId } }
    );
    console.log(`  Updated LaundrySlot ${slot._id} -> orgId: ${orgId}, hostelId: ${hostelId}`);
  }

  // 3. MenuRating Migration
  console.log('\n--- 3. Reconciling Menu Ratings ---');
  const ratingDocs = await MenuRating.find({
    $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
  });
  console.log(`MenuRatings needing organizationId: ${ratingDocs.length}`);
  for (const r of ratingDocs) {
    let orgId = defaultOrg._id;
    let hostelId = null;
    let hostel = 'Q2';
    if (r.student) {
      const student = await Student.findById(r.student);
      if (student) {
        orgId = student.organizationId || orgId;
        hostelId = student.hostelId || null;
        hostel = student.hostel || 'Q2';
      }
    }
    await MenuRating.updateOne(
      { _id: r._id },
      { $set: { organizationId: orgId, hostelId, hostel } }
    );
  }

  // 4. Room Migration
  console.log('\n--- 4. Reconciling Rooms ---');
  const roomDocs = await Room.find({
    $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
  });
  console.log(`Rooms needing organizationId: ${roomDocs.length}`);
  for (const room of roomDocs) {
    const matchedHostel = allHostels.find(
      (h) => h.code.toLowerCase() === (room.hostel || '').toLowerCase()
    );
    const orgId = matchedHostel ? matchedHostel.organizationId : defaultOrg._id;
    const hostelId = matchedHostel ? matchedHostel._id : null;
    await Room.updateOne(
      { _id: room._id },
      { $set: { organizationId: orgId, hostelId } }
    );
  }
  console.log(`  Updated ${roomDocs.length} rooms to include organizationId.`);

  // 5. MessRequest Migration
  console.log('\n--- 5. Reconciling Mess Requests ---');
  const messDocs = await MessRequest.find({
    $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
  });
  console.log(`MessRequests needing organizationId: ${messDocs.length}`);
  for (const mr of messDocs) {
    let orgId = defaultOrg._id;
    let hostelId = null;
    if (mr.studentId) {
      const student = await Student.findById(mr.studentId);
      if (student && student.organizationId) {
        orgId = student.organizationId;
        hostelId = student.hostelId || null;
      }
    }
    await MessRequest.updateOne(
      { _id: mr._id },
      { $set: { organizationId: orgId, hostelId } }
    );
  }

  // 6. Attendance Migration
  console.log('\n--- 6. Reconciling Attendance ---');
  const attDocs = await Attendance.find({
    $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
  });
  console.log(`Attendance needing organizationId: ${attDocs.length}`);
  for (const att of attDocs) {
    let orgId = defaultOrg._id;
    let hostelId = null;
    if (att.studentId) {
      const student = await Student.findById(att.studentId);
      if (student && student.organizationId) {
        orgId = student.organizationId;
        hostelId = student.hostelId || null;
      }
    }
    await Attendance.updateOne(
      { _id: att._id },
      { $set: { organizationId: orgId, hostelId } }
    );
  }

  // 7. Notifications Migration
  console.log('\n--- 7. Reconciling Notifications ---');
  const notifDocs = await Notification.find({
    $or: [{ organizationId: null }, { organizationId: { $exists: false } }],
  });
  console.log(`Notifications needing organizationId: ${notifDocs.length}`);
  for (const n of notifDocs) {
    let orgId = defaultOrg._id;
    let hostelId = null;
    if (n.userId) {
      const user = await User.findById(n.userId);
      if (user && user.activeOrganizationId) {
        orgId = user.activeOrganizationId;
      } else {
        const student = await Student.findOne({ userId: n.userId });
        if (student && student.organizationId) {
          orgId = student.organizationId;
          hostelId = student.hostelId || null;
        }
      }
    }
    await Notification.updateOne(
      { _id: n._id },
      { $set: { organizationId: orgId, hostelId } }
    );
  }

  console.log('\n============================================================');
  console.log('✅ RECONCILIATION COMPLETE: All documents now scoped to valid organizationId');
  console.log('============================================================');

  await mongoose.connection.close();
  process.exit(0);
}

runMigration().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
