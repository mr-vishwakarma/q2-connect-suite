const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');
const { adminOnly } = require('../middleware/admin.middleware');
const { upload, getUploadAuth, uploadFile, deleteFile } = require('../controllers/upload.controller');

router.use(protect);
router.get('/auth', getUploadAuth);
router.post('/file', upload.single('file'), uploadFile);
router.delete('/file/:fileId', adminOnly, deleteFile);

module.exports = router;
