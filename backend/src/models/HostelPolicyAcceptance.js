const mongoose = require('mongoose');

/**
 * HostelPolicyAcceptance Schema
 * Immutable audit record of student agreement to an exact published policy version.
 */
const hostelPolicyAcceptanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
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
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelPolicyDocument',
      required: true,
      index: true,
    },
    versionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelPolicyVersion',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['TERMS_AND_CONDITIONS', 'RULES_AND_REGULATIONS', 'HOSTEL_POLICIES'],
      required: true,
    },
    versionNumber: {
      type: Number,
      required: true,
    },
    versionLabel: {
      type: String,
      trim: true,
    },
    // The content hash that was accepted by the student, matching the immutable version contentHash
    acceptedContentHash: {
      type: String,
      required: true,
      trim: true,
    },
    acceptedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    actionType: {
      type: String,
      default: 'EXPLICIT_ACCEPTANCE',
      enum: ['EXPLICIT_ACCEPTANCE'],
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

// Prevent duplicate acceptances of the same version by the same student
hostelPolicyAcceptanceSchema.index({ studentId: 1, versionId: 1 }, { unique: true });
hostelPolicyAcceptanceSchema.index({ studentId: 1, category: 1, acceptedAt: -1 });
hostelPolicyAcceptanceSchema.index({ organizationId: 1, documentId: 1, versionId: 1 });

module.exports = mongoose.model('HostelPolicyAcceptance', hostelPolicyAcceptanceSchema);

