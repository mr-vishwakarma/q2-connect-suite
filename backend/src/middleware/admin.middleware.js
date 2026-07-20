/**
 * Middleware to restrict routes to admin users only.
 * Must be used AFTER the `protect` middleware.
 */
const adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin role required.',
    });
  }
  next();
};

const adminOrWarden = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'warden')) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin or Warden role required.',
    });
  }
  next();
};

module.exports = { adminOnly, adminOrWarden };
