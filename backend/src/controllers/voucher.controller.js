/**
 * Voucher Controller (Phase H - Super Admin Subscription Vouchers)
 * 
 * Provides:
 * 1. Super Admin Voucher Management (Create, List, Detail, Status change, Redemptions report)
 * 2. Organization Admin Checkout Integration:
 *    - Apply / Preview voucher discount (preview without consumption)
 *    - Zero-payable atomic redemption & subscription activation (₹0 payable, no fake Razorpay)
 *    - Partial-discount checkout reservation and payment verification
 * 3. Security, anti-brute-force rate limiting, and immutable audit trails
 */

const mongoose = require('mongoose');
const Voucher = require('../models/Voucher');
const VoucherRedemption = require('../models/VoucherRedemption');
const VoucherReservation = require('../models/VoucherReservation');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Organization = require('../models/Organization');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const InvoiceSequence = require('../models/InvoiceSequence');
const LedgerEntry = require('../models/LedgerEntry');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const User = require('../models/User');
const {
  createOrder,
  verifyPaymentSignature,
  getPublicKey,
} = require('../config/razorpay');
const {
  generateVoucherCode,
  normalizeVoucherCode,
  isValidVoucherCodeFormat,
  generateVoucherPin,
  normalizeVoucherPin,
  isValidVoucherPinFormat,
  computeVoucherLookupDigest,
  maskVoucherCode,
  generateVoucherReference,
  generatePinSalt,
  computePinVerifier,
  verifyPin,
} = require('../utils/voucherCrypto');

// Helper: Resolve Organization ID from tenant context
function resolveOrgId(req) {
  if (req.tenant?.isSuperAdmin) {
    return req.body.organizationId || req.query.organizationId || req.tenant.organizationId || null;
  }
  return req.tenant?.organizationId || req.user?.activeOrganizationId || null;
}

// Helper: Notify all Super Admins about a successful voucher redemption
async function notifySuperAdmins(redemptionData, io = null) {
  try {
    const superAdmins = await User.find({
      $or: [{ role: 'super_admin' }, { isSuperAdmin: true }],
      isActive: true,
    }).select('_id email name');

    if (!superAdmins || superAdmins.length === 0) return;

    const notifications = superAdmins.map((admin) => ({
      userId: admin._id,
      organizationId: redemptionData.organizationId,
      title: 'Subscription Activated Using Voucher',
      message: `Organization "${redemptionData.orgName}" activated ${redemptionData.planName} (${redemptionData.billingCycle}) using voucher ${redemptionData.voucherName} [${redemptionData.voucherReference}]. Original: ₹${redemptionData.originalAmount}, Discount: ₹${redemptionData.discountAmount}, Final Payable: ₹${redemptionData.finalPayable}.`,
      type: 'success',
    }));

    await Notification.insertMany(notifications, { ordered: false }).catch(() => {});

    if (io) {
      notifications.forEach((notif) => {
        io.to(notif.userId.toString()).emit('notification', notif);
      });
      io.emit('super-admin:voucher-redeemed', {
        voucherReference: redemptionData.voucherReference,
        orgName: redemptionData.orgName,
        planName: redemptionData.planName,
        discountAmount: redemptionData.discountAmount,
        finalPayable: redemptionData.finalPayable,
        redeemedAt: new Date(),
      });
    }
  } catch (err) {
    console.error('[VoucherController:notifySuperAdmins] Notice: Super Admin notification delivery non-fatal error:', err.message);
  }
}

// Helper: Log audit event safely without secrets
async function logVoucherAudit({
  actor,
  action,
  entityId,
  organizationId = null,
  oldValue = null,
  newValue = null,
  result = 'SUCCESS',
  description = '',
  req = null,
}) {
  try {
    await AuditLog.create({
      organizationId,
      actorId: actor._id,
      actorName: actor.name || actor.username || 'Super Admin',
      actorEmail: actor.email,
      actorRole: actor.role || 'super_admin',
      action,
      entityType: 'Voucher',
      entityId: String(entityId || ''),
      oldValue,
      newValue,
      result,
      description,
      ipAddress: req?.ip || req?.headers?.['x-forwarded-for'],
      userAgent: req?.headers?.['user-agent'],
    });
  } catch (err) {
    console.error('[VoucherController:logVoucherAudit] AuditLog error:', err.message);
  }
}

// Helper: Authoritatively calculate price & discount
async function calculateDiscountForPlan({ voucher, planId, billingCycle, organizationId }) {
  const plan = await Plan.findById(planId);
  if (!plan || !plan.isActive) {
    return { error: 'Selected SaaS plan is inactive or does not exist' };
  }

  const isYearly = String(billingCycle || '').toUpperCase() === 'YEARLY';
  const originalAmount = isYearly ? plan.priceYearly : plan.priceMonthly;

  if (voucher.minSubscriptionAmountRupees && originalAmount < voucher.minSubscriptionAmountRupees) {
    return {
      error: `Subscription amount (₹${originalAmount}) does not meet minimum voucher requirement (₹${voucher.minSubscriptionAmountRupees})`,
    };
  }

  // Fixed discount: minimum of voucher discount and original amount
  const discountAmount = Math.min(voucher.discountAmountRupees, originalAmount);
  const finalPayable = Math.max(0, originalAmount - discountAmount);
  const isZeroPayable = finalPayable === 0;

  return {
    plan,
    isYearly,
    originalAmount,
    discountAmount,
    finalPayable,
    isZeroPayable,
  };
}

