const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getStudentPolicyStatus } = require('../services/hostelPolicy.service');

/**
 * Routes that students are permitted to access even when policy acceptance is pending.
 */
const WHITELISTED_PATH_PATTERNS = [
  /^\/api\/policies\/(applicable|accept|student-status|view|history)/i,
  /^\/api\/auth\//i,
  /^\/auth\//i,
  /^\/api\/health/i,
  /^\/health/i,
];

/**
 * Backend Policy Acceptance Gate Middleware
 * Strictly blocks authenticated student requests to protected features
 * until all applicable mandatory hostel policies are accepted.
 */
const verifyPolicyGate = async (req, res, next) => {
  try {
    const rawPath = req.originalUrl || req.path || '';
    const cleanPath = rawPath.split('?')[0];

    // 1. Check if path is whitelisted for the acceptance workflow
    const isWhitelisted = WHITELISTED_PATH_PATTERNS.some((pattern) => pattern.test(cleanPath));
    if (isWhitelisted) {
      return next();
    }

    let user = req.user;

    // 2. If req.user is not yet bound, resolve from Bearer token if present
    if (!user && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      const token = req.headers.authorization.split(' ')[1];
      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          user = await User.findById(decoded.id).select('-password -refreshTokens').lean();
          if (user) {
            req.user = user;
          }
        } catch (tokenErr) {
          // Token is invalid/expired; pass through to downstream auth middleware (protect) to return 401
          return next();
        }
      }
    }

    // 3. Unauthenticated requests are handled by protect middleware
    if (!user) {
      return next();
    }

    // 4. Only enforce for student residents (Admins, SuperAdmins, Wardens pass through)
    if (user.role !== 'student') {
      return next();
    }

    // 5. Authoritatively compute policy acceptance status
    const status = await getStudentPolicyStatus(user);

    // 6. If not ready or bypass, allow access (prevents trapping students on unconfigured hostels)
    if (status.notReadyBypass || status.allAccepted) {
      return next();
    }

    // 7. Deny access to protected student resource with machine-readable code
    return res.status(403).json({
      success: false,
      code: 'POLICY_ACCEPTANCE_REQUIRED',
      message: 'Mandatory hostel policy acceptance required before accessing student portal features.',
      pendingCategories: status.pendingCategories,
      readiness: status.readiness,
    });
  } catch (error) {
    console.error('[POLICY GATE ERROR]', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying hostel policy acceptance status.',
    });
  }
};

module.exports = {
  verifyPolicyGate,
  WHITELISTED_PATH_PATTERNS,
};
