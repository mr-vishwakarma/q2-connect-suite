const Suggestion = require('../models/Suggestion');
const Student = require('../models/Student');

const getSuggestions = async (req, res) => {
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

    const suggestions = await Suggestion.find(query)
      .populate('userId', 'name username')
      .populate('studentId', 'name roomNo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitAmount);

    const total = await Suggestion.countDocuments(query);

    return res.status(200).json({ 
      success: true, 
      data: suggestions,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limitAmount),
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
    const student = await Student.findOne({ userId: req.user._id });
    const suggestion = await Suggestion.create({
      userId: req.user._id,
      studentId: student?._id,
      organizationId: req.tenant?.organizationId || student?.organizationId || null,
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

    const suggestionQuery = { _id: req.params.id };
    if (req.tenant?.organizationId && !req.tenant.isSuperAdmin) {
      suggestionQuery.organizationId = req.tenant.organizationId;
    }

    const suggestion = await Suggestion.findOneAndUpdate(
      suggestionQuery,
      updateData,
      { new: true, runValidators: true }
    );
    if (!suggestion) return res.status(404).json({ success: false, message: 'Suggestion not found' });
    return res.status(200).json({ success: true, data: suggestion });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getSuggestions, createSuggestion, updateSuggestion };
