const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true, trim: true },
    hostel: { type: String, enum: ['Q2', 'Q2.0', 'Q2.1'], required: true },
    capacity: { type: Number, default: 2 },
    occupiedCount: { type: Number, default: 0 },
    status: { type: String, enum: ['available', 'full'], default: 'available' },
  },
  { timestamps: true }
);

// Compound unique index: room number must be unique within a hostel
roomSchema.index({ roomNumber: 1, hostel: 1 }, { unique: true });

// Auto-update status based on occupancy
roomSchema.pre('save', function (next) {
  this.status = this.occupiedCount >= this.capacity ? 'full' : 'available';
  next();
});

module.exports = mongoose.model('Room', roomSchema);
