import { api } from '@/lib/api';
import { ApiResponse, LeaveRequest } from '@/types';

export const leaveService = {
  async getLeaveRequests(params?: { hostel?: string }): Promise<ApiResponse<LeaveRequest[]>> {
    const res = await api.get('/mess-requests', { params });
    return res.data;
  },

  async createLeaveRequest(payload: { startDate: string; endDate: string; reason: string; hostel: string }): Promise<ApiResponse<LeaveRequest>> {
    const res = await api.post('/mess-requests', payload);
    return res.data;
  },

  async updateLeaveStatus(id: string, payload: { status: 'approved' | 'rejected'; rejectionReason?: string }): Promise<ApiResponse<LeaveRequest>> {
    const res = await api.put(`/mess-requests/${id}/status`, payload);
    return res.data;
  },

  async deleteLeaveRequest(id: string): Promise<ApiResponse<void>> {
    const res = await api.delete(`/mess-requests/${id}`);
    return res.data;
  },
};
