import QRCode from 'qrcode';
import { FeeReceiptSnapshot } from '@/types/receipt';

export interface ReceiptData {
  receipt_no: string;
  payment_date: string;
  student_name: string;
  username: string;
  student_code?: string;
  room_no: string | null;
  hostel: string;
  month: string;
  billing_period?: string;
  monthly_fee: number;
  late_fee: number;
  discount: number;
  security_deposit: number;
  amount_paid: number;
  remaining_fee_balance?: number;
  payment_mode: string;
  admin_name?: string | null;
  notes?: string | null;
  deposit_collected_separately?: number | null;
  deposit_receipt_no?: string | null;
  course?: string;
  yearSemester?: string;
}

export interface FeeReceiptData {
  receipt_no: string;
  payment_date: string;
  student_name: string;
  username: string;
  student_code?: string;
  room_no: string | null;
  hostel: string;
  month: string;
  billing_period?: string;
  monthly_fee: number;
  late_fee: number;
  discount: number;
  amount_paid: number;
  remaining_fee_balance?: number;
  payment_mode: string;
  admin_name?: string | null;
  notes?: string | null;
  deposit_collected_separately?: number | null;
  deposit_receipt_no?: string | null;
  course?: string;
  yearSemester?: string;
  transactionId?: string;
  bankName?: string;
}

export interface SecurityDepositReceiptData {
  receipt_no: string;
  payment_date: string;
  student_name: string;
  username: string;
  student_code?: string;
  room_no: string | null;
  hostel: string;
  deposit_amount: number;
  total_required?: number;
  previously_paid?: number;
  remaining_balance?: number;
  payment_mode: string;
  admin_name?: string | null;
  notes?: string | null;
}

/**
 * Normalizes any fee receipt input into a comprehensive FeeReceiptSnapshot
 */
