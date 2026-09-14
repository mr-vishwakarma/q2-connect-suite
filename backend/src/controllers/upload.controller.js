/**
 * Upload & Media Controller (Phase E — Memory-Safe & Direct ImageKit Architecture)
 * 
 * Features:
 * - Direct Client Upload Authorization (Signed ImageKit tokens + tenant-safe folder paths)
 * - Confirmation & MediaMetadata lifecycle tracking (INITIALIZED -> CONFIRMED -> REPLACED -> DELETED)
 * - Safe replacement semantics (new asset confirmed before old asset deleted)
 * - Memory-Safe disk streaming fallback for server-proxied uploads (Zero Buffer base64 conversion)
 * - Multi-tenant media namespace isolation
 * - Category-specific file size and MIME type enforcement
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');
const imagekit = require('../config/imagekit');
const MediaMetadata = require('../models/MediaMetadata');
const Student = require('../models/Student');
const User = require('../models/User');
const MessRequest = require('../models/MessRequest');
const FeePayment = require('../models/FeePayment');

// Category-Specific Constraints
const UPLOAD_CATEGORIES = {
  PROFILE_PHOTO: {
    maxSizeBytes: 3 * 1024 * 1024, // 3 MB
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    folderPrefix: 'profiles',
    ownerModel: 'Student',
  },
  MESS_LEAVE_DOCUMENT: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
    folderPrefix: 'mess-documents',
    ownerModel: 'MessRequest',
  },
  FEE_RECEIPT: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
    folderPrefix: 'receipts',
    ownerModel: 'FeePayment',
  },
  ORGANIZATION_LOGO: {
    maxSizeBytes: 2 * 1024 * 1024, // 2 MB
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.svg'],
    folderPrefix: 'logos',
    ownerModel: 'Organization',
  },
  ORGANIZATION_AADHAAR: {
    maxSizeBytes: 5 * 1024 * 1024, // 5 MB
    allowedMimes: ['image/jpeg', 'image/png', 'application/pdf'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.pdf'],
    folderPrefix: 'kyc',
    ownerModel: 'Organization',
  },
  GENERAL_MEDIA: {
    maxSizeBytes: 10 * 1024 * 1024, // 10 MB
    allowedMimes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.pdf'],
    folderPrefix: 'general',
    ownerModel: null,
  },
};

// Memory-Safe Disk Storage for server fallback (randomized filename in OS temp directory)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `q2_upload_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10 MB hard limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.svg'];
    const isAllowedMime = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';

    if (isAllowedMime && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, SVG images and PDF documents are allowed.'), false);
    }
  },
});

/**
 * Sanitizes and extracts safe file extension.
 */
function getSafeExtension(fileName = '') {
  const ext = path.extname(fileName).toLowerCase().trim();
  return ext.replace(/[^a-z0-9.]/g, '');
}

/**
 * ImageKit SDK compatibility helpers (handles @imagekit/nodejs v7+ and legacy versions)
 */
const getImageKitAuthParams = (token, expire) => {
  if (typeof imagekit?.helper?.getAuthenticationParameters === 'function') {
    return imagekit.helper.getAuthenticationParameters(token, expire);
  }
  if (typeof imagekit?.getAuthenticationParameters === 'function') {
    return imagekit.getAuthenticationParameters(token, expire);
  }
  const defaultExpire = expire || Math.floor(Date.now() / 1000) + 1800;
  const finalToken = token || crypto.randomUUID();
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY || 'dummy_private_key';
  const signature = crypto.createHmac('sha1', privateKey).update(finalToken + defaultExpire).digest('hex');
  return { token: finalToken, expire: defaultExpire, signature };
};

const deleteImageKitFile = async (fileId) => {
  if (typeof imagekit?.files?.delete === 'function') {
    return await imagekit.files.delete(fileId);
  }
  if (typeof imagekit?.deleteFile === 'function') {
    return await imagekit.deleteFile(fileId);
  }
};

