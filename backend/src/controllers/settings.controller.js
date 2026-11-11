const mongoose = require('mongoose');
const Settings = require('../models/Settings');
const Hostel = require('../models/Hostel');

const isValidObjectIdHex = (val) =>
  typeof val === 'string' ? /^[0-9a-fA-F]{24}$/.test(val.trim()) : val instanceof mongoose.Types.ObjectId;

/**
 * Resolves the target hostel branch safely inside multi-tenant boundaries.
 * Prioritizes the caller's own organization so multiple organizations can safely
 * share default branch codes like "MAIN", while still detecting cross-tenant probes.
 */
const resolveTargetHostel = async (hostelParam, orgId) => {
  if (!hostelParam) return null;
  const cleanParam = String(hostelParam).trim();
  if (!cleanParam) return null;

  // 1. Canonical ObjectId lookup
  if (isValidObjectIdHex(cleanParam)) {
    return Hostel.findOne({ _id: cleanParam, isDeleted: { $ne: true } });
  }

  const escaped = cleanParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const caseInsensitiveRegex = new RegExp(`^${escaped}$`, 'i');

  // 2. Scoped lookup inside caller's organization FIRST (prevents shared-code collisions across tenants)
  if (orgId) {
    const ownHostel = await Hostel.findOne({
      organizationId: orgId,
      isDeleted: { $ne: true },
      $or: [
        { code: cleanParam },
        { code: cleanParam.toUpperCase() },
        { code: caseInsensitiveRegex },
        { name: caseInsensitiveRegex },
      ],
    });
    if (ownHostel) return ownHostel;
  }

  // 3. Cross-platform fallback (handles SuperAdmin without active org context and preserves 403 on foreign probes)
  return Hostel.findOne({
    isDeleted: { $ne: true },
    $or: [{ code: cleanParam }, { code: cleanParam.toUpperCase() }],
  });
};

const hasBranchAccess = (req, targetHostelDoc, requestedParam) => {
  if (req.tenant?.isSuperAdmin) return true;
  const allowed = req.tenant?.hostelAccess;
  if (!allowed || allowed.includes('all')) return true;

  const targetIdStr = targetHostelDoc._id.toString();
  const canonicalUpper = String(targetHostelDoc.code || '').toUpperCase();
  const requestedUpper = String(requestedParam || '').toUpperCase();

  return allowed.some((entry) => {
    const entryStr = String(entry || '').trim();
    const entryUpper = entryStr.toUpperCase();
    return (
      entryStr === targetIdStr ||
      (canonicalUpper && entryUpper === canonicalUpper) ||
      (requestedUpper && entryUpper === requestedUpper)
    );
  });
};

