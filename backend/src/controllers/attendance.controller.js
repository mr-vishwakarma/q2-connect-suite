const mongoose = require('mongoose');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');

const getAttendance = async (req, res) => {
  try {
    const { userId, hostel, startDate, endDate, date } = req.query;
    const query = {};

    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    // Enforce Tenant Scoping
    if (!isSuperAdmin) {
      query.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      query.organizationId = orgId;
    }

    if (req.user.role === 'student') {
      query.userId = req.user._id;
    } else {
      if (userId) query.userId = userId;
      if (hostel && hostel !== 'All') {
        query.hostel = hostel;
      } else if (req.tenant?.hostelAccess && !req.tenant.hostelAccess.includes('all') && !isSuperAdmin) {
        query.hostel = { $in: req.tenant.hostelAccess };
      }
    }

    if (date) {
      query.date = new Date(date);
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const records = await Attendance.find(query)
      .populate('userId', 'name username')
      .sort({ date: -1 });

    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const markAttendance = async (req, res) => {
  try {
    const { userId, studentId, hostel, date, status } = req.body;
    if (!userId || !date || !status) {
      return res.status(400).json({ success: false, message: 'userId, date, status are required' });
    }

    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    // Verify student belongs to this organization
    const studentQuery = { userId };
    if (!isSuperAdmin) {
      studentQuery.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      studentQuery.organizationId = orgId;
    }

    const student = await Student.findOne(studentQuery);
    if (!student && !isSuperAdmin) {
      return res.status(404).json({ success: false, message: 'Student not found in your organization' });
    }

    const targetOrgId = student?.organizationId || orgId || null;
    const targetHostelId = student?.hostelId || null;
    const targetHostel = student?.hostel || hostel || 'Q2';

    const filter = { userId, date: new Date(date) };
    if (targetOrgId) filter.organizationId = targetOrgId;

    const record = await Attendance.findOneAndUpdate(
      filter,
      {
        $set: {
          userId,
          studentId: student?._id || studentId,
          organizationId: targetOrgId,
          hostelId: targetHostelId,
          hostel: targetHostel,
          date: new Date(date),
          status
        }
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const { status } = req.body;
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const filter = { _id: req.params.id };
    if (!isSuperAdmin) {
      filter.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      filter.organizationId = orgId;
    }

    const record = await Attendance.findOneAndUpdate(filter, { $set: { status } }, { new: true });
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found in your organization' });
    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAttendance, markAttendance, updateAttendance };

