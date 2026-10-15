const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const SecurityDeposit = require('../models/SecurityDeposit');
const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const Settings = require('../models/Settings');
const {
  calculateCycleDueDate,
  getNextMonthlyDueDate,
  calculateBillingPeriod,
  calculateLateFeeBreakdown,
  normalizeToDateOnly,
} = require('../utils/billingCycle');

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

    const [fees, payments, deposits, hostelSettings] = await Promise.all([
      Fee.find({ studentId: { $in: studentIds } }).select('-createdAt -updatedAt -__v').sort({ createdAt: -1 }).lean(),
      FeePayment.find({ studentId: { $in: studentIds } }).select('-createdAt -updatedAt -__v').sort({ paymentDate: -1 }).lean(),
      SecurityDeposit.find({ studentId: { $in: studentIds } }).select('-createdAt -updatedAt -__v').lean(),
      organizationId ? Settings.find({ organizationId }).lean() : Settings.find({}).lean(),
    ]);

    // Build fast settings map for late fee calculations
    const settingsMap = new Map();
    hostelSettings.forEach((s) => {
      const key = s.hostel;
      settingsMap.set(key, s);
    });

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
      welcome_email_status: s.welcomeEmailStatus || 'pending',
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
      period_start: f.periodStart || null,
      period_end: f.periodEnd || null,
      cycle_number: f.cycleNumber || null,
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
   * Central Authoritative Fee Calculation Service
   * 
   * Computes base fee, paid amount, outstanding amount, derived due date from joining date,
   * applicable late fee based on tenant policy, one-time security deposit due, and total payable.
   * 
   * Strict business rules:
   * - Recurring monthly due dates derive canonically from student.startDate (joining date)
   * - Security deposit is a ONE-TIME charge and is NEVER added into recurring monthly rent
   * - When all existing fees are paid, derives next eligible billing cycle and due date
   * - Unpaid previous cycles (arrears) take precedence over skipping forward
   * - Stored fee configuration is authoritative; no hardcoded ₹520
   */
  async calculatePayableFee({
    studentId,
    hostelId,
    feeId,
    feeMonth,
    organizationId,
    asOfDate,
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
    if (!settings) {
      settings = await Settings.findOne({ hostel: targetHostel }).lean();
    }

    const lateFeePerDay = Number(settings?.lateFeePerDay ?? hostelDoc?.settings?.lateFeePerDay ?? 20);
    const gracePeriodDays = Number(settings?.gracePeriodDays ?? hostelDoc?.settings?.gracePeriodDays ?? 5);

    // Canonical joining date anchor
    const joiningDate = student.startDate || student.createdAt || new Date();

    // Fetch all existing fee records for this student sorted chronologically
    const allStudentFees = await Fee.find({
      studentId: student._id,
      ...(organizationId ? { organizationId } : {}),
    })
      .sort({ createdAt: 1, dueDate: 1 })
      .lean();

    // Resolve which fee / cycle is being calculated
    let fee = null;
    let cycleIndex = 0;
    let targetBillingPeriod = null;

    if (feeId) {
      fee = allStudentFees.find((f) => String(f._id) === String(feeId));
    } else if (feeMonth) {
      fee = allStudentFees.find((f) => f.month === feeMonth);
    } else {
      // Default: Find the oldest unpaid or partial fee record (Case A & Case C: preserve arrears)
      const oldestUnpaid = allStudentFees.find((f) => f.status === 'unpaid' || f.status === 'partial');
      if (oldestUnpaid) {
        fee = oldestUnpaid;
      } else if (allStudentFees.length > 0) {
        // Case B: All existing cycles are fully settled.
        // Resolve the next eligible cycle index
        cycleIndex = allStudentFees.length;
        targetBillingPeriod = calculateBillingPeriod(joiningDate, cycleIndex);
      } else {
        // First admission cycle (cycle 0)
        cycleIndex = 0;
        targetBillingPeriod = calculateBillingPeriod(joiningDate, 0);
      }
    }

    // Determine authoritative base fee amount
    const studentContractedFee = Number(student.fees || 0);
    const baseMonthlyFee = studentContractedFee > 0 ? studentContractedFee : Number(fee?.amount || 0);
    const paidAmount = Number(fee?.paidAmount || 0);
    const discount = Number(fee?.discount || 0);
    const isExplicitlyPaid = fee?.status === 'paid';
    const outstandingBase = isExplicitlyPaid ? 0 : Math.max(0, baseMonthlyFee - paidAmount);
    let feeStatus = isExplicitlyPaid ? 'paid' : (outstandingBase === 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid'));

    // Determine authoritative Due Date & Billing Period
    let dueDate = null;
    let periodStart = null;
    let periodEnd = null;
    let resolvedMonth = feeMonth || fee?.month;

    if (fee) {
      // Existing fee record
      if (fee.dueDate) {
        dueDate = new Date(fee.dueDate);
      } else {
        // If due date was missing on historical record, derive from student joining date
        const feeIdx = allStudentFees.findIndex((f) => String(f._id) === String(fee._id));
        dueDate = calculateCycleDueDate(joiningDate, Math.max(0, feeIdx));
      }
      periodStart = fee.periodStart ? new Date(fee.periodStart) : dueDate;
      periodEnd = fee.periodEnd ? new Date(fee.periodEnd) : new Date(dueDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      resolvedMonth = fee.month;
    } else {
      // New / Next billing cycle
      if (!targetBillingPeriod) {
        targetBillingPeriod = calculateBillingPeriod(joiningDate, cycleIndex);
      }
      dueDate = targetBillingPeriod.dueDate;
      periodStart = targetBillingPeriod.periodStart;
      periodEnd = targetBillingPeriod.periodEnd;
      resolvedMonth = targetBillingPeriod.feeMonth;
    }

    // Authoritative Centralized Late Fee Calculation (Phase 3)
    const calculationDate = asOfDate || new Date();
    const lateFeeBreakdown = calculateLateFeeBreakdown({
      dueDate,
      asOfDate: calculationDate,
      gracePeriodDays,
      lateFeePerDay,
      isPaid: feeStatus === 'paid',
      historicalLateFee: fee?.lateFee,
    });

    const applicableLateFee = lateFeeBreakdown.lateFee;
    const daysOverdue = lateFeeBreakdown.overdueDays;
    const chargeableDays = lateFeeBreakdown.chargeableDays;
    const isOverdue = lateFeeBreakdown.isOverdue;

    if (feeStatus !== 'paid') {
      feeStatus = isOverdue ? 'overdue' : (paidAmount > 0 ? 'partial' : 'unpaid');
    }

    // Security Deposit: STRICT ONE-TIME CHARGE (Phase 4)
    const requiredDeposit = Number(student.securityDeposit || 0);
    const depositRecords = await SecurityDeposit.find({
      studentId: student._id,
      status: { $in: ['collected', 'held'] },
    }).lean();
    const collectedDeposit = depositRecords.reduce((sum, d) => sum + Number(d.amount || 0), 0);
    const depositDue = Math.max(0, requiredDeposit - collectedDeposit);

    // Monthly Rent Total: ONLY base + late fee - discount (DO NOT add deposit here!)
    const monthlyTotal = feeStatus === 'paid' ? 0 : Math.max(0, outstandingBase + applicableLateFee - discount);

    // Total Payable: Separate combination (Monthly Fee + One-Time Security Deposit Due)
    const totalPayable = monthlyTotal + depositDue;

    return {
      success: true,
      studentId: student._id,
      studentName: student.name,
      username: student.username,
      roomNo: student.roomNo,
      hostel: targetHostel,
      joiningDate,
      billingCycle: {
        periodStart,
        periodEnd,
        dueDate,
        feeMonth: resolvedMonth,
        cycleIndex,
      },
      feeId: fee?._id || null,
      feeMonth: resolvedMonth,
      dueDate,
      periodStart,
      periodEnd,
      baseFee: baseMonthlyFee,
      paidAmount,
      discount,
      outstandingAmount: outstandingBase,
      monthlyTotal,
      applicableLateFee,
      overdueDays: daysOverdue,
      chargeableDays,
      gracePeriodDays,
      lateFeePerDay,
      isOverdue,
      feeStatus,
      status: feeStatus,
      // Security Deposit explicitly distinct from recurring monthly rent
      securityDepositRequired: requiredDeposit,
      securityDepositCollected: collectedDeposit,
      depositDue,
      isDepositFullyPaid: depositDue === 0,
      totalPayable,
    };
  },
};

module.exports = feeService;
