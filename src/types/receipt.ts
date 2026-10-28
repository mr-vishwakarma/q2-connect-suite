export interface HostelBranding {
  organizationName: string;
  branchName: string;
  hostelName?: string;
  tagline: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  isBranchBranded?: boolean;
}

export interface ReceiptStudent {
  id?: string;
  name: string;
  studentId: string;
  username: string;
  course: string;
  yearSemester: string;
  roomNo: string;
  floor?: string;
}

export interface ReceiptBilling {
  month: string;
  rawMonth?: string;
  dueDate: string;
  paymentDate: string;
  billingPeriod: string;
  numberOfDays: string;
}

export interface ReceiptLineItem {
  index: number;
  particulars: string;
  amount: number;
  isDeduction?: boolean;
}

export interface ReceiptFinancials {
  subtotal: number;
  lateFee: number;
  discount: number;
  totalAmount: number;
  amountPaid: number;
  remainingBalance: number;
}

export interface ReceiptPaymentDetails {
  method: string;
  transactionId: string;
  paidAmount: number;
  paymentStatus: string;
  bankOrApp: string;
  receivedBy: string;
}

export interface FeeReceiptSnapshot {
  receiptNo: string;
  invoiceNo: string;
  issuedAt: string;
  receiptDate: string;
  paymentDate: string;
  status: 'PAID' | 'PARTIALLY PAID' | string;
  confirmationMessage: string;
  isFullSettlement: boolean;
  branding: HostelBranding;
  student: ReceiptStudent;
  billing: ReceiptBilling;
  lineItems: ReceiptLineItem[];
  financials: ReceiptFinancials;
  paymentDetails: ReceiptPaymentDetails;
  verificationUrl: string;
  notes: string[];
}
