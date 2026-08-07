const mongoose = require('mongoose');

const complaintSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    hostel: { type: String, enum: ['Q2', 'Q2.0', 'Q2.1'] },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['pending', 'in_progress', 'resolved'], default: 'pending' },
    adminReply: { type: String },
  },
  { timestamps: true }
);

complaintSchema.index({ hostel: 1, status: 1 });
complaintSchema.index({ userId: 1 });

module.exports = mongoose.model('Complaint', complaintSchema);
