const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth.middleware');
const { requireSuperAdmin } = require('../middleware/rbac.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const {
  createVoucher,
  getVouchers,
  getVoucherById,
  updateVoucherStatus,
  getRedemptionsReport,
  applyVoucher,
  redeemVoucherZeroPayable,
  reserveVoucherPartial,
  verifyVoucherPartial,
} = require('../controllers/voucher.controller');

// Anti-brute-force rate limiter for PIN and voucher code validation
const voucherValidateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    message: 'Too many voucher validation attempts, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for redemption mutations
const voucherRedeemLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many redemption requests, please try again shortly.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ============================================================
// 1. Super Admin Routes (Strictly Super Admin Only)
// ============================================================
const superAdminRouter = express.Router();
superAdminRouter.use(protect, requireSuperAdmin);

superAdminRouter.post('/', createVoucher);
superAdminRouter.get('/', getVouchers);
superAdminRouter.get('/reports/redemptions', getRedemptionsReport);
superAdminRouter.get('/:id', getVoucherById);
superAdminRouter.patch('/:id/status', updateVoucherStatus);

// ============================================================
// 2. Organization Admin Checkout Routes (Tenant Scoped)
// ============================================================
const checkoutRouter = express.Router();
checkoutRouter.use(protect, resolveTenantContext);

checkoutRouter.post('/apply', voucherValidateLimiter, applyVoucher);
checkoutRouter.post('/redeem-zero-payable', voucherRedeemLimiter, redeemVoucherZeroPayable);
checkoutRouter.post('/reserve-partial', voucherRedeemLimiter, reserveVoucherPartial);
checkoutRouter.post('/verify-partial', voucherRedeemLimiter, verifyVoucherPartial);

module.exports = {
  superAdminVoucherRoutes: superAdminRouter,
  checkoutVoucherRoutes: checkoutRouter,
};
