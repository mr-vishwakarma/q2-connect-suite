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
  amount_paid: number; // ONLY amount allocated to fee liability
  remaining_fee_balance?: number;
  payment_mode: string;
  admin_name?: string | null;
  notes?: string | null;
  deposit_collected_separately?: number | null;
  deposit_receipt_no?: string | null;
}

export interface SecurityDepositReceiptData {
  receipt_no: string;
  payment_date: string;
  student_name: string;
  username: string;
  student_code?: string;
  room_no: string | null;
  hostel: string;
  deposit_amount: number; // ONLY security deposit collected
  total_required?: number;
  previously_paid?: number;
  remaining_balance?: number;
  payment_mode: string;
  admin_name?: string | null;
  notes?: string | null;
}

const HOSTEL_ADDR = 'Plot No. 8, Manak Vihar, Bhopal • +91 9691160716 • q2hostel@gmail.com';

/**
 * Generates an authoritative Hostel Fee Receipt.
 * Financial total reflects ONLY the monthly fee liability (rent + late fee - discount).
 * If security deposit was collected in the same operation, it is referenced as an
 * informational section ONLY and is NOT added to the fee subtotal or total.
 */
export async function generateFeeReceiptPDF(r: FeeReceiptData) {
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 40;

  // Header band
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, W, 80, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Q2 Group of Hostels', 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(HOSTEL_ADDR, 40, 58);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('HOSTEL FEE RECEIPT', W - 40, 40, { align: 'right' });
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
  row('Billing Month:', r.month);
  if (r.billing_period) row('Billing Period:', r.billing_period);
  row('Payment Mode:', (r.payment_mode || 'CASH').toUpperCase());
  if (r.admin_name) row('Received By:', r.admin_name);

  y += 6;
  doc.setDrawColor(220);
  doc.line(40, y, W - 40, y);
  y += 18;

  const item = (desc: string, amt: number, isMinus = false) => {
    if (amt <= 0) return;
    doc.setFont('helvetica', 'normal');
    doc.text(desc, 40, y);
    doc.setFont('helvetica', 'bold');
    const txt = `${isMinus ? '-' : ''}Rs. ${amt.toLocaleString('en-IN')}`;
    doc.text(txt, W - 40, y, { align: 'right' });
    y += 18;
  };

  item('Monthly Hostel Rent', r.monthly_fee);
  item('Late Fee', r.late_fee);
  item('Discount / Concession', r.discount, true);

  y += 6;
  doc.setFillColor(245, 245, 245);
  doc.rect(40, y, W - 80, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL FEE AMOUNT PAID', 50, y + 18);
  doc.text(`Rs. ${r.amount_paid.toLocaleString('en-IN')}`, W - 50, y + 18, { align: 'right' });
  y += 40;

  if (r.remaining_fee_balance && r.remaining_fee_balance > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(180, 83, 9);
    doc.text(`Remaining Fee Balance Due: Rs. ${r.remaining_fee_balance.toLocaleString('en-IN')}`, 40, y);
    y += 18;
  }

  // INFORMATIONAL SECTION: Security Deposit Collected Separately
  if (r.deposit_collected_separately && r.deposit_collected_separately > 0) {
    doc.setFillColor(240, 249, 255); // Sky 50
    doc.setDrawColor(186, 230, 253); // Sky 200
    doc.rect(40, y, W - 80, 46, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(3, 105, 161); // Sky 700
    doc.text(`Security Deposit Collected Separately: Rs. ${r.deposit_collected_separately.toLocaleString('en-IN')}`, 50, y + 17);
    doc.setFont('helvetica', 'normal');
    doc.text(`Security Deposit Receipt No.: ${r.deposit_receipt_no || 'Issued Separately'}`, 50, y + 32);

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('(Separate Security Deposit Receipt issued. Not included in fee total above)', W - 50, y + 32, { align: 'right' });
    y += 58;
  }

  if (r.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Notes / Reference: ${r.notes}`, 40, y);
    y += 20;
  }

  // Footer
  y = doc.internal.pageSize.getHeight() - 60;
  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('This is an official system-generated Hostel Fee Receipt from Q2 Group of Hostels. Keep it safe for your records.', 40, y);

  return doc;
}

/**
 * Generates an authoritative Security Deposit Receipt.
 * Labelled clearly as "Security Deposit Receipt" and reflects ONLY the security deposit liability.
 * Does not include monthly rent or late fees in the payable total.
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
  doc.text('Q2 Group of Hostels', 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(HOSTEL_ADDR, 40, 58);
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
  doc.setFillColor(236, 253, 245); // Emerald 50
  doc.setDrawColor(167, 243, 208); // Emerald 200
  doc.rect(40, y, W - 80, 28, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(6, 78, 59); // Emerald 900
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

  // Clear Legal / Informational Box
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(226, 232, 240); // Slate 200
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

  // Footer
  y = doc.internal.pageSize.getHeight() - 60;
  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('This is an official system-generated Security Deposit Receipt from Q2 Group of Hostels. Keep it safe for your records.', 40, y);

  return doc;
}

export async function downloadFeeReceipt(r: FeeReceiptData) {
  const doc = await generateFeeReceiptPDF(r);
  doc.save(`Fee-Receipt-${r.receipt_no}.pdf`);
}

export async function downloadSecurityDepositReceipt(r: SecurityDepositReceiptData) {
  const doc = await generateSecurityDepositReceiptPDF(r);
  doc.save(`SecurityDeposit-Receipt-${r.receipt_no}.pdf`);
}

export async function downloadBothReceipts(feeReceipt: FeeReceiptData, depositReceipt: SecurityDepositReceiptData) {
  await downloadFeeReceipt(feeReceipt);
  // Brief pause so browser downloads both files reliably
  await new Promise((resolve) => setTimeout(resolve, 350));
  await downloadSecurityDepositReceipt(depositReceipt);
}

export async function getFeeReceiptBlob(r: FeeReceiptData): Promise<Blob> {
  const doc = await generateFeeReceiptPDF(r);
  return doc.output('blob');
}

export async function getSecurityDepositReceiptBlob(r: SecurityDepositReceiptData): Promise<Blob> {
  const doc = await generateSecurityDepositReceiptPDF(r);
  return doc.output('blob');
}

/**
 * Legacy / General receipt PDF generator retained for backward compatibility.
 * Redirects to generateFeeReceiptPDF when no security deposit is bundled,
 * or handles combined data safely.
 */
export async function generateReceiptPDF(r: ReceiptData) {
  const feeData: FeeReceiptData = {
    receipt_no: r.receipt_no,
    payment_date: r.payment_date,
    student_name: r.student_name,
    username: r.username,
    student_code: r.student_code,
    room_no: r.room_no,
    hostel: r.hostel,
    month: r.month,
    billing_period: r.billing_period,
    monthly_fee: r.monthly_fee,
    late_fee: r.late_fee,
    discount: r.discount,
    amount_paid: r.amount_paid > 0 ? (r.amount_paid - (r.security_deposit || 0)) : r.monthly_fee,
    remaining_fee_balance: r.remaining_fee_balance,
    payment_mode: r.payment_mode,
    admin_name: r.admin_name,
    notes: r.notes,
    deposit_collected_separately: r.security_deposit > 0 ? r.security_deposit : r.deposit_collected_separately,
    deposit_receipt_no: r.deposit_receipt_no,
  };
  return generateFeeReceiptPDF(feeData);
}

export async function downloadReceipt(r: ReceiptData) {
  const doc = await generateReceiptPDF(r);
  doc.save(`Receipt-${r.receipt_no}.pdf`);
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

  // Header
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, W, 80, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Q2 Group of Hostels', 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(HOSTEL_ADDR, 40, 58);
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
    body: data.payments.map(p => [
      new Date(p.payment_date).toLocaleDateString('en-IN'),
      p.receipt_no,
      p.month,
      p.payment_mode.toUpperCase(),
      `Rs. ${p.amount.toLocaleString('en-IN')}`
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
  doc.text('This is a system-generated history report from Q2 Group of Hostels.', 40, y);

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

export async function printFeeReceipt(r: FeeReceiptData) {
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

