const crypto = require('crypto');
const User = require('../models/User');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Notification = require('../models/Notification');
const { sendStudentCredentials } = require('../utils/email');

// @desc    Get all students (with optional hostel filter)
// @route   GET /api/students
// @access  Admin
const getAllStudents = async (req, res) => {
  try {
    const { hostel, search, page = 1, limit = 50 } = req.query;
    const query = { isActive: { $ne: false } };
    if (hostel) query.hostel = hostel;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { roomNo: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [students, total] = await Promise.all([
      Student.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Student.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, data: students, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Admin or the student themselves
const getStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Students can only see their own profile
    if (req.user.role === 'student' && String(student.userId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    return res.status(200).json({ success: true, data: student });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register a new student (creates User + Student records)
// @route   POST /api/students
// @access  Admin
const createStudent = async (req, res) => {
  try {
    const { name, username, email, phone, parentPhone, roomNo, hostel, fees, startDate, validDate, password } = req.body;

    if (!name || !username || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, username, email, password are required' });
    }

    // Check for existing user/username
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email or username already exists' });
    }

    // Create User account
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      username,
      password,
      role: 'student',
    });

    // Create Student profile
    const student = await Student.create({
      userId: user._id,
      name,
      username,
      email: email.toLowerCase(),
      phone,
      parentPhone,
      roomNo,
      hostel,
      fees: fees || 0,
      startDate,
      validDate,
    });

    // Link student to user
    user.studentId = student._id;
    await user.save({ validateBeforeSave: false });

    // Update room occupancy if room assigned
    if (roomNo && hostel) {
      await Room.findOneAndUpdate(
        { roomNumber: roomNo, hostel },
        { $inc: { occupiedCount: 1 } }
      );
    }

    // Generate a reset token for their first login
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days for initial setup
    await user.save({ validateBeforeSave: false });

    // Send credentials email with reset link
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
      const resetLink = `${frontendUrl}/reset-password?token=${resetToken}`;
      await sendStudentCredentials({ to: email, name, username, password, resetLink });
    } catch (emailErr) {
      console.error('Email send failed (non-fatal):', emailErr.message);
    }

    // Create welcome notification
    await Notification.create({
      userId: user._id,
      hostel,
      title: 'Welcome to Q2 Connect Suite!',
      message: `Hello ${name}, your account has been set up. Welcome to ${hostel} hostel.`,
      type: 'success',
    });

    return res.status(201).json({ success: true, data: { user: user.toJSON(), student } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Admin
const updateStudent = async (req, res) => {
  try {
    const { name, phone, parentPhone, roomNo, hostel, fees, startDate, validDate } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Handle room change: update occupancy
    const oldRoom = student.roomNo;
    const oldHostel = student.hostel;
    if (roomNo && hostel && (roomNo !== oldRoom || hostel !== oldHostel)) {
      // Decrement old room
      if (oldRoom && oldHostel) {
        await Room.findOneAndUpdate(
          { roomNumber: oldRoom, hostel: oldHostel },
          { $inc: { occupiedCount: -1 } }
        );
      }
      // Increment new room
      await Room.findOneAndUpdate(
        { roomNumber: roomNo, hostel },
        { $inc: { occupiedCount: 1 } }
      );
    }

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      { name, phone, parentPhone, roomNo, hostel, fees, startDate, validDate },
      { new: true, runValidators: true }
    );

    // Also update name on User record
    if (name) {
      await User.findByIdAndUpdate(student.userId, { name });
    }

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Admin
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Decrement room occupancy
    if (student.roomNo && student.hostel) {
      await Room.findOneAndUpdate(
        { roomNumber: student.roomNo, hostel: student.hostel },
        { $inc: { occupiedCount: -1 } }
      );
    }

    // Permanently remove User and Student records
    if (student.userId) {
      await User.findByIdAndDelete(student.userId);
    }
    await Student.findByIdAndDelete(req.params.id);

    return res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllStudents, getStudent, createStudent, updateStudent, deleteStudent };