// Helper: Authoritatively validate voucher eligibility for an organization
async function validateVoucherEligibility({ voucher, pin, planId, billingCycle, organizationId }) {
  const now = new Date();

  // 1. Check temporary PIN lockout
  if (voucher.pinLockedUntil && now < voucher.pinLockedUntil) {
    return {
      valid: false,
      userMessage: 'Voucher could not be applied. Verify the details or contact support.',
      internalReason: 'Voucher is temporarily locked due to excessive failed PIN attempts',
    };
  }

  // 2. Validate PIN with constant-time comparison
  const isPinValid = verifyPin(pin, voucher.pinSalt, voucher.pinVerifier);
  if (!isPinValid) {
    voucher.failedPinAttempts = (voucher.failedPinAttempts || 0) + 1;
    if (voucher.failedPinAttempts >= 5) {
      voucher.pinLockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15-minute lockout
    }
    await voucher.save();
    return {
      valid: false,
      userMessage: 'Voucher could not be applied. Verify the details or contact support.',
      internalReason: 'Invalid PIN provided',
    };
  }

  // Reset failed PIN attempts upon success
  if (voucher.failedPinAttempts > 0) {
    voucher.failedPinAttempts = 0;
    voucher.pinLockedUntil = null;
    await voucher.save();
  }

  // 3. Status lifecycle & effective validity
  const effectiveStatus = voucher.getEffectiveStatus(now);
  if (effectiveStatus !== 'ACTIVE') {
    return {
      valid: false,
      userMessage: 'Voucher could not be applied. Verify the details or contact support.',
      internalReason: `Voucher is ${effectiveStatus.toLowerCase()}`,
    };
  }

  // 4. Valid from check
  if (voucher.validFrom && now < voucher.validFrom) {
    return {
      valid: false,
      userMessage: 'Voucher could not be applied. Verify the details or contact support.',
      internalReason: 'Voucher validity window has not started yet',
    };
  }

  // 5. Global limit check
  if (voucher.currentRedemptionCount >= voucher.globalRedemptionLimit) {
    return {
      valid: false,
      userMessage: 'Voucher could not be applied. Verify the details or contact support.',
      internalReason: 'Global redemption limit exhausted',
    };
  }

  // 6. Organization scope check
  if (voucher.scope === 'SPECIFIC_ORGANIZATION' || voucher.scope === 'SELECTED_ORGANIZATIONS') {
    const isOrgAllowed = voucher.restrictedToOrgIds.some(
      (id) => id.toString() === organizationId.toString()
    );
    if (!isOrgAllowed) {
      return {
        valid: false,
        userMessage: 'Voucher could not be applied. Verify the details or contact support.',
        internalReason: 'Organization is not eligible for this restricted voucher',
      };
    }
  }

  // 7. Max redemptions per organization check
  const existingOrgRedemptions = await VoucherRedemption.countDocuments({
    voucherId: voucher._id,
    organizationId,
    status: 'COMPLETED',
  });

  if (existingOrgRedemptions >= voucher.maxRedemptionsPerOrg) {
    return {
      valid: false,
      userMessage: 'Voucher could not be applied. Verify the details or contact support.',
      internalReason: `Organization has reached maximum permitted redemptions (${voucher.maxRedemptionsPerOrg}) for this voucher`,
    };
  }

  // 8. Eligible plans check
  if (voucher.eligiblePlans && voucher.eligiblePlans.length > 0) {
    const isPlanEligible = voucher.eligiblePlans.some(
      (id) => id.toString() === planId.toString()
    );
    if (!isPlanEligible) {
      return {
        valid: false,
        userMessage: 'Voucher could not be applied. Verify the details or contact support.',
        internalReason: 'Selected plan is not eligible for this voucher',
      };
    }
  }

  // 9. Eligible billing interval check
  const normCycle = String(billingCycle || '').toUpperCase();
  if (
    voucher.eligibleBillingIntervals &&
    voucher.eligibleBillingIntervals.length > 0 &&
    !voucher.eligibleBillingIntervals.includes(normCycle)
  ) {
    return {
      valid: false,
      userMessage: 'Voucher could not be applied. Verify the details or contact support.',
      internalReason: `Billing cycle ${normCycle} is not eligible for this voucher`,
    };
  }

  // 10. Subscription eligibility check
  if (voucher.subscriptionEligibility === 'NEW_SUBSCRIPTIONS_ONLY') {
    const existingSub = await Subscription.findOne({
      organizationId,
      status: { $in: ['ACTIVE', 'AUTHENTICATED'] },
    });
    if (existingSub) {
      return {
        valid: false,
        userMessage: 'Voucher could not be applied. Verify the details or contact support.',
        internalReason: 'Voucher is restricted to new subscribers only',
      };
    }
  }

  return { valid: true };
}

// ============================================================
// SUPER ADMIN ENDPOINTS
// ============================================================

/**
 * @desc    Create a new Voucher & return one-time credentials
 * @route   POST /api/super-admin/vouchers
 * @access  Private (Super Admin ONLY)
 */
const createVoucher = async (req, res) => {
  try {
    const {
      name,
      description,
      discountAmountRupees,
      eligiblePlans,
      eligibleBillingIntervals,
      validFrom,
      expiresAt,
      globalRedemptionLimit = 1,
      maxRedemptionsPerOrg = 1,
      scope = 'GLOBAL',
      restrictedToOrgIds,
      subscriptionEligibility = 'ALL',
      discountDurationCycles = 1,
      minSubscriptionAmountRupees = 0,
      internalNotes,
    } = req.body;

    // 1. Mandatory input validations
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Voucher name is required' });
    }

    const discount = Number(discountAmountRupees);
    if (isNaN(discount) || discount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount amount must be a positive number greater than 0',
      });
    }

    if (!expiresAt) {
      return res.status(400).json({ success: false, message: 'Voucher expiry date (expiresAt) is required' });
    }

    const expiryDate = new Date(expiresAt);
    const startDate = validFrom ? new Date(validFrom) : new Date();

    if (isNaN(expiryDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid expiry date format' });
    }
    if (expiryDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: 'Expiry date must be strictly after the validity start date',
      });
    }

    const globalLimit = parseInt(globalRedemptionLimit, 10);
    const perOrgLimit = parseInt(maxRedemptionsPerOrg, 10);
    if (isNaN(globalLimit) || globalLimit < 1) {
      return res.status(400).json({ success: false, message: 'Global redemption limit must be at least 1' });
    }
    if (isNaN(perOrgLimit) || perOrgLimit < 1) {
      return res.status(400).json({ success: false, message: 'Maximum redemptions per organization must be at least 1' });
    }

    if (scope !== 'GLOBAL' && (!restrictedToOrgIds || !Array.isArray(restrictedToOrgIds) || restrictedToOrgIds.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Restricted scope requires at least one designated organization ID',
      });
    }

    // 2. Cryptographic generation & collision retry loop
    let rawCode = '';
    let codeDigest = '';
    let reference = '';
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      attempts++;
      rawCode = generateVoucherCode();
      codeDigest = computeVoucherLookupDigest(rawCode);
      reference = generateVoucherReference();

      const existing = await Voucher.findOne({
        $or: [{ codeDigest }, { reference }],
      });
      if (!existing) {
        isUnique = true;
      }
    }

    if (!isUnique) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate unique voucher code. Please retry.',
      });
    }

    // 3. Cryptographic PIN generation and salted verifier
    const rawPin = generateVoucherPin();
    const pinSalt = generatePinSalt();
    const pinVerifier = computePinVerifier(rawPin, pinSalt);
    const codeMasked = maskVoucherCode(rawCode);

    // 4. Persist Voucher document
    const voucher = await Voucher.create({
      reference,
      name: name.trim(),
      description: description ? description.trim() : undefined,
      codeDigest,
      codeMasked,
      pinVerifier,
      pinSalt,
      discountAmountRupees: discount,
      eligiblePlans: Array.isArray(eligiblePlans) ? eligiblePlans : [],
      eligibleBillingIntervals: Array.isArray(eligibleBillingIntervals)
        ? eligibleBillingIntervals
        : [],
      validFrom: startDate,
      expiresAt: expiryDate,
      globalRedemptionLimit: globalLimit,
      currentRedemptionCount: 0,
      maxRedemptionsPerOrg: perOrgLimit,
      scope,
      restrictedToOrgIds: Array.isArray(restrictedToOrgIds) ? restrictedToOrgIds : [],
      subscriptionEligibility,
      discountDurationCycles: parseInt(discountDurationCycles, 10) || 1,
      minSubscriptionAmountRupees: Math.max(0, Number(minSubscriptionAmountRupees) || 0),
      status: 'ACTIVE',
      internalNotes: internalNotes ? internalNotes.trim() : undefined,
      createdBy: req.user._id,
    });

    // 5. Immutable Audit Log (NEVER logging raw code or raw PIN)
    await logVoucherAudit({
      actor: req.user,
      action: 'VOUCHER_CREATED',
      entityId: voucher._id,
      newValue: {
        reference: voucher.reference,
        name: voucher.name,
        codeMasked: voucher.codeMasked,
        discountAmountRupees: voucher.discountAmountRupees,
        globalRedemptionLimit: voucher.globalRedemptionLimit,
        maxRedemptionsPerOrg: voucher.maxRedemptionsPerOrg,
        expiresAt: voucher.expiresAt,
      },
      description: `Created voucher campaign "${voucher.name}" [${voucher.reference}] with ₹${voucher.discountAmountRupees} discount`,
      req,
    });

    // 6. Return response with ONE-TIME credentials
    return res.status(201).json({
      success: true,
      message: 'Voucher successfully created. Save credentials now; the PIN will never be displayed again.',
      data: {
        voucher: {
          _id: voucher._id,
          reference: voucher.reference,
          name: voucher.name,
          description: voucher.description,
          codeMasked: voucher.codeMasked,
          discountAmountRupees: voucher.discountAmountRupees,
          eligiblePlans: voucher.eligiblePlans,
          eligibleBillingIntervals: voucher.eligibleBillingIntervals,
          validFrom: voucher.validFrom,
          expiresAt: voucher.expiresAt,
          globalRedemptionLimit: voucher.globalRedemptionLimit,
          maxRedemptionsPerOrg: voucher.maxRedemptionsPerOrg,
          scope: voucher.scope,
          restrictedToOrgIds: voucher.restrictedToOrgIds,
          subscriptionEligibility: voucher.subscriptionEligibility,
          discountDurationCycles: voucher.discountDurationCycles,
          status: voucher.status,
          createdAt: voucher.createdAt,
        },
        credentials: {
          code: rawCode,
          pin: rawPin,
          warning: 'This is the only time the code and PIN are presented. Distribute securely to the intended organization.',
        },
      },
    });
  } catch (err) {
    console.error('[VoucherController:createVoucher] Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to create voucher',
    });
  }
};

/**
 * @desc    Get paginated vouchers list with filtering & stats
 * @route   GET /api/super-admin/vouchers
 * @access  Private (Super Admin ONLY)
 */
