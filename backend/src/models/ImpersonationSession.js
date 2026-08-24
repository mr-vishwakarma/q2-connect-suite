const mongoose = require('mongoose');

const impersonationSessionSchema = new mongoose.Schema(
  {
    superAdminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    targetUserName: { type: String },
    organizationName: { type: String },
    reason: { type: String, required: true },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

impersonationSessionSchema.index({ superAdminId: 1, isActive: 1 });
impersonationSessionSchema.index({ organizationId: 1 });

module.exports = mongoose.model('ImpersonationSession', impersonationSessionSchema);
