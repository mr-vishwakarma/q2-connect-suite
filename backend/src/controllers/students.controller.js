const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Notification = require('../models/Notification');
const { sendStudentCredentials, sendAdminNewStudentRegisteredNotification } = require('../utils/email');

// @desc    Get all students (with optional hostel filter)
// @route   GET /api/students
// @access  Admin
const getAllStudents = async (req, res) => {
  try {
    const { hostel, search, page = 1, limit = 50 } = req.query;
    
    const skipAmount = (parseInt(page) - 1) * parseInt(limit);
    const limitAmount = parseInt(limit);

    const studentMatch = { isActive: { $ne: false } };
    if (hostel) studentMatch.hostel = hostel;
    if (search) {
      studentMatch.$or = [
        { name: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { roomNo: { $regex: search, $options: 'i' } },
      ];
    }

    const pipeline = [
      { $match: studentMatch },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'user.role': { $ne: 'admin' },
          'user.admin': { $ne: true },
          'user.isActive': { $ne: false }
        }
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skipAmount }, { $limit: limitAmount }]
        }
      }
    ];

    const result = await Student.aggregate(pipeline);
    
    const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;
    const paginatedStudents = result[0].data.map(s => {
       s.userId = {
         _id: s.user._id,
         role: s.user.role,
         isActive: s.user.isActive,
         admin: s.user.admin
       };
       delete s.user;
       return s;
    });

    return res.status(200).json({
      success: true,
      data: paginatedStudents,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limitAmount),
      limit: limitAmount
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Admin or the student themselves
const getStudent = async (req, res) => {
  try {
    let student;
    if (req.params.id === 'me') {
      student = await Student.findOne({ userId: req.user._id });
    } else {
      student = await Student.findById(req.params.id);
    }
    
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
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { name, username, email, phone, parentPhone, roomNo, hostel, fees, startDate, validDate, password, initialFeePaid } = req.body;

    if (!name || !username || !email || !password) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'name, username, email, password are required' });
    }

    // Check for existing user/username
    let user;
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] }).session(session);
    if (existingUser) {
      if (existingUser.registrationStatus === 'pending_approval' && existingUser.email === email.toLowerCase()) {
        existingUser.name = name;
        existingUser.username = username;
        existingUser.password = password;
        existingUser.role = 'student';
        existingUser.registrationStatus = 'active';
        existingUser.hostels = [hostel];
        if (existingUser.authProvider === 'google') existingUser.authProvider = 'both';
        await existingUser.save({ session });
        user = existingUser;
      } else {
        await session.abortTransaction();
        return res.status(409).json({ success: false, message: 'Email or username already exists' });
      }
    } else {
      // Create User account
      const users = await User.create([{
        name,
        email: email.toLowerCase(),
        username,
        password,
        role: 'student',
        registrationStatus: 'active',
        hostels: [hostel],
      }], { session, ordered: true });
      user = users[0];
    }

    // Create Student profile
    const students = await Student.create([{
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
    }], { session, ordered: true });
    const student = students[0];

    // Link student to user
    user.studentId = student._id;
    await user.save({ validateBeforeSave: false, session });

    // Update room occupancy if room assigned
    if (roomNo && hostel) {
      await Room.findOneAndUpdate(
        { roomNumber: roomNo, hostel },
        { $inc: { occupiedCount: 1 } },
        { session }
      );
    }

    // Handle initial Fee creation for current month
    if (fees && fees > 0) {
      const Fee = require('../models/Fee');
      const FeePayment = require('../models/FeePayment');
      const now = new Date();
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const month = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

      if (initialFeePaid) {
        const receiptNo = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

        const feeRecords = await Fee.create([{
          studentId: student._id,
          hostel,
          month,
          amount: fees,
          paidAmount: fees,
          status: 'paid',
          paidDate: now,
          paymentMode: 'cash',
          receiptNo,
        }], { session, ordered: true });
        const feeRecord = feeRecords[0];

        await FeePayment.create([{
          feeId: feeRecord._id,
          studentId: student._id,
          hostel,
          receiptNo,
          amount: fees,
          lateFee: 0,
          discount: 0,
          securityDeposit: 0,
          paymentMode: 'cash',
          paymentDate: now,
          adminId: req.user._id,
          adminName: req.user.name,
          month,
          notes: 'Initial fee paid at registration',
        }], { session, ordered: true });
      } else {
        // Create UNPAID Fee record so status shows Unpaid and pending balance reflects monthly fee
        const dueDate = new Date(now.getFullYear(), now.getMonth(), 10);
        await Fee.create([{
          studentId: student._id,
          hostel,
          month,
          amount: fees,
          paidAmount: 0,
          status: 'unpaid',
          dueDate,
        }], { session, ordered: true });
      }
    }

    // Create welcome notification
    await Notification.create([{
      userId: user._id,
      hostel,
      title: 'Welcome to Q2 Connect Suite!',
      message: `Hello ${name}, your account has been set up. Welcome to ${hostel} hostel.`,
      type: 'success',
    }], { session, ordered: true });

    await session.commitTransaction();
    session.endSession();

    // Asynchronously notify admin via email
    const adminEmail = req.user?.email || 'abhi1006@q2connect.com';
    sendAdminNewStudentRegisteredNotification({
      to: adminEmail,
      studentName: name,
      studentEmail: email.toLowerCase(),
      studentRoom: roomNo,
      studentHostel: hostel,
      studentPhone: phone,
      username: username,
    }).catch(err => console.warn('[students.controller] Admin notification email failed:', err.message));

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      data: { user: user.toJSON(), student }
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Admin
const updateStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, phone, parentPhone, roomNo, hostel, fees, startDate, validDate } = req.body;
    const student = await Student.findById(req.params.id).session(session);
    if (!student) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Handle room change: update occupancy
    const oldRoom = student.roomNo;
    const oldHostel = student.hostel;
    if (roomNo && hostel && (roomNo !== oldRoom || hostel !== oldHostel)) {
      // Decrement old room
      if (oldRoom && oldHostel) {
        await Room.findOneAndUpdate(
          { roomNumber: oldRoom, hostel: oldHostel },
          { $inc: { occupiedCount: -1 } },
          { session }
        );
      }
      // Increment new room
      await Room.findOneAndUpdate(
        { roomNumber: roomNo, hostel },
        { $inc: { occupiedCount: 1 } },
        { session }
      );
    }

    const updated = await Student.findByIdAndUpdate(
      req.params.id,
      { name, phone, parentPhone, roomNo, hostel, fees, startDate, validDate },
      { new: true, runValidators: true, session }
    );

    // Also update name on User record
    if (name) {
      await User.findByIdAndUpdate(student.userId, { name }, { session });
    }

    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Admin
const deleteStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let student = await Student.findById(req.params.id).session(session);
    if (!student) {
      student = await Student.findOne({ userId: req.params.id }).session(session);
    }

    if (student) {
      if (student.roomNo && student.hostel) {
        await Room.findOneAndUpdate(
          { roomNumber: student.roomNo, hostel: student.hostel },
          { $inc: { occupiedCount: -1 } },
          { session }
        );
      }
      if (student.userId) {
        await User.findByIdAndDelete(student.userId, { session });
      }
      await Student.findByIdAndDelete(student._id, { session });
    } else {
      await User.findByIdAndDelete(req.params.id, { session });
    }

    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update student's own profile
// @route   PUT /api/students/profile
// @access  Student
const updateOwnProfile = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, phone, parentPhone, address, dob, profilePhoto, profilePhotoFileId } = req.body;
    
    // Find the student record associated with the logged-in user
    const student = await Student.findOne({ userId: req.user._id }).session(session);
    
    if (!student) {
      await session.abortTransaction();
      return res.status(404).json({ success: false, message: 'Student profile not found' });
    }

    const updated = await Student.findByIdAndUpdate(
      student._id,
      { name, phone, parentPhone, address, dob, profilePhoto, profilePhotoFileId },
      { new: true, runValidators: true, session }
    );

    // Also update name on User record
    if (name) {
      await User.findByIdAndUpdate(req.user._id, { name }, { session });
    }

    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(500).json({ success: false, message: error.message });
  }
};

const studentService = require('../services/student.service');

