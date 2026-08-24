const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const SecurityDeposit = require('../models/SecurityDeposit');
const Student = require('../models/Student');

const feeService = {
  async getDashboardData({ hostel, organizationId, page = 1, limit = 100 }) {
    const skipAmount = (parseInt(page) - 1) * parseInt(limit);
    const limitAmount = parseInt(limit);

    const studentMatch = { isActive: { $ne: false } };
    if (organizationId) studentMatch.organizationId = organizationId;
    if (hostel && hostel !== 'All') studentMatch.hostel = hostel;

    const pipeline = [
      { $match: studentMatch },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: false } },
      {
        $match: {
          'user.role': { $ne: 'admin' },
          'user.admin': { $ne: true },
          'user.isActive': { $ne: false },
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skipAmount }, { $limit: limitAmount }],
        },
      },
    ];

    const result = await Student.aggregate(pipeline);
    const total = result[0].metadata[0] ? result[0].metadata[0].total : 0;
    const paginatedStudents = result[0].data;

    const studentIds = paginatedStudents.map((s) => s._id);

    const [fees, payments, deposits] = await Promise.all([
      Fee.find({ studentId: { $in: studentIds } }).select('-createdAt -updatedAt -__v').sort({ createdAt: -1 }).lean(),
      FeePayment.find({ studentId: { $in: studentIds } }).select('-createdAt -updatedAt -__v').sort({ paymentDate: -1 }).lean(),
      SecurityDeposit.find({ studentId: { $in: studentIds } }).select('-createdAt -updatedAt -__v').lean(),
    ]);

    const mappedStudents = paginatedStudents.map((s) => ({
      id: s._id,
      user_id: s.user._id,
      name: s.name,
      phone: s.phone,
      parent_phone: s.parentPhone,
      room_no: s.roomNo,
      floor: s.floor || null,
      profile_photo: s.profilePhoto || null,
      fees: s.fees,
      start_date: s.startDate,
      valid_date: s.validDate,
      username: s.username,
    }));

    const mappedFees = fees.map((f) => ({
      id: f._id,
      student_id: f.studentId,
      month: f.month,
      amount: f.amount,
      paid_date: f.paidDate,
      payment_mode: f.paymentMode,
      status: f.status,
      due_date: f.dueDate,
      late_fee: f.lateFee,
      discount: f.discount,
      paid_amount: f.paidAmount,
      receipt_no: f.receiptNo,
      notes: f.notes,
    }));

    const mappedPayments = payments.map((p) => ({
      id: p._id,
      fee_id: p.feeId,
      student_id: p.studentId,
      receipt_no: p.receiptNo,
      amount: p.amount,
      late_fee: p.lateFee,
      discount: p.discount,
      security_deposit: p.securityDeposit,
      payment_mode: p.paymentMode,
      payment_date: p.paymentDate,
      admin_name: p.adminName,
      month: p.month,
      notes: p.notes,
    }));

    const mappedDeposits = deposits.map((d) => ({
      id: d._id,
      student_id: d.studentId,
      amount: d.amount,
      status: d.status,
      collected_date: d.collectedDate,
      refund_date: d.refundDate,
    }));

    return {
      students: mappedStudents,
      fees: mappedFees,
      payments: mappedPayments,
      deposits: mappedDeposits,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limitAmount),
      limit: limitAmount,
    };
  },
};

module.exports = feeService;
