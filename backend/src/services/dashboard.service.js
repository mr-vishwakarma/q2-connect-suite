const Student = require('../models/Student');
const Complaint = require('../models/Complaint');
const Suggestion = require('../models/Suggestion');

const dashboardService = {
  async getAdminDashboardStats(hostel) {
    const match = { isActive: { $ne: false } };
    const hostelMatch = hostel && hostel !== 'All' ? { hostel } : {};

    const [totalStudents, totalComplaints, totalSuggestions, recentComplaints, recentSuggestions] = await Promise.all([
      Student.countDocuments({ ...match, ...hostelMatch }),
      Complaint.countDocuments(hostelMatch),
      Suggestion.countDocuments(hostelMatch),
      Complaint.find(hostelMatch).sort({ createdAt: -1 }).limit(5).lean(),
      Suggestion.find(hostelMatch).sort({ createdAt: -1 }).limit(5).lean(),
    ]);

    return {
      stats: {
        totalStudents,
        totalComplaints,
        totalSuggestions,
      },
      recentComplaints,
      recentSuggestions,
    };
  },
};

module.exports = dashboardService;
