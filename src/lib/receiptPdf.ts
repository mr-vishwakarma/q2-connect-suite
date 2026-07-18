import jsPDF from 'jspdf';

export interface ReceiptData {
  receipt_no: string;
  payment_date: string;
  student_name: string;
  username: string;
  room_no: string | null;
  hostel: string;
  month: string;
  monthly_fee: number;
  late_fee: number;
  discount: number;
  security_deposit: number;
  amount_paid: number;
  payment_mode: string;
  admin_name?: string | null;
  notes?: string | null;
}

const HOSTEL_ADDR = 'Plot No. 8, Manak Vihar, Bhopal • +91 9691160716 • q2hostel@gmail.com';

export function generateReceiptPDF(r: ReceiptData): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 40;

  // Header band
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
  doc.text('FEE RECEIPT', W - 40, 40, { align: 'right' });
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

  row('Receipt Date:', new Date(r.payment_date).toLocaleDateString('en-IN'));
  row('Hostel:', r.hostel);
  row('Student Name:', r.student_name);
  row('User ID:', r.username);
  row('Room No:', r.room_no || 'N/A');
  row('Fee Month:', r.month);

  y += 10;
  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('Description', 40, y);
  doc.text('Amount (INR)', W - 40, y, { align: 'right' });
  y += 6;
  doc.line(40, y, W - 40, y);
  y += 18;

  const lineItem = (l: string, amt: number, sign: 1 | -1 = 1) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(l, 40, y);
    const val = (sign < 0 ? '- ' : '') + amt.toLocaleString('en-IN');
    doc.text(val, W - 40, y, { align: 'right' });
    y += 18;
  };

  lineItem(`Monthly Fee (${r.month})`, r.monthly_fee);
  if (r.late_fee > 0) lineItem('Late Fee', r.late_fee);
  if (r.security_deposit > 0) lineItem('Security Deposit', r.security_deposit);
  if (r.discount > 0) lineItem('Discount', r.discount, -1);

  y += 4;
  doc.line(40, y, W - 40, y);
  y += 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Amount Paid', 40, y);
  doc.text(`Rs. ${r.amount_paid.toLocaleString('en-IN')}`, W - 40, y, { align: 'right' });
  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Payment Mode: ${r.payment_mode.toUpperCase()}`, 40, y);
  y += 16;
  if (r.admin_name) { doc.text(`Collected By: ${r.admin_name}`, 40, y); y += 16; }
  if (r.notes) { doc.text(`Notes: ${r.notes}`, 40, y); y += 16; }

  y = doc.internal.pageSize.getHeight() - 60;
  doc.setDrawColor(200);
  doc.line(40, y, W - 40, y);
  y += 18;
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('This is a system-generated receipt from Q2 Group of Hostels. Keep it safe for your records.', 40, y);

  return doc;
}

export function downloadReceipt(r: ReceiptData) {
  const doc = generateReceiptPDF(r);
  doc.save(`Receipt-${r.receipt_no}.pdf`);
}
