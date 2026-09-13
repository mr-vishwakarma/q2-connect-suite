const mongoose = require('mongoose');

const messRequestSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    hostel: { type: String, trim: true, default: 'Q2' },
    leavingDate: { type: Date, required: true },
    returnDate: { type: Date, required: true },
    reason: { type: String },
    parentMobile: { type: String },
    // Document stored in ImageKit
    documentUrl: { type: String },
    documentName: { type: String },
    documentFileId: { type: String }, // ImageKit fileId for deletion
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'returned'], default: 'pending' },
    adminMessage: { type: String },
    approvedDate: { type: Date },
  },
  { timestamps: true }
);

messRequestSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
messRequestSchema.index({ organizationId: 1, createdAt: -1 });
messRequestSchema.index({ organizationId: 1, studentId: 1, createdAt: -1 });
messRequestSchema.index({ userId: 1, createdAt: -1 });
messRequestSchema.index({ organizationId: 1, hostelId: 1 });

module.exports = mongoose.model('MessRequest', messRequestSchema);