const getVouchers = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { status, scope, planId, search } = req.query;
    const filter = {};

    if (status) {
      filter.status = status.toUpperCase();
    }
    if (scope) {
      filter.scope = scope.toUpperCase();
    }
    if (planId && mongoose.Types.ObjectId.isValid(planId)) {
      filter.eligiblePlans = planId;
    }
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } },
        { codeMasked: { $regex: search, $options: 'i' } },
      ];
    }

    const [vouchers, total] = await Promise.all([
      Voucher.find(filter)
        .select('-pinVerifier -pinSalt -codeDigest')
        .populate('eligiblePlans', 'name code priceMonthly priceYearly')
        .populate('restrictedToOrgIds', 'name')
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Voucher.countDocuments(filter),
    ]);

    const now = new Date();
    const enriched = vouchers.map((v) => {
      let effectiveStatus = v.status;
      if (v.status !== 'REVOKED' && v.status !== 'SUSPENDED' && v.status !== 'DRAFT') {
        if (v.expiresAt && now > new Date(v.expiresAt)) {
          effectiveStatus = 'EXPIRED';
        } else if (v.currentRedemptionCount >= v.globalRedemptionLimit) {
          effectiveStatus = 'EXHAUSTED';
        }
      }
      return {
        ...v,
        effectiveStatus,
      };
    });

    return res.status(200).json({
      success: true,
      data: enriched,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[VoucherController:getVouchers] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve vouchers',
    });
  }
};

/**
 * @desc    Get detailed voucher by ID with recent redemptions
 * @route   GET /api/super-admin/vouchers/:id
 * @access  Private (Super Admin ONLY)
 */
const getVoucherById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid voucher ID' });
    }

    const voucher = await Voucher.findById(id)
      .select('-pinVerifier -pinSalt -codeDigest')
      .populate('eligiblePlans', 'name code priceMonthly priceYearly')
      .populate('restrictedToOrgIds', 'name')
      .populate('createdBy', 'name email')
      .lean();

    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Voucher not found' });
    }

    const redemptions = await VoucherRedemption.find({ voucherId: id })
      .populate('organizationId', 'name email')
      .populate('planId', 'name code')
      .populate('redeemedBy', 'name email')
      .sort({ redeemedAt: -1 })
      .limit(50)
      .lean();

    return res.status(200).json({
      success: true,
      data: {
        ...voucher,
        redemptions,
      },
    });
  } catch (err) {
    console.error('[VoucherController:getVoucherById] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve voucher details',
    });
  }
};

/**
 * @desc    Update voucher status (ACTIVATE, SUSPEND, REVOKE)
 * @route   PATCH /api/super-admin/vouchers/:id/status
 * @access  Private (Super Admin ONLY)
 */
const updateVoucherStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid voucher ID' });
    }

    const validTransitions = ['ACTIVE', 'SUSPENDED', 'REVOKED'];
    const targetStatus = String(status || '').toUpperCase();
    if (!validTransitions.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed values: ACTIVE, SUSPENDED, REVOKED',
      });
    }

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.status(404).json({ success: false, message: 'Voucher not found' });
    }

    const previousStatus = voucher.status;
    voucher.status = targetStatus;
    if (reason) {
      voucher.internalNotes = voucher.internalNotes
        ? `${voucher.internalNotes}\n[${new Date().toISOString()}] Status changed to ${targetStatus}: ${reason}`
        : `[${new Date().toISOString()}] Status changed to ${targetStatus}: ${reason}`;
    }
    await voucher.save();

    await logVoucherAudit({
      actor: req.user,
      action: 'VOUCHER_STATUS_CHANGED',
      entityId: voucher._id,
      oldValue: { status: previousStatus },
      newValue: { status: targetStatus, reason },
      description: `Voucher ${voucher.reference} status changed from ${previousStatus} to ${targetStatus}`,
      req,
    });

    return res.status(200).json({
      success: true,
      message: `Voucher status updated to ${targetStatus}`,
      data: {
        _id: voucher._id,
        reference: voucher.reference,
        status: voucher.status,
      },
    });
  } catch (err) {
    console.error('[VoucherController:updateVoucherStatus] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to update voucher status',
    });
  }
};

/**
 * @desc    Get paginated redemptions audit report
 * @route   GET /api/super-admin/vouchers/reports/redemptions
 * @access  Private (Super Admin ONLY)
 */
const getRedemptionsReport = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { voucherId, organizationId, status, fromDate, toDate } = req.query;
    const filter = {};

    if (voucherId && mongoose.Types.ObjectId.isValid(voucherId)) {
      filter.voucherId = voucherId;
    }
    if (organizationId && mongoose.Types.ObjectId.isValid(organizationId)) {
      filter.organizationId = organizationId;
    }
    if (status) {
      filter.status = status.toUpperCase();
    }
    if (fromDate || toDate) {
      filter.redeemedAt = {};
      if (fromDate) filter.redeemedAt.$gte = new Date(fromDate);
      if (toDate) filter.redeemedAt.$lte = new Date(toDate);
    }

    const [redemptions, total] = await Promise.all([
      VoucherRedemption.find(filter)
        .populate('voucherId', 'name reference codeMasked discountAmountRupees')
        .populate('organizationId', 'name email')
        .populate('planId', 'name code')
        .populate('invoiceId', 'invoiceNumber totalRupees status')
        .populate('redeemedBy', 'name email')
        .sort({ redeemedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VoucherRedemption.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: redemptions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[VoucherController:getRedemptionsReport] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate redemptions report',
    });
  }
};

// ============================================================
// HOSTEL ADMIN CHECKOUT ENDPOINTS
// ============================================================

/**
 * @desc    Apply & Preview Voucher (Preview discount WITHOUT consuming)
 * @route   POST /api/billing/vouchers/apply
 * @access  Private (Organization Admin / Super Admin — Students blocked)
 */