function normalizeToSnapshot(input: any): FeeReceiptSnapshot {
  if (input?.branding && input?.student && input?.billing && input?.financials) {
    return input as FeeReceiptSnapshot;
  }

  const receiptNo = input.receipt_no || input.receiptNo || 'RCPT-001';
  const hostelName = input.hostel || input.hostel_name || input.hostelName || input.branchName || 'Hostel Campus';
  const studentName = input.student_name || input.studentName || 'Student';
  const username = input.username || 'resident';
  const studentId = input.student_code || input.studentCode || username;
  const roomNo = input.room_no || input.roomNo || 'N/A';
  const month = input.month || 'Current Month';
  const billingPeriod = input.billing_period || input.billingPeriod || month;
  const paymentMode = (input.payment_mode || input.paymentMode || 'UPI').toUpperCase();
  const paymentDate = input.payment_date || input.paymentDate || new Date().toISOString();
  const amountPaid = input.amount_paid !== undefined ? Number(input.amount_paid) : (input.amount !== undefined ? Number(input.amount) : 0);
  const monthlyFee = Number(input.monthly_fee || input.amount || amountPaid);
  const lateFee = Number(input.late_fee || input.lateFee || 0);
  const discount = Number(input.discount || 0);
  const remainingBalance = Number(input.remaining_fee_balance || input.remainingBalance || 0);
  const adminName = input.admin_name || input.adminName || 'Hostel Warden';
  const notes = input.notes ? [input.notes] : [
    'This is a system-generated receipt and does not require a physical signature.',
    'For any query, please contact the hostel office.',
  ];

  const lineItems = [
    { index: 1, particulars: 'Hostel Rent', amount: monthlyFee, isDeduction: false },
  ];
  let idx = 2;
  if (lateFee > 0) {
    lineItems.push({ index: idx++, particulars: 'Late Fee / Surcharge', amount: lateFee, isDeduction: false });
  }
  if (discount > 0) {
    lineItems.push({ index: idx++, particulars: 'Concession / Fee Discount', amount: discount, isDeduction: true });
  }

  const invoiceNo = `INV-${receiptNo.replace(/^RCPT-|^HLQ-/, '')}`;
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hosteliq.in';
  const verificationUrl = `${origin}/verify-receipt?no=${encodeURIComponent(receiptNo)}`;

  return {
    receiptNo,
    invoiceNo,
    issuedAt: paymentDate,
    receiptDate: new Date(paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    paymentDate: new Date(paymentDate).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }),
    status: remainingBalance <= 0 ? 'PAID' : 'PARTIALLY PAID',
    confirmationMessage: remainingBalance <= 0
      ? 'Payment received successfully.'
      : `Partial payment received. Balance due: Rs. ${remainingBalance.toLocaleString('en-IN')}`,
    isFullSettlement: remainingBalance <= 0,
    branding: {
      organizationName: hostelName,
      hostelName: hostelName,
      branchName: hostelName,
      tagline: input.tagline || 'STUDENT RESIDENCE & ACCOMMODATION',
      logo: input.logo || '',
      address: input.address || input.hostel_address || 'Hostel Campus, Student Living Block',
      phone: input.phone || input.hostel_phone || '+91 98765 43210',
      email: input.email || input.hostel_email || 'office@hosteliq.in',
    },
    student: {
      name: studentName,
      studentId,
      username,
      course: input.course || 'B.Tech / Degree Residency',
      yearSemester: input.yearSemester || 'Academic Resident',
      roomNo,
    },
    billing: {
      month,
      dueDate: new Date(paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      paymentDate: new Date(paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      billingPeriod,
      numberOfDays: 'Full Month',
    },
    lineItems,
    financials: {
      subtotal: monthlyFee,
      lateFee,
      discount,
      totalAmount: Math.max(0, monthlyFee + lateFee - discount),
      amountPaid,
      remainingBalance,
    },
    paymentDetails: {
      method: paymentMode,
      transactionId: input.transactionId || receiptNo.slice(-10).toUpperCase(),
      paidAmount: amountPaid,
      paymentStatus: 'Success',
      bankOrApp: input.bankName || (paymentMode === 'UPI' ? 'UPI' : paymentMode === 'CASH' ? 'Cash Counter' : 'Bank Transfer'),
      receivedBy: adminName,
    },
    verificationUrl,
    notes,
  };
}

/**
 * Generates an authoritative Master Hostel Fee Receipt PDF matching the reference template.
 * Layout: A4 portrait, lavender pill, green PAID card, two-card student/billing split,
 * itemized breakdown table, centered pale logo watermark, payment details card, QR code, and footer.
 */
export async function generateFeeReceiptPDF(input: FeeReceiptData | FeeReceiptSnapshot | ReceiptData) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const snap = normalizeToSnapshot(input);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(); // 595.28 pt
  const H = doc.internal.pageSize.getHeight(); // 841.89 pt
  const margin = 36;
  const contentWidth = W - margin * 2; // 523.28 pt

  // ==========================================
  // 1. Centered Pale Watermark (~4-5% opacity, NO text name)
  // ==========================================
  // @ts-ignore
  if (doc.GState) {
    // @ts-ignore
    doc.saveGraphicsState();
    // @ts-ignore
    doc.setGState(new doc.GState({ opacity: 0.045 }));

    // Hostel IQ architectural logo mark watermark (strictly without text name)
    const cx = W / 2;
    const cy = H / 2 - 20;

    doc.setDrawColor(109, 40, 217);
    doc.setFillColor(109, 40, 217);
    doc.setLineWidth(14);

    // Modern pitched roof
    doc.line(cx - 105, cy - 5, cx, cy - 80);
    doc.line(cx, cy - 80, cx + 105, cy - 5);

    // Roof ridge peak emblem
    doc.circle(cx, cy - 38, 12, 'F');

    // Building pillars & portals
    doc.roundedRect(cx - 80, cy + 10, 32, 75, 4, 4, 'F');
    doc.roundedRect(cx - 20, cy + 28, 40, 57, 5, 5, 'F');
    doc.roundedRect(cx + 48, cy + 10, 32, 75, 4, 4, 'F');

    // Foundation Base
    doc.roundedRect(cx - 95, cy + 92, 190, 10, 3, 3, 'F');

    // @ts-ignore
    doc.restoreGraphicsState();
  }

  // ==========================================
  // 2. Top Header & Issuer Information
  // ==========================================
  let y = 40;

  // Left side: Particular Hostel's Name (Top Left), Tagline & Address
  const particularHostelName =
    snap.branding.hostelName ||
    (snap.branding.organizationName && snap.branding.organizationName !== 'Hosteliq'
      ? snap.branding.organizationName
      : null) ||
    snap.branding.branchName ||
    (snap.student as any)?.hostel ||
    'Hostel Campus';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(particularHostelName, margin, y);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(124, 58, 237); // Purple 600
  doc.text(snap.branding.tagline || 'STUDENT RESIDENCE & ACCOMMODATION', margin, y + 11);

  let nextY = y + 25;
  if (snap.branding.branchName && snap.branding.branchName !== particularHostelName) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text(snap.branding.branchName, margin, nextY);
    nextY += 14;
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // Slate 500
  const addressLines = doc.splitTextToSize(snap.branding.address || '', 240);
  doc.text(addressLines, margin, nextY);

  const contactY = nextY + addressLines.length * 10;
  doc.text(`Phone: ${snap.branding.phone || 'N/A'}`, margin, contactY);
  doc.text(`Email: ${snap.branding.email || 'N/A'}`, margin, contactY + 11);

  // Right side: Fee Receipt Pill
  const pillW = 150;
  const pillH = 34;
  const pillX = W - margin - pillW;
  doc.setFillColor(245, 237, 255); // #f5edff
  doc.setDrawColor(221, 214, 254); // #ddd6fe
  doc.roundedRect(pillX, 36, pillW, pillH, 8, 8, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(126, 34, 206); // Purple 700
  doc.text('FEE RECEIPT', pillX + pillW / 2, 49, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105); // Slate 600
  doc.text(`# ${snap.receiptNo}`, pillX + pillW / 2, 62, { align: 'center' });

  // Right side: Green Confirmation Card
  const greenW = 165;
  const greenH = 34;
  const greenX = W - margin - greenW;
  doc.setFillColor(236, 253, 245); // #ecfdf5
  doc.setDrawColor(167, 243, 208); // #a7f3d0
  doc.roundedRect(greenX, 76, greenW, greenH, 7, 7, 'FD');

  // Green circle checkmark
  doc.setFillColor(16, 185, 129); // Emerald 500
  doc.circle(greenX + 16, 93, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('✓', greenX + 16, 96, { align: 'center' });

  // Status text
  doc.setTextColor(4, 120, 87); // Emerald 700
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(snap.status, greenX + 30, 90);

  doc.setTextColor(6, 95, 70);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(snap.isFullSettlement ? 'Payment received successfully.' : 'Partial payment received.', greenX + 30, 101);

  // Right side: Meta Key-Values Table
  let metaY = 118;
  const drawMetaRow = (label: string, val: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(label, W - margin - 120, metaY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`: ${val}`, W - margin - 55, metaY);
    metaY += 12;
  };

  drawMetaRow('Receipt Date', snap.receiptDate);
  drawMetaRow('Payment Date', snap.paymentDate);
  drawMetaRow('Invoice No.', snap.invoiceNo);
  drawMetaRow('Receipt No.', snap.receiptNo);

  // ==========================================
  // 3. Side-by-Side Cards (Student & Billing)
  // ==========================================
  y = 172;
  const cardW = (contentWidth - 14) / 2;
  const cardH = 92;

  // --- Left Card: Student Details ---
  const leftX = margin;
  doc.setFillColor(252, 250, 255); // #fcfaff
  doc.setDrawColor(237, 233, 254); // #ede9fe
  doc.roundedRect(leftX, y, cardW, cardH, 7, 7, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(109, 40, 217); // Purple 700
  doc.text('STUDENT DETAILS', leftX + 10, y + 15);

  doc.setDrawColor(241, 238, 255);
  doc.line(leftX + 10, y + 20, leftX + cardW - 10, y + 20);

  let stuRowY = y + 33;
  const drawStuRow = (l: string, v: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(l, leftX + 10, stuRowY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`: ${v}`, leftX + 85, stuRowY);
    stuRowY += 13;
  };

  drawStuRow('Name', snap.student.name);
  drawStuRow('Student ID', snap.student.studentId);
  drawStuRow('Course', snap.student.course);
  drawStuRow('Year / Semester', snap.student.yearSemester);
  drawStuRow('Room No.', snap.student.roomNo);

  // --- Right Card: Billing Period ---
  const rightX = margin + cardW + 14;
  doc.setFillColor(252, 250, 255);
  doc.setDrawColor(237, 233, 254);
  doc.roundedRect(rightX, y, cardW, cardH, 7, 7, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(109, 40, 217);
  doc.text('BILLING PERIOD', rightX + 10, y + 15);

  doc.setDrawColor(241, 238, 255);
  doc.line(rightX + 10, y + 20, rightX + cardW - 10, y + 20);

  let billRowY = y + 33;
  const drawBillRow = (l: string, v: string) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(l, rightX + 10, billRowY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(`: ${v}`, rightX + 85, billRowY);
    billRowY += 13;
  };

  drawBillRow('Month', snap.billing.month);
  drawBillRow('Due Date', snap.billing.dueDate);
  drawBillRow('Payment Date', snap.billing.paymentDate);
  drawBillRow('No. of Days', snap.billing.numberOfDays);

  // ==========================================
  // 4. Fee Breakdown Table
  // ==========================================
  y = y + cardH + 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(109, 40, 217);
  doc.text('FEE BREAKDOWN', margin, y);

  y += 7;
  const tableBody = snap.lineItems.map((item, idx) => [
    String(item.index || idx + 1),
    item.particulars,
    `${item.isDeduction ? '-' : ''}${Number(item.amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
  ]);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Particulars', 'Amount (Rs.)']],
    body: tableBody,
    theme: 'plain',
    headStyles: {
      fillColor: [246, 239, 254], // #f6effe
      textColor: [51, 65, 85],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    styles: {
      fontSize: 8,
      cellPadding: 6,
      textColor: [30, 41, 59],
      lineColor: [241, 238, 255],
      lineWidth: 0.5,
    },
    columnStyles: {
      0: { cellWidth: 35, halign: 'center', textColor: [148, 163, 184] },
      1: { halign: 'left' },
      2: { cellWidth: 100, halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: margin, right: margin },
  });

  // @ts-ignore
  let afterTableY = doc.lastAutoTable.finalY;

  // Lavender Total Band
  const totalBandH = 28;
  doc.setFillColor(245, 237, 255); // #f5edff
  doc.setDrawColor(221, 214, 254);
  doc.roundedRect(margin, afterTableY, contentWidth, totalBandH, 5, 5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(107, 33, 168); // Purple 800
  doc.text('TOTAL AMOUNT PAID', margin + 12, afterTableY + 18);

  doc.setFontSize(11);
  doc.text(
    `Rs. ${Number(snap.financials.amountPaid).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`,
    W - margin - 12,
    afterTableY + 18,
    { align: 'right' }
  );

  y = afterTableY + totalBandH + 16;

  // Remaining balance alert if any
  if (snap.financials.remainingBalance > 0) {
    doc.setFillColor(254, 243, 199); // Amber 100
    doc.setDrawColor(251, 191, 36);
    doc.roundedRect(margin, y, contentWidth, 20, 4, 4, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(146, 64, 14);
    doc.text('Remaining Unpaid Balance Due:', margin + 10, y + 13);
    doc.text(
      `Rs. ${Number(snap.financials.remainingBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
      W - margin - 10,
      y + 13,
      { align: 'right' }
    );
    y += 28;
  }

  // ==========================================
  // 5. Payment Details Card & Verification QR
  // ==========================================
  const payCardW = contentWidth - 110;
  const payCardH = 80;

  // Left: Payment Details Card
  doc.setFillColor(244, 252, 246); // #f4fcf6
  doc.setDrawColor(187, 247, 208); // #bbf7d0
  doc.roundedRect(margin, y, payCardW, payCardH, 7, 7, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(21, 128, 61); // Emerald 700
  doc.text('PAYMENT DETAILS', margin + 10, y + 15);

  doc.setDrawColor(220, 252, 231);
  doc.line(margin + 10, y + 20, margin + payCardW - 10, y + 20);

  let payRowY = y + 33;
  const drawPayRow = (l: string, v: string, isGreen = false) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(l, margin + 10, payRowY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(isGreen ? 22 : 30, isGreen ? 163 : 41, isGreen ? 74 : 59);
    doc.text(`: ${v}`, margin + 120, payRowY);
    payRowY += 12;
  };

  drawPayRow('Payment Method', snap.paymentDetails.method);
  drawPayRow('Transaction ID / UTR', snap.paymentDetails.transactionId);
  drawPayRow(
    'Paid Amount',
    `Rs. ${Number(snap.paymentDetails.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
  );
  drawPayRow('Payment Status', snap.paymentDetails.paymentStatus, true);
  drawPayRow('Bank / UPI App', snap.paymentDetails.bankOrApp);

  // Right: QR Code Box
  const qrBoxX = margin + payCardW + 12;
  const qrBoxW = contentWidth - payCardW - 12; // ~98 pt
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(qrBoxX, y, qrBoxW, payCardH, 7, 7, 'FD');

  try {
    const qrDataUrl = await QRCode.toDataURL(snap.verificationUrl, {
      margin: 1,
      width: 120,
    });
    doc.addImage(qrDataUrl, 'PNG', qrBoxX + (qrBoxW - 56) / 2, y + 6, 56, 56);
  } catch (qrErr) {
    console.error('Failed to render QR on PDF:', qrErr);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Scan to verify this receipt', qrBoxX + qrBoxW / 2, y + 71, { align: 'center' });

  y += payCardH + 14;

  // ==========================================
  // 6. Notes Section
  // ==========================================
  const notesH = 34;
  doc.setFillColor(251, 250, 255);
  doc.setDrawColor(241, 238, 255);
  doc.roundedRect(margin, y, contentWidth, notesH, 6, 6, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(88, 28, 135);
  doc.text('Notes', margin + 10, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('•  This is a system-generated receipt and does not require a physical signature.', margin + 12, y + 23);
  doc.text('•  For any query, please contact the hostel office.', margin + 12, y + 32);

  // ==========================================
  // 7. Footer Section
  // ==========================================
  const footerY = H - 42;
  doc.setDrawColor(241, 245, 249);
  doc.line(margin, footerY - 10, W - margin, footerY - 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(126, 34, 206);
  doc.text('Thank you!', margin, footerY + 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('For being a part of our hostel community.', margin, footerY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);
  doc.text(particularHostelName, W - margin, footerY + 2, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Managed with 💜 by Hosteliq', W - margin, footerY + 12, { align: 'right' });

  return doc;
}

/**
 * Downloads the Master Fee Receipt PDF
 */
export async function downloadFeeReceipt(r: FeeReceiptData | FeeReceiptSnapshot | ReceiptData) {
  const doc = await generateFeeReceiptPDF(r);
  const snap = normalizeToSnapshot(r);
  const sanitizedReceiptNo = (snap.receiptNo || 'Receipt').replace(/[^a-zA-Z0-9_-]/g, '_');
  doc.save(`Hostel-Receipt-${sanitizedReceiptNo}.pdf`);
}

/**
 * Generates an authoritative Security Deposit Receipt PDF
 */
export async function generateSecurityDepositReceiptPDF(r: SecurityDepositReceiptData) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 40;

  // Header band - Emerald / Deep Teal for distinct deposit identity
  doc.setFillColor(6, 78, 59); // Emerald 900
  doc.rect(0, 0, W, 80, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(r.hostel || 'Hostel Campus', 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Official Security Deposit Statement', 40, 58);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('SECURITY DEPOSIT RECEIPT', W - 40, 40, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`#${r.receipt_no}`, W - 40, 58, { align: 'right' });

  y = 110;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);

  const row = (l: string, v: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(l, 40, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, 180, y);
    y += 18;
  };

  const formattedDate = r.payment_date ? new Date(r.payment_date).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
  row('Receipt Date:', formattedDate);
  row('Hostel Branch:', r.hostel);
  row('Student Name:', r.student_name);
  row('Student Identifier:', r.student_code ? `${r.username} (${r.student_code})` : `@${r.username}`);
  row('Room No:', r.room_no || 'N/A');
  row('Liability Category:', 'One-Time Security Deposit (Refundable)');
  row('Payment Mode:', (r.payment_mode || 'CASH').toUpperCase());
  if (r.admin_name) row('Received By:', r.admin_name);

  y += 6;
  doc.setDrawColor(220);
  doc.line(40, y, W - 40, y);
  y += 18;

  const item = (desc: string, amt: number) => {
    if (amt === undefined || amt === null) return;
    doc.setFont('helvetica', 'normal');
    doc.text(desc, 40, y);
    doc.setFont('helvetica', 'bold');
    const txt = `Rs. ${amt.toLocaleString('en-IN')}`;
    doc.text(txt, W - 40, y, { align: 'right' });
    y += 18;
  };

  if (r.total_required !== undefined) {
    item('Total Security Deposit Required', r.total_required);
  }
  if (r.previously_paid !== undefined && r.previously_paid > 0) {
    item('Amount Previously Paid', r.previously_paid);
  }
  item('Security Deposit Amount Collected Now', r.deposit_amount);

  y += 6;
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.rect(40, y, W - 80, 28, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(6, 78, 59);
  doc.text('TOTAL DEPOSIT RECEIVED', 50, y + 18);
  doc.text(`Rs. ${r.deposit_amount.toLocaleString('en-IN')}`, W - 50, y + 18, { align: 'right' });
  y += 44;

  const remaining = r.remaining_balance ?? 0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  if (remaining > 0) {
    doc.setTextColor(180, 83, 9);
    doc.text(`Remaining Unpaid Deposit Balance: Rs. ${remaining.toLocaleString('en-IN')}`, 40, y);
  } else {
    doc.setTextColor(5, 150, 105);
    doc.text('Security Deposit Status: FULLY SETTLED', 40, y);
  }
  y += 24;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(40, y, W - 80, 48, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text('IMPORTANT POLICY NOTICE:', 50, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('This document is an official receipt for a one-time refundable security deposit, not recurring monthly rent.', 50, y + 28);
  doc.text('Refundable upon formal student checkout subject to room clearance and applicable hostel rules.', 50, y + 40);
  y += 62;

  if (r.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Notes / Reference: ${r.notes}`, 40, y);
    y += 20;
  }

  y = doc.internal.pageSize.getHeight() - 60;
  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('This is an official system-generated Security Deposit Receipt from Hosteliq. Keep it safe for your records.', 40, y);

  return doc;
}

export async function downloadSecurityDepositReceipt(r: SecurityDepositReceiptData) {
  const doc = await generateSecurityDepositReceiptPDF(r);
  doc.save(`SecurityDeposit-Receipt-${r.receipt_no}.pdf`);
}

export async function downloadBothReceipts(
  feeReceipt: FeeReceiptData | FeeReceiptSnapshot,
  depositReceipt: SecurityDepositReceiptData
) {
  await downloadFeeReceipt(feeReceipt);
  await new Promise((resolve) => setTimeout(resolve, 350));
  await downloadSecurityDepositReceipt(depositReceipt);
}

export async function getFeeReceiptBlob(r: FeeReceiptData | FeeReceiptSnapshot): Promise<Blob> {
  const doc = await generateFeeReceiptPDF(r);
  return doc.output('blob');
}

export async function getSecurityDepositReceiptBlob(r: SecurityDepositReceiptData): Promise<Blob> {
  const doc = await generateSecurityDepositReceiptPDF(r);
  return doc.output('blob');
}

export async function generateReceiptPDF(r: ReceiptData | FeeReceiptSnapshot) {
  return generateFeeReceiptPDF(r);
}

export async function downloadReceipt(r: ReceiptData | FeeReceiptSnapshot) {
  return downloadFeeReceipt(r);
}

export interface HistoryReceiptData {
  student_name: string;
  username: string;
  room_no: string | null;
  hostel: string;
  payments: Array<{
    payment_date: string;
    month: string;
    amount: number;
    payment_mode: string;
    receipt_no: string;
  }>;
}

export async function generateHistoryReceipt(data: HistoryReceiptData) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 40;

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 80, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(data.hostel || 'Hostel Campus', 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Official Payment History Ledger', 40, 58);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PAYMENT HISTORY', W - 40, 40, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, W - 40, 58, { align: 'right' });

  y = 110;
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(10);

  const row = (l: string, v: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(l, 40, y);
    doc.setFont('helvetica', 'normal');
    doc.text(v, 180, y);
    y += 18;
  };

  row('Student Name:', data.student_name);
  row('User ID:', data.username);
  row('Room No:', data.room_no || 'N/A');
  row('Hostel:', data.hostel);

  y += 20;
  const totalPaid = data.payments.reduce((sum, p) => sum + Number(p.amount), 0);

  autoTable(doc, {
    startY: y,
    head: [['Date', 'Receipt No.', 'Fee Month', 'Mode', 'Amount Paid']],
    body: data.payments.map((p) => [
      new Date(p.payment_date).toLocaleDateString('en-IN'),
      p.receipt_no,
      p.month,
      p.payment_mode.toUpperCase(),
      `Rs. ${p.amount.toLocaleString('en-IN')}`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [15, 23, 42] },
    margin: { top: 40, left: 40, right: 40 },
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 30;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Total Amount Paid:', 40, y);
  doc.text(`Rs. ${totalPaid.toLocaleString('en-IN')}`, W - 40, y, { align: 'right' });

  y = doc.internal.pageSize.getHeight() - 60;
  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 18;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('This is a system-generated history report from Hosteliq.', 40, y);

  return doc;
}

export async function downloadHistoryReceipt(data: HistoryReceiptData) {
  const doc = await generateHistoryReceipt(data);
  doc.save(`History-${data.username}-${Date.now()}.pdf`);
}

export async function getHistoryReceiptBlob(data: HistoryReceiptData): Promise<Blob> {
  const doc = await generateHistoryReceipt(data);
  return doc.output('blob');
}

export async function printFeeReceipt(r: FeeReceiptData | FeeReceiptSnapshot | ReceiptData) {
  const doc = await generateFeeReceiptPDF(r);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.focus();
  }
}

export async function printSecurityDepositReceipt(r: SecurityDepositReceiptData) {
  const doc = await generateSecurityDepositReceiptPDF(r);
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (win) {
    win.focus();
  }
}
