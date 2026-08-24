const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    roomNumber: { type: String, required: true, trim: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
    hostelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hostel' },
    hostel: { type: String, required: true },
    capacity: { type: Number, default: 2 },
    occupiedCount: { type: Number, default: 0 },
    status: { type: String, enum: ['available', 'full'], default: 'available' },
  },
  { timestamps: true }
);

// Compound unique index: room number must be unique within an organization & hostel
roomSchema.index({ organizationId: 1, hostelId: 1, roomNumber: 1 });
roomSchema.index({ roomNumber: 1, hostel: 1 });
roomSchema.index({ hostel: 1 });

// Auto-update status based on occupancy
roomSchema.pre('save', function (next) {
  this.status = this.occupiedCount >= this.capacity ? 'full' : 'available';
  next();
});

module.exports = mongoose.model('Room', roomSchema);
