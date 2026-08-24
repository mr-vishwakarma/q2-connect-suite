const Organization = require('../models/Organization');
const Membership = require('../models/Membership');
const OrganizationFeature = require('../models/OrganizationFeature');
const Hostel = require('../models/Hostel');

/**
 * Tenant Context Resolution Middleware
 * Resolves the authenticated user's organization, active hostel branch, role, permissions, and feature flags.
 * Binds immutable req.tenant context to the request.
 */
const resolveTenantContext = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    // Super Admin bypass: Global administrative context
    if (req.user.isSuperAdmin || req.user.role === 'super_admin') {
      req.tenant = {
        isSuperAdmin: true,
        organizationId: req.headers['x-organization-id'] || req.user.activeOrganizationId || null,
        hostelId: req.headers['x-hostel-id'] || req.user.activeHostelId || null,
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      };
      return next();
    }

    // Find active organization membership
    const organizationId = req.headers['x-organization-id'] || req.user.activeOrganizationId;
    let membershipQuery = { userId: req.user._id, status: 'ACTIVE' };
    if (organizationId) {
      membershipQuery.organizationId = organizationId;
    }

    let membership = await Membership.findOne(membershipQuery).populate('organizationId');

    // If no membership found, check if a single membership exists for this user
    if (!membership) {
      membership = await Membership.findOne({ userId: req.user._id, status: 'ACTIVE' }).populate('organizationId');
    }

    if (!membership || !membership.organizationId) {
      // Fallback for legacy standalone records if not yet migrated
      req.tenant = {
        organizationId: null,
        hostelId: req.headers['x-hostel-id'] || null,
        role: req.user.role || 'student',
        permissions: [],
        features: {},
      };
      return next();
    }

    const organization = membership.organizationId;

    // Check organization active status
    if (organization.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        code: 'TENANT_SUSPENDED',
        message: 'This organization account has been suspended. Please contact platform administration.',
      });
    }

    // Resolve active hostel branch
    let activeHostelId = req.headers['x-hostel-id'] || req.user.activeHostelId;
    if (!activeHostelId && membership.hostelAccess && membership.hostelAccess.length > 0 && membership.hostelAccess[0] !== 'all') {
      activeHostelId = membership.hostelAccess[0];
    }

    // Load enabled features for organization
    const orgFeatures = await OrganizationFeature.find({ organizationId: organization._id, enabled: true });
    const featuresMap = {};
    orgFeatures.forEach((f) => {
      featuresMap[f.featureKey] = f.configuration || true;
    });

    // Attach immutable tenant context
    req.tenant = {
      isSuperAdmin: false,
      organizationId: organization._id,
      organizationName: organization.name,
      organizationSlug: organization.slug,
      hostelId: activeHostelId || null,
      role: membership.role,
      hostelAccess: membership.hostelAccess || ['all'],
      permissions: membership.permissions || [],
      features: featuresMap,
    };

    next();
  } catch (error) {
    console.error('Error resolving tenant context:', error);
    return res.status(500).json({ success: false, message: 'Tenant resolution error' });
  }
};

module.exports = { resolveTenantContext };
