const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const ImpersonationSession = require('../models/ImpersonationSession');

const securityCenterService = {
  async getSecurityOverview() {
    const now = new Date();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [lockedUsersCount, activeImpersonationsCount, privilegedEventsCount, recentSecurityEvents, lockedUsers] =
      await Promise.all([
        User.countDocuments({ lockUntil: { $gt: now } }),
        ImpersonationSession.countDocuments({ isActive: true }),
        AuditLog.countDocuments({
          createdAt: { $gte: twentyFourHoursAgo },
          action: {
            $in: [
              'SUSPEND_ORGANIZATION',
              'ACTIVATE_ORGANIZATION',
              'START_IMPERSONATION',
              'END_IMPERSONATION',
              'UPDATE_USER_ROLE',
              'DEACTIVATE_USER',
              'REVOKE_SESSIONS',
            ],
          },
        }),
        AuditLog.find({
          action: {
            $in: [
              'START_IMPERSONATION',
              'END_IMPERSONATION',
              'SUSPEND_ORGANIZATION',
              'ACTIVATE_ORGANIZATION',
              'UPDATE_USER_ROLE',
              'DEACTIVATE_USER',
              'UNLOCK_USER',
              'REVOKE_SESSIONS',
            ],
          },
        })
          .populate('organizationId', 'name slug')
          .sort({ createdAt: -1 })
          .limit(15)
          .lean(),
        User.find({ lockUntil: { $gt: now } })
          .select('name email username role failedLoginAttempts lockUntil activeOrganizationId')
          .populate('activeOrganizationId', 'name slug')
          .limit(20)
          .lean(),
      ]);

    const activeSuperAdminsCount = await User.countDocuments({
      role: { $in: ['SUPER_ADMIN', 'super_admin'] },
      isActive: true,
    });

    return {
      metrics: {
        lockedAccounts: lockedUsersCount,
        lockedAccountsCount: lockedUsersCount,
        highRiskUsersCount: lockedUsersCount,
        activeImpersonations: activeImpersonationsCount,
        privilegedActions24h: privilegedEventsCount,
        recentCriticalEventsCount: privilegedEventsCount,
        activeSuperAdminsCount,
        securityPostureStatus: lockedUsersCount > 5 ? 'ELEVATED_RISK' : 'NORMAL',
      },
      lockedUsers,
      recentSecurityEvents: recentSecurityEvents.map((evt) => ({
        id: evt._id,
        action: evt.action,
        actorName: evt.actorName || 'Super Admin',
        actorEmail: evt.actorEmail,
        organizationName: evt.organizationId?.name || 'Platform-Wide',
        entityType: evt.entityType,
        ipAddress: evt.ipAddress,
        createdAt: evt.createdAt,
      })),
    };
  },

  async unlockUser(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error('User not found');

    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();

    return user.toJSON();
  },
};

module.exports = { securityCenterService };
