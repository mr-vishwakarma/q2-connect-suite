const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Fee = require('../models/Fee');
const Complaint = require('../models/Complaint');
const Suggestion = require('../models/Suggestion');
const MessRequest = require('../models/MessRequest');
const { getStats } = require('../middleware/requestLogger.middleware');

const getAnalytics = async (req, res) => {
  try {
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const orgFilter = {};
    const userFilter = {};

    // Enforce Tenant Scoping: Ordinary admins only see their own organization's metrics
    if (!isSuperAdmin) {
      orgFilter.organizationId = orgId || new mongoose.Types.ObjectId();
      userFilter.activeOrganizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      orgFilter.organizationId = orgId;
      userFilter.activeOrganizationId = orgId;
    }

    const [
      totalUsers,
      totalStudents,
      totalRooms,
      totalFees,
      totalComplaints,
      totalSuggestions,
      totalMessRequests
    ] = await Promise.all([
      User.countDocuments(userFilter),
      Student.countDocuments(orgFilter),
      Room.countDocuments(orgFilter),
      Fee.countDocuments(orgFilter),
      Complaint.countDocuments(orgFilter),
      Suggestion.countDocuments(orgFilter),
      MessRequest.countDocuments(orgFilter)
    ]);

    // Calculate active sessions (proxy based on users with refreshTokens)
    const activeSessions = await User.countDocuments({
      ...userFilter,
      refreshTokens: { $exists: true, $not: { $size: 0 } }
    });

    // Login Activity (simulated from user creation/login for this tenant)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentLogins = await User.aggregate([
      { $match: { ...userFilter, updatedAt: { $gte: thirtyDaysAgo } } },
      { 
        $group: { 
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } }, 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { _id: 1 } }
    ]);


    // Memory Usage
    const memory = process.memoryUsage();
    const memoryStats = {
      rss: Math.round(memory.rss / 1024 / 1024), // MB
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024), // MB
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024), // MB
      external: Math.round(memory.external / 1024 / 1024), // MB
    };

    const apiStats = getStats();

    return res.status(200).json({
      success: true,
      data: {
        database: {
          totalUsers,
          totalStudents,
          totalRooms,
          totalFees,
          totalComplaints,
          totalSuggestions,
          totalMessRequests
        },
        sessions: {
          active: activeSessions,
          recentLogins: recentLogins.map(r => ({ date: r._id, logins: r.count }))
        },
        system: {
          memory: memoryStats,
          uptime: apiStats.uptimeSeconds,
          platform: process.platform,
          nodeVersion: process.version
        },
        api: {
          totalRequests: apiStats.total,
          errors: apiStats.errors,
          byMethod: apiStats.byMethod,
          byEndpoint: Object.entries(apiStats.byEndpoint)
            .sort((a, b) => b[1] - a[1]) // Sort by count descending
            .slice(0, 10) // Top 10 endpoints
            .reduce((obj, [k, v]) => ({ ...obj, [k]: v }), {})
        }
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAnalytics };
