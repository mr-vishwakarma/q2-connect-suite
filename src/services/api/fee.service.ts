import { api } from '@/lib/api';
import { ApiResponse, CollectPaymentPayload, Fee, Payment, SecurityDeposit, Student } from '@/types';

export interface FeeDashboardData {
  students: Student[];
  fees: Fee[];
  payments: Payment[];
  deposits: SecurityDeposit[];
  total: number;
  totalPages: number;
  page: number;
}

export const feeService = {
  async getFeeDashboard(params?: { hostel?: string; page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }): Promise<ApiResponse<FeeDashboardData>> {
    const res = await api.get('/fees/dashboard', { params });
    return res.data;
  },

  async calculatePayableFee(params: { studentId: string; feeMonth: string; hostelId?: string }): Promise<ApiResponse<{
    studentId: string;
    studentName: string;
    feeMonth: string;
    baseFee: number;
    paidAmount: number;
    outstandingAmount: number;
    applicableLateFee: number;
    overdueDays: number;
    isOverdue: boolean;
    dueDate: string | null;
    discount: number;
    depositDue: number;
    totalPayable: number;
    status: string;
  }>> {
    const res = await api.get('/fees/calculate', { params });
    return res.data;
  },

  async collectFee(payload: CollectPaymentPayload): Promise<ApiResponse<any>> {
    const res = await api.post('/fees/collect', payload);
    return res.data;
  },

  async getStudentFees(studentId: string): Promise<ApiResponse<Fee[]>> {
    const res = await api.get(`/fees/student/${studentId}`);
    return res.data;
  },

  async getStudentPayments(studentId: string): Promise<ApiResponse<Payment[]>> {
    const res = await api.get(`/fees/payments/${studentId}`);
    return res.data;
  },
};
