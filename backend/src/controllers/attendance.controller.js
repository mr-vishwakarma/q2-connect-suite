const Attendance = require('../models/Attendance');
const Student = require('../models/Student');

const getAttendance = async (req, res) => {
  try {
    const { userId, hostel, startDate, endDate, date } = req.query;
    const query = {};

    if (req.user.role === 'student') {
      query.userId = req.user._id;
    } else {
      if (userId) query.userId = userId;
      if (hostel) query.hostel = hostel;
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

    const record = await Attendance.findOneAndUpdate(
      { userId, date: new Date(date) },
      { userId, studentId, hostel, date: new Date(date), status },
      { upsert: true, new: true, runValidators: true }
    );

    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const { status } = req.body;
    const record = await Attendance.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAttendance, markAttendance, updateAttendance };
