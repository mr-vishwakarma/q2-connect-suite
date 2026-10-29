/**
 * Middleware to restrict routes to student residents only.
 * Must be used AFTER the `protect` middleware.
 * Also enforces the Mandatory Policy Acceptance Gate.
 */
const { verifyPolicyGate } = require('./policyGate.middleware');

const studentOnly = async (req, res, next) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      code: 'STUDENT_ROLE_REQUIRED',
      message: 'Access denied. Student resident role required.',
    });
  }

  // Authoritatively enforce Mandatory Policy Gate
  return verifyPolicyGate(req, res, next);
};

module.exports = { studentOnly };
