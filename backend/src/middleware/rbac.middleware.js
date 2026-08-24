/**
 * Role-Based Access Control (RBAC) Middlewares
 */

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || (!req.user.isSuperAdmin && req.user.role !== 'super_admin')) {
    return res.status(403).json({
      success: false,
      code: 'SUPER_ADMIN_REQUIRED',
      message: 'Access restricted to Super Administrators only',
    });
  }
  next();
};

const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (req.user.isSuperAdmin || req.user.role === 'super_admin') {
      return next();
    }

    const currentRole = req.tenant?.role || req.user.role;
    if (!allowedRoles.includes(currentRole)) {
      return res.status(403).json({
        success: false,
        code: 'INSUFFICIENT_PERMISSIONS',
        message: `Role ${currentRole} is not authorized to access this resource`,
      });
    }

    next();
  };
};

const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (req.user.isSuperAdmin || req.user.role === 'super_admin') {
      return next();
    }

    const userPermissions = req.tenant?.permissions || [];
    const hasAll = requiredPermissions.every(
      (perm) => userPermissions.includes(perm) || userPermissions.includes('*')
    );

    // Fallback: If user is admin/owner, grant operational permissions
    if (['ORGANIZATION_OWNER', 'HOSTEL_ADMIN', 'admin'].includes(req.tenant?.role || req.user.role)) {
      return next();
    }

    if (!hasAll) {
      return res.status(403).json({
        success: false,
        code: 'PERMISSION_DENIED',
        message: `Missing required permission(s): ${requiredPermissions.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = {
  requireSuperAdmin,
  requireRole,
  requirePermission,
};
