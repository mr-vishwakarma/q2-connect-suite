const mongoose = require('mongoose');

/**
 * HostelPolicyVersion Schema
 * Represents an immutable version of a policy document.
 * Once published, content and metadata cannot be mutated. Updates require issuing a new version.
 */
const hostelPolicyVersionSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelPolicyDocument',
      required: true,
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    hostelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hostel',
      default: null,
      index: true,
    },
    category: {
      type: String,
      enum: ['TERMS_AND_CONDITIONS', 'RULES_AND_REGULATIONS', 'HOSTEL_POLICIES'],
      required: true,
      index: true,
    },
    versionNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    versionLabel: {
      type: String,
      required: true,
      trim: true,
      default: 'v1.0',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    effectiveDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PROCESSING', 'REVIEW_REQUIRED', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED'],
      default: 'DRAFT',
      index: true,
    },
    // Raw extracted text from PDF
    rawText: {
      type: String,
      default: '',
    },
    // Structured document model
    structuredContent: {
      title: { type: String, default: '' },
      summary: { type: String, default: '' },
      sections: [
        {
          heading: { type: String, default: '' },
          subheading: { type: String, default: '' },
          paragraphs: [{ type: String }],
          clauses: [{ type: String }],
          pageNumber: { type: Number },
        },
      ],
    },
    // Cryptographic SHA-256 hash of structured content ensuring integrity and auditability
    contentHash: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    // Source PDF metadata
    file: {
      originalFileName: { type: String, trim: true },
      fileSize: { type: Number, default: 0 },
      mimeType: { type: String, default: 'application/pdf' },
      fileUrl: { type: String, trim: true },
      fileKey: { type: String, trim: true },
      pageCount: { type: Number, default: 1 },
      isScanned: { type: Boolean, default: false },
      extractionStatus: {
        type: String,
        enum: ['SUCCESS', 'EMPTY', 'SCANNED_WARNING', 'ERROR'],
        default: 'SUCCESS',
      },
      extractionNotes: { type: String, default: '' },
    },
    requiresAcceptance: {
      type: Boolean,
      default: true,
    },
    requiresReacceptance: {
      type: Boolean,
      default: true,
    },
    isImmutable: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: Date,
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    supersededAt: {
      type: Date,
    },
    supersededBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

// Compound index on documentId and versionNumber
hostelPolicyVersionSchema.index({ documentId: 1, versionNumber: 1 }, { unique: true });
hostelPolicyVersionSchema.index({ organizationId: 1, hostelId: 1, category: 1, status: 1 });

// Guard against mutating published immutable versions
hostelPolicyVersionSchema.pre('save', function (next) {
  if (!this.isNew && this.isImmutable && this.isModified('rawText')) {
    return next(new Error('Cannot mutate content of an immutable published document version.'));
  }
  if (!this.isNew && this.isImmutable && this.isModified('structuredContent')) {
    return next(new Error('Cannot mutate structuredContent of an immutable published document version.'));
  }
  if (!this.isNew && this.isImmutable && this.isModified('contentHash')) {
    return next(new Error('Cannot mutate contentHash of an immutable published document version.'));
  }
  next();
});

module.exports = mongoose.model('HostelPolicyVersion', hostelPolicyVersionSchema);

