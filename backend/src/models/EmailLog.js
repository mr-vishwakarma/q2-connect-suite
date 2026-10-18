const mongoose = require('mongoose');

const emailLogSchema = new mongoose.Schema(
  {
    recipient: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    recipientMasked: {
      type: String,
      trim: true,
    },
    purpose: {
      type: String,
      required: true,
      enum: [
        'STUDENT_WELCOME_ACTIVATION',
        'PASSWORD_RESET',
        'SECONDARY_ADMIN_WELCOME',
        'ADMIN_ACTION_OTP',
        'FEE_REMINDER',
        'ADMIN_NEW_STUDENT_REGISTERED',
        'MESS_REQUEST_UPDATE',
        'HOSTEL_ONBOARDING_WELCOME',
        'GENERAL_NOTIFICATION',
      ],
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'REQUESTED',
        'QUEUED',
        'PROCESSING',
        'SMTP_ACCEPTED',
        'FAILED_RETRYABLE',
        'FAILED_PERMANENT',
        'BOUNCED',
        'SUPPRESSED_UNROUTABLE',
      ],
      default: 'REQUESTED',
      index: true,
    },
    correlationId: {
      type: String,
      trim: true,
      index: true,
    },
    jobId: {
      type: String,
      trim: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    smtpMessageId: {
      type: String,
      trim: true,
    },
    lastError: {
      type: String,
    },
    lastErrorCode: {
      type: String,
    },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    targetStudentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

emailLogSchema.index({ correlationId: 1, createdAt: -1 });
emailLogSchema.index({ recipient: 1, purpose: 1, createdAt: -1 });
emailLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('EmailLog', emailLogSchema);
