const mongoose = require('mongoose');
const MenuRating = require('../models/MenuRating');
const Student = require('../models/Student');
const moment = require('moment');

exports.submitRating = async (req, res) => {
  try {
    const { mealType, rating, feedback } = req.body;
    let studentId = req.user.studentId;
    if (!studentId && req.user.role === 'student') {
      const foundStudent = await Student.findOne({ userId: req.user._id });
      if (foundStudent) studentId = foundStudent._id;
    }

    if (!studentId) {
      return res.status(400).json({ success: false, message: 'Student profile not found' });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const orgId = req.organizationId || req.tenant?.organizationId || student.organizationId;
    if (!orgId) {
      return res.status(403).json({ success: false, message: 'Organization context is required' });
    }

    const date = moment().format('YYYY-MM-DD');

    if (!mealType || !rating) {
      return res.status(400).json({ success: false, message: 'Meal type and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    // Upsert rating scoped to tenant organization
    const newRating = await MenuRating.findOneAndUpdate(
      { organizationId: orgId, student: studentId, date, mealType },
      {
        $set: {
          rating,
          feedback,
          hostelId: student.hostelId || null,
          hostel: student.hostel || 'Q2',
        },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: 'Rating submitted successfully',
      data: newRating
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already rated this meal today' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, hostel } = req.query;
    const orgId = req.organizationId || req.tenant?.organizationId;
    const isSuperAdmin = req.tenant?.isSuperAdmin;

    const query = {};

    // Enforce Tenant Scoping on Analytics Aggregation
    if (!isSuperAdmin) {
      query.organizationId = orgId || new mongoose.Types.ObjectId();
    } else if (orgId) {
      query.organizationId = orgId;
    }

    if (hostel && hostel !== 'All') {
      query.hostel = hostel;
    }

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else {
      // Default to last 7 days
      query.date = {
        $gte: moment().subtract(7, 'days').format('YYYY-MM-DD'),
        $lte: moment().format('YYYY-MM-DD')
      };
    }

    // Aggregate average rating per meal type per day (strictly scoped to organizationId)
    const analytics = await MenuRating.aggregate([
      { $match: query },
      {
        $group: {
          _id: { date: '$date', mealType: '$mealType' },
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.date',
          meals: {
            $push: {
              type: '$_id.mealType',
              avgRating: { $round: ['$avgRating', 1] },
              count: '$count'
            }
          },
          dailyAvg: { $avg: '$avgRating' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format for recharts
    const formattedData = analytics.map(day => {
      const dataPoint = { date: day._id, dailyAvg: Math.round(day.dailyAvg * 10) / 10 };
      day.meals.forEach(m => {
        dataPoint[m.type] = m.avgRating;
        dataPoint[`${m.type}Count`] = m.count;
      });
      return dataPoint;
    });

    res.status(200).json({
      success: true,
      data: formattedData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

