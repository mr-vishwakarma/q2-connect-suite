const Suggestion = require('../models/Suggestion');
const Student = require('../models/Student');

const getSuggestions = async (req, res) => {
  try {
    const { hostel, status } = req.query;
    const query = {};
    if (req.user.role === 'student') query.userId = req.user._id;
    else if (hostel) query.hostel = hostel;
    if (status) query.status = status;

    const suggestions = await Suggestion.find(query)
      .populate('userId', 'name username')
      .populate('studentId', 'name roomNo')
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: suggestions });
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
      hostel: student?.hostel,
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
    const suggestion = await Suggestion.findByIdAndUpdate(
      req.params.id,
      { status, adminReply },
      { new: true }
    );
    if (!suggestion) return res.status(404).json({ success: false, message: 'Suggestion not found' });
    return res.status(200).json({ success: true, data: suggestion });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getSuggestions, createSuggestion, updateSuggestion };
