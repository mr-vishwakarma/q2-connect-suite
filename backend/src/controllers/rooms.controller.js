const Room = require('../models/Room');
const Hostel = require('../models/Hostel');

const getAllRooms = async (req, res) => {
  try {
    const { hostel, status, page = 1, limit = 50 } = req.query;
    const query = {};

    // Enforce Tenant Scoping
    if (req.tenant && req.tenant.organizationId && !req.tenant.isSuperAdmin) {
      query.organizationId = req.tenant.organizationId;
    }

    if (hostel && hostel !== 'All') {
      query.hostel = hostel;
    } else if (req.tenant && req.tenant.hostelAccess && !req.tenant.hostelAccess.includes('all') && !req.tenant.isSuperAdmin) {
      query.hostel = { $in: req.tenant.hostelAccess };
    }

    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitAmount = parseInt(limit);

    const rooms = await Room.find(query)
      .sort({ roomNumber: 1 })
      .skip(skip)
      .limit(limitAmount);

    const total = await Room.countDocuments(query);

    return res.status(200).json({ 
      success: true, 
      data: rooms,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limitAmount),
      limit: limitAmount
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const createRoom = async (req, res) => {
  try {
    const { roomNumber, hostel, capacity = 2 } = req.body;
    if (!roomNumber || !hostel) {
      return res.status(400).json({ success: false, message: 'roomNumber and hostel are required' });
    }

    const orgId = req.tenant?.organizationId || req.user.activeOrganizationId;
    const hostelDoc = await Hostel.findOne({ organizationId: orgId, code: hostel });

    const room = await Room.create({
      roomNumber,
      hostel,
      capacity,
      organizationId: orgId || null,
      hostelId: hostelDoc?._id || null,
    });
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
    const roomQuery = { _id: req.params.id };
    if (req.tenant && req.tenant.organizationId && !req.tenant.isSuperAdmin) {
      roomQuery.organizationId = req.tenant.organizationId;
    }

    const room = await Room.findOne(roomQuery);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    if (capacity !== undefined) {
      if (capacity < (occupiedCount !== undefined ? occupiedCount : room.occupiedCount)) {
        return res.status(400).json({
          success: false,
          message: `Capacity cannot be less than current occupancy (${room.occupiedCount})`,
        });
      }
      room.capacity = capacity;
    }

    if (occupiedCount !== undefined) {
      if (occupiedCount < 0) {
        return res.status(400).json({ success: false, message: 'Occupancy cannot be negative' });
      }
      if (occupiedCount > room.capacity) {
        return res.status(400).json({ success: false, message: `Occupancy cannot exceed capacity (${room.capacity})` });
      }
      room.occupiedCount = occupiedCount;
    }

    await room.save();
    return res.status(200).json({ success: true, data: room });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const deleteRoom = async (req, res) => {
  try {
    const roomQuery = { _id: req.params.id };
    if (req.tenant && req.tenant.organizationId && !req.tenant.isSuperAdmin) {
      roomQuery.organizationId = req.tenant.organizationId;
    }

    const room = await Room.findOne(roomQuery);
    if (!room) return res.status(404).json({ success: false, message: 'Room not found' });

    if (room.occupiedCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete Room ${room.roomNumber}: currently has ${room.occupiedCount} resident(s) assigned. Please reassign residents first.`,
      });
    }

    await Room.deleteOne({ _id: room._id });
    return res.status(200).json({ success: true, message: 'Room deleted' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { getAllRooms, createRoom, updateRoom, deleteRoom };
