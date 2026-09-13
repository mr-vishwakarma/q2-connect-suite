const mongoose = require('mongoose');

const menuRatingSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  hostelId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hostel',
  },
  hostel: {
    type: String,
    trim: true,
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true,
  },
  mealType: {
    type: String,
    enum: ['Breakfast', 'Lunch', 'Snacks', 'Dinner'],
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  feedback: {
    type: String,
    trim: true,
    maxlength: 500,
  },
}, { timestamps: true });

// Prevent a student from rating the same meal multiple times a day within an organization
menuRatingSchema.index({ organizationId: 1, student: 1, date: 1, mealType: 1 }, { unique: true });
menuRatingSchema.index({ organizationId: 1, date: 1, mealType: 1 });
menuRatingSchema.index({ organizationId: 1, hostel: 1, date: 1 });

module.exports = mongoose.model('MenuRating', menuRatingSchema);

