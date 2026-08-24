const Room = require('../models/Room');
const Student = require('../models/Student');

const roomService = {
  async getRooms(hostel, organizationId) {
    const matchQuery = {};
    if (organizationId) matchQuery.organizationId = organizationId;
    if (hostel && hostel !== 'All') matchQuery.hostel = hostel;

    const rooms = await Room.find(matchQuery).sort({ roomNumber: 1 }).lean();
    return rooms;
  },

  async getRoomByNumber(roomNumber, hostel, organizationId) {
    const filter = { roomNumber, hostel };
    if (organizationId) filter.organizationId = organizationId;
    return await Room.findOne(filter);
  },
};

module.exports = roomService;
