const Settings = require('../models/Settings');

// @desc    Get settings for a hostel
// @route   GET /api/settings/:hostel
const getSettings = async (req, res) => {
  try {
    const { hostel } = req.params;
    let settings = await Settings.findOne({ hostel });
    
    if (!settings) {
      // Create defaults if they don't exist
      settings = await Settings.create({ hostel, lateFeePerDay: 20, gracePeriodDays: 5 });
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
    const { lateFeePerDay, gracePeriodDays } = req.body;
    
    const settings = await Settings.findOneAndUpdate(
      { hostel },
      { lateFeePerDay, gracePeriodDays },
      { new: true, upsert: true, runValidators: true }
    );
    
    return res.status(200).json({ success: true, data: settings });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getSettings, updateSettings };
