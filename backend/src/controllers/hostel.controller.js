const mongoose = require('mongoose');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Student = require('../models/Student');
const Subscription = require('../models/Subscription');
const { assertTenantOwnership } = require('../middleware/tenant.middleware');
const { logAuditAction } = require('../middleware/audit.middleware');

/**
 * Controller for tenant-scoped Hostel Branch Management
 */
const hostelController = {
  /**
   * @desc    Get all branches for current organization
   * @route   GET /api/hostels
   * @access  Private (Tenant)
   */
  async getHostels(req, res) {
    try {
      const { status, genderType, search, page = 1, limit = 50 } = req.query;
      const orgId = req.organizationId || req.tenant?.organizationId;
      const isSuperAdmin = req.tenant?.isSuperAdmin;

      const filter = { isDeleted: false };

      if (!isSuperAdmin) {
        if (!orgId) {
          return res.status(200).json({ success: true, data: [], pagination: { total: 0, page: 1, totalPages: 0 } });
        }
        filter.organizationId = orgId;
      } else if (orgId) {
        filter.organizationId = orgId;
      }

      // Restrict staff who only have access to specific branches
      if (req.tenant?.hostelAccess && !req.tenant.hostelAccess.includes('all') && !isSuperAdmin) {
        filter._id = { $in: req.tenant.hostelAccess };
      }

      if (status && status !== 'all') {
        filter.status = status;
      }

      if (genderType && genderType !== 'all') {
        filter.genderType = genderType;
      }

      if (search) {
        const searchRegex = { $regex: search.trim(), $options: 'i' };
        filter.$or = [
          { name: searchRegex },
          { code: searchRegex },
          { address: searchRegex },
          { wardenName: searchRegex },
          { city: searchRegex },
        ];
      }

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
      const skip = (pageNum - 1) * limitNum;

      const [hostels, total] = await Promise.all([
        Hostel.find(filter)
          .populate('organizationId', 'name slug status')
          .sort({ createdAt: 1, _id: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Hostel.countDocuments(filter),
      ]);

      const hostelIds = hostels.map((h) => h._id);

      // Aggregate room capacity and active student count per branch
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
        const rStats = roomMap.get(hIdStr) || {
          totalCapacity: h.capacity || 0,
          totalOccupied: 0,
          roomCount: h.totalRooms || 0,
        };
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

      return res.status(200).json({
        success: true,
        data: enrichedHostels,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum) || (total === 0 ? 0 : 1),
        },
      });
    } catch (error) {
      console.error('Error fetching tenant hostels:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * @desc    Get branch details by ID
   * @route   GET /api/hostels/:id
   * @access  Private (Tenant)
   */
  async getHostelById(req, res) {
    try {
      const hostel = await Hostel.findById(req.params.id)
        .populate('organizationId', 'name slug status')
        .lean();

      if (!hostel || hostel.isDeleted) {
        return res.status(404).json({ success: false, message: 'Hostel branch not found' });
      }

      if (!assertTenantOwnership(hostel, req)) {
        return res.status(403).json({ success: false, message: 'Access denied: Branch belongs to another organization' });
      }

      // Aggregate room & occupancy stats
      const [roomAgg, studentCount] = await Promise.all([
        Room.aggregate([
          { $match: { hostelId: hostel._id } },
          {
            $group: {
              _id: '$hostelId',
              totalCapacity: { $sum: '$capacity' },
              totalOccupied: { $sum: '$occupiedCount' },
              roomCount: { $sum: 1 },
            },
          },
        ]),
        Student.countDocuments({ hostelId: hostel._id, isActive: true }),
      ]);

      const rStats = roomAgg[0] || {
        totalCapacity: hostel.capacity || 0,
        totalOccupied: 0,
        roomCount: hostel.totalRooms || 0,
      };
      const capacity = rStats.totalCapacity || hostel.capacity || 0;
      const occupied = rStats.totalOccupied || studentCount || 0;
      const vacant = Math.max(0, capacity - occupied);
      const occupancyRate = capacity > 0 ? Math.round((occupied / capacity) * 100) : 0;

      return res.status(200).json({
        success: true,
        data: {
          ...hostel,
          metrics: {
            capacity,
            occupied,
            vacant,
            roomCount: rStats.roomCount || hostel.totalRooms,
            studentCount,
            occupancyRate,
          },
        },
      });
    } catch (error) {
      console.error('Error fetching hostel by ID:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },

  /**
   * @desc    Create new hostel branch
   * @route   POST /api/hostels
   * @access  Private (Tenant Admin / Super Admin)
   */
  async createHostel(req, res) {
    try {
      const orgId = req.organizationId || req.tenant?.organizationId;
      if (!orgId) {
        return res.status(400).json({ success: false, message: 'Organization context is required to create a branch' });
      }

      const {
        name,
        code,
        slug,
        address,
        city,
        state,
        country = 'India',
        pincode,
        capacity = 0,
        floors = 1,
        totalRooms = 10,
        genderType = 'COED',
        amenities = [],
        contactPhone,
        contactEmail,
        wardenName,
        wardenPhone,
        emergencyContact,
        settings,
      } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Hostel branch name is required' });
      }

      // Enforce subscription plan limits
      const subscription = await Subscription.findOne({
        organizationId: orgId,
        status: { $in: ['ACTIVE', 'TRIAL'] },
      }).populate('planId');

      if (subscription && subscription.planId && subscription.planId.limits) {
        const maxHostels = subscription.planId.limits.maxHostels;
        if (maxHostels && maxHostels > 0) {
          const currentCount = await Hostel.countDocuments({ organizationId: orgId, isDeleted: false });
          if (currentCount >= maxHostels) {
            return res.status(403).json({
              success: false,
              code: 'PLAN_LIMIT_EXCEEDED',
              message: `Your current plan (${subscription.planId.name}) allows a maximum of ${maxHostels} hostel branch(es). Please upgrade your subscription to add more branches.`,
            });
          }
        }
      }

      // Generate stable code if not provided
      let branchCode = (code || name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)).toUpperCase();
      const existingCode = await Hostel.findOne({ organizationId: orgId, code: branchCode });
      if (existingCode) {
        branchCode = `${branchCode}-${Date.now().toString().slice(-4)}`;
      }

      // Generate slug
      const branchSlug = (slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));

      const newHostel = await Hostel.create({
        organizationId: orgId,
        name: name.trim(),
        code: branchCode,
        slug: branchSlug,
        address,
        city,
        state,
        country,
        pincode,
        capacity: Number(capacity) || 0,
        floors: Number(floors) || 1,
        totalRooms: Number(totalRooms) || 10,
        genderType,
        amenities,
        contactPhone,
        contactEmail,
        wardenName,
        wardenPhone,
        emergencyContact,
        settings: settings || {},
        status: 'ACTIVE',
      });

      await logAuditAction({
        req,
        action: 'CREATE_HOSTEL_BRANCH',
        entityType: 'Hostel',
        entityId: newHostel._id,
        newValue: newHostel,
      });

      return res.status(201).json({ success: true, data: newHostel });
    } catch (error) {
      console.error('Error creating hostel branch:', error);
      if (error.code === 11000) {
        return res.status(409).json({ success: false, message: 'A branch with this code or slug already exists in this organization.' });
      }
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * @desc    Update hostel branch details
   * @route   PUT /api/hostels/:id
   * @access  Private (Tenant Admin / Super Admin)
   */
  async updateHostel(req, res) {
    try {
      const hostel = await Hostel.findById(req.params.id);
      if (!hostel || hostel.isDeleted) {
        return res.status(404).json({ success: false, message: 'Hostel branch not found' });
      }

      if (!assertTenantOwnership(hostel, req)) {
        return res.status(403).json({ success: false, message: 'Access denied: Branch belongs to another organization' });
      }

      const updatableFields = [
        'name',
        'address',
        'city',
        'state',
        'country',
        'pincode',
        'capacity',
        'floors',
        'totalRooms',
        'genderType',
        'amenities',
        'contactPhone',
        'contactEmail',
        'wardenName',
        'wardenPhone',
        'emergencyContact',
        'settings',
      ];

      updatableFields.forEach((field) => {
        if (req.body[field] !== undefined) {
          hostel[field] = req.body[field];
        }
      });

      if (req.body.name && !req.body.slug) {
        hostel.slug = req.body.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
      }

      await hostel.save();

      await logAuditAction({
        req,
        action: 'UPDATE_HOSTEL_BRANCH',
        entityType: 'Hostel',
        entityId: hostel._id,
        newValue: req.body,
      });

      return res.status(200).json({ success: true, data: hostel });
    } catch (error) {
      console.error('Error updating hostel branch:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * @desc    Update branch status (ACTIVE, SUSPENDED, INACTIVE)
   * @route   PATCH /api/hostels/:id/status
   * @access  Private (Tenant Admin / Super Admin)
   */
  async updateHostelStatus(req, res) {
    try {
      const { status } = req.body;
      const validStatuses = ['ACTIVE', 'SUSPENDED', 'INACTIVE', 'ARCHIVED'];

      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        });
      }

      const hostel = await Hostel.findById(req.params.id);
      if (!hostel || hostel.isDeleted) {
        return res.status(404).json({ success: false, message: 'Hostel branch not found' });
      }

      if (!assertTenantOwnership(hostel, req)) {
        return res.status(403).json({ success: false, message: 'Access denied: Branch belongs to another organization' });
      }

      const oldStatus = hostel.status;
      hostel.status = status;
      await hostel.save();

      await logAuditAction({
        req,
        action: 'UPDATE_HOSTEL_STATUS',
        entityType: 'Hostel',
        entityId: hostel._id,
        oldValue: { status: oldStatus },
        newValue: { status },
      });

      return res.status(200).json({
        success: true,
        message: `Branch status updated to ${status}`,
        data: hostel,
      });
    } catch (error) {
      console.error('Error updating branch status:', error);
      return res.status(400).json({ success: false, message: error.message });
    }
  },

  /**
   * @desc    Soft delete / archive hostel branch
   * @route   DELETE /api/hostels/:id
   * @access  Private (Tenant Admin / Super Admin)
   */
  async deleteHostel(req, res) {
    try {
      const hostel = await Hostel.findById(req.params.id);
      if (!hostel || hostel.isDeleted) {
        return res.status(404).json({ success: false, message: 'Hostel branch not found' });
      }

      if (!assertTenantOwnership(hostel, req)) {
        return res.status(403).json({ success: false, message: 'Access denied: Branch belongs to another organization' });
      }

      // Safety check: Cannot delete a branch with active students!
      const activeStudents = await Student.countDocuments({
        $or: [{ hostelId: hostel._id }, { hostel: hostel.code }, { hostel: hostel.name }],
        isActive: true,
      });

      if (activeStudents > 0) {
        return res.status(400).json({
          success: false,
          code: 'CANNOT_DELETE_ACTIVE_BRANCH',
          message: `Cannot delete branch '${hostel.name}'. There are currently ${activeStudents} active resident(s) assigned to this branch. Please transfer or deactivate all residents first.`,
        });
      }

      hostel.isDeleted = true;
      hostel.deletedAt = new Date();
      hostel.status = 'ARCHIVED';
      await hostel.save();

      await logAuditAction({
        req,
        action: 'DELETE_HOSTEL_BRANCH',
        entityType: 'Hostel',
        entityId: hostel._id,
      });

      return res.status(200).json({
        success: true,
        message: `Hostel branch '${hostel.name}' archived successfully.`,
      });
    } catch (error) {
      console.error('Error deleting hostel branch:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  },
};

module.exports = hostelController;