const uploadToImageKit = async (options) => {
  if (typeof imagekit?.files?.upload === 'function') {
    return await imagekit.files.upload(options);
  }
  if (typeof imagekit?.upload === 'function') {
    return await imagekit.upload(options);
  }
  throw new Error('ImageKit upload method unavailable');
};

/**
 * Validates tenant ownership for upload context.
 */
function resolveUploadTenant(req) {
  if (req.tenant?.isSuperAdmin) {
    return req.body.organizationId || req.tenant.organizationId || null;
  }
  return req.tenant?.organizationId || req.user?.activeOrganizationId || null;
}

// @desc    Authorize a direct client-to-ImageKit upload
// @route   POST /api/upload/authorize
// @access  Private (Authenticated users)
const authorizeUpload = async (req, res) => {
  try {
    const { category = 'PROFILE_PHOTO', fileName, fileSize, mimeType, resourceId } = req.body;

    // 1. Resolve & Validate Tenant
    const organizationId = resolveUploadTenant(req);
    if (!organizationId && !req.tenant?.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Active organization tenant context is required' });
    }

    // 2. Validate Upload Category
    const config = UPLOAD_CATEGORIES[category];
    if (!config) {
      return res.status(400).json({
        success: false,
        message: `Invalid upload category. Allowed categories: ${Object.keys(UPLOAD_CATEGORIES).join(', ')}`,
      });
    }

    // 3. Validate File Size if provided
    if (fileSize && typeof fileSize === 'number') {
      if (fileSize > config.maxSizeBytes) {
        return res.status(400).json({
          success: false,
          message: `File size exceeds maximum allowed limit of ${(config.maxSizeBytes / 1024 / 1024).toFixed(1)} MB for category ${category}`,
        });
      }
    }

    // 4. Validate MIME Type if provided
    if (mimeType) {
      const normalizedMime = mimeType.toLowerCase().trim();
      if (!config.allowedMimes.includes(normalizedMime)) {
        return res.status(400).json({
          success: false,
          message: `MIME type '${mimeType}' is not allowed for category ${category}. Allowed: ${config.allowedMimes.join(', ')}`,
        });
      }
    }

    // 5. Validate File Extension
    const ext = getSafeExtension(fileName || 'file.jpg') || '.jpg';
    if (!config.allowedExtensions.includes(ext)) {
      return res.status(400).json({
        success: false,
        message: `File extension '${ext}' is not permitted for category ${category}. Allowed: ${config.allowedExtensions.join(', ')}`,
      });
    }

    // 6. Role & Ownership Permission Guard
    if (category === 'PROFILE_PHOTO' && req.user?.role === 'student') {
      // Students may only authorize photo uploads for their own profile
      if (resourceId && resourceId !== req.user._id.toString() && resourceId !== req.user.studentId?.toString()) {
        return res.status(403).json({
          success: false,
          message: 'Students are not authorized to upload profile photos for other residents',
        });
      }
    }

    // 7. Deterministic Tenant-Safe Folder Path
    const safeResourceId = (resourceId || req.user._id).toString().replace(/[^a-zA-Z0-9_-]/g, '');
    const tenantFolderPath = `/q2-connect/orgs/${organizationId}/${config.folderPrefix}/${safeResourceId}`;

    // 8. Unique Safe File Name
    const uniqueFileName = `${config.folderPrefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;

    // 9. Generate Signed ImageKit Authentication Parameters
    let authParams = { token: 'mock_token', expire: Math.floor(Date.now() / 1000) + 1800, signature: 'mock_sig' };
    try {
      authParams = getImageKitAuthParams();
    } catch (e) {
      console.warn('[Upload:Authorize] ImageKit SDK auth parameters notice:', e.message);
    }

    return res.status(200).json({
      success: true,
      uploadMode: 'DIRECT_IMAGEKIT',
      auth: {
        token: authParams.token,
        expire: authParams.expire,
        signature: authParams.signature,
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'dummy_public_key',
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/dummy_id',
        uploadEndpoint: 'https://upload.imagekit.io/api/v1/files/upload',
      },
      params: {
        fileName: uniqueFileName,
        folder: tenantFolderPath,
        tags: [`tenant:${organizationId}`, `cat:${category}`, `user:${req.user._id}`],
      },
      constraints: {
        maxSizeBytes: config.maxSizeBytes,
        allowedMimeTypes: config.allowedMimes,
      },
    });
  } catch (error) {
    console.error('[Upload:Authorize] Error generating direct upload authorization:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Confirm successful upload and update media reference atomically
// @route   POST /api/upload/confirm
// @access  Private (Authenticated users)
const confirmUpload = async (req, res) => {
  try {
    const {
      fileId,
      url,
      thumbnailUrl,
      fileName,
      size = 0,
      mimeType,
      category = 'PROFILE_PHOTO',
      resourceId,
    } = req.body;

    if (!fileId || !url) {
      return res.status(400).json({ success: false, message: 'fileId and url are required to confirm upload' });
    }

    // 1. Resolve & Validate Tenant
    const organizationId = resolveUploadTenant(req);
    if (!organizationId && !req.tenant?.isSuperAdmin) {
      return res.status(403).json({ success: false, message: 'Active organization context is required' });
    }

    const config = UPLOAD_CATEGORIES[category] || UPLOAD_CATEGORIES.GENERAL_MEDIA;

    // 2. Persist MediaMetadata
    const mediaDoc = await MediaMetadata.create({
      organizationId,
      hostelId: req.user?.hostelId || null,
      uploadedBy: req.user._id,
      fileId,
      url,
      thumbnailUrl: thumbnailUrl || url,
      fileName: fileName || `${fileId}.jpg`,
      size,
      mimeType,
      category,
      ownerId: resourceId || req.user._id,
      ownerModel: config.ownerModel,
      status: 'CONFIRMED',
      confirmedAt: new Date(),
    });

    // 3. Handle Atomic Replacement for Profile Photos
    let replacedFileId = null;
    if (category === 'PROFILE_PHOTO') {
      const studentQuery = { organizationId };
      if (req.user.role === 'student') {
        studentQuery.userId = req.user._id;
      } else if (resourceId) {
        studentQuery._id = resourceId;
      }

      const existingStudent = await Student.findOne(studentQuery);
      if (existingStudent) {
        if (existingStudent.profilePhotoFileId && existingStudent.profilePhotoFileId !== fileId) {
          replacedFileId = existingStudent.profilePhotoFileId;
        }

        // Save new asset first!
        existingStudent.profilePhoto = url;
        existingStudent.profilePhotoFileId = fileId;
        await existingStudent.save();

        // Also update User picture
        if (existingStudent.userId) {
          await User.findByIdAndUpdate(existingStudent.userId, { picture: url });
        }
      } else if (req.user._id) {
        await User.findByIdAndUpdate(req.user._id, { picture: url });
      }

      // If replacement occurred, mark old metadata and delete from ImageKit
      if (replacedFileId) {
        await MediaMetadata.updateOne(
          { fileId: replacedFileId },
          { $set: { status: 'REPLACED', replacedAt: new Date() } }
        );
        // Delete old asset asynchronously
        if (process.env.IMAGEKIT_PUBLIC_KEY !== 'dummy_public_key' && process.env.NODE_ENV !== 'test') {
          deleteImageKitFile(replacedFileId).catch((delErr) => {
            console.warn(`[Upload:Confirm] Background cleanup of replaced file ${replacedFileId} failed:`, delErr.message);
          });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Upload confirmed successfully',
      data: {
        fileId: mediaDoc.fileId,
        url: mediaDoc.url,
        thumbnailUrl: mediaDoc.thumbnailUrl,
        category: mediaDoc.category,
        confirmedAt: mediaDoc.confirmedAt,
      },
    });
  } catch (error) {
    console.error('[Upload:Confirm] Error confirming upload:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get ImageKit auth params (backward compatible endpoint)
// @route   GET /api/upload/auth
// @access  Private
const getUploadAuth = (req, res) => {
  try {
    const authParams = getImageKitAuthParams();
    return res.status(200).json({
      success: true,
      ...authParams,
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'dummy_public_key',
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/dummy_id',
    });
  } catch (error) {
    console.error('ImageKit auth error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Memory-Safe server-proxied upload fallback (Streams from disk temp, zero Base64)
// @route   POST /api/upload/file
// @access  Private
const uploadFile = async (req, res) => {
  const tempPath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const organizationId = resolveUploadTenant(req) || 'global';
    const folder = req.body.folder || `/q2-connect/orgs/${organizationId}/uploads`;
    const fileName = req.body.fileName || `${Date.now()}_${path.basename(req.file.originalname)}`;

    if (process.env.IMAGEKIT_PUBLIC_KEY === 'dummy_public_key' || process.env.NODE_ENV === 'test') {
      const mockResult = {
        success: true,
        url: `https://ik.imagekit.io/dummy_id/${fileName}`,
        fileId: 'mock_file_id_' + Date.now(),
        name: fileName,
        size: req.file.size,
      };

      if (organizationId && organizationId !== 'global') {
        await MediaMetadata.create({
          organizationId: req.tenant?.organizationId || new (require('mongoose').Types.ObjectId)(),
          uploadedBy: req.user._id,
          fileId: mockResult.fileId,
          url: mockResult.url,
          fileName,
          size: req.file.size,
          category: 'GENERAL_MEDIA',
          status: 'CONFIRMED',
          confirmedAt: new Date(),
        }).catch(() => {});
      }

      return res.status(200).json(mockResult);
    }

    // Memory-Safe Stream Pipeline: Stream directly from temporary disk file to ImageKit
    const fileStream = fs.createReadStream(tempPath);

    const result = await uploadToImageKit({
      file: fileStream, // Passes stream directly; no large buffer or Base64 string in heap!
      fileName,
      folder,
      useUniqueFileName: true,
    });

    if (organizationId && organizationId !== 'global') {
      await MediaMetadata.create({
        organizationId: req.tenant?.organizationId || req.user?.activeOrganizationId,
        uploadedBy: req.user._id,
        fileId: result.fileId,
        url: result.url,
        fileName: result.name,
        size: result.size,
        category: 'GENERAL_MEDIA',
        status: 'CONFIRMED',
        confirmedAt: new Date(),
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      url: result.url,
      fileId: result.fileId,
      name: result.name,
      size: result.size,
    });
  } catch (error) {
    console.error('ImageKit upload file error:', error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    // Crucial Cleanup: Always remove temporary file from disk immediately
    if (tempPath && fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (unlinkErr) {
        console.warn(`[Upload:Cleanup] Could not unlink temp file ${tempPath}:`, unlinkErr.message);
      }
    }
  }
};

