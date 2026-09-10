const path = require('path');
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const Complaint = require('../models/Complaint');
const Membership = require('../models/Membership');
const User = require('../models/User');

async function migrate() {
  try {
    console.log('🔄 Starting Multi-Tenant Legacy Migration...');
    await mongoose.connect(process.env.MONGODB_URI);

    const defaultOrg = await Organization.findOne({ slug: 'q2-hostels' });
    if (!defaultOrg) {
      console.error('❌ Default Q2 organization not found!');
      process.exit(1);
    }
    console.log(`🏢 Default Organization: ${defaultOrg.name} (${defaultOrg._id})`);

    // Build hostel code map
    const hostels = await Hostel.find({ organizationId: defaultOrg._id });
    const hostelMap = new Map();
    hostels.forEach((h) => {
      hostelMap.set(h.code, h._id);
    });
    console.log(`🏨 Found ${hostels.length} branches for Q2.`);

    // 1. Backfill Students
    const unlinkedStudents = await Student.find({ organizationId: { $in: [null, undefined] } });
    console.log(`👨‍🎓 Found ${unlinkedStudents.length} students without organizationId.`);
    for (const student of unlinkedStudents) {
      student.organizationId = defaultOrg._id;
      if (student.hostel && hostelMap.has(student.hostel)) {
        student.hostelId = hostelMap.get(student.hostel);
      }
      await student.save();

      // Ensure membership exists for student user
      if (student.userId) {
        await Membership.findOneAndUpdate(
          { organizationId: defaultOrg._id, userId: student.userId },
          {
            organizationId: defaultOrg._id,
            userId: student.userId,
            role: 'MEMBER',
            status: 'ACTIVE',
            hostelAccess: student.hostel ? [student.hostel] : ['Q2'],
          },
          { upsert: true }
        );
        // Ensure user has activeOrganizationId set
        await User.findByIdAndUpdate(student.userId, {
          activeOrganizationId: defaultOrg._id,
          activeHostelId: student.hostelId || null,
        });
      }
    }
    console.log(`✅ Backfilled ${unlinkedStudents.length} students.`);

    // 2. Backfill Rooms
    const unlinkedRooms = await Room.find({ organizationId: { $in: [null, undefined] } });
    console.log(`🚪 Found ${unlinkedRooms.length} rooms without organizationId.`);
    for (const room of unlinkedRooms) {
      room.organizationId = defaultOrg._id;
      if (room.hostel && hostelMap.has(room.hostel)) {
        room.hostelId = hostelMap.get(room.hostel);
      }
      await room.save();
    }
    console.log(`✅ Backfilled ${unlinkedRooms.length} rooms.`);

    // 3. Backfill Fees
    const unlinkedFees = await Fee.find({ organizationId: { $in: [null, undefined] } });
    console.log(`💵 Found ${unlinkedFees.length} fees without organizationId.`);
    for (const fee of unlinkedFees) {
      fee.organizationId = defaultOrg._id;
      if (fee.hostel && hostelMap.has(fee.hostel)) {
        fee.hostelId = hostelMap.get(fee.hostel);
      }
      await fee.save();
    }
    console.log(`✅ Backfilled ${unlinkedFees.length} fees.`);

    // 4. Backfill FeePayments
    const unlinkedPayments = await FeePayment.find({ organizationId: { $in: [null, undefined] } });
    console.log(`💳 Found ${unlinkedPayments.length} fee payments without organizationId.`);
    for (const payment of unlinkedPayments) {
      payment.organizationId = defaultOrg._id;
      if (payment.hostel && hostelMap.has(payment.hostel)) {
        payment.hostelId = hostelMap.get(payment.hostel);
      }
      await payment.save();
    }
    console.log(`✅ Backfilled ${unlinkedPayments.length} fee payments.`);

    // 5. Backfill Complaints
    const unlinkedComplaints = await Complaint.find({ organizationId: { $in: [null, undefined] } });
    console.log(`📝 Found ${unlinkedComplaints.length} complaints without organizationId.`);
    for (const comp of unlinkedComplaints) {
      comp.organizationId = defaultOrg._id;
      if (comp.hostel && hostelMap.has(comp.hostel)) {
        comp.hostelId = hostelMap.get(comp.hostel);
      }
      await comp.save();
    }
    console.log(`✅ Backfilled ${unlinkedComplaints.length} complaints.`);

    console.log('\n🎉 Legacy Multi-Tenant Migration Completed Successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

migrate();
