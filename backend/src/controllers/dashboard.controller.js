const Student = require('../models/Student');
const Complaint = require('../models/Complaint');
const Suggestion = require('../models/Suggestion');
const Room = require('../models/Room');
const MenuRating = require('../models/MenuRating');

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

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    // Parallel queries
    const [
      totalStudents,
      lastMonthStudents,
      totalComplaints,
      lastMonthComplaints,
      totalSuggestions,
      lastMonthSuggestions,
      complaintsToday,
      complaintsThisWeek,
      complaintsThisMonth,
      recentComplaintsRaw,
      recentSuggestions,
      studentDistribution,
      complaintsAgg,
      roomAgg,
      activeStudentsAssigned,
      menuRatingAgg
    ] = await Promise.all([
      // Current counts
      Student.countDocuments(studentMatch),
      Student.countDocuments({ ...studentMatch, createdAt: { $lt: thirtyDaysAgo } }),
      Complaint.countDocuments(filter),
      Complaint.countDocuments({ ...filter, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),
      Suggestion.countDocuments(filter),
      Suggestion.countDocuments({ ...filter, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }),

      // Complaint timeframe counters
      Complaint.countDocuments({ ...filter, createdAt: { $gte: startOfToday } }),
      Complaint.countDocuments({ ...filter, createdAt: { $gte: sevenDaysAgo } }),
      Complaint.countDocuments({ ...filter, createdAt: { $gte: thirtyDaysAgo } }),

      // Recents
      Complaint.find(filter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select('_id title description status createdAt userId')
        .lean(),
      Suggestion.find(filter)
        .sort({ createdAt: -1 })
        .limit(3)
        .select('_id title description createdAt userId')
        .lean(),

      // Distribution by hostel
      Student.aggregate([
        { $match: studentMatch },
        { $group: { _id: '$hostel', value: { $sum: 1 } } },
        { $project: { name: '$_id', value: 1, _id: 0 } }
      ]),

      // 7-day daily complaints
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
      ]),

      // Room capacity vs occupied
      Room.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalCapacity: { $sum: '$capacity' },
            occupiedCount: { $sum: '$occupiedCount' },
            roomCount: { $sum: 1 }
          }
        }
      ]),

      // Active students with assigned room
      Student.countDocuments({ ...studentMatch, roomNo: { $exists: true, $ne: '', $ne: null } }),

      // Menu ratings summary
      MenuRating.aggregate([
        {
          $group: {
            _id: null,
            averageRating: { $avg: '$rating' },
            totalRatings: { $sum: 1 }
          }
        }
      ])
    ]);

    // Build complete 7-day timeline (ensuring no missing days in chart)
    const complaintsDataMap = new Map();
    complaintsAgg.forEach(item => complaintsDataMap.set(item.name, item.value));

    const complaintsData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const name = d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
      complaintsData.push({
        name,
        value: complaintsDataMap.get(name) || 0
      });
    }

    // Helper to compute percentage trend string
    const calcTrend = (current, previous) => {
      if (previous === 0) return current > 0 ? `+${current * 100}%` : '+0%';
      const diff = Math.round(((current - previous) / previous) * 100);
      return diff >= 0 ? `+${diff}%` : `${diff}%`;
    };

    // Calculate allocation distribution
    const roomStats = roomAgg[0] || { totalCapacity: 0, occupiedCount: 0, roomCount: 0 };
    const allocatedStudents = activeStudentsAssigned;
    const pendingStudents = Math.max(0, totalStudents - allocatedStudents);
    const vacantBeds = Math.max(0, roomStats.totalCapacity - roomStats.occupiedCount);

    // Enrich recent complaints with inferred category and isNew tag
    const recentComplaints = recentComplaintsRaw.map(c => {
      const text = `${c.title} ${c.description}`.toLowerCase();
      let category = 'Room';
      if (text.includes('water') || text.includes('tap') || text.includes('leak') || text.includes('pipe')) category = 'Water';
      else if (text.includes('wifi') || text.includes('internet') || text.includes('network')) category = 'WiFi';
      else if (text.includes('food') || text.includes('mess') || text.includes('meal')) category = 'Mess';
      else if (text.includes('light') || text.includes('fan') || text.includes('electric') || text.includes('ac')) category = 'Electrical';
      else if (text.includes('clean') || text.includes('washroom') || text.includes('toilet') || text.includes('dust')) category = 'Cleaning';

      const isNew = c.status === 'pending' || (Date.now() - new Date(c.createdAt).getTime()) < 48 * 60 * 60 * 1000;
      return {
        ...c,
        category,
        tag: category,
        isNew
      };
    });

    // Rating summary
    const ratingSummary = menuRatingAgg[0] ? {
      averageRating: Math.round(menuRatingAgg[0].averageRating * 10) / 10,
      totalRatings: menuRatingAgg[0].totalRatings
    } : {
      averageRating: 0,
      totalRatings: 0
    };

    return res.status(200).json({
      success: true,
      data: {
        stats: {
          totalStudents,
          totalComplaints,
          totalSuggestions,
          studentsTrend: calcTrend(totalStudents, lastMonthStudents),
          complaintsTrend: calcTrend(totalComplaints, lastMonthComplaints),
          suggestionsTrend: calcTrend(totalSuggestions, lastMonthSuggestions),
        },
        complaintsSummary: {
          today: complaintsToday,
          thisWeek: complaintsThisWeek,
          thisMonth: complaintsThisMonth
        },
        recentComplaints,
        recentSuggestions,
        complaintsData,
        studentDistribution,
        allocationDistribution: {
          total: totalStudents,
          allocated: allocatedStudents,
          pending: pendingStudents,
          vacant: vacantBeds,
          totalCapacity: roomStats.totalCapacity
        },
        ratingSummary
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