// @desc    Delete a file from ImageKit with strict tenant ownership validation
// @route   DELETE /api/upload/file/:fileId
// @access  Private (Admin / SuperAdmin)
const deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const organizationId = resolveUploadTenant(req);

    // 1. Verify Tenant Ownership of the File
    const mediaRecord = await MediaMetadata.findOne({ fileId });
    if (mediaRecord) {
      if (
        !req.tenant?.isSuperAdmin &&
        organizationId &&
        mediaRecord.organizationId.toString() !== organizationId.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: 'Tenant boundary violation: you do not own this media resource',
        });
      }
    }

    if (process.env.IMAGEKIT_PUBLIC_KEY === 'dummy_public_key' || process.env.NODE_ENV === 'test') {
      if (mediaRecord) {
        mediaRecord.status = 'DELETED';
        mediaRecord.deletedAt = new Date();
        await mediaRecord.save();
      }
      return res.status(200).json({ success: true, message: 'File deleted from ImageKit' });
    }

    await deleteImageKitFile(fileId);

    if (mediaRecord) {
      mediaRecord.status = 'DELETED';
      mediaRecord.deletedAt = new Date();
      await mediaRecord.save();
    }

    return res.status(200).json({ success: true, message: 'File deleted from ImageKit' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  UPLOAD_CATEGORIES,
  upload,
  authorizeUpload,
  confirmUpload,
  getUploadAuth,
  uploadFile,
  deleteFile,
};
