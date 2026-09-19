const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    actorName: { type: String },
    actorEmail: { type: String },
    actorRole: { type: String },
    action: { type: String, required: true },
    description: { type: String },
    entityType: { type: String, required: true },
    entityId: { type: String },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    result: { type: String, enum: ['SUCCESS', 'FAILURE', 'DENIED'], default: 'SUCCESS' },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, entityType: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