// @desc    Get count of alert students (expiring within 5 days or already expired)
// @route   GET /api/students/alerts/count
const getAlertsCount = async (req, res) => {
  try {
    const { hostel } = req.query;
    const count = await studentService.getAlertsCount(hostel, req.tenant?.organizationId);
    return res.status(200).json({ success: true, count });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get alert students list (pre-filtered)
// @route   GET /api/students/alerts
const getAlertStudents = async (req, res) => {
  try {
    const { hostel } = req.query;
    const students = await studentService.getAlertStudents(hostel, req.tenant?.organizationId);
    return res.status(200).json({ success: true, data: students });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get pending resident registrations awaiting admin approval
// @route   GET /api/students/pending-registrations
// @access  Admin/Warden
const getPendingRegistrations = async (req, res) => {
  try {
    const { hostel } = req.query;
    const query = {
      role: 'student',
      registrationStatus: 'pending_approval',
    };

    if (hostel && hostel.toLowerCase() !== 'all') {
      query.$or = [
        { 'registrationDetails.hostel': hostel },
        { hostels: hostel },
      ];
    } else if (req.user && req.user.role === 'admin' && req.user.hostels && req.user.hostels.length > 0 && !req.user.isSuperAdmin) {
      // If admin has restricted branch access, only show pending applicants for their branches
      query.$or = [
        { 'registrationDetails.hostel': { $in: req.user.hostels } },
        { hostels: { $in: req.user.hostels } },
      ];
    }

    const pendingUsers = await User.find(query).sort({ 'registrationDetails.submittedAt': -1, createdAt: -1 });
    return res.status(200).json({
      success: true,
      count: pendingUsers.length,
      data: pendingUsers.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.registrationDetails?.phone || 'N/A',
        hostel: u.registrationDetails?.hostel || u.hostels?.[0] || 'Q2',
        picture: u.registrationDetails?.picture || '',
        submittedAt: u.registrationDetails?.submittedAt || u.createdAt,
        registrationStatus: u.registrationStatus,
      })),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve resident registration request
// @route   POST /api/students/approve-registration/:id
// @access  Admin
const approveRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Resident request not found' });
    }
    user.registrationStatus = 'approved';
    if (!user.registrationDetails) user.registrationDetails = {};
    user.registrationDetails.approvedAt = new Date();
    user.registrationDetails.approvedBy = req.user._id;
    await user.save();

    // Create Notification for the student
    await Notification.create({
      userId: user._id,
      title: 'Hostel Registration Approved!',
      message: `Your registration request for ${user.registrationDetails?.hostel || 'Q2'} has been approved. Please log in with Google to choose your username and password.`,
      type: 'success',
    });

    return res.status(200).json({
      success: true,
      message: `Registration for ${user.name} has been approved! The resident can now sign in with Google to set their username and password.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reject resident registration request
// @route   POST /api/students/reject-registration/:id
// @access  Admin
const rejectRegistration = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Registration declined by administrator.' } = req.body;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Resident request not found' });
    }
    user.registrationStatus = 'rejected';
    if (!user.registrationDetails) user.registrationDetails = {};
    user.registrationDetails.rejectionReason = reason;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `Registration for ${user.name} has been declined.`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Approve and complete student registration directly by Admin
// @route   POST /api/students/approve-and-register/:id
// @access  Admin
const approveAndRegisterStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    let {
      name,
      username,
      email,
      phone,
      parentPhone,
      roomNo,
      hostel,
      fees,
      startDate,
      validDate,
      password,
      initialFeePaid
    } = req.body;

    const user = await User.findById(id).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Applicant user not found' });
    }

    const finalEmail = (email || user.email || '').toLowerCase().trim();
    // User ID, Email, and Password default to Google authentication email if not provided
    const finalUsername = (username || finalEmail).toLowerCase().trim();
    const finalPassword = password || finalEmail;
    const finalHostel = hostel || user.registrationDetails?.hostel || user.hostels?.[0] || 'Q2';
    const finalPhone = phone || user.registrationDetails?.phone || '';
    const finalName = name || user.name || 'Resident';

    // Update user properties
    user.name = finalName;
    user.email = finalEmail;
    user.username = finalUsername;
    user.password = finalPassword;
    user.role = 'student';
    user.registrationStatus = 'active';
    user.hostels = [finalHostel];
    if (user.authProvider === 'google') {
      user.authProvider = 'both';
    }

    if (!user.registrationDetails) user.registrationDetails = {};
    user.registrationDetails.approvedAt = new Date();
    user.registrationDetails.approvedBy = req.user._id;

    // Check if a Student profile already exists for this user
    let student = await Student.findOne({ userId: user._id }).session(session);
    if (student) {
      student.name = finalName;
      student.username = finalUsername;
      student.email = finalEmail;
      student.phone = finalPhone;
      student.parentPhone = parentPhone;
      student.roomNo = roomNo;
      student.hostel = finalHostel;
      student.fees = fees ? parseFloat(fees) : 0;
      student.startDate = startDate || new Date();
      student.validDate = validDate || null;
      await student.save({ session });
    } else {
      const createdStudents = await Student.create([{
        userId: user._id,
        name: finalName,
        username: finalUsername,
        email: finalEmail,
        phone: finalPhone,
        parentPhone,
        roomNo,
        hostel: finalHostel,
        fees: fees ? parseFloat(fees) : 0,
        startDate: startDate || new Date(),
        validDate: validDate || null,
      }], { session, ordered: true });
      student = createdStudents[0];
    }

    user.studentId = student._id;
    await user.save({ session });

    // Update Room occupancy if room assigned
    if (roomNo && finalHostel) {
      await Room.findOneAndUpdate(
        { roomNumber: roomNo, hostel: finalHostel },
        { $inc: { occupiedCount: 1 } },
        { session }
      );
    }

    // Handle Fee creation if fees > 0
    if (fees && parseFloat(fees) > 0) {
      const Fee = require('../models/Fee');
      const FeePayment = require('../models/FeePayment');
      const now = new Date();
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const month = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
      const feeAmount = parseFloat(fees);

      if (initialFeePaid) {
        const receiptNo = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
        const feeRecords = await Fee.create([{
          studentId: student._id,
          hostel: finalHostel,
          month,
          amount: feeAmount,
          paidAmount: feeAmount,
          status: 'paid',
          paidDate: now,
          paymentMode: 'cash',
          receiptNo,
        }], { session, ordered: true });

        await FeePayment.create([{
          feeId: feeRecords[0]._id,
          studentId: student._id,
          hostel: finalHostel,
          receiptNo,
          amount: feeAmount,
          lateFee: 0,
          discount: 0,
          securityDeposit: 0,
          paymentMode: 'cash',
          paymentDate: now,
          adminId: req.user._id,
          adminName: req.user.name,
          month,
          notes: 'Initial registration fee collection',
        }], { session, ordered: true });
      } else {
        const dueDate = new Date(now.getFullYear(), now.getMonth(), 10);
        await Fee.create([{
          studentId: student._id,
          hostel: finalHostel,
          month,
          amount: feeAmount,
          paidAmount: 0,
          status: 'unpaid',
          dueDate,
        }], { session, ordered: true });
      }
    }

    // In-app Notifications
    const notificationsToCreate = [
      {
        userId: user._id,
        title: 'Hostel Registration Complete!',
        message: `Welcome to ${finalHostel}! You have been assigned to Room ${roomNo || 'TBD'}. You can now sign in with Google or your credentials.`,
        type: 'success',
        hostel: finalHostel,
      }
    ];

    if (req.user?._id) {
      notificationsToCreate.push({
        userId: req.user._id,
        hostel: finalHostel,
        title: 'New Student Registration Complete',
        message: `${finalName} has been officially registered and assigned to Room ${roomNo || 'N/A'} in ${finalHostel}.`,
        type: 'info',
      });
    }

    await Notification.create(notificationsToCreate, { session, ordered: true });

    await session.commitTransaction();
    session.endSession();

    // Send asynchronous confirmation email to Admin
    const adminEmail = req.user?.email || 'abhi1006@q2connect.com';
    sendAdminNewStudentRegisteredNotification({
      to: adminEmail,
      studentName: finalName,
      studentEmail: finalEmail,
      studentRoom: roomNo,
      studentHostel: finalHostel,
      studentPhone: finalPhone,
      username: finalUsername,
    }).catch(e => console.warn('Admin registration confirmation email failed:', e.message));

    return res.status(200).json({
      success: true,
      message: `Student ${finalName} successfully registered and approved!`,
      data: { user: user.toJSON(), student },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('approveAndRegisterStudent error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getAllStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent,
  updateOwnProfile,
  getAlertsCount,
  getAlertStudents,
  getPendingRegistrations,
  approveRegistration,
  approveAndRegisterStudent,
  rejectRegistration,
};

