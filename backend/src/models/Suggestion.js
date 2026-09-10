const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    hostel: { type: String, trim: true, default: 'Q2' },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    status: { type: String, enum: ['pending', 'reviewed', 'implemented', 'in_progress', 'rejected'], default: 'pending' },
    adminReply: { type: String },
  },
  { timestamps: true }
);

suggestionSchema.index({ organizationId: 1, status: 1 });
suggestionSchema.index({ organizationId: 1, createdAt: -1 });
suggestionSchema.index({ hostel: 1 });
suggestionSchema.index({ userId: 1 });

module.exports = mongoose.model('Suggestion', suggestionSchema);
