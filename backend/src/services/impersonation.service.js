const ImpersonationSession = require('../models/ImpersonationSession');
const User = require('../models/User');
const Organization = require('../models/Organization');
const jwt = require('jsonwebtoken');

const impersonationService = {
  async startImpersonationSession({ superAdminId, targetUserId, organizationId, reason }) {
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new Error('Target user not found');

    const org = await Organization.findById(organizationId);
    if (!org) throw new Error('Organization not found');

    const session = await ImpersonationSession.create({
      superAdminId,
      targetUserId,
      organizationId,
      targetUserName: targetUser.name,
      organizationName: org.name,
      reason,
      startedAt: new Date(),
      isActive: true,
    });

    // Generate impersonation token
    const impersonationToken = jwt.sign(
      {
        id: targetUser._id,
        isImpersonating: true,
        impersonatorId: superAdminId,
        sessionId: session._id,
        organizationId: org._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    return {
      session,
      token: impersonationToken,
      targetUser: targetUser.toJSON(),
      organization: org,
    };
  },

  async endImpersonationSession(sessionId) {
    const session = await ImpersonationSession.findByIdAndUpdate(
      sessionId,
      { isActive: false, endedAt: new Date() },
      { new: true }
    );
    return session;
  },
};

module.exports = { impersonationService };
