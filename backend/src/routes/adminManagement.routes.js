const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const {
  getAdmins,
  requestCreateAdminOtp,
  verifyCreateAdmin,
  requestDeleteAdminOtp,
  verifyDeleteAdmin,
  resendAdminInvitation,
} = require('../controllers/adminManagement.controller');

// Rate limiter for sensitive OTP operations (max 10 requests per 15 minutes)
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many verification requests from this IP, please try again after 15 minutes.',
  },
});

// Protect all admin management routes with authentication, admin role, and tenant context resolution
router.use(protect, adminOnly, resolveTenantContext);

// Directory listing (tenant & hostel scoped)
router.get('/', getAdmins);

// Create Secondary Admin flow (OTP protected)
router.post('/request-create-otp', otpLimiter, requestCreateAdminOtp);
router.post('/verify-create', otpLimiter, verifyCreateAdmin);

// Delete/Deactivate Secondary Admin flow (OTP protected)
router.post('/request-delete-otp', otpLimiter, requestDeleteAdminOtp);
router.post('/verify-delete', otpLimiter, verifyDeleteAdmin);

// Resend invitation
router.post('/:id/resend-invite', otpLimiter, resendAdminInvitation);

module.exports = router;
