const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { protect } = require('../middleware/auth.middleware');
const { resolveTenantContext } = require('../middleware/tenant.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const {
  upload,
  authorizeUpload,
  confirmUpload,
  getUploadAuth,
  uploadFile,
  deleteFile,
} = require('../controllers/upload.controller');

// Rate limiter for upload authorization initiation to protect against signature spam
const uploadAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Max 100 upload authorization requests per 15 minutes per IP
  message: {
    success: false,
    message: 'Too many upload authorization requests. Please wait a few minutes before trying again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// All upload routes require authentication and tenant context
router.use(protect);
router.use(resolveTenantContext);

// Direct ImageKit Upload Lifecycle Endpoints
router.post('/authorize', uploadAuthLimiter, authorizeUpload);
router.post('/confirm', confirmUpload);

// Backward Compatible Endpoints
router.get('/auth', uploadAuthLimiter, getUploadAuth);
router.post('/file', upload.single('file'), uploadFile);
router.delete('/file/:fileId', adminOnly, deleteFile);

module.exports = router;
