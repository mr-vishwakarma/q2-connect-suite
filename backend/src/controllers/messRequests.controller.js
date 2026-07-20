const MessRequest = require('../models/MessRequest');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { sendMessRequestUpdate } = require('../utils/email');

const getMessRequests = async (req, res) => {
  try {
    const { hostel, status } = req.query;
    const query = {};

    if (req.user.role === 'student') {
      query.userId = req.user._id;
    } else {
      if (hostel) query.hostel = hostel;
    }
    if (status) query.status = status;

    const requests = await MessRequest.find(query)
      .populate('userId', 'name email username')
      .populate('studentId', 'name roomNo hostel')
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, data: requests });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createMessRequest = async (req, res) => {
  try {
    const { leavingDate, returnDate, reason, parentMobile, documentUrl, documentName, documentFileId } = req.body;
    if (!leavingDate || !returnDate) {
      return res.status(400).json({ success: false, message: 'leavingDate and returnDate are required' });
    }

    const student = await Student.findOne({ userId: req.user._id });

    const request = await MessRequest.create({
      userId: req.user._id,
      studentId: student?._id,
      hostel: student?.hostel,
      leavingDate: new Date(leavingDate),
      returnDate: new Date(returnDate),
      reason,
      parentMobile,
      documentUrl,
      documentName,
      documentFileId,
    });

    return res.status(201).json({ success: true, data: request });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateMessRequest = async (req, res) => {
  try {
    const { status, adminMessage } = req.body;
    const messReq = await MessRequest.findByIdAndUpdate(
      req.params.id,
      { status, adminMessage, ...(status !== 'pending' ? { approvedDate: new Date() } : {}) },
      { new: true }
    ).populate('userId', 'name email');

    if (!messReq) return res.status(404).json({ success: false, message: 'Request not found' });

    // Notify student
    await Notification.create({
      userId: messReq.userId._id,
      hostel: messReq.hostel,
      title: `Mess Off Request ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      message: adminMessage || `Your mess off request has been ${status}.`,
      type: status === 'approved' ? 'success' : 'error',
    });

    // Send email
    try {
      await sendMessRequestUpdate({
        to: messReq.userId.email,
        name: messReq.userId.name,
        status,
        leavingDate: messReq.leavingDate.toDateString(),
        returnDate: messReq.returnDate.toDateString(),
        adminMessage,
      });
    } catch (emailErr) {
      console.error('Email send failed (non-fatal):', emailErr.message);
    }

    return res.status(200).json({ success: true, data: messReq });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMessRequests, createMessRequest, updateMessRequest };
