const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Notification = require('../models/Notification');
const { sendStudentCredentials, sendAdminNewStudentRegisteredNotification } = require('../utils/email');
const { addEmailJob } = require('../queues/queueManager');
const { parsePagination, getPaginationMeta } = require('../utils/pagination');

// @desc    Get all students (with optional hostel filter)
// @route   GET /api/students
// @access  Admin
const getAllStudents = async (req, res) => {
  try {
    const { hostel, search } = req.query;
    const { page, limit: limitAmount, skip: skipAmount } = parsePagination(req.query, 50);

    const studentMatch = { isActive: { $ne: false } };
    
    // Enforce Tenant Scoping
    if (req.tenant && req.tenant.organizationId && !req.tenant.isSuperAdmin) {
      studentMatch.organizationId = req.tenant.organizationId;
    }

    if (hostel && hostel !== 'All') {
      studentMatch.hostel = hostel;
    } else if (req.tenant && req.tenant.hostelAccess && !req.tenant.hostelAccess.includes('all') && !req.tenant.isSuperAdmin) {
      studentMatch.hostel = { $in: req.tenant.hostelAccess };
    }

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
      { $sort: { createdAt: -1, _id: -1 } },
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
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    if (req.params.id === 'me') {
      student = await Student.findOne({ userId: req.user._id }).lean();
    } else {
      const studentQuery = { _id: req.params.id };
      if (!isSuperAdmin) {
        studentQuery.organizationId = orgId || new mongoose.Types.ObjectId();
      } else if (orgId) {
        studentQuery.organizationId = orgId;
      }
      student = await Student.findOne(studentQuery).lean();
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

    if (!name || !email) {
      await session.abortTransaction();
      return res.status(400).json({ success: false, message: 'name and email are required' });
    }

    const finalUsername = username || (email ? email.toLowerCase().split('@')[0] + Math.floor(100 + Math.random() * 900) : `std_${Date.now()}`);
    const finalPassword = password || phone || 'Student@123';

    const orgId = req.tenant?.organizationId || req.user.activeOrganizationId;

    // Check for existing user/username
    let user;
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: finalUsername }] }).session(session);
    if (existingUser) {
      if (existingUser.registrationStatus === 'pending_approval' && existingUser.email === email.toLowerCase()) {
        existingUser.name = name;
        existingUser.username = finalUsername;
        existingUser.password = finalPassword;
        existingUser.role = 'student';
        existingUser.registrationStatus = 'active';
        existingUser.hostels = [hostel];
        if (orgId) existingUser.activeOrganizationId = orgId;
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
        username: finalUsername,
        password: finalPassword,
        role: 'student',
        registrationStatus: 'active',
        hostels: [hostel],
        activeOrganizationId: orgId || null,
      }], { session, ordered: true });
      user = users[0];
    }

    // Resolve hostelId
    const Hostel = require('../models/Hostel');
    const hostelDoc = await Hostel.findOne({ organizationId: orgId, code: hostel }).session(session);

    // Generate studentCode if not provided (e.g. Q2S2026001)
    let finalStudentCode = req.body.studentCode;
    if (!finalStudentCode) {
      const year = new Date(startDate || Date.now()).getFullYear();
      const count = await Student.countDocuments({ organizationId: orgId }).session(session);
      const cleanHostel = (hostel || 'Q2').toUpperCase().replace(/[^A-Z0-9]/g, '');
      finalStudentCode = `${cleanHostel}S${year}${String(count + 1).padStart(3, '0')}`;
    }

    // Create Student profile
    const students = await Student.create([{
      userId: user._id,
      organizationId: orgId || null,
      hostelId: hostelDoc?._id || null,
      name,
      username: finalUsername,
      email: email.toLowerCase(),
      phone,
      parentPhone,
      roomNo,
      hostel,
      fees: fees || 0,
      startDate,
      validDate,
      studentCode: finalStudentCode,
    }], { session, ordered: true });
    const student = students[0];

    // Link student to user
    user.studentId = student._id;
    await user.save({ validateBeforeSave: false, session });

    // Ensure Membership exists for student user
    if (orgId) {
      const Membership = require('../models/Membership');
      await Membership.findOneAndUpdate(
        { organizationId: orgId, userId: user._id },
        {
          organizationId: orgId,
          userId: user._id,
          role: 'MEMBER',
          status: 'ACTIVE',
          hostelAccess: [hostel],
        },
        { upsert: true, session }
      );
    }

    // Update room occupancy if room assigned with atomic capacity check to prevent race condition
    if (roomNo && hostel) {
      const roomQuery = { roomNumber: roomNo, hostel };
      if (orgId && !req.tenant?.isSuperAdmin) {
        roomQuery.organizationId = orgId;
      }
      const updatedRoom = await Room.findOneAndUpdate(
        {
          ...roomQuery,
          $expr: {
            $lt: [{ $ifNull: ['$occupiedCount', 0] }, '$capacity'],
          },
        },
        [
          {
            $set: {
              occupiedCount: { $add: [{ $ifNull: ['$occupiedCount', 0] }, 1] },
              status: {
                $cond: {
                  if: { $gte: [{ $add: [{ $ifNull: ['$occupiedCount', 0] }, 1] }, '$capacity'] },
                  then: 'full',
                  else: 'available',
                },
              },
            },
          },
        ],
        { session, new: true }
      );

      if (!updatedRoom) {
        const existingRoom = await Room.findOne(roomQuery).session(session);
        await session.abortTransaction();
        session.endSession();
        if (!existingRoom) {
          return res.status(400).json({
            success: false,
            message: `Room ${roomNo} in ${hostel} does not exist`,
          });
        }
        return res.status(400).json({
          success: false,
          message: `Room ${roomNo} in ${hostel} is already fully occupied (capacity: ${existingRoom.capacity})`,
        });
      }
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
          organizationId: orgId || null,
          hostelId: hostelDoc?._id || null,
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
          organizationId: orgId || null,
          hostelId: hostelDoc?._id || null,
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
          organizationId: orgId || null,
          hostelId: hostelDoc?._id || null,
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
      organizationId: orgId || null,
      hostelId: hostelDoc?._id || null,
      hostel,
      title: 'Welcome to Q2 Connect Suite!',
      message: `Hello ${name}, your account has been set up. Welcome to ${hostel} hostel.`,
      type: 'success',
    }], { session, ordered: true });

    await session.commitTransaction();
    session.endSession();

    // Asynchronously notify admin via queue
    const adminEmail = req.user?.email || 'abhi1006@q2connect.com';
    addEmailJob('ADMIN_NEW_STUDENT_REGISTERED', {
      to: adminEmail,
      studentName: name,
      studentEmail: email.toLowerCase(),
      studentRoom: roomNo,
      studentHostel: hostel,
      studentPhone: phone,
      username: username,
    }).catch(err => console.warn('[students.controller] Admin notification email queue warning:', err.message));

    return res.status(201).json({
      success: true,
      message: 'Student registered successfully',
      data: { user: user.toJSON(), student }
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    session.endSession();
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A student or user with this email or username already exists' });
    }
    if (error.code === 112 || (error.hasErrorLabel && error.hasErrorLabel('TransientTransactionError')) || (error.message && error.message.includes('WriteConflict'))) {
      return res.status(409).json({ success: false, message: 'Write conflict during concurrent registration. Room or user was concurrently modified.' });
    }
    return res.status(error.status || 500).json({ success: false, message: error.message });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Admin
const updateStudent = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;
    const studentQuery = { _id: req.params.id };
    if (!isSuperAdmin) {
      studentQuery.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      studentQuery.organizationId = orgId;
    }

    const student = await Student.findOne(studentQuery).session(session);
    if (!student) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    // Handle room change: update occupancy safely
    const oldRoom = student.roomNo;
    const oldHostel = student.hostel;
    if (roomNo && hostel && (roomNo !== oldRoom || hostel !== oldHostel)) {
      // Safe atomic decrement on old room (only if occupiedCount > 0)
      if (oldRoom && oldHostel) {
        await Room.findOneAndUpdate(
          { roomNumber: oldRoom, hostel: oldHostel, organizationId: student.organizationId, occupiedCount: { $gt: 0 } },
          [
            {
              $set: {
                occupiedCount: { $max: [{ $subtract: [{ $ifNull: ['$occupiedCount', 1] }, 1] }, 0] },
                status: 'available',
              },
            },
          ],
          { session }
        );
      }
      // Atomic increment on new room with live capacity guard
      const newRoomQuery = { roomNumber: roomNo, hostel, organizationId: student.organizationId };
      const updatedNewRoom = await Room.findOneAndUpdate(
        {
          ...newRoomQuery,
          $expr: {
            $lt: [{ $ifNull: ['$occupiedCount', 0] }, '$capacity'],
          },
        },
        [
          {
            $set: {
              occupiedCount: { $add: [{ $ifNull: ['$occupiedCount', 0] }, 1] },
              status: {
                $cond: {
                  if: { $gte: [{ $add: [{ $ifNull: ['$occupiedCount', 0] }, 1] }, '$capacity'] },
                  then: 'full',
                  else: 'available',
                },
              },
            },
          },
        ],
        { session, new: true }
      );

      if (!updatedNewRoom) {
        const existingNewRoom = await Room.findOne(newRoomQuery).session(session);
        await session.abortTransaction();
        session.endSession();
        if (!existingNewRoom) {
          return res.status(400).json({
            success: false,
            message: `Room ${roomNo} in ${hostel} does not exist`,
          });
        }
        return res.status(400).json({
          success: false,
          message: `Room ${roomNo} in ${hostel} is already fully occupied (capacity: ${existingNewRoom.capacity})`,
        });
      }
    }

    const updated = await Student.findByIdAndUpdate(
      student._id,
      { name, phone, parentPhone, roomNo, hostel, fees, startDate, validDate },
      { new: true, runValidators: true, session }
    );

    // Also update name on User record
    if (name && student.userId) {
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
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const studentQuery = { _id: req.params.id };
    if (!isSuperAdmin) {
      studentQuery.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      studentQuery.organizationId = orgId;
    }

    let student = await Student.findOne(studentQuery).session(session);
    if (!student) {
      student = await Student.findOne({
        userId: req.params.id,
        ...(!isSuperAdmin ? { organizationId: orgId || new mongoose.Types.ObjectId() } : (orgId ? { organizationId: orgId } : {})),
      }).session(session);
    }

    if (!student) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Student not found in your organization' });
    }

    if (student.roomNo && student.hostel) {
      await Room.findOneAndUpdate(
        { roomNumber: student.roomNo, hostel: student.hostel, organizationId: student.organizationId, occupiedCount: { $gt: 0 } },
        [
          {
            $set: {
              occupiedCount: { $max: [{ $subtract: [{ $ifNull: ['$occupiedCount', 1] }, 1] }, 0] },
              status: 'available',
            },
          },
        ],
        { session }
      );
    }
    if (student.userId) {
      await User.findByIdAndDelete(student.userId, { session });
    }
    await Student.findByIdAndDelete(student._id, { session });

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
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const query = {
      role: 'student',
      registrationStatus: 'pending_approval',
    };

    if (!isSuperAdmin) {
      query.activeOrganizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      query.activeOrganizationId = orgId;
    }

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
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const userQuery = { _id: id };
    if (!isSuperAdmin) {
      userQuery.activeOrganizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      userQuery.activeOrganizationId = orgId;
    }

    const user = await User.findOne(userQuery);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Resident request not found in your organization' });
    }
    user.registrationStatus = 'approved';
    if (!user.registrationDetails) user.registrationDetails = {};
    user.registrationDetails.approvedAt = new Date();
    user.registrationDetails.approvedBy = req.user._id;
    await user.save();

    // Create Notification for the student
    await Notification.create({
      userId: user._id,
      organizationId: user.activeOrganizationId || orgId,
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
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const userQuery = { _id: id };
    if (!isSuperAdmin) {
      userQuery.activeOrganizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      userQuery.activeOrganizationId = orgId;
    }

    const user = await User.findOne(userQuery);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Resident request not found in your organization' });
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

    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const userQuery = { _id: id };
    if (!isSuperAdmin) {
      userQuery.activeOrganizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      userQuery.activeOrganizationId = orgId;
    }

    const user = await User.findOne(userQuery).session(session);
    if (!user) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ success: false, message: 'Applicant user not found in your organization' });
    }


    const finalEmail = (email || user.email || '').toLowerCase().trim();
    // User ID, Email, and Password default to Google authentication email if not provided
    const finalUsername = (username || finalEmail).toLowerCase().trim();
    const finalPassword = password || finalEmail;
    const finalHostel = hostel || user.registrationDetails?.hostel || user.hostels?.[0] || 'Q2';
    const finalPhone = phone || user.registrationDetails?.phone || '';
    const finalName = name || user.name || 'Resident';

    const targetOrgId = orgId || req.tenant?.organizationId || req.user?.activeOrganizationId;
    const Hostel = require('../models/Hostel');
    const hostelDoc = await Hostel.findOne({ organizationId: targetOrgId, code: finalHostel }).session(session);

    // Update user properties
    user.name = finalName;
    user.email = finalEmail;
    user.username = finalUsername;
    user.password = finalPassword;
    user.role = 'student';
    user.registrationStatus = 'active';
    user.hostels = [finalHostel];
    if (orgId) user.activeOrganizationId = orgId;
    if (hostelDoc) user.activeHostelId = hostelDoc._id;
    if (user.authProvider === 'google') {
      user.authProvider = 'both';
    }

    if (!user.registrationDetails) user.registrationDetails = {};
    user.registrationDetails.approvedAt = new Date();
    user.registrationDetails.approvedBy = req.user._id;

    // Check if a Student profile already exists for this user
    let student = await Student.findOne({ userId: user._id }).session(session);
    // Generate studentCode if not provided
    let finalStudentCode = req.body.studentCode;
    if (!finalStudentCode) {
      const year = new Date(startDate || Date.now()).getFullYear();
      const count = await Student.countDocuments({ organizationId: orgId }).session(session);
      const cleanHostel = (finalHostel || 'Q2').toUpperCase().replace(/[^A-Z0-9]/g, '');
      finalStudentCode = `${cleanHostel}S${year}${String(count + 1).padStart(3, '0')}`;
    }

    if (student) {
      student.name = finalName;
      student.username = finalUsername;
      student.email = finalEmail;
      student.phone = finalPhone;
      student.parentPhone = parentPhone;
      student.roomNo = roomNo;
      student.hostel = finalHostel;
      if (orgId) student.organizationId = orgId;
      if (hostelDoc) student.hostelId = hostelDoc._id;
      student.fees = fees ? parseFloat(fees) : 0;
      student.startDate = startDate || new Date();
      student.validDate = validDate || null;
      if (!student.studentCode) student.studentCode = finalStudentCode;
      await student.save({ session });
    } else {
      const createdStudents = await Student.create([{
        userId: user._id,
        organizationId: orgId || null,
        hostelId: hostelDoc?._id || null,
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
        studentCode: finalStudentCode,
      }], { session, ordered: true });
      student = createdStudents[0];
    }

    user.studentId = student._id;
    await user.save({ session });

    // Ensure Membership exists for student user
    if (orgId) {
      const Membership = require('../models/Membership');
      await Membership.findOneAndUpdate(
        { organizationId: orgId, userId: user._id },
        {
          organizationId: orgId,
          userId: user._id,
          role: 'MEMBER',
          status: 'ACTIVE',
          hostelAccess: [finalHostel],
        },
        { upsert: true, session }
      );
    }

    // Update Room occupancy if room assigned with atomic capacity check
    if (roomNo && finalHostel) {
      const roomQuery = { roomNumber: roomNo, hostel: finalHostel };
      if (orgId && !req.tenant?.isSuperAdmin) {
        roomQuery.organizationId = orgId;
      }
      const updatedRoom = await Room.findOneAndUpdate(
        {
          ...roomQuery,
          $expr: {
            $lt: [{ $ifNull: ['$occupiedCount', 0] }, '$capacity'],
          },
        },
        [
          {
            $set: {
              occupiedCount: { $add: [{ $ifNull: ['$occupiedCount', 0] }, 1] },
              status: {
                $cond: {
                  if: { $gte: [{ $add: [{ $ifNull: ['$occupiedCount', 0] }, 1] }, '$capacity'] },
                  then: 'full',
                  else: 'available',
                },
              },
            },
          },
        ],
        { session, new: true }
      );

      if (!updatedRoom) {
        const existingRoom = await Room.findOne(roomQuery).session(session);
        await session.abortTransaction();
        session.endSession();
        if (!existingRoom) {
          return res.status(400).json({
            success: false,
            message: `Room ${roomNo} in ${finalHostel} does not exist`,
          });
        }
        return res.status(400).json({
          success: false,
          message: `Room ${roomNo} in ${finalHostel} is already fully occupied (capacity: ${existingRoom.capacity})`,
        });
      }
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
          organizationId: orgId || null,
          hostelId: hostelDoc?._id || null,
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
          organizationId: orgId || null,
          hostelId: hostelDoc?._id || null,
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
          organizationId: orgId || null,
          hostelId: hostelDoc?._id || null,
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
        organizationId: orgId || null,
        hostelId: hostelDoc?._id || null,
        title: 'Hostel Registration Complete!',
        message: `Welcome to ${finalHostel}! You have been assigned to Room ${roomNo || 'TBD'}. You can now sign in with Google or your credentials.`,
        type: 'success',
        hostel: finalHostel,
      }
    ];

    if (req.user?._id) {
      notificationsToCreate.push({
        userId: req.user._id,
        organizationId: orgId || null,
        hostelId: hostelDoc?._id || null,
        hostel: finalHostel,
        title: 'New Student Registration Complete',
        message: `${finalName} has been officially registered and assigned to Room ${roomNo || 'N/A'} in ${finalHostel}.`,
        type: 'info',
      });
    }

    await Notification.create(notificationsToCreate, { session, ordered: true });

    await session.commitTransaction();
    session.endSession();

    // Send asynchronous confirmation email to Admin via queue
    const adminEmail = req.user?.email || 'abhi1006@q2connect.com';
    addEmailJob('ADMIN_NEW_STUDENT_REGISTERED', {
      to: adminEmail,
      studentName: finalName,
      studentEmail: finalEmail,
      studentRoom: roomNo,
      studentHostel: finalHostel,
      studentPhone: finalPhone,
      username: finalUsername,
    }).catch(e => console.warn('Admin registration confirmation email queue warning:', e.message));

    return res.status(200).json({
      success: true,
      message: `Student ${finalName} successfully registered and approved!`,
      data: { user: user.toJSON(), student },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('approveAndRegisterStudent error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A student or user with this email or username already exists' });
    }
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

