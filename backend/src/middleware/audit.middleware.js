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
}) => {
  try {
    if (!req.user) return;

    await AuditLog.create({
      organizationId: req.tenant?.organizationId || null,
      hostelId: req.tenant?.hostelId || null,
      actorId: req.user._id,
      actorName: req.user.name,
      actorEmail: req.user.email,
      action,
      entityType,
      entityId: entityId ? String(entityId) : null,
      oldValue,
      newValue,
      ipAddress: req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
};

module.exports = { logAuditAction };
