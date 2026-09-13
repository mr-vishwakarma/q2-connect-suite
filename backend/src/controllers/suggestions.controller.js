const mongoose = require('mongoose');
const Suggestion = require('../models/Suggestion');
const Student = require('../models/Student');

const getSuggestions = async (req, res) => {
  try {
    const { hostel, status, page = 1, limit = 50 } = req.query;
    const query = {};

    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

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

    const [total, suggestions] = await Promise.all([
      Suggestion.countDocuments(query),
      Suggestion.find(query)
        .populate('userId', 'name username')
        .populate('studentId', 'name roomNo')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limitAmount)
        .lean()
    ]);

    return res.status(200).json({ 
      success: true, 
      data: suggestions,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitAmount) || (total === 0 ? 0 : 1),
      limit: limitAmount
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createSuggestion = async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'title and description are required' });
    }
    const student = await Student.findOne({ userId: req.user._id }).lean();
    const orgId = req.organizationId || req.tenant?.organizationId || student?.organizationId || null;

    const suggestion = await Suggestion.create({
      userId: req.user._id,
      studentId: student?._id,
      organizationId: orgId,
      hostelId: student?.hostelId || null,
      hostel: student?.hostel || 'Q2',
      title,
      description,
    });
    return res.status(201).json({ success: true, data: suggestion });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateSuggestion = async (req, res) => {
  try {
    const { status, adminReply } = req.body;
    const updateData = {};
    if (status) updateData.status = status;
    if (adminReply !== undefined) updateData.adminReply = adminReply;

    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const suggestionQuery = { _id: req.params.id };
    if (!isSuperAdmin) {
      suggestionQuery.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      suggestionQuery.organizationId = orgId;
    }

    const suggestion = await Suggestion.findOneAndUpdate(
      suggestionQuery,
      updateData,
      { new: true, runValidators: true }
    );
    if (!suggestion) return res.status(404).json({ success: false, message: 'Suggestion not found in your organization' });
    return res.status(200).json({ success: true, data: suggestion });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getSuggestions, createSuggestion, updateSuggestion };

