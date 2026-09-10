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

    let organization = membership ? membership.organizationId : null;

    // Resilient fallbacks if user membership record is not yet initialized
    if (!organization) {
      if (req.user.activeOrganizationId) {
        organization = await Organization.findById(req.user.activeOrganizationId);
      }
      if (!organization && (req.user.studentId || req.user.role === 'student')) {
        const studentDoc = await require('../models/Student').findOne({ userId: req.user._id });
        if (studentDoc && studentDoc.organizationId) {
          organization = await Organization.findById(studentDoc.organizationId);
        }
      }
      if (!organization) {
        organization = (await Organization.findOne({ slug: 'q2-hostels' })) || (await Organization.findOne({ status: 'ACTIVE' }));
      }
    }

    // Check organization active status
    if (organization && organization.status === 'SUSPENDED') {
      return res.status(403).json({
        success: false,
        code: 'TENANT_SUSPENDED',
        message: 'This organization account has been suspended. Please contact platform administration.',
      });
    }

    // Resolve active hostel branch
    let activeHostelId = req.headers['x-hostel-id'] || req.user.activeHostelId;
    if (!activeHostelId && membership && membership.hostelAccess && membership.hostelAccess.length > 0 && membership.hostelAccess[0] !== 'all') {
      activeHostelId = membership.hostelAccess[0];
    }

    // Load enabled features for organization
    const orgFeatures = organization ? await OrganizationFeature.find({ organizationId: organization._id, enabled: true }) : [];
    const featuresMap = {};
    orgFeatures.forEach((f) => {
      featuresMap[f.featureKey] = f.configuration || true;
    });

    // Attach immutable tenant context
    req.tenant = {
      isSuperAdmin: false,
      organizationId: organization ? organization._id : null,
      organizationName: organization ? organization.name : 'Standalone',
      organizationSlug: organization ? organization.slug : 'standalone',
      hostelId: activeHostelId || null,
      role: membership ? membership.role : (req.user.role || 'student'),
      hostelAccess: membership ? (membership.hostelAccess || ['all']) : (req.user.hostels || ['all']),
      permissions: membership ? (membership.permissions || []) : [],
      features: featuresMap,
    };

    next();
  } catch (error) {
    console.error('Error resolving tenant context:', error);
    return res.status(500).json({ success: false, message: 'Tenant resolution error' });
  }
};

module.exports = { resolveTenantContext };
