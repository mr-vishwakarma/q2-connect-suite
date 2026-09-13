/**
 * Centralized Portal Access Authorization Matrix & Utilities
 * Enforces strict boundaries between Super Admin, Admin, and Student portals.
 */

const PORTALS = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  STUDENT: 'STUDENT',
};

// Authoritative roles allowed for each portal
const PORTAL_ALLOWED_ROLES = {
  SUPER_ADMIN: ['super_admin'],
  ADMIN: ['admin', 'warden', 'staff', 'accountant'],
  STUDENT: ['student'],
};

/**
 * Normalizes input string to canonical portal enum
 * @param {string} portal
 * @returns {string|null}
 */
const normalizePortal = (portal) => {
  if (!portal) return null;
  const p = String(portal).toUpperCase().replace(/[-_ ]/g, '');
  if (p === 'SUPERADMIN' || p === 'SUPER_ADMIN') return PORTALS.SUPER_ADMIN;
  if (p === 'ADMIN' || p === 'HOSTELADMIN') return PORTALS.ADMIN;
  if (p === 'STUDENT' || p === 'RESIDENT') return PORTALS.STUDENT;
  return null;
};

/**
 * Validates if an authenticated user's actual database role is allowed to access the requested portal.
 * @param {Object} user - User document from database
 * @param {string} portal - The requested portal identifier
 * @returns {boolean}
 */
const isRoleAllowedForPortal = (user, portal) => {
  if (!user) return false;

  const normalizedPortal = normalizePortal(portal);
  if (!normalizedPortal) {
    // If no portal specified, refuse access to prevent ambiguous bypass
    return false;
  }

  const userRole = String(user.role || '').toLowerCase();
  const isSuperAdminUser = Boolean(
    user.isSuperAdmin === true || 
    userRole === 'super_admin' || 
    user.email === 'superadmin@q2connect.com'
  );

  switch (normalizedPortal) {
    case PORTALS.SUPER_ADMIN:
      // STRICT: Only users with super_admin flag/role may enter Super Admin portal
      return isSuperAdminUser;

    case PORTALS.ADMIN:
      // STRICT: Only admin, warden, staff, accountant.
      // Super Admin and Student are strictly FORBIDDEN from standard Admin login.
      if (isSuperAdminUser) return false;
      return PORTAL_ALLOWED_ROLES.ADMIN.includes(userRole);

    case PORTALS.STUDENT:
      // STRICT: Only resident students.
      // Super Admin and Admin are strictly FORBIDDEN from Student portal login.
      if (isSuperAdminUser) return false;
      return userRole === 'student';

    default:
      return false;
  }
};

module.exports = {
  PORTALS,
  PORTAL_ALLOWED_ROLES,
  normalizePortal,
  isRoleAllowedForPortal,
};
