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
  async getFeeDashboard(params?: { hostel?: string; page?: number; limit?: number }): Promise<ApiResponse<FeeDashboardData>> {
    const res = await api.get('/fees/dashboard', { params });
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
