const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const {
  getPolicySettings,
  uploadPolicyDraft,
  updateDraft,
  publishPolicyVersion,
  getDocumentHistory,
  splitCombinedDocument,
  getApplicablePolicies,
  getStudentStatus,
  acceptPolicies,
  getStudentHistory,
  viewPolicyVersion,
} = require('../controllers/hostelPolicy.controller');

// Memory storage for PDF text extraction
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    if (isPdf) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF documents are supported for policy extraction.'), false);
    }
  },
});

// All policy routes require authentication and tenant resolution
router.use(protect, resolveTenantContext);

// --- Student Endpoints (Whitelisted from policy gate) ---
router.get('/applicable', getApplicablePolicies);
router.get('/student-status', getStudentStatus);
router.post('/accept', acceptPolicies);
router.get('/history', getStudentHistory);
router.get('/view/:versionId', viewPolicyVersion);

// --- Hostel Admin Management Endpoints ---
router.get('/settings', adminOnly, getPolicySettings);
router.post('/upload-draft', adminOnly, upload.single('file'), uploadPolicyDraft);
router.put('/draft/:versionId', adminOnly, updateDraft);
router.post('/publish/:versionId', adminOnly, publishPolicyVersion);
router.get('/history/:documentId', adminOnly, getDocumentHistory);
router.post('/split-combined', adminOnly, splitCombinedDocument);

module.exports = router;

