const mongoose = require('mongoose');

const messRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    hostel: { type: String, enum: ['Q2', 'Q2.0', 'Q2.1'] },
    leavingDate: { type: Date, required: true },
    returnDate: { type: Date, required: true },
    reason: { type: String },
    parentMobile: { type: String },
    // Document stored in ImageKit
    documentUrl: { type: String },
    documentName: { type: String },
    documentFileId: { type: String }, // ImageKit fileId for deletion
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    adminMessage: { type: String },
    approvedDate: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('MessRequest', messRequestSchema);
