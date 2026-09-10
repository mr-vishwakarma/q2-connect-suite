const AuditLog = require('../models/AuditLog');

/**
 * Audit Logging Helper & Middleware
 * Immutable compliance and security action recorder.
 */
const logAuditAction = async ({
  req,
  action,
  entityType,
  entityId,
  oldValue = null,
  newValue = null,
  actor = null,
}) => {
  try {
    const actorUser = actor || req.user;
    if (!actorUser) return;

    await AuditLog.create({
      organizationId: req.tenant?.organizationId || actorUser.activeOrganizationId || null,
      hostelId: req.tenant?.hostelId || actorUser.activeHostelId || null,
      actorId: actorUser._id,
      actorName: actorUser.name || 'System User',
      actorEmail: actorUser.email || 'system@q2connect.com',
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      oldValue,
      newValue,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};

module.exports = { logAuditAction };
