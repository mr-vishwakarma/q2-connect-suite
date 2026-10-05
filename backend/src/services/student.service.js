const Student = require('../models/Student');

const studentService = {
  async getAlertsCount(hostel, organizationId) {
    const filter = { isActive: { $ne: false } };
    if (organizationId) filter.organizationId = organizationId;
    if (hostel && hostel !== 'All') {
      filter.hostel = { $regex: new RegExp(`^${String(hostel).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }

    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(23, 59, 59, 999);

    filter.$or = [
      { validDate: { $lte: fiveDaysFromNow } },
      { validDate: null },
      { validDate: { $exists: false } },
    ];

    const count = await Student.countDocuments(filter);
    return count;
  },

  async getAlertStudents(hostel, organizationId) {
    const filter = { isActive: { $ne: false } };
    if (organizationId) filter.organizationId = organizationId;
    if (hostel && hostel !== 'All') {
      filter.hostel = { $regex: new RegExp(`^${String(hostel).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }

    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(23, 59, 59, 999);

    filter.$or = [
      { validDate: { $lte: fiveDaysFromNow } },
      { validDate: null },
      { validDate: { $exists: false } },
    ];

    const students = await Student.find(filter)
      .select('name username phone parentPhone roomNo fees startDate validDate hostel userId')
      .sort({ validDate: 1, createdAt: -1 })
      .lean();

    return students;
  },
};

module.exports = studentService;