// @desc    Get settings for a hostel
// @route   GET /api/settings/:hostel
const getSettings = async (req, res) => {
  try {
    const { hostel } = req.params;
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    if (!isSuperAdmin && !orgId) {
      return res.status(403).json({
        success: false,
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'Organization context is required to access hostel settings.',
      });
    }

    // 1. Resolve target hostel branch (scoped to caller's org first)
    const targetHostelDoc = await resolveTargetHostel(hostel, orgId);
    if (!targetHostelDoc) {
      return res.status(404).json({
        success: false,
        code: 'HOSTEL_NOT_FOUND',
        message: `Hostel branch '${hostel}' not found.`,
      });
    }

    // 2. Multi-tenant isolation: verify target branch belongs to user's organization
    if (!isSuperAdmin && orgId && targetHostelDoc.organizationId.toString() !== orgId.toString()) {
      return res.status(403).json({
        success: false,
        code: 'UNAUTHORIZED_HOSTEL_ACCESS',
        message: `You are not authorized to view settings for branch '${hostel}'.`,
      });
    }

    // 3. Branch-level authorization within the organization
    if (!hasBranchAccess(req, targetHostelDoc, hostel)) {
      return res.status(403).json({
        success: false,
        code: 'UNAUTHORIZED_HOSTEL_ACCESS',
        message: `You are not authorized to view settings for branch '${hostel}'.`,
      });
    }

    const canonicalCode = targetHostelDoc.code;
    const targetOrgId = targetHostelDoc.organizationId;
    const hostelDoc = targetHostelDoc;

    let settings = await Settings.findOne({
      organizationId: targetOrgId,
      $or: [{ hostel: canonicalCode }, { hostelId: targetHostelDoc._id }],
    });

    if (!settings && targetOrgId) {
      // Create defaults for this organization & hostel, drawing from hostelDoc.settings where available
      try {
        settings = await Settings.create({
          organizationId: targetOrgId,
          hostelId: targetHostelDoc._id,
          hostel: canonicalCode,
          lateFeePerDay: hostelDoc?.settings?.lateFeePerDay ?? 20,
          gracePeriodDays: hostelDoc?.settings?.gracePeriodDays ?? 5,
          monthlyRentDueDay: hostelDoc?.settings?.monthlyRentDueDay ?? 5,
          securityDeposit: hostelDoc?.settings?.securityDeposit ?? 5000,
          curfewTime: hostelDoc?.settings?.curfewTime ?? '21:30',
          weeklyLaundrySlots: hostelDoc?.settings?.laundrySlotsPerWeek ?? 2,
          laundrySlotsPerWeek: hostelDoc?.settings?.laundrySlotsPerWeek ?? 2,
        });
      } catch (dupErr) {
        if (dupErr.code === 11000) {
          settings = await Settings.findOne({ organizationId: targetOrgId, hostel: canonicalCode });
        } else {
          throw dupErr;
        }
      }
    } else if (settings) {
      let needsSave = false;
      if (!settings.hostelId && targetHostelDoc._id) {
        settings.hostelId = targetHostelDoc._id;
        needsSave = true;
      }
      if (settings.securityDeposit === undefined) {
        settings.securityDeposit = hostelDoc?.settings?.securityDeposit ?? 5000;
        needsSave = true;
      }
      if (!settings.curfewTime) {
        settings.curfewTime = hostelDoc?.settings?.curfewTime ?? '21:30';
        needsSave = true;
      }
      if (settings.weeklyLaundrySlots === undefined) {
        settings.weeklyLaundrySlots = hostelDoc?.settings?.laundrySlotsPerWeek ?? 2;
        settings.laundrySlotsPerWeek = settings.weeklyLaundrySlots;
        needsSave = true;
      }
      if (needsSave) {
        await settings.save();
      }
    }

    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update settings for a hostel
// @route   PUT /api/settings/:hostel
const updateSettings = async (req, res) => {
  try {
    const { hostel } = req.params;
    const {
      lateFeePerDay,
      gracePeriodDays,
      securityDeposit,
      curfewTime,
      weeklyLaundrySlots,
      laundrySlotsPerWeek,
      monthlyRentDueDay,
    } = req.body;
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    if (!isSuperAdmin && !orgId) {
      return res.status(403).json({
        success: false,
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'Organization context is required to update hostel settings.',
      });
    }

    // 1. Resolve target hostel branch (scoped to caller's org first)
    const targetHostelDoc = await resolveTargetHostel(hostel, orgId);
    if (!targetHostelDoc) {
      return res.status(404).json({
        success: false,
        code: 'HOSTEL_NOT_FOUND',
        message: `Hostel branch '${hostel}' not found.`,
      });
    }

    // 2. Multi-tenant isolation: verify target branch belongs to user's organization
    if (!isSuperAdmin && orgId && targetHostelDoc.organizationId.toString() !== orgId.toString()) {
      return res.status(403).json({
        success: false,
        code: 'UNAUTHORIZED_HOSTEL_ACCESS',
        message: `You are not authorized to modify configuration for branch '${hostel}'.`,
      });
    }

    // 3. Branch-level authorization within the organization
    if (!hasBranchAccess(req, targetHostelDoc, hostel)) {
      return res.status(403).json({
        success: false,
        code: 'UNAUTHORIZED_HOSTEL_ACCESS',
        message: `You are not authorized to modify configuration for branch '${hostel}'.`,
      });
    }

    // Input Validation
    const updateDoc = {};
    const hostelSettingsUpdate = {};

    if (gracePeriodDays !== undefined) {
      const parsedGrace = Number(gracePeriodDays);
      if (!Number.isInteger(parsedGrace) || parsedGrace < 0 || parsedGrace > 60) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_GRACE_PERIOD',
          message: 'Grace period must be an integer between 0 and 60 days.',
        });
      }
      updateDoc.gracePeriodDays = parsedGrace;
      hostelSettingsUpdate['settings.gracePeriodDays'] = parsedGrace;
    }

    if (lateFeePerDay !== undefined) {
      const parsedPenalty = Number(lateFeePerDay);
      if (isNaN(parsedPenalty) || parsedPenalty < 0 || parsedPenalty > 10000) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_LATE_FEE_PENALTY',
          message: 'Late fee penalty per day must be a non-negative monetary amount.',
        });
      }
      updateDoc.lateFeePerDay = parsedPenalty;
      hostelSettingsUpdate['settings.lateFeePerDay'] = parsedPenalty;
    }

    if (securityDeposit !== undefined) {
      const parsedDeposit = Number(securityDeposit);
      if (isNaN(parsedDeposit) || parsedDeposit < 0 || parsedDeposit > 500000) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_SECURITY_DEPOSIT',
          message: 'Security deposit must be a non-negative monetary amount.',
        });
      }
      updateDoc.securityDeposit = parsedDeposit;
      hostelSettingsUpdate['settings.securityDeposit'] = parsedDeposit;
    }

    if (curfewTime !== undefined) {
      if (typeof curfewTime !== 'string' || !curfewTime.trim()) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_CURFEW_TIME',
          message: 'Night curfew timing must be a valid time string.',
        });
      }
      const trimmedCurfew = curfewTime.trim();
      updateDoc.curfewTime = trimmedCurfew;
      hostelSettingsUpdate['settings.curfewTime'] = trimmedCurfew;
    }

    const laundryVal = weeklyLaundrySlots !== undefined ? weeklyLaundrySlots : laundrySlotsPerWeek;
    if (laundryVal !== undefined) {
      const parsedLaundry = Number(laundryVal);
      if (!Number.isInteger(parsedLaundry) || parsedLaundry < 0 || parsedLaundry > 50) {
        return res.status(400).json({
          success: false,
          code: 'INVALID_LAUNDRY_SLOTS',
          message: 'Weekly laundry slots must be an integer between 0 and 50.',
        });
      }
      updateDoc.weeklyLaundrySlots = parsedLaundry;
      updateDoc.laundrySlotsPerWeek = parsedLaundry;
      hostelSettingsUpdate['settings.laundrySlotsPerWeek'] = parsedLaundry;
    }

    if (monthlyRentDueDay !== undefined) {
      const parsedDueDay = Number(monthlyRentDueDay);
      if (Number.isInteger(parsedDueDay) && parsedDueDay >= 1 && parsedDueDay <= 31) {
        updateDoc.monthlyRentDueDay = parsedDueDay;
        hostelSettingsUpdate['settings.monthlyRentDueDay'] = parsedDueDay;
      }
    }

    const canonicalCode = targetHostelDoc.code;
    const targetOrgId = targetHostelDoc.organizationId || orgId;

    const filter = { hostel: canonicalCode };
    if (targetOrgId) filter.organizationId = targetOrgId;

    updateDoc.hostel = canonicalCode;
    updateDoc.hostelId = targetHostelDoc._id;
    if (targetOrgId) updateDoc.organizationId = targetOrgId;

    if (Object.keys(hostelSettingsUpdate).length > 0) {
      await Hostel.updateOne({ _id: targetHostelDoc._id }, { $set: hostelSettingsUpdate });
    }

    const settings = await Settings.findOneAndUpdate(
      filter,
      { $set: updateDoc },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getSettings, updateSettings };