const applyVoucher = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Students cannot purchase SaaS subscriptions',
      });
    }

    const organizationId = resolveOrgId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization tenant context is required' });
    }

    const { code, pin, planId, billingCycle = 'MONTHLY' } = req.body;

    if (!code || !pin || !planId) {
      return res.status(400).json({
        success: false,
        message: 'Voucher code, secret PIN, and target planId are required',
      });
    }

    const normalizedCode = normalizeVoucherCode(code);
    const normalizedPin = normalizeVoucherPin(pin);

    if (!isValidVoucherCodeFormat(normalizedCode) || !isValidVoucherPinFormat(normalizedPin)) {
      return res.status(400).json({
        success: false,
        message: 'Voucher could not be applied. Verify the details or contact support.',
      });
    }

    // Lookup voucher by HMAC digest
    const codeDigest = computeVoucherLookupDigest(normalizedCode);
    const voucher = await Voucher.findOne({ codeDigest });

    if (!voucher) {
      return res.status(400).json({
        success: false,
        message: 'Voucher could not be applied. Verify the details or contact support.',
      });
    }

    // Validate eligibility & PIN with anti-brute-force rate limiting
    const eligibility = await validateVoucherEligibility({
      voucher,
      pin: normalizedPin,
      planId,
      billingCycle,
      organizationId,
    });

    if (!eligibility.valid) {
      return res.status(400).json({
        success: false,
        message: eligibility.userMessage,
      });
    }

    // Authoritative calculation of discount & payable
    const calculation = await calculateDiscountForPlan({
      voucher,
      planId,
      billingCycle,
      organizationId,
    });

    if (calculation.error) {
      return res.status(400).json({
        success: false,
        message: calculation.error,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Voucher preview successfully calculated',
      data: {
        voucherReference: voucher.reference,
        voucherName: voucher.name,
        codeMasked: voucher.codeMasked,
        originalAmount: calculation.originalAmount,
        discountAmount: calculation.discountAmount,
        finalPayable: calculation.finalPayable,
        isZeroPayable: calculation.isZeroPayable,
        billingCycle: calculation.isYearly ? 'YEARLY' : 'MONTHLY',
        planId: calculation.plan._id,
        planName: calculation.plan.name,
        discountDurationCycles: voucher.discountDurationCycles,
      },
    });
  } catch (err) {
    console.error('[VoucherController:applyVoucher] Error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to evaluate voucher preview',
    });
  }
};

/**
 * @desc    Atomic Zero-Payable Voucher Redemption & Instant SaaS Subscription Activation (₹0 Final Payable)
 * @route   POST /api/billing/vouchers/redeem-zero-payable
 * @access  Private (Organization Admin / Super Admin — Students blocked)
 */
