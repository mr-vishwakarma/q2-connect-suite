const User = require('../models/User');
const Membership = require('../models/Membership');
const Organization = require('../models/Organization');

const userService = {
  async getAllUsers(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};

    if (query.search) {
      const searchRegex = { $regex: query.search.trim(), $options: 'i' };
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { username: searchRegex },
      ];
    }

    if (query.role && query.role !== 'all') {
      filter.role = query.role;
    }

    if (query.status && query.status !== 'all') {
      filter.isActive = query.status === 'active';
    }

    if (query.organizationId && query.organizationId !== 'all') {
      filter.activeOrganizationId = query.organizationId;
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -refreshTokens')
        .populate('activeOrganizationId', 'name slug')
        .populate('activeHostelId', 'name code')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Enhance users with membership roles
    const userIds = users.map((u) => u._id);
    const memberships = await Membership.find({ userId: { $in: userIds } })
      .populate('organizationId', 'name slug')
      .lean();

    const membershipMap = new Map();
    memberships.forEach((m) => {
      const uId = String(m.userId);
      if (!membershipMap.has(uId)) {
        membershipMap.set(uId, []);
      }
      membershipMap.get(uId).push({
        organizationId: m.organizationId?._id,
        organizationName: m.organizationId?.name,
        role: m.role,
        status: m.status,
      });
    });

    const enrichedUsers = users.map((u) => ({
      ...u,
      memberships: membershipMap.get(String(u._id)) || [],
    }));

    return {
      users: enrichedUsers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getUserById(id) {
    const user = await User.findById(id)
      .select('-password -refreshTokens')
      .populate('activeOrganizationId', 'name slug status')
      .populate('activeHostelId', 'name code');

    if (!user) throw new Error('User not found');

    const memberships = await Membership.find({ userId: id })
      .populate('organizationId', 'name slug status')
      .lean();

    return {
      ...user.toObject(),
      memberships,
    };
  },

  async updateUserStatus(id, isActive) {
    const user = await User.findById(id);
    if (!user) throw new Error('User not found');

    // Protect Super Admin accounts from accidental self-deactivation
    if (user.isSuperAdmin && !isActive) {
      const activeSuperAdmins = await User.countDocuments({ isSuperAdmin: true, isActive: true });
      if (activeSuperAdmins <= 1) {
        throw new Error('Cannot deactivate the last active Super Administrator');
      }
    }

    user.isActive = Boolean(isActive);
    if (!isActive) {
      user.refreshTokens = []; // Revoke active sessions on deactivation
    }
    await user.save();

    return user.toJSON();
  },

  async revokeUserSessions(id) {
    const user = await User.findById(id);
    if (!user) throw new Error('User not found');

    user.refreshTokens = [];
    await user.save();

    return { success: true, message: 'All active sessions have been revoked' };
  },

  async unlockUserAccount(id) {
    const user = await User.findById(id);
    if (!user) throw new Error('User not found');

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    return user.toJSON();
  },

  async updateUserRole(id, newRole) {
    const validRoles = ['super_admin', 'admin', 'student', 'warden', 'accountant', 'staff'];
    if (!validRoles.includes(newRole)) {
      throw new Error(`Invalid role '${newRole}'. Allowed roles: ${validRoles.join(', ')}`);
    }

    const user = await User.findById(id);
    if (!user) throw new Error('User not found');

    const oldRole = user.role;
    user.role = newRole;
    user.isSuperAdmin = newRole === 'super_admin';
    await user.save();

    return {
      user: user.toJSON(),
      oldRole,
      newRole,
    };
  },
};

module.exports = { userService };
