const imagekit = require('../config/imagekit');
const multer = require('multer');

// Use memory storage (file in buffer, not saved to disk)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WEBP images and PDFs are allowed'), false);
    }
  },
});

// @desc    Get ImageKit auth params (for client-side uploads)
// @route   GET /api/upload/auth
// @access  Private
const getUploadAuth = (req, res) => {
  try {
    const authParams = imagekit.getAuthenticationParameters();
    return res.status(200).json({ success: true, ...authParams });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload a file via server to ImageKit
// @route   POST /api/upload/file
// @access  Private
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const folder = req.body.folder || '/q2-connect/uploads';
    const fileName = req.body.fileName || `${Date.now()}_${req.file.originalname}`;

    if (process.env.IMAGEKIT_PUBLIC_KEY === 'dummy_public_key') {
      return res.status(200).json({
        success: true,
        url: 'https://ik.imagekit.io/dummy_id/mock_image.jpg',
        fileId: 'mock_file_id_' + Date.now(),
        name: fileName,
        size: req.file.size,
      });
    }

    const result = await imagekit.upload({
      file: req.file.buffer.toString('base64'),
      fileName,
      folder,
      useUniqueFileName: true,
    });

    return res.status(200).json({
      success: true,
      url: result.url,
      fileId: result.fileId,
      name: result.name,
      size: result.size,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a file from ImageKit
// @route   DELETE /api/upload/file/:fileId
// @access  Private (Admin)
const deleteFile = async (req, res) => {
  try {
    if (process.env.IMAGEKIT_PUBLIC_KEY === 'dummy_public_key') {
      return res.status(200).json({ success: true, message: 'Mock file deleted' });
    }
    await imagekit.deleteFile(req.params.fileId);
    return res.status(200).json({ success: true, message: 'File deleted from ImageKit' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { upload, getUploadAuth, uploadFile, deleteFile };
