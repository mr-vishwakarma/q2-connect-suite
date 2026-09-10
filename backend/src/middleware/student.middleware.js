/**
 * Middleware to restrict routes to student residents only.
 * Must be used AFTER the `protect` middleware.
 */
const studentOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'student') {
    return res.status(403).json({
      success: false,
      code: 'STUDENT_ROLE_REQUIRED',
      message: 'Access denied. Student resident role required.',
    });
  }
  next();
};

module.exports = { studentOnly };
