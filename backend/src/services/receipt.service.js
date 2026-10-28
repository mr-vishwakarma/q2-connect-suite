const mongoose = require('mongoose');
const FeePayment = require('../models/FeePayment');
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const Organization = require('../models/Organization');
const InvoiceSequence = require('../models/InvoiceSequence');

/**
 * Normalizes month strings like "2025-10" or "October 2025"
 */
function formatMonthDisplay(monthStr) {
  if (!monthStr) return 'Current Month';
  if (/^\d{4}-\d{2}$/.test(monthStr)) {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  }
  return monthStr;
}

/**
 * Resolves dynamic branding according to the hierarchy:
 * 1. Branch (Hostel)
 * 2. Parent Organization
 * 3. Neutral Hosteliq Fallback
 */
function resolveBranding(hostel, organization, fallbackHostelName) {
  const particularHostelName = hostel?.name || fallbackHostelName || (organization?.name && organization.name !== 'Hosteliq' ? organization.name : null) || 'Hostel Campus';
  const orgName = particularHostelName;
  const branchName = particularHostelName;
  const tagline = hostel?.tagline || organization?.tagline || 'STUDENT RESIDENCE & ACCOMMODATION';

  // Logo resolution
  const logo = hostel?.logo || organization?.logo || '';

  // Address resolution
  let address = '';
  if (hostel?.address) {
    const parts = [
      hostel.address,
      hostel.city,
      hostel.state ? `${hostel.state}${hostel.pincode ? ' - ' + hostel.pincode : ''}` : hostel.pincode,
    ].filter(Boolean);
    address = parts.join(', ');
  } else if (organization?.address) {
    const parts = [
      organization.address,
      organization.city,
      organization.state ? `${organization.state}${organization.pincode ? ' - ' + organization.pincode : ''}` : organization.pincode,
    ].filter(Boolean);
    address = parts.join(', ');
  } else {
    address = 'Hostel Office Campus';
  }

  // Contact resolution
  const phone = hostel?.contactPhone || organization?.phone || '+91 98765 43210';
  const email = hostel?.contactEmail || organization?.contactEmail || 'office@hosteliq.in';

  return {
    organizationName: orgName,
    hostelName: particularHostelName,
    branchName,
    tagline,
    logo,
    address,
    phone,
    email,
    isBranchBranded: Boolean(hostel?.logo || hostel?.name),
  };
}

/**
 * Builds an immutable receipt snapshot
 */
