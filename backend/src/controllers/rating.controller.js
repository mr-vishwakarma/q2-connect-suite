const MenuRating = require('../models/MenuRating');
const moment = require('moment');

exports.submitRating = async (req, res) => {
  try {
    const { mealType, rating, feedback } = req.body;
    const studentId = req.user.studentId;
    const date = moment().format('YYYY-MM-DD');

    if (!mealType || !rating) {
      return res.status(400).json({ success: false, message: 'Meal type and rating are required' });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    // Upsert rating (if student already rated this meal today, update it)
    const newRating = await MenuRating.findOneAndUpdate(
      { student: studentId, date, mealType },
      { rating, feedback },
      { new: true, upsert: true }
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
    const { startDate, endDate } = req.query;

    const query = {};
    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else {
      // Default to last 7 days
      query.date = {
        $gte: moment().subtract(7, 'days').format('YYYY-MM-DD'),
        $lte: moment().format('YYYY-MM-DD')
      };
    }

    // Aggregate average rating per meal type per day
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
