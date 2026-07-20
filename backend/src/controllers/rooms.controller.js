const Room = require('../models/Room');

const getAllRooms = async (req, res) => {
  try {
    const { hostel, status } = req.query;
    const query = {};
    if (hostel) query.hostel = hostel;
    if (status) query.status = status;
    const rooms = await Room.find(query).sort({ roomNumber: 1 });
    return res.status(200).json({ success: true, data: rooms });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createRoom = async (req, res) => {
  try {
    const { roomNumber, hostel, capacity } = req.body;
    if (!roomNumber || !hostel) {
      return res.status(400).json({ success: false, message: 'roomNumber and hostel are required' });
    }
    const room = await Room.create({ roomNumber, hostel, capacity });
    return res.status(201).json({ success: true, data: room });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Room already exists in this hostel' });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

const updateRoom = async (req, res) => {
  try {
    const { capacity, occupiedCount } = req.body;
    const room = await Room.findByIdAndUpdate(
      req.params.id,
      { capacity, occupiedCount },
      { new: true, runValidators: true }
    );
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    return res.status(200).json({ success: true, data: room });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });
    return res.status(200).json({ success: true, message: 'Room deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllRooms, createRoom, updateRoom, deleteRoom };
