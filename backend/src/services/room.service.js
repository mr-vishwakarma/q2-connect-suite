const Room = require('../models/Room');
const Student = require('../models/Student');

const roomService = {
  async getRooms(hostel) {
    const matchQuery = {};
    if (hostel && hostel !== 'All') matchQuery.hostel = hostel;

    const rooms = await Room.find(matchQuery).sort({ roomNumber: 1 }).lean();
    return rooms;
  },

  async getRoomByNumber(roomNumber, hostel) {
    return await Room.findOne({ roomNumber, hostel });
  },
};

module.exports = roomService;
