const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Student = require('../models/Student');

const hostelAdminService = {
  async getAllHostelsPaginated(query = {}) {
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = { isDeleted: false };

    if (query.organizationId && query.organizationId !== 'all') {
      filter.organizationId = query.organizationId;
    }

    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    if (query.genderType && query.genderType !== 'all') {
      filter.genderType = query.genderType;
    }

    if (query.search) {
      const searchRegex = { $regex: query.search.trim(), $options: 'i' };
      filter.$or = [
        { name: searchRegex },
        { code: searchRegex },
        { address: searchRegex },
        { wardenName: searchRegex },
      ];
    }

    const [hostels, total] = await Promise.all([
      Hostel.find(filter)
        .populate('organizationId', 'name slug status')
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Hostel.countDocuments(filter),
    ]);

    // Batch room & student occupancy aggregation for displayed hostels
    const hostelIds = hostels.map((h) => h._id);
    const [roomAgg, studentAgg] = await Promise.all([
      Room.aggregate([
        { $match: { hostelId: { $in: hostelIds } } },
        {
          $group: {
            _id: '$hostelId',
            totalCapacity: { $sum: '$capacity' },
            totalOccupied: { $sum: '$occupiedCount' },
            roomCount: { $sum: 1 },
          },
        },
      ]),
      Student.aggregate([
        { $match: { hostelId: { $in: hostelIds }, isActive: true } },
        { $group: { _id: '$hostelId', count: { $sum: 1 } } },
      ]),
    ]);

    const roomMap = new Map(roomAgg.map((r) => [String(r._id), r]));
    const studentMap = new Map(studentAgg.map((s) => [String(s._id), s.count]));

    const enrichedHostels = hostels.map((h) => {
      const hIdStr = String(h._id);
      const rStats = roomMap.get(hIdStr) || { totalCapacity: h.capacity || 0, totalOccupied: 0, roomCount: h.totalRooms || 0 };
      const sCount = studentMap.get(hIdStr) || 0;
      const capacity = rStats.totalCapacity || h.capacity || 0;
      const occupied = rStats.totalOccupied || sCount || 0;
      const vacant = Math.max(0, capacity - occupied);
      const occupancyRate = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;

      return {
        ...h,
        metrics: {
          capacity,
          occupied,
          vacant,
          roomCount: rStats.roomCount || h.totalRooms,
          studentCount: sCount,
          occupancyRate,
        },
      };
    });

    return {
      hostels: enrichedHostels,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getHostelGlobalMetrics() {
    const [hostelCount, activeHostelCount, roomAgg, studentCount] = await Promise.all([
      Hostel.countDocuments({ isDeleted: false }),
      Hostel.countDocuments({ isDeleted: false, status: 'ACTIVE' }),
      Room.aggregate([
        {
          $group: {
            _id: null,
            totalCapacity: { $sum: '$capacity' },
            totalOccupied: { $sum: '$occupiedCount' },
            totalRooms: { $sum: 1 },
          },
        },
      ]),
      Student.countDocuments({ isActive: true }),
    ]);

    const rooms = roomAgg[0] || { totalCapacity: 0, totalOccupied: 0, totalRooms: 0 };
    const capacity = rooms.totalCapacity || 0;
    const occupied = rooms.totalOccupied || studentCount || 0;
    const vacant = Math.max(0, capacity - occupied);
    const globalOccupancyRate = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;

    return {
      totalHostels: hostelCount,
      activeHostels: activeHostelCount,
      totalRooms: rooms.totalRooms,
      totalCapacity: capacity,
      occupiedBeds: occupied,
      totalOccupied: occupied,
      vacantBeds: vacant,
      totalVacant: vacant,
      globalOccupancyRate,
      overallOccupancyRate: globalOccupancyRate,
      totalStudentsEnrolled: studentCount,
    };
  },
};

module.exports = { hostelAdminService };
