const Student = require('../models/Student');

const studentService = {
  async getAlertsCount(hostel) {
    const filter = { isActive: { $ne: false } };
    if (hostel && hostel !== 'All') filter.hostel = hostel;

    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(23, 59, 59, 999);

    filter.validDate = { $exists: true, $ne: null, $lte: fiveDaysFromNow };

    const count = await Student.countDocuments(filter);
    return count;
  },

  async getAlertStudents(hostel) {
    const filter = { isActive: { $ne: false } };
    if (hostel && hostel !== 'All') filter.hostel = hostel;

    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(23, 59, 59, 999);

    filter.validDate = { $exists: true, $ne: null, $lte: fiveDaysFromNow };

    const students = await Student.find(filter)
      .select('name username phone roomNo fees startDate validDate hostel userId')
      .sort({ validDate: 1 })
      .lean();

    return students;
  },
};

module.exports = studentService;