function buildReceiptSnapshot({ payment, fee, student, hostel, organization, baseUrl }) {
  const branding = resolveBranding(hostel, organization, payment.hostel || student?.hostel);
  const clientUrl = baseUrl || process.env.CLIENT_URL || 'https://hosteliq.in';

  const paymentDate = payment.paymentDate ? new Date(payment.paymentDate) : new Date();
  const receiptNo = payment.receiptNo;
  const invoiceNo = fee?.receiptNo ? `INV-${fee.receiptNo.replace(/^RCPT-|^HLQ-/, '')}` : `INV-${receiptNo}`;

  // Student info
  const studentInfo = {
    id: student?._id?.toString() || payment.studentId?.toString(),
    name: student?.name || 'Student Resident',
    studentId: student?.studentCode || student?.username || 'STU-001',
    username: student?.username || 'resident',
    course: student?.course || 'General Residency',
    yearSemester: student?.yearSemester || 'Academic Resident',
    roomNo: student?.roomNo || 'N/A',
    floor: student?.floor || 'N/A',
  };

  // Billing period calculation
  const formattedMonth = formatMonthDisplay(payment.month || fee?.month);
  const dueDate = fee?.dueDate ? new Date(fee.dueDate) : new Date(paymentDate);
  const billingPeriod = fee?.periodStart && fee?.periodEnd
    ? `${new Date(fee.periodStart).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} - ${new Date(fee.periodEnd).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`
    : formattedMonth;

  // Calculate itemized breakdown
  const lineItems = [];
  let itemIndex = 1;

  const totalFeeBase = (fee?.amount || payment.amount || 0);
  const lateFee = payment.lateFee || fee?.lateFee || 0;
  const discount = payment.discount || fee?.discount || 0;

  // If hostel settings or student details indicate mess charges, break down proportionally
  // Default clean breakdown: Hostel Rent (base), plus any late fee / discount
  lineItems.push({
    index: itemIndex++,
    particulars: 'Hostel Rent',
    amount: totalFeeBase,
    isDeduction: false,
  });

  if (lateFee > 0) {
    lineItems.push({
      index: itemIndex++,
      particulars: 'Late Fee / Surcharge',
      amount: lateFee,
      isDeduction: false,
    });
  }

  if (discount > 0) {
    lineItems.push({
      index: itemIndex++,
      particulars: 'Concession / Fee Discount',
      amount: discount,
      isDeduction: true,
    });
  }

  const invoiceTotal = Math.max(0, totalFeeBase + lateFee - discount);
  const amountPaid = Number(payment.amount) || invoiceTotal;
  const totalPaidForFee = (fee?.paidAmount || amountPaid);
  const remainingBalance = Math.max(0, invoiceTotal - totalPaidForFee);

  const isFullSettlement = remainingBalance <= 0;
  const paymentStatus = isFullSettlement ? 'PAID' : 'PARTIALLY PAID';
  const confirmationMessage = isFullSettlement
    ? 'Payment received successfully.'
    : `Partial payment received. Balance due: ₹${remainingBalance.toLocaleString('en-IN')}`;

  const paymentDetails = {
    method: (payment.paymentMode || 'cash').toUpperCase(),
    transactionId: payment.transactionId || payment._id.toString().slice(-12).toUpperCase(),
    paidAmount: amountPaid,
    paymentStatus: isFullSettlement ? 'Success' : 'Partial Success',
    bankOrApp: payment.bankName || (payment.paymentMode === 'upi' ? 'UPI' : payment.paymentMode === 'cash' ? 'Cash Counter' : 'Bank Transfer'),
    receivedBy: payment.adminName || 'Authorized Hostel Warden',
  };

  const verificationUrl = `${clientUrl.replace(/\/$/, '')}/verify-receipt?no=${encodeURIComponent(receiptNo)}`;

  return {
    receiptNo,
    invoiceNo,
    issuedAt: paymentDate.toISOString(),
    receiptDate: paymentDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    paymentDate: paymentDate.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    status: paymentStatus,
    confirmationMessage,
    isFullSettlement,
    branding,
    student: studentInfo,
    billing: {
      month: formattedMonth,
      rawMonth: payment.month || fee?.month,
      dueDate: dueDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      paymentDate: paymentDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      billingPeriod,
      numberOfDays: 'Full Month',
    },
    lineItems,
    financials: {
      subtotal: totalFeeBase,
      lateFee,
      discount,
      totalAmount: invoiceTotal,
      amountPaid,
      remainingBalance,
    },
    paymentDetails,
    verificationUrl,
    notes: [
      'This is a system-generated receipt and does not require a physical signature.',
      'For any query, please contact the hostel office.',
    ],
  };
}

