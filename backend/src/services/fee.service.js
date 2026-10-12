const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const SecurityDeposit = require('../models/SecurityDeposit');
const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const Settings = require('../models/Settings');

const feeService = {
  async getDashboardData({
    hostel,
    organizationId,
    page = 1,
    limit = 100,
    sortBy = 'roomNo',
    sortOrder = 'asc',
  }) {
    const skipAmount = (parseInt(page) - 1) * parseInt(limit);
    const limitAmount = parseInt(limit);

    const studentMatch = { isActive: { $ne: false } };
    if (organizationId) studentMatch.organizationId = organizationId;
    if (hostel && hostel !== 'All') studentMatch.hostel = hostel;

    const sortDirection = String(sortOrder).toLowerCase() === 'desc' ? -1 : 1;
    const sortStage = {};
    if (sortBy === 'name') {
      sortStage.name = sortDirection;
      sortStage.roomNo = 1;
    } else if (sortBy === 'createdAt') {
      sortStage.createdAt = sortDirection;
    } else {
      // Default: Natural Room Number sorting, secondary Name ascending
      sortStage.roomNo = sortDirection;
      sortStage.name = 1;
    }
    sortStage._id = 1;

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
      { $sort: sortStage },
      {
        $facet: {
          metadata: [{ $count: 'total' }],
          data: [{ $skip: skipAmount }, { $limit: limitAmount }],
        },
      },
    ];

    const result = await Student.aggregate(pipeline).collation({ locale: 'en', numericOrdering: true });
    const total = result[0]?.metadata[0] ? result[0].metadata[0].total : 0;
    const paginatedStudents = result[0]?.data || [];

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
      security_deposit: s.securityDeposit || 0,
      start_date: s.startDate,
      valid_date: s.validDate,
      username: s.username,
      student_code: s.studentCode || null,
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

  /**
   * Central backend fee-calculation service
   * Authoritatively computes base fee, paid amount, outstanding amount,
   * applicable late fee based on hostel policy, grace period, deposit due, and total payable.
   */
  async calculatePayableFee({
    studentId,
    hostelId,
    feeId,
    feeMonth,
    organizationId,
  }) {
    if (!studentId) {
      const err = new Error('studentId is required for fee calculation');
      err.statusCode = 400;
      throw err;
    }

    const studentQuery = { _id: studentId };
    if (organizationId) studentQuery.organizationId = organizationId;

    const student = await Student.findOne(studentQuery).lean();
    if (!student) {
      const error = new Error('Student not found in your organization');
      error.statusCode = 404;
      throw error;
    }

    // Determine target hostel
    const targetHostel = student.hostel || 'Q2';
    const targetHostelId = student.hostelId || hostelId;

    // Load hostel configuration & settings
    let hostelDoc = null;
    if (targetHostelId) {
      hostelDoc = await Hostel.findById(targetHostelId).lean();
    }
    if (!hostelDoc && organizationId) {
      hostelDoc = await Hostel.findOne({ organizationId, code: targetHostel }).lean();
    }

    let settings = null;
    if (organizationId) {
      settings = await Settings.findOne({ organizationId, hostel: targetHostel }).lean();
    }

    const lateFeePerDay = Number(settings?.lateFeePerDay ?? hostelDoc?.settings?.lateFeePerDay ?? 20);
    const gracePeriodDays = Number(settings?.gracePeriodDays ?? hostelDoc?.settings?.gracePeriodDays ?? 5);
    const monthlyRentDueDay = Number(settings?.monthlyRentDueDay ?? hostelDoc?.settings?.monthlyRentDueDay ?? 5);

    // Look for existing Fee record
    const feeFilter = { studentId: student._id };
    if (feeId) {
      feeFilter._id = feeId;
    } else if (feeMonth) {
      feeFilter.month = feeMonth;
    }
    if (organizationId) feeFilter.organizationId = organizationId;

    const fee = await Fee.findOne(feeFilter).lean();

    const baseMonthlyFee = Number(fee ? fee.amount : (student.fees || 0));
    const paidAmount = Number(fee?.paidAmount || 0);
    const discount = Number(fee?.discount || 0);
    const feeStatus = fee ? fee.status : (baseMonthlyFee === 0 ? 'paid' : 'unpaid');
    const outstandingBase = Math.max(0, baseMonthlyFee - paidAmount);

    // Determine due date
    let dueDate = null;
    if (fee?.dueDate) {
      dueDate = new Date(fee.dueDate);
    } else if (feeMonth) {
      const parsedMonth = new Date(feeMonth);
      if (!isNaN(parsedMonth.getTime())) {
        dueDate = new Date(parsedMonth.getFullYear(), parsedMonth.getMonth(), Math.min(monthlyRentDueDay, 28));
      } else {
        const parts = feeMonth.split(' ');
        if (parts.length === 2) {
          const monthIndex = new Date(`${parts[0]} 1, 2000`).getMonth();
          const year = parseInt(parts[1], 10);
          if (!isNaN(monthIndex) && !isNaN(year)) {
            dueDate = new Date(year, monthIndex, Math.min(monthlyRentDueDay, 28));
          }
        }
      }
    }

    if (!dueDate) {
      dueDate = student.validDate ? new Date(student.validDate) : new Date();
    }

    // Determine overdue and late fee
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkDue = new Date(dueDate);
    checkDue.setHours(0, 0, 0, 0);

    let applicableLateFee = 0;
    let daysOverdue = 0;
    let isOverdue = false;

    if (feeStatus !== 'paid' && outstandingBase > 0) {
      const msPerDay = 1000 * 60 * 60 * 24;
      const diffDays = Math.floor((today.getTime() - checkDue.getTime()) / msPerDay);
      if (diffDays > 0) {
        daysOverdue = diffDays;
        isOverdue = true;
        if (diffDays > gracePeriodDays) {
          const penaltyDays = diffDays - gracePeriodDays;
          applicableLateFee = penaltyDays * lateFeePerDay;
        }
      }
    }

    // Security deposit status
    const requiredDeposit = Number(student.securityDeposit || 0);
    const depositRecords = await SecurityDeposit.find({
      studentId: student._id,
      status: { $in: ['collected', 'held'] },
    }).lean();
    const collectedDeposit = depositRecords.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const depositDue = Math.max(0, requiredDeposit - collectedDeposit);

    // Total payable: (outstanding base + late fee - discount) + deposit due
    const monthlyTotal = Math.max(0, outstandingBase + applicableLateFee - discount);
    const totalPayable = monthlyTotal + depositDue;

    return {
      success: true,
      studentId: student._id,
      studentName: student.name,
      username: student.username,
      roomNo: student.roomNo,
      hostel: targetHostel,
      feeMonth: feeMonth || fee?.month || 'Current Month',
      feeId: fee?._id || null,
      baseFee: baseMonthlyFee,
      paidAmount,
      outstandingAmount: outstandingBase,
      applicableLateFee,
      discount,
      depositDue,
      totalPayable,
      dueDate,
      daysOverdue,
      gracePeriodDays,
      lateFeePerDay,
      isOverdue,
      feeStatus,
      securityDepositRequired: requiredDeposit,
      securityDepositCollected: collectedDeposit,
    };
  },
};

module.exports = feeService;
