const express = require('express');
const router = express.Router();
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

router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/register-admin', registerAdmin);
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

