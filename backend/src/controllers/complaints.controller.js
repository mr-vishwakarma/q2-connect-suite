const Complaint = require('../models/Complaint');
const Student = require('../models/Student');

const getComplaints = async (req, res) => {
  try {
    const { hostel, status, page = 1, limit = 50 } = req.query;
    const query = {};

    const orgId = req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;
    if (orgId && !isSuperAdmin) query.organizationId = orgId;

    if (req.user.role === 'student') {
      query.userId = req.user._id;
    } else {
      if (hostel && hostel !== 'All') {
        query.hostel = hostel;
      } else if (req.tenant?.hostelAccess && !req.tenant.hostelAccess.includes('all') && !isSuperAdmin) {
        query.hostel = { $in: req.tenant.hostelAccess };
      }
    }

    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitAmount = parseInt(limit);

    const complaints = await Complaint.find(query)
      .populate('userId', 'name username')
      .populate('studentId', 'name roomNo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitAmount);

    const total = await Complaint.countDocuments(query);

    return res.status(200).json({ 
      success: true, 
      data: complaints,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limitAmount),
      limit: limitAmount
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createComplaint = async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'title and description are required' });
    }
    const student = await Student.findOne({ userId: req.user._id });
    const complaint = await Complaint.create({
      userId: req.user._id,
      studentId: student?._id,
      organizationId: req.tenant?.organizationId || student?.organizationId || null,
      hostelId: student?.hostelId || null,
      hostel: student?.hostel || 'Q2',
      title,
      description,
    });
    return res.status(201).json({ success: true, data: complaint });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateComplaint = async (req, res) => {
  try {
    const { status, adminReply } = req.body;
    const updateData = {};
    if (status) updateData.status = status;
    if (adminReply !== undefined) updateData.adminReply = adminReply;

    const complaintQuery = { _id: req.params.id };
    if (req.tenant?.organizationId && !req.tenant.isSuperAdmin) {
      complaintQuery.organizationId = req.tenant.organizationId;
    }

    const complaint = await Complaint.findOneAndUpdate(
      complaintQuery,
      updateData,
      { new: true, runValidators: true }
    );
    if (!complaint) return res.status(404).json({ success: false, message: 'Complaint not found' });
    return res.status(200).json({ success: true, data: complaint });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getComplaints, createComplaint, updateComplaint };
