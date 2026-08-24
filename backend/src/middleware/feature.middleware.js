/**
 * Feature Flag Middleware
 * Evaluates whether a requested module/feature is enabled for the active tenant's plan.
 */
const requireFeature = (featureKey) => {
  return (req, res, next) => {
    // Super Admins bypass feature gating
    if (req.user?.isSuperAdmin || req.user?.role === 'super_admin') {
      return next();
    }

    // Default core features are always available
    const CORE_FEATURES = ['student_management', 'room_management', 'fee_management', 'reports'];
    if (CORE_FEATURES.includes(featureKey)) {
      return next();
    }

    const isEnabled = req.tenant?.features && req.tenant.features[featureKey] !== undefined;

    if (!isEnabled) {
      return res.status(403).json({
        success: false,
        code: 'FEATURE_NOT_ENABLED',
        message: `The feature '${featureKey}' is not enabled on your organization subscription plan.`,
      });
    }

    next();
  };
};

module.exports = { requireFeature };
