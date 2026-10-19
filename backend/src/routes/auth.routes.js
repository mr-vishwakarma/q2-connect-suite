const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const {
  login,
  adminLogin,
  superAdminLogin,
  registerAdmin,
  refreshToken,
  logout,
  getMe,
  checkAdminExists,
  getAdmins,
  deleteAdmin,
  requestPasswordReset,
  resetPassword,
  googleLogin,
  registerStudent,
  completeGoogleSetup,
  requestGoogleRegistration,
} = require('../controllers/auth.controller');
const User = require('../models/User');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60, // Limit each IP to 60 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication attempts, please try again after 15 minutes.' }
});

const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Dedicated quota for password recovery
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many password reset requests. Please wait a few minutes before trying again.' }
});

router.post('/login', authLimiter, login);
router.post('/admin/login', authLimiter, adminLogin);
router.post('/super-admin/login', authLimiter, superAdminLogin);
router.post('/google', authLimiter, googleLogin);
router.post('/request-google-registration', authLimiter, requestGoogleRegistration);
router.post('/complete-google-setup', authLimiter, completeGoogleSetup);
router.post('/register', authLimiter, registerStudent);
router.post('/register-admin', authLimiter, registerAdmin);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.get('/admin-exists', checkAdminExists);

// Password Reset (dedicated rate limiter)
router.post('/password/forgot', passwordResetLimiter, requestPasswordReset);
router.post('/password/reset', passwordResetLimiter, resetPassword);
router.post('/request-reset', passwordResetLimiter, requestPasswordReset);
router.post('/reset-password', passwordResetLimiter, resetPassword);
router.post('/forgot-password', passwordResetLimiter, requestPasswordReset);

// Admin management (Tenant scoped & Protected)
router.get('/admins', protect, adminOnly, resolveTenantContext, getAdmins);
router.delete('/admins/:id', protect, adminOnly, resolveTenantContext, deleteAdmin);

module.exports = router;

