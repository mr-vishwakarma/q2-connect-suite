const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const reportExportService = {
  async streamReportToCsv(reportType, query, res) {
    // Graceful fallback if called as (reportType, res)
    if (!res && query && typeof query.setHeader === 'function') {
      res = query;
      query = {};
    }

    const filename = `${reportType}_export_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    if (reportType === 'organizations') {
      res.write('Organization Name,Slug,Contact Email,Phone,City,Status,Created At\n');
      const cursor = Organization.find({ isDeleted: false }).sort({ createdAt: -1 }).cursor();
      for await (const doc of cursor) {
        const line = [
          escapeCsv(doc.name),
          escapeCsv(doc.slug),
          escapeCsv(doc.contactEmail),
          escapeCsv(doc.phone),
          escapeCsv(doc.city),
          escapeCsv(doc.status),
          escapeCsv(doc.createdAt ? doc.createdAt.toISOString() : ''),
        ].join(',') + '\n';
        res.write(line);
      }
      res.end();
      return;
    }

    if (reportType === 'hostels') {
      res.write('Hostel Name,Code,Organization ID,Address,Capacity,Total Rooms,Gender Type,Status\n');
      const cursor = Hostel.find({ isDeleted: false }).sort({ createdAt: -1 }).cursor();
      for await (const doc of cursor) {
        const line = [
          escapeCsv(doc.name),
          escapeCsv(doc.code),
          escapeCsv(doc.organizationId),
          escapeCsv(doc.address),
          escapeCsv(doc.capacity),
          escapeCsv(doc.totalRooms),
          escapeCsv(doc.genderType),
          escapeCsv(doc.status),
        ].join(',') + '\n';
        res.write(line);
      }
      res.end();
      return;
    }

    if (reportType === 'users') {
      res.write('Name,Email,Username,Role,Organization ID,Status,Created At\n');
      const cursor = User.find().select('-password -refreshTokens').sort({ createdAt: -1 }).cursor();
      for await (const doc of cursor) {
        const line = [
          escapeCsv(doc.name),
          escapeCsv(doc.email),
          escapeCsv(doc.username),
          escapeCsv(doc.role),
          escapeCsv(doc.activeOrganizationId),
          escapeCsv(doc.isActive ? 'Active' : 'Deactivated'),
          escapeCsv(doc.createdAt ? doc.createdAt.toISOString() : ''),
        ].join(',') + '\n';
        res.write(line);
      }
      res.end();
      return;
    }

    if (reportType === 'audit_logs') {
      res.write('Timestamp,Actor Name,Actor Email,Action,Entity Type,Entity ID,Organization ID,IP Address\n');
      const cursor = AuditLog.find().sort({ createdAt: -1 }).limit(5000).cursor();
      for await (const doc of cursor) {
        const line = [
          escapeCsv(doc.createdAt ? doc.createdAt.toISOString() : ''),
          escapeCsv(doc.actorName),
          escapeCsv(doc.actorEmail),
          escapeCsv(doc.action),
          escapeCsv(doc.entityType),
          escapeCsv(doc.entityId),
          escapeCsv(doc.organizationId),
          escapeCsv(doc.ipAddress),
        ].join(',') + '\n';
        res.write(line);
      }
      res.end();
      return;
    }

    throw new Error(`Unsupported report type '${reportType}'`);
  },
};

module.exports = { reportExportService };
