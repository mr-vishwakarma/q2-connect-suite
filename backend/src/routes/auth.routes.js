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
const User = require('../models/User');

router.post('/login', login);
router.post('/admin/login', adminLogin);
router.post('/register-admin', registerAdmin);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.get('/admin-exists', checkAdminExists);

router.get('/seed-admin', async (req, res) => {
  try {
    let admin = await User.findOne({ email: 'abhi1006@q2connect.com' });
    if (!admin) {
      admin = new User({
        name: 'Abhi',
        email: 'abhi1006@q2connect.com',
        username: 'Abhi1006',
        password: 'q2@6XZZ2U28',
        role: 'admin',
        hostels: ['Q2', 'Q2.0', 'Q2.1']
      });
      await admin.save();
      return res.json({ success: true, message: 'Admin user created successfully!' });
    }
    return res.json({ success: true, message: 'Admin user already exists.' });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Password Reset
router.post('/request-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

// Admin management
router.get('/admins', protect, adminOnly, getAdmins);
router.delete('/admins/:id', protect, adminOnly, deleteAdmin);

module.exports = router;

