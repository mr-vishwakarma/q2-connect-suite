const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const {
  login,
  adminLogin,
  registerAdmin,
  refreshToken,
  logout,
  getMe,
  checkAdminExists,
  getAdmins,
  deleteAdmin,
  requestPasswordReset,
  resetPassword,
} = require('../controllers/auth.controller');
const User = require('../models/User');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per `window` (here, per 15 minutes)
  message: { success: false, message: 'Too many login attempts from this IP, please try again after 15 minutes.' }
});

router.post('/login', authLimiter, login);
router.post('/admin/login', authLimiter, adminLogin);
router.post('/register-admin', authLimiter, registerAdmin);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.get('/admin-exists', checkAdminExists);

// Password Reset
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

// Admin management
router.get('/admins', protect, adminOnly, getAdmins);
router.delete('/admins/:id', protect, adminOnly, deleteAdmin);

module.exports = router;

