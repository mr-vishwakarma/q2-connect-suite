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

export async function generateReceiptPDF(r: ReceiptData) {
  const { default: jsPDF } = await import('jspdf');
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
  row('Payment Mode:', r.payment_mode.toUpperCase());
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

  item('Monthly Hostel Fee', r.monthly_fee);
  item('Security Deposit', r.security_deposit);
  item('Late Fee', r.late_fee);
  item('Discount / Concession', r.discount, true);

  y += 6;
  doc.setFillColor(245, 245, 245);
  doc.rect(40, y, W - 80, 28, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL AMOUNT PAID', 50, y + 18);
  doc.text(`Rs. ${r.amount_paid.toLocaleString('en-IN')}`, W - 50, y + 18, { align: 'right' });
  y += 44;

  if (r.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Notes: ${r.notes}`, 40, y);
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
  doc.text('This is a system-generated receipt from Q2 Group of Hostels. Keep it safe for your records.', 40, y);

  return doc;
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
