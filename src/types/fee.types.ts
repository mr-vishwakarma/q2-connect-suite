import { PaymentMode, FeeStatus } from './common.types';
import { Student } from './student.types';

export interface Fee {
  id: string;
  student_id: string;
  month: string;
  amount: number;
  paid_date: string | null;
  payment_mode: PaymentMode;
  status: 'paid' | 'unpaid' | 'partial';
  due_date: string | null;
  late_fee: number;
  discount: number;
  paid_amount: number;
  receipt_no: string | null;
  notes: string | null;
}

export interface Payment {
  id: string;
  fee_id: string;
  student_id: string;
  receipt_no: string;
  amount: number;
  late_fee: number;
  discount: number;
  security_deposit: number;
  payment_mode: PaymentMode;
  payment_date: string;
  admin_name: string | null;
  month: string;
  notes: string | null;
  receipt_url?: string | null;
}

export interface SecurityDeposit {
  id: string;
  student_id: string;
  amount: number;
  status: 'active' | 'refunded' | 'adjusted';
  collected_date: string | null;
  refund_date: string | null;
}

export interface CollectPaymentPayload {
  studentId: string;
  hostel: string;
  month: string;
  amount: number;
  lateFee: number;
  discount: number;
  securityDeposit: number;
  receivedAmount: number;
  paymentMode: PaymentMode;
  notes?: string;
  receiptNo: string;
  receiptUrl?: string | null;
}
