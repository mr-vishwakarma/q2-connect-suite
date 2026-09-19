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
  description = null,
  result = 'SUCCESS',
  oldValue = null,
  newValue = null,
  actor = null,
}) => {
  try {
    const actorUser = actor || req.user;
    if (!actorUser) return;

    const actorName = actorUser.name || 'System Administrator';
    const actorRole = actorUser.role || (req.tenant?.isSuperAdmin ? 'SUPER_ADMIN' : 'USER');

    let readableDescription = description;
    if (!readableDescription) {
      const formattedAction = action.replace(/_/g, ' ').toLowerCase();
      readableDescription = `${actorName} (${actorRole}) performed ${formattedAction} on ${entityType}${entityId ? ` [${entityId}]` : ''}`;
    }

    await AuditLog.create({
      organizationId: req.tenant?.organizationId || actorUser.activeOrganizationId || null,
      hostelId: req.tenant?.hostelId || actorUser.activeHostelId || null,
      actorId: actorUser._id,
      actorName,
      actorEmail: actorUser.email || 'system@q2connect.com',
      actorRole,
      action,
      description: readableDescription,
      result,
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
