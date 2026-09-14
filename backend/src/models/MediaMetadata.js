const mongoose = require('mongoose');

const mediaMetadataSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      index: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    url: {
      type: String,
      required: true,
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      trim: true,
    },
    filePath: {
      type: String,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    originalName: {
      type: String,
      trim: true,
    },
    fileType: {
      type: String,
      default: 'image',
    },
    mimeType: {
      type: String,
      trim: true,
    },
    size: {
      type: Number,
      default: 0,
    },
    category: {
      type: String,
      enum: [
        'PROFILE_PHOTO',
        'MESS_LEAVE_DOCUMENT',
        'FEE_RECEIPT',
        'ORGANIZATION_LOGO',
        'ORGANIZATION_AADHAAR',
        'GENERAL_MEDIA',
      ],
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    ownerModel: {
      type: String,
      enum: ['Student', 'User', 'MessRequest', 'FeePayment', 'Organization'],
    },
    status: {
      type: String,
      enum: ['INITIALIZED', 'CONFIRMED', 'REPLACED', 'DELETED'],
      default: 'INITIALIZED',
      index: true,
    },
    confirmedAt: {
      type: Date,
    },
    replacedAt: {
      type: Date,
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Compound indexes for tenant-safe and owner-safe queries
mediaMetadataSchema.index({ organizationId: 1, category: 1, status: 1 });
mediaMetadataSchema.index({ organizationId: 1, ownerId: 1 });
mediaMetadataSchema.index({ organizationId: 1, fileId: 1 });
mediaMetadataSchema.index({ status: 1, createdAt: 1 }); // Useful for identifying unconfirmed/abandoned uploads

module.exports = mongoose.model('MediaMetadata', mediaMetadataSchema);
