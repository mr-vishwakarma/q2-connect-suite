const Organization = require('../models/Organization');
const Membership = require('../models/Membership');
const OrganizationFeature = require('../models/OrganizationFeature');
const Hostel = require('../models/Hostel');

/**
 * Tenant Context Resolution Middleware
 * Resolves the authenticated user's organization, active hostel branch, role, permissions, and feature flags.
 * Binds authoritative req.tenant and req.organizationId to the request.
 */
const resolveTenantContext = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Super Admin bypass: Global administrative context with optional explicit tenant scoping
    if (req.user.isSuperAdmin || req.user.role === 'super_admin') {
      const explicitOrgId =
        req.headers['x-organization-id'] ||
        req.headers['x-organization-context'] ||
        req.query?.organizationId ||
        null;

      const explicitHostelId =
        req.headers['x-hostel-id'] ||
        req.headers['x-hostel-context'] ||
        req.query?.hostelId ||
        null;

      req.tenant = {
        isSuperAdmin: true,
        organizationId: explicitOrgId,
        hostelId: explicitHostelId,
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      };
      req.organizationId = explicitOrgId;
      return next();
    }

    // Normal Tenant Users: Server-side authoritative tenant resolution
    const requestedOrgId =
      req.headers['x-organization-id'] ||
      req.headers['x-organization-context'] ||
      req.query?.organizationId ||
      null;

    // Retrieve all active memberships for this user
    const userMemberships = await Membership.find({
      userId: req.user._id,
      status: 'ACTIVE',
    }).populate('organizationId');

    let membership = null;

    if (requestedOrgId) {
      // User explicitly requested an organization: verify they are an authorized ACTIVE member
      membership = userMemberships.find(
        (m) =>
          m.organizationId &&
          (m.organizationId._id.toString() === requestedOrgId.toString() ||
            m.organizationId.slug === requestedOrgId)
      );

      if (!membership) {
        // Untrusted tenant override attempt: DENY access to the foreign tenant
        return res.status(403).json({
          success: false,
          code: 'TENANT_ACCESS_DENIED',
          message: 'Access denied: You do not belong to the requested organization.',
        });
      }
    } else {
      // No explicit organization requested: resolve from user's active membership or activeOrganizationId
      if (req.user.activeOrganizationId) {
        membership = userMemberships.find(
          (m) =>
            m.organizationId &&
            m.organizationId._id.toString() === req.user.activeOrganizationId.toString()
        );
      }
      if (!membership && userMemberships.length > 0) {
        membership = userMemberships[0];
      }
    }

    let organization = membership ? membership.organizationId : null;

    // Resilient fallback for students or users whose membership is linked through Student record
    if (!organization) {
      if (req.user.studentId || req.user.role === 'student') {
        const Student = require('../models/Student');
        const studentDoc = await Student.findOne({ userId: req.user._id });
        if (studentDoc && studentDoc.organizationId) {
          organization = await Organization.findById(studentDoc.organizationId);
        }
      }
      if (!organization && req.user.activeOrganizationId) {
        organization = await Organization.findById(req.user.activeOrganizationId);
      }
    }

    // Notice: Lines 56-58 unsafe fallback to 'q2-hostels' / first active org is intentionally REMOVED.
    // Unassigned users will have organization = null and will fail closed on tenant-required operations.

    // Check organization active status
    if (organization && organization.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        code: 'TENANT_SUSPENDED',
        message: 'This organization account has been suspended. Please contact platform administration.',
      });
    }

    // Resolve active hostel branch
    let activeHostelId =
      req.headers['x-hostel-id'] ||
      req.headers['x-hostel-context'] ||
      req.user.activeHostelId ||
      null;

    if (!activeHostelId && membership && membership.hostelAccess && membership.hostelAccess.length > 0 && membership.hostelAccess[0] !== 'all') {
      activeHostelId = membership.hostelAccess[0];
    }

    // Load enabled features for organization
    const orgFeatures = organization ? await OrganizationFeature.find({ organizationId: organization._id, enabled: true }) : [];
    const featuresMap = {};
    orgFeatures.forEach((f) => {
      featuresMap[f.featureKey] = f.configuration || true;
    });

    const orgId = organization ? organization._id : null;

    // Attach immutable tenant context
    req.tenant = {
      isSuperAdmin: false,
      organizationId: orgId,
      organizationName: organization ? organization.name : 'Standalone',
      organizationSlug: organization ? organization.slug : 'standalone',
      hostelId: activeHostelId || null,
      role: membership ? membership.role : (req.user.role || 'student'),
      hostelAccess: membership ? (membership.hostelAccess || ['all']) : (req.user.hostels || ['all']),
      permissions: membership ? (membership.permissions || []) : [],
      features: featuresMap,
    };

    // Bind direct req.organizationId for uniform controller scoping
    req.organizationId = orgId;

    // Guard against body manipulation: overwrite any client-supplied organizationId with authoritative tenant
    if (req.body && typeof req.body === 'object' && req.body.organizationId !== undefined) {
      req.body.organizationId = orgId;
    }

    next();
  } catch (error) {
    console.error('Error resolving tenant context:', error);
    return res.status(500).json({ success: false, message: 'Tenant resolution error' });
  }
};

/**
 * Middleware: Enforces that the request has a valid tenant organization context.
 * Super Admins are permitted to proceed (unscoped or explicitly scoped).
 */
const requireTenantContext = (req, res, next) => {
  if (req.tenant?.isSuperAdmin) {
    return next();
  }
  if (!req.organizationId) {
    return res.status(403).json({
      success: false,
      code: 'TENANT_CONTEXT_REQUIRED',
      message: 'A valid organization tenant context is required for this operation.',
    });
  }
  next();
};

/**
 * Helper: Builds a tenant-scoped MongoDB filter safely.
 */
const buildTenantFilter = (req, baseQuery = {}) => {
  if (req.tenant?.isSuperAdmin && !req.organizationId) {
    return { ...baseQuery };
  }
  if (req.organizationId) {
    return { ...baseQuery, organizationId: req.organizationId };
  }
  // Failsafe: if ordinary user has no organizationId, match nothing
  return { ...baseQuery, _id: null };
};

/**
 * Helper: Asserts that an object belongs to the request's tenant organization.
 */
const assertTenantOwnership = (resource, req) => {
  if (req.tenant?.isSuperAdmin) return true;
  if (!resource || !resource.organizationId || !req.organizationId) return false;
  return resource.organizationId.toString() === req.organizationId.toString();
};

module.exports = {
  resolveTenantContext,
  requireTenantContext,
  buildTenantFilter,
  assertTenantOwnership,
};

