const Student = require('../models/Student');
const Complaint = require('../models/Complaint');
const Suggestion = require('../models/Suggestion');

exports.getAdminDashboard = async (req, res) => {
  try {
    const { hostel } = req.query;
    const orgId = req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    // Enforce Tenant Scoping
    const filter = {};
    if (orgId && !isSuperAdmin) {
      filter.organizationId = orgId;
    }

    if (hostel && hostel !== 'All') {
      filter.hostel = hostel;
    } else if (req.tenant?.hostelAccess && !req.tenant.hostelAccess.includes('all') && !isSuperAdmin) {
      filter.hostel = { $in: req.tenant.hostelAccess };
    }

    const studentMatch = { isActive: { $ne: false }, ...filter };

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Run all counts, aggregates, and recents in a single parallel batch
    const [
      totalStudents,
      totalComplaints,
      totalSuggestions,
      recentComplaints,
      recentSuggestions,
      studentDistribution,
      complaintsData
    ] = await Promise.all([
      Student.countDocuments(studentMatch),
      Complaint.countDocuments(filter),
      Suggestion.countDocuments(filter),
      Complaint.find(filter)
        .sort({ createdAt: -1 })
        .limit(3)
        .select('_id title description createdAt userId')
        .lean(),
      Suggestion.find(filter)
        .sort({ createdAt: -1 })
        .limit(3)
        .select('_id title description createdAt userId')
        .lean(),
      Student.aggregate([
        { $match: studentMatch },
        { $group: { _id: '$hostel', value: { $sum: 1 } } },
        { $project: { name: '$_id', value: 1, _id: 0 } }
      ]),
      Complaint.aggregate([
        {
          $match: {
            ...filter,
            createdAt: { $gte: sevenDaysAgo }
          }
        },
        {
          $group: {
            _id: { $dateToString: { format: "%b %d", date: "$createdAt" } },
            value: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        { $project: { name: '$_id', value: 1, _id: 0 } }
      ])
    ]);

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalStudents,
          totalComplaints,
          totalSuggestions
        },
        recentComplaints,
        recentSuggestions,
        complaintsData,
        studentDistribution
      }
    });

  } catch (error) {
    console.error('Error fetching admin dashboard data:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getStudentDashboard = async (req, res) => {
  try {
    const userId = req.user._id;
    const MessRequest = require('../models/MessRequest');

    const [studentData, leaveRequests, complaints, suggestions, approvedRequests] = await Promise.all([
      Student.findOne({ userId }).select('name username email phone parentPhone roomNo fees startDate validDate hostel studentCode profilePhoto'),
      MessRequest.countDocuments({ userId }),
      Complaint.countDocuments({ userId }),
      Suggestion.countDocuments({ userId }),
      MessRequest.countDocuments({ userId, status: 'approved' })
    ]);

    if (!studentData) {
      return res.status(404).json({ success: false, message: 'Student data not found' });
    }

    return res.status(200).json({
      success: true,
      data: {
        student: {
          name: studentData.name,
          username: studentData.username,
          email: studentData.email || req.user.email,
          phone: studentData.phone,
          parent_phone: studentData.parentPhone,
          room_no: studentData.roomNo,
          fees: studentData.fees,
          start_date: studentData.startDate,
          valid_date: studentData.validDate,
          hostel: studentData.hostel,
          student_code: studentData.studentCode,
          profile_photo: studentData.profilePhoto,
        },
        stats: {
          leaveRequests,
          complaints,
          suggestions,
          approvedRequests
        }
      }
    });

  } catch (error) {
    console.error('Error fetching student dashboard data:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
