const mongoose = require('mongoose');
const MessRequest = require('../models/MessRequest');
const Student = require('../models/Student');
const Notification = require('../models/Notification');
const { sendMessRequestUpdate } = require('../utils/email');

const getMessRequests = async (req, res) => {
  try {
    const { hostel, status, page = 1, limit = 20 } = req.query;
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
      if (hostel && hostel !== 'All') {
        query.hostel = hostel;
      } else if (req.tenant?.hostelAccess && !req.tenant.hostelAccess.includes('all') && !isSuperAdmin) {
        query.hostel = { $in: req.tenant.hostelAccess };
      }
    }
    if (status) query.status = status;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitAmount = Math.min(Math.max(parseInt(limit) || 20, 1), 100);
    const skip = (pageNum - 1) * limitAmount;

    const [total, requests] = await Promise.all([
      MessRequest.countDocuments(query),
      MessRequest.find(query)
        .populate('userId', 'name email username')
        .populate('studentId', 'name roomNo hostel')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limitAmount)
        .lean()
    ]);

    return res.status(200).json({ 
      success: true, 
      count: requests.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitAmount) || (total === 0 ? 0 : 1),
      limit: limitAmount,
      data: requests 
    });
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

    const student = await Student.findOne({ userId: req.user._id }).lean();
    const orgId = req.organizationId || req.tenant?.organizationId || student?.organizationId || null;
    const hostelId = student?.hostelId || null;

    const request = await MessRequest.create({
      organizationId: orgId,
      hostelId,
      userId: req.user._id,
      studentId: student?._id,
      hostel: student?.hostel || 'Q2',
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
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { status, adminMessage } = req.body;
    
    const updateData = {};
    if (status) updateData.status = status;
    if (adminMessage !== undefined) updateData.adminMessage = adminMessage;
    if (status && status !== 'pending') updateData.approvedDate = new Date();

    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    // Enforce Tenant Ownership in lookup
    const filter = { _id: req.params.id };
    if (!isSuperAdmin) {
      filter.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      filter.organizationId = orgId;
    }

    const messReq = await MessRequest.findOneAndUpdate(
      filter,
      { $set: updateData },
      { new: true, session }
    ).populate('userId', 'name email');

    if (!messReq) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    // Notify student
    await Notification.create([{
      userId: messReq.userId._id,
      organizationId: messReq.organizationId || orgId,
      hostelId: messReq.hostelId || null,
      hostel: messReq.hostel,
      title: `Mess Off Request ${status === 'approved' ? 'Approved' : (status === 'returned' ? 'Returned' : 'Rejected')}`,
      message: adminMessage || `Your mess off request has been marked as ${status}.`,
      type: status === 'approved' ? 'success' : (status === 'returned' ? 'info' : 'error'),
    }], { session, ordered: true });

    await session.commitTransaction();
    session.endSession();

    // Send email (outside transaction)
    try {
      if (messReq.userId?.email) {
        await sendMessRequestUpdate({
          to: messReq.userId.email,
          name: messReq.userId.name,
          status,
          leavingDate: messReq.leavingDate.toDateString(),
          returnDate: messReq.returnDate.toDateString(),
          adminMessage,
        });
      }
    } catch (emailErr) {
      console.error('Email send failed (non-fatal):', emailErr.message);
    }

    return res.status(200).json({ success: true, data: messReq });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error updating mess request:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getMessRequests, createMessRequest, updateMessRequest };