const receiptService = {
  /**
   * Generates a new unique receipt number atomically
   */
  async generateReceiptNumber(organizationId, branchCode = 'Q2G', period = null) {
    return InvoiceSequence.getNextReceiptNumber(organizationId, branchCode, period);
  },

  /**
   * Retrieves a receipt snapshot by receipt number, enforcing role-based and tenant authorization.
   * If snapshot already exists on payment, returns it to guarantee historical integrity.
   * If not, generates snapshot, saves it, and returns it.
   */
  async getReceiptByNumber(receiptNo, { user, tenant, isSuperAdmin, baseUrl }) {
    if (!receiptNo) {
      const err = new Error('Receipt number is required');
      err.statusCode = 400;
      throw err;
    }

    let payment = null;
    let currentStudent = null;

    if (user.role === 'student') {
      currentStudent = await Student.findOne({ userId: user._id }).lean();
      if (!currentStudent) {
        const err = new Error('Student profile not found');
        err.statusCode = 404;
        throw err;
      }
      payment = await FeePayment.findOne({ receiptNo, studentId: currentStudent._id }).lean();
      if (!payment) {
        const existsElsewhere = await FeePayment.exists({ receiptNo });
        if (existsElsewhere) {
          const err = new Error('Access denied: You are not authorized to view this receipt');
          err.statusCode = 403;
          throw err;
        }
        const err = new Error(`Receipt #${receiptNo} not found`);
        err.statusCode = 404;
        throw err;
      }
    } else if (!isSuperAdmin) {
      const orgId = tenant?.organizationId;
      payment = await FeePayment.findOne({
        receiptNo,
        ...(orgId ? { organizationId: orgId } : {}),
      }).lean();

      if (!payment) {
        const existsElsewhere = await FeePayment.exists({ receiptNo });
        if (existsElsewhere) {
          const err = new Error('Access denied: This receipt does not belong to your organization');
          err.statusCode = 403;
          throw err;
        }
        const err = new Error(`Receipt #${receiptNo} not found`);
        err.statusCode = 404;
        throw err;
      }

      if (tenant?.hostelAccess && !tenant.hostelAccess.includes('all')) {
        if (payment.hostel && !tenant.hostelAccess.includes(payment.hostel)) {
          const err = new Error('Access denied: Branch scope restriction');
          err.statusCode = 403;
          throw err;
        }
      }
    } else {
      payment = await FeePayment.findOne({ receiptNo }).lean();
      if (!payment) {
        const err = new Error(`Receipt #${receiptNo} not found`);
        err.statusCode = 404;
        throw err;
      }
    }

    // Return stored snapshot if already created (ensuring historical immutability)
    if (payment.receiptSnapshot && payment.receiptSnapshot.receiptNo === receiptNo) {
      return payment.receiptSnapshot;
    }

    // Otherwise, generate snapshot from underlying records and save it
    const [fee, student, hostel, organization] = await Promise.all([
      Fee.findById(payment.feeId).lean(),
      Student.findById(payment.studentId).lean(),
      payment.hostelId ? Hostel.findById(payment.hostelId).lean() : Hostel.findOne({ name: payment.hostel }).lean(),
      payment.organizationId ? Organization.findById(payment.organizationId).lean() : null,
    ]);

    const snapshot = buildReceiptSnapshot({
      payment,
      fee,
      student,
      hostel,
      organization,
      baseUrl,
    });

    // Save snapshot on FeePayment asynchronously for historical stability
    await FeePayment.findByIdAndUpdate(payment._id, { receiptSnapshot: snapshot });

    return snapshot;
  },

  /**
   * Public verification lookup by receipt number.
   * Returns non-sensitive, verified summary data for external QR scanners without leaking PII.
   */
  async verifyReceipt(receiptNo) {
    if (!receiptNo) {
      return { valid: false, message: 'Receipt number is required' };
    }

    const payment = await FeePayment.findOne({ receiptNo }).lean();
    if (!payment) {
      return { valid: false, message: 'Receipt not found or invalid' };
    }

    let snapshot = payment.receiptSnapshot;
    if (!snapshot) {
      const [fee, student, hostel, organization] = await Promise.all([
        Fee.findById(payment.feeId).lean(),
        Student.findById(payment.studentId).lean(),
        payment.hostelId ? Hostel.findById(payment.hostelId).lean() : Hostel.findOne({ name: payment.hostel }).lean(),
        payment.organizationId ? Organization.findById(payment.organizationId).lean() : null,
      ]);
      snapshot = buildReceiptSnapshot({ payment, fee, student, hostel, organization });
    }

    // Mask student name: "Aaradhya Sharma" -> "Aaradhya S."
    const nameParts = (snapshot.student?.name || 'Resident').split(' ');
    const maskedName = nameParts.length > 1
      ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
      : nameParts[0];

    return {
      valid: true,
      receiptNo: snapshot.receiptNo,
      invoiceNo: snapshot.invoiceNo,
      status: snapshot.status,
      hostelBranch: snapshot.branding?.branchName || 'Hosteliq Living',
      organizationName: snapshot.branding?.organizationName || 'Hosteliq',
      maskedStudentName: maskedName,
      billingMonth: snapshot.billing?.month,
      paidAmount: snapshot.financials?.amountPaid,
      paymentDate: snapshot.receiptDate,
      paymentMethod: snapshot.paymentDetails?.method,
      transactionId: snapshot.paymentDetails?.transactionId,
      verifiedAt: new Date().toISOString(),
    };
  },
};

module.exports = receiptService;