const redeemVoucherZeroPayable = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Students cannot purchase SaaS subscriptions',
      });
    }

    const organizationId = resolveOrgId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization tenant context is required' });
    }

    const { code, pin, planId, billingCycle = 'MONTHLY', idempotencyKey } = req.body;

    if (!code || !pin || !planId) {
      return res.status(400).json({
        success: false,
        message: 'Voucher code, PIN, and planId are required',
      });
    }

    const safeIdempotencyKey = String(idempotencyKey || `zero_${organizationId}_${planId}_${Date.now()}`);

    // 1. Idempotency Guard: check if already redeemed under this key
    const existingRedemption = await VoucherRedemption.findOne({
      idempotencyKey: safeIdempotencyKey,
      status: 'COMPLETED',
    })
      .populate('invoiceId')
      .populate('subscriptionId');

    if (existingRedemption) {
      return res.status(200).json({
        success: true,
        idempotent: true,
        message: 'Voucher already successfully redeemed for this checkout',
        data: {
          subscriptionId: existingRedemption.subscriptionId?._id,
          invoiceNumber: existingRedemption.invoiceId?.invoiceNumber,
          originalAmount: existingRedemption.originalAmountRupees,
          discountAmount: existingRedemption.discountAmountRupees,
          finalPayable: existingRedemption.finalPayableRupees,
        },
      });
    }

    const normalizedCode = normalizeVoucherCode(code);
    const normalizedPin = normalizeVoucherPin(pin);

    if (!isValidVoucherCodeFormat(normalizedCode) || !isValidVoucherPinFormat(normalizedPin)) {
      return res.status(400).json({
        success: false,
        message: 'Voucher could not be applied. Verify the details or contact support.',
      });
    }

    const codeDigest = computeVoucherLookupDigest(normalizedCode);
    const voucher = await Voucher.findOne({ codeDigest });

    if (!voucher) {
      return res.status(400).json({
        success: false,
        message: 'Voucher could not be applied. Verify the details or contact support.',
      });
    }

    // 2. Authoritative Eligibility & PIN Verification
    const eligibility = await validateVoucherEligibility({
      voucher,
      pin: normalizedPin,
      planId,
      billingCycle,
      organizationId,
    });

    if (!eligibility.valid) {
      return res.status(400).json({
        success: false,
        message: eligibility.userMessage,
      });
    }

    // 3. Authoritative Pricing Calculation
    const calculation = await calculateDiscountForPlan({
      voucher,
      planId,
      billingCycle,
      organizationId,
    });

    if (calculation.error) {
      return res.status(400).json({ success: false, message: calculation.error });
    }

    if (!calculation.isZeroPayable) {
      return res.status(400).json({
        success: false,
        message: `Voucher does not yield a ₹0 payable amount (final payable: ₹${calculation.finalPayable}). Please continue through partial discount payment checkout.`,
      });
    }

    // 4. Atomic conditional increment to enforce global limit under concurrency
    const now = new Date();
    const updatedVoucher = await Voucher.findOneAndUpdate(
      {
        _id: voucher._id,
        status: 'ACTIVE',
        currentRedemptionCount: { $lt: voucher.globalRedemptionLimit },
        expiresAt: { $gte: now },
      },
      {
        $inc: { currentRedemptionCount: 1 },
      },
      { new: true }
    );

    if (!updatedVoucher) {
      return res.status(400).json({
        success: false,
        message: 'Voucher redemption limit has been reached or voucher expired during checkout.',
      });
    }

    // If global limit reached, set status to EXHAUSTED
    if (updatedVoucher.currentRedemptionCount >= updatedVoucher.globalRedemptionLimit) {
      await Voucher.findByIdAndUpdate(updatedVoucher._id, { status: 'EXHAUSTED' });
    }

    // 5. Activate SaaS Subscription
    const isYearly = calculation.isYearly;
    const durationCycles = updatedVoucher.discountDurationCycles || 1;
    const daysToAdd = (isYearly ? 365 : 30) * durationCycles;
    const periodEnd = new Date(now.getTime() + daysToAdd * 24 * 3600 * 1000);

    const subscription = await Subscription.findOneAndUpdate(
      { organizationId },
      {
        planId: calculation.plan._id,
        status: 'ACTIVE',
        billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
        amount: 0,
        amountPaise: 0,
        currency: 'INR',
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        totalCount: isYearly ? 5 : 12,
        paidCount: 1,
      },
      { upsert: true, new: true }
    );

    await Organization.findByIdAndUpdate(organizationId, {
      subscriptionId: subscription._id,
      status: 'ACTIVE',
    });

    // 6. Record Zero-Balance Payment
    const payment = await Payment.create({
      organizationId,
      billingDomain: 'SAAS',
      subscriptionId: subscription._id,
      planId: calculation.plan._id,
      amountPaise: 0,
      amountRupees: 0,
      discountRupees: calculation.discountAmount,
      currency: 'INR',
      provider: 'VOUCHER',
      paymentMethod: 'voucher_zero_balance',
      orderId: `order_vch_${updatedVoucher.reference}_${Date.now()}`,
      status: 'CAPTURED',
      capturedAt: now,
      idempotencyKey: safeIdempotencyKey,
      notes: `Voucher ${updatedVoucher.reference} full discount activation`,
    });

    // 7. Generate Sequential SaaS Invoice
    const invoiceNumber = await InvoiceSequence.getNextInvoiceNumber(organizationId);

    const invoice = await Invoice.create({
      organizationId,
      paymentId: payment._id,
      subscriptionId: subscription._id,
      invoiceNumber,
      invoiceType: 'SAAS_INVOICE',
      subtotalRupees: calculation.originalAmount,
      taxRupees: 0,
      discountRupees: calculation.discountAmount,
      originalAmountRupees: calculation.originalAmount,
      totalRupees: 0,
      currency: 'INR',
      status: 'PAID',
      issuedAt: now,
      paidAt: now,
      notes: `Settled via 100% voucher discount [${updatedVoucher.reference}]`,
    });

    payment.invoiceId = invoice._id;
    await payment.save();

    // 8. Immutable Financial Ledger Entry
    await LedgerEntry.create({
      organizationId,
      subscriptionId: subscription._id,
      paymentId: payment._id,
      invoiceId: invoice._id,
      amountPaise: 0,
      amountRupees: 0,
      currency: 'INR',
      type: 'CREDIT',
      source: 'SAAS_VOUCHER',
      externalReference: updatedVoucher.reference,
      description: `Zero-balance voucher settlement - ${calculation.plan.name} (${isYearly ? 'YEARLY' : 'MONTHLY'})`,
    });

    // 9. Persist VoucherRedemption Record
    const redemption = await VoucherRedemption.create({
      voucherId: updatedVoucher._id,
      organizationId,
      subscriptionId: subscription._id,
      paymentId: payment._id,
      invoiceId: invoice._id,
      planId: calculation.plan._id,
      billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
      originalAmountRupees: calculation.originalAmount,
      discountAmountRupees: calculation.discountAmount,
      finalPayableRupees: 0,
      isZeroPayable: true,
      status: 'COMPLETED',
      idempotencyKey: safeIdempotencyKey,
      redeemedBy: req.user._id,
      redeemedAt: now,
      discountCyclesGranted: durationCycles,
    });

    // Link back to payment and invoice
    payment.voucherRedemptionId = redemption._id;
    await payment.save();
    invoice.voucherRedemptionId = redemption._id;
    await invoice.save();

    // 10. Audit Log
    await logVoucherAudit({
      actor: req.user,
      action: 'VOUCHER_REDEEMED_ZERO_PAYABLE',
      entityId: updatedVoucher._id,
      organizationId,
      newValue: {
        voucherReference: updatedVoucher.reference,
        invoiceNumber,
        originalAmountRupees: calculation.originalAmount,
        discountAmountRupees: calculation.discountAmount,
        finalPayableRupees: 0,
        subscriptionPeriodEnd: periodEnd,
      },
      description: `Voucher ${updatedVoucher.reference} redeemed for zero-payable activation of ${calculation.plan.name}`,
      req,
    });

    // 11. Super Admin Notification
    const orgDoc = await Organization.findById(organizationId).select('name');
    await notifySuperAdmins(
      {
        organizationId,
        orgName: orgDoc?.name || 'Q2 Organization',
        planName: calculation.plan.name,
        billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
        voucherName: updatedVoucher.name,
        voucherReference: updatedVoucher.reference,
        originalAmount: calculation.originalAmount,
        discountAmount: calculation.discountAmount,
        finalPayable: 0,
      },
      req.io
    );

    return res.status(200).json({
      success: true,
      message: 'Subscription successfully activated using voucher!',
      data: {
        subscriptionId: subscription._id,
        invoiceNumber,
        planName: calculation.plan.name,
        billingCycle: isYearly ? 'YEARLY' : 'MONTHLY',
        originalAmount: calculation.originalAmount,
        discountAmount: calculation.discountAmount,
        finalPayable: 0,
        currentPeriodEnd: periodEnd,
      },
    });
  } catch (err) {
    console.error('[VoucherController:redeemVoucherZeroPayable] Error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Failed to process zero-payable voucher redemption',
    });
  }
};

