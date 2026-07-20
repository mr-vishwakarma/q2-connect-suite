const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, trim: true },
    parentPhone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    roomNo: { type: String, trim: true },
    hostel: { type: String, enum: ['Q2', 'Q2.0', 'Q2.1'] },
    fees: { type: Number, default: 0 },
    startDate: { type: Date },
    validDate: { type: Date },
    profilePhoto: { type: String }, // ImageKit URL
    profilePhotoFileId: { type: String }, // ImageKit fileId for deletion
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Virtual: compute whether subscription is valid
studentSchema.virtual('isValid').get(function () {
  if (!this.validDate) return false;
  return new Date() <= new Date(this.validDate);
});

studentSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Student', studentSchema);
