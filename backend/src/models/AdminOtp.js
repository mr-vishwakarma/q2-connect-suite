const mongoose = require('mongoose');

const adminOtpSchema = new mongoose.Schema(
  {
    actorId: {
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
      index: true,
    },
    action: {
      type: String,
      enum: ['CREATE_SECONDARY_ADMIN', 'DELETE_SECONDARY_ADMIN', 'DEACTIVATE_SECONDARY_ADMIN'],
      required: true,
      index: true,
    },
    targetAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    payload: {
      name: { type: String, trim: true },
      username: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
      hostelId: { type: String, trim: true },
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // MongoDB TTL auto-cleanup
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    isConsumed: {
      type: Boolean,
      default: false,
      index: true,
    },
    resendCooldownUntil: {
      type: Date,
    },
  },
  { timestamps: true }
);

adminOtpSchema.index({ actorId: 1, action: 1, isConsumed: 1, expiresAt: 1 });
adminOtpSchema.index({ organizationId: 1, createdAt: -1 });

module.exports = mongoose.model('AdminOtp', adminOtpSchema);
