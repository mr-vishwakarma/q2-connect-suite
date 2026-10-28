const receiptService = require('../services/receipt.service');

// @desc    Get complete receipt snapshot by receipt number (Admin or Student)
// @route   GET /api/receipts/:receiptNo
// @access  Private (Admin or Student owner)
const getReceiptDetails = async (req, res) => {
  try {
    const { receiptNo } = req.params;
    const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;

    const receipt = await receiptService.getReceiptByNumber(receiptNo, {
      user: req.user,
      tenant: req.tenant,
      isSuperAdmin: req.tenant?.isSuperAdmin,
      baseUrl: origin,
    });

    return res.status(200).json({
      success: true,
      data: receipt,
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error fetching receipt',
    });
  }
};

// @desc    Public QR verification endpoint for a receipt number
// @route   GET /api/receipts/verify/:receiptNo
// @access  Public
const verifyReceiptPublic = async (req, res) => {
  try {
    const { receiptNo } = req.params;
    const verification = await receiptService.verifyReceipt(receiptNo);

    if (!verification.valid) {
      return res.status(404).json({
        success: false,
        message: verification.message || 'Receipt could not be verified',
      });
    }

    return res.status(200).json({
      success: true,
      data: verification,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Error verifying receipt',
    });
  }
};

module.exports = {
  getReceiptDetails,
  verifyReceiptPublic,
};
