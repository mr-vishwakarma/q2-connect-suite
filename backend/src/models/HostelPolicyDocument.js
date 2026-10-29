const mongoose = require('mongoose');

/**
 * HostelPolicyDocument Schema
 * Represents a logical document category entity for an organization and optional hostel branch.
 * Categories:
 * - TERMS_AND_CONDITIONS ("Terms & Conditions")
 * - RULES_AND_REGULATIONS ("Hostel Rules & Regulations")
 * - HOSTEL_POLICIES ("Hostel Policies")
 */
const hostelPolicyDocumentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      required: true,
      index: true,
    },
    // Null indicates organization-level default inherited by all branches.
    // Non-null indicates branch-specific override.
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
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // Reference to current active published version
    currentPublishedVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelPolicyVersion',
      default: null,
    },
    // Reference to working draft version (if one is under review)
    draftVersionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'HostelPolicyVersion',
      default: null,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'PROCESSING', 'REVIEW_REQUIRED', 'PUBLISHED', 'ARCHIVED'],
      default: 'DRAFT',
    },
    isMandatory: {
      type: Boolean,
      default: true,
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

// Compound unique index: Only 1 document record per org + hostel + category
hostelPolicyDocumentSchema.index(
  { organizationId: 1, hostelId: 1, category: 1 },
  { unique: true }
);

module.exports = mongoose.model('HostelPolicyDocument', hostelPolicyDocumentSchema);

