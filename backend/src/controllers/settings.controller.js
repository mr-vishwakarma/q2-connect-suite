const Settings = require('../models/Settings');
const Hostel = require('../models/Hostel');

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

    const filter = { hostel };
    if (orgId) filter.organizationId = orgId;

    let settings = await Settings.findOne(filter);
    
    if (!settings && orgId) {
      const hostelDoc = await Hostel.findOne({ organizationId: orgId, code: hostel });
      // Create defaults for this organization & hostel
      settings = await Settings.create({
        organizationId: orgId,
        hostelId: hostelDoc?._id || null,
        hostel,
        lateFeePerDay: 20,
        gracePeriodDays: 5,
        monthlyRentDueDay: 5,
      });
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
    const { lateFeePerDay, gracePeriodDays, monthlyRentDueDay } = req.body;
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    if (!isSuperAdmin && !orgId) {
      return res.status(403).json({
        success: false,
        code: 'TENANT_CONTEXT_REQUIRED',
        message: 'Organization context is required to update hostel settings.',
      });
    }

    const filter = { hostel };
    if (orgId) filter.organizationId = orgId;

    const hostelDoc = orgId ? await Hostel.findOne({ organizationId: orgId, code: hostel }) : null;

    const updateDoc = {};
    if (lateFeePerDay !== undefined) updateDoc.lateFeePerDay = lateFeePerDay;
    if (gracePeriodDays !== undefined) updateDoc.gracePeriodDays = gracePeriodDays;
    if (monthlyRentDueDay !== undefined) updateDoc.monthlyRentDueDay = Number(monthlyRentDueDay);
    if (hostelDoc) updateDoc.hostelId = hostelDoc._id;
    if (orgId) updateDoc.organizationId = orgId;

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

