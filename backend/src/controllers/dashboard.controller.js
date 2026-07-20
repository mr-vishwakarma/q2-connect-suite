const Student = require('../models/Student');
const Complaint = require('../models/Complaint');
const Suggestion = require('../models/Suggestion');

exports.getAdminDashboard = async (req, res) => {
  try {
    const { hostel } = req.query;
    
    // Filter by hostel if provided, else fetch for all hostels
    const filter = hostel && hostel !== 'All' ? { hostel } : {};

    // Parallel counts
    const [totalStudents, totalComplaints, totalSuggestions] = await Promise.all([
      Student.countDocuments(filter),
      Complaint.countDocuments(filter),
      Suggestion.countDocuments(filter)
    ]);

    // Fetch recent complaints and suggestions
    const [recentComplaints, recentSuggestions] = await Promise.all([
      Complaint.find(filter)
        .sort({ createdAt: -1 })
        .limit(3)
        .select('_id title description createdAt userId'),
      Suggestion.find(filter)
        .sort({ createdAt: -1 })
        .limit(3)
        .select('_id title description createdAt userId')
    ]);

    // Fetch complaints chart data (last 7 days grouped by date)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const complaintsDataQuery = await Complaint.find({
      ...filter,
      createdAt: { $gte: thirtyDaysAgo }
    }).sort({ createdAt: 1 }).select('createdAt');

    const chartDataMap = {};
    complaintsDataQuery.forEach(item => {
      const dateStr = new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      chartDataMap[dateStr] = (chartDataMap[dateStr] || 0) + 1;
    });

    const studentDistribution = await Student.aggregate([
      { $match: filter },
      { $group: { _id: '$hostel', value: { $sum: 1 } } },
      { $project: { name: '$_id', value: 1, _id: 0 } }
    ]);

    const complaintsData = Object.entries(chartDataMap)
      .slice(-7)
      .map(([name, value]) => ({ name, value }));

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
      Student.findOne({ userId }),
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
          room_no: studentData.roomNo,
          fees: studentData.fees,
          start_date: studentData.startDate,
          valid_date: studentData.validDate,
          hostel: studentData.hostel,
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