/**
 * @desc    Reserve Voucher for Partial-Discount Checkout (final payable > 0)
 * @route   POST /api/billing/vouchers/reserve-partial
 * @access  Private (Organization Admin / Super Admin)
 */
const reserveVoucherPartial = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({ success: false, message: 'Access denied: Students cannot purchase SaaS subscriptions' });
    }

    const organizationId = resolveOrgId(req);
    if (!organizationId) {
      return res.status(400).json({ success: false, message: 'Organization tenant context is required' });
    }

    const { code, pin, planId, billingCycle = 'MONTHLY' } = req.body;

    if (!code || !pin || !planId) {
      return res.status(400).json({ success: false, message: 'Voucher code, PIN, and planId are required' });
    }

    const normalizedCode = normalizeVoucherCode(code);
    const normalizedPin = normalizeVoucherPin(pin);

    if (!isValidVoucherCodeFormat(normalizedCode) || !isValidVoucherPinFormat(normalizedPin)) {
      return res.status(400).json({ success: false, message: 'Voucher could not be applied. Verify the details or contact support.' });
    }

    const codeDigest = computeVoucherLookupDigest(normalizedCode);
    const voucher = await Voucher.findOne({ codeDigest });

    if (!voucher) {
      return res.status(400).json({ success: false, message: 'Voucher could not be applied. Verify the details or contact support.' });
    }

    const eligibility = await validateVoucherEligibility({
      voucher,
      pin: normalizedPin,
      planId,
      billingCycle,
      organizationId,
    });

    if (!eligibility.valid) {
      return res.status(400).json({ success: false, message: eligibility.userMessage });
    }

    const calculation = await calculateDiscountForPlan({
      voucher,
      planId,
      billingCycle,
      organizationId,
    });

    if (calculation.error) {
      return res.status(400).json({ success: false, message: calculation.error });
    }

    if (calculation.finalPayable <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This voucher yields a ₹0 payable amount. Use zero-payable redemption directly.',
      });
    }

    // Create short-lived reservation (15-minute TTL)
    const checkoutSessionId = `chk_sess_${organizationId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const reservation = await VoucherReservation.create({
      voucherId: voucher._id,
      organizationId,
      checkoutSessionId,
      planId: calculation.plan._id,
      billingCycle: calculation.isYearly ? 'YEARLY' : 'MONTHLY',
      originalAmountRupees: calculation.originalAmount,
      discountAmountRupees: calculation.discountAmount,
      finalPayableRupees: calculation.finalPayable,
      status: 'HELD',
      expiresAt,
      heldBy: req.user._id,
    });

    // Create Razorpay Order for the discounted final payable amount
    const amountPaise = Math.round(calculation.finalPayable * 100);
    const order = await createOrder({
      amountPaise,
      currency: 'INR',
      receipt: `rcpt_${checkoutSessionId}`,
      notes: {
        organizationId: organizationId.toString(),
        planId: calculation.plan._id.toString(),
        voucherId: voucher._id.toString(),
        checkoutSessionId,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        checkoutSessionId,
        orderId: order.id,
        keyId: getPublicKey(),
        amountPaise,
        amountRupees: calculation.finalPayable,
        originalAmount: calculation.originalAmount,
        discountAmount: calculation.discountAmount,
        currency: 'INR',
        planName: calculation.plan.name,
        billingCycle: calculation.isYearly ? 'YEARLY' : 'MONTHLY',
        voucherReference: voucher.reference,
      },
    });
  } catch (err) {
    console.error('[VoucherController:reserveVoucherPartial] Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to initialize partial discount checkout' });
  }
};

/**
 * @desc    Verify Payment & Finalize Partial-Discount Voucher Redemption
 * @route   POST /api/billing/vouchers/verify-partial
 * @access  Private (Organization Admin / Super Admin)
 */
const verifyVoucherPartial = async (req, res) => {
  try {
    if (req.user?.role === 'student') {
      return res.status(403).json({ success: false, message: 'Access denied: Students cannot purchase SaaS subscriptions' });
    }

    const organizationId = resolveOrgId(req);
    const {
      checkoutSessionId,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!checkoutSessionId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'checkoutSessionId, razorpay_order_id, razorpay_payment_id, and razorpay_signature are required',
      });
    }

    // 1. Verify Razorpay Payment Signature
    const isValidSignature = verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValidSignature) {
      return res.status(400).json({
        success: false,
        message: 'Payment verification failed: signature mismatch',
      });
    }

    // 2. Fetch reservation
    const reservation = await VoucherReservation.findOne({
      checkoutSessionId,
      organizationId,
      status: 'HELD',
    }).populate('voucherId planId');

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Active voucher reservation not found or expired',
      });
    }

    // 3. Atomically finalize voucher consumption
    const now = new Date();
    const updatedVoucher = await Voucher.findOneAndUpdate(
      {
        _id: reservation.voucherId._id,
        currentRedemptionCount: { $lt: reservation.voucherId.globalRedemptionLimit },
      },
      {
        $inc: { currentRedemptionCount: 1 },
      },
      { new: true }
    );

    if (!updatedVoucher) {
      return res.status(400).json({
        success: false,
        message: 'Voucher redemption limit was reached prior to payment confirmation',
      });
    }

    reservation.status = 'COMMITTED';
    await reservation.save();

    // 4. Activate SaaS Subscription
    const isYearly = reservation.billingCycle === 'YEARLY';
    const periodEnd = new Date(now.getTime() + (isYearly ? 365 : 30) * 24 * 3600 * 1000);

    const subscription = await Subscription.findOneAndUpdate(
      { organizationId },
      {
        planId: reservation.planId._id,
        status: 'ACTIVE',
        billingCycle: reservation.billingCycle,
        amount: reservation.finalPayableRupees,
        amountPaise: Math.round(reservation.finalPayableRupees * 100),
        currency: 'INR',
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        totalCount: isYearly ? 5 : 12,
        paidCount: 1,
      },
      { upsert: true, new: true }
    );

    await Organization.findByIdAndUpdate(organizationId, {
      subscriptionId: subscription._id,
      status: 'ACTIVE',
    });

    // 5. Create Payment record for SaaS transaction
    const payment = await Payment.create({
      organizationId,
      billingDomain: 'SAAS',
      subscriptionId: subscription._id,
      planId: reservation.planId._id,
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      amountPaise: Math.round(reservation.finalPayableRupees * 100),
      amountRupees: reservation.finalPayableRupees,
      discountRupees: reservation.discountAmountRupees,
      currency: 'INR',
      provider: 'RAZORPAY',
      status: 'CAPTURED',
      paymentMethod: 'subscription_discounted_online',
      capturedAt: now,
      notes: `Voucher ${updatedVoucher.reference} partial discount checkout`,
    });

    // 6. Generate sequential SaaS invoice
    const invoiceNumber = await InvoiceSequence.getNextInvoiceNumber(organizationId);

    const invoice = await Invoice.create({
      organizationId,
      paymentId: payment._id,
      subscriptionId: subscription._id,
      invoiceNumber,
      invoiceType: 'SAAS_INVOICE',
      subtotalRupees: reservation.originalAmountRupees,
      taxRupees: 0,
      discountRupees: reservation.discountAmountRupees,
      originalAmountRupees: reservation.originalAmountRupees,
      totalRupees: reservation.finalPayableRupees,
      currency: 'INR',
      status: 'PAID',
      issuedAt: now,
      paidAt: now,
      notes: `Applied voucher [${updatedVoucher.reference}] discount of ₹${reservation.discountAmountRupees}`,
    });

    payment.invoiceId = invoice._id;
    await payment.save();

    // 7. Ledger entry
    await LedgerEntry.create({
      organizationId,
      subscriptionId: subscription._id,
      paymentId: payment._id,
      invoiceId: invoice._id,
      amountPaise: payment.amountPaise,
      amountRupees: payment.amountRupees,
      currency: 'INR',
      type: 'CREDIT',
      source: 'SAAS_SUBSCRIPTION',
      externalReference: razorpay_payment_id,
      description: `Discounted SaaS Subscription - ${reservation.planId.name} (${reservation.billingCycle})`,
    });

    // 8. Record redemption
    const redemption = await VoucherRedemption.create({
      voucherId: updatedVoucher._id,
      organizationId,
      subscriptionId: subscription._id,
      paymentId: payment._id,
      invoiceId: invoice._id,
      planId: reservation.planId._id,
      billingCycle: reservation.billingCycle,
      originalAmountRupees: reservation.originalAmountRupees,
      discountAmountRupees: reservation.discountAmountRupees,
      finalPayableRupees: reservation.finalPayableRupees,
      isZeroPayable: false,
      status: 'COMPLETED',
      idempotencyKey: checkoutSessionId,
      redeemedBy: req.user._id,
      redeemedAt: now,
    });

    payment.voucherRedemptionId = redemption._id;
    await payment.save();
    invoice.voucherRedemptionId = redemption._id;
    await invoice.save();

    // 9. Audit Log & Notifications
    await logVoucherAudit({
      actor: req.user,
      action: 'VOUCHER_REDEEMED_PARTIAL',
      entityId: updatedVoucher._id,
      organizationId,
      newValue: {
        voucherReference: updatedVoucher.reference,
        invoiceNumber,
        originalAmountRupees: reservation.originalAmountRupees,
        discountAmountRupees: reservation.discountAmountRupees,
        finalPayableRupees: reservation.finalPayableRupees,
      },
      description: `Voucher ${updatedVoucher.reference} redeemed with partial payment of ₹${reservation.finalPayableRupees}`,
      req,
    });

    const orgDoc = await Organization.findById(organizationId).select('name');
    await notifySuperAdmins(
      {
        organizationId,
        orgName: orgDoc?.name || 'Q2 Organization',
        planName: reservation.planId.name,
        billingCycle: reservation.billingCycle,
        voucherName: updatedVoucher.name,
        voucherReference: updatedVoucher.reference,
        originalAmount: reservation.originalAmountRupees,
        discountAmount: reservation.discountAmountRupees,
        finalPayable: reservation.finalPayableRupees,
      },
      req.io
    );

    return res.status(200).json({
      success: true,
      message: 'Discounted subscription successfully activated!',
      data: {
        subscriptionId: subscription._id,
        invoiceNumber,
        planName: reservation.planId.name,
        originalAmount: reservation.originalAmountRupees,
        discountAmount: reservation.discountAmountRupees,
        finalPayable: reservation.finalPayableRupees,
        currentPeriodEnd: periodEnd,
      },
    });
  } catch (err) {
    console.error('[VoucherController:verifyVoucherPartial] Error:', err);
    return res.status(500).json({ success: false, message: err.message || 'Failed to verify partial discount checkout' });
  }
};

module.exports = {
  createVoucher,
  getVouchers,
  getVoucherById,
  updateVoucherStatus,
  getRedemptionsReport,
  applyVoucher,
  redeemVoucherZeroPayable,
  reserveVoucherPartial,
  verifyVoucherPartial,
};
