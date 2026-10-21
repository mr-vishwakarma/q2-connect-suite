const mongoose = require('mongoose');

/**
 * EmailSuppression Model
 * 
 * Tracks email addresses that have hard-bounced or submitted spam complaints.
 * Suppressed addresses are automatically blocked before sending to protect
 * sender reputation on the authenticated domain (mrvishwakarma.in).
 */
const emailSuppressionSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    reason: {
      type: String,
      enum: ['HARD_BOUNCE', 'SPAM_COMPLAINT', 'MANUAL_UNSUBSCRIBE', 'INVALID_SYNTAX'],
      required: true,
    },
    provider: {
      type: String,
      default: 'resend',
    },
    resendMessageId: {
      type: String,
      trim: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    suppressedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
);

emailSuppressionSchema.index({ email: 1, reason: 1 });

module.exports = mongoose.model('EmailSuppression', emailSuppressionSchema);
