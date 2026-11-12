import { api } from '@/lib/api';
import { ApiResponse, LeaveRequest } from '@/types';

export const leaveService = {
  async getLeaveRequests(params?: { hostel?: string }): Promise<ApiResponse<LeaveRequest[]>> {
    const res = await api.get('/mess-requests', { params });
    return res.data;
  },

  async createLeaveRequest(payload: {
    leavingDate?: string;
    returnDate?: string;
    startDate?: string;
    endDate?: string;
    reason: string;
    hostel?: string;
    parentMobile?: string;
  }): Promise<ApiResponse<LeaveRequest>> {
    const res = await api.post('/mess-requests', {
      leavingDate: payload.leavingDate ?? payload.startDate,
      returnDate: payload.returnDate ?? payload.endDate,
      reason: payload.reason,
      ...(payload.hostel ? { hostel: payload.hostel } : {}),
      ...(payload.parentMobile ? { parentMobile: payload.parentMobile } : {}),
    });
    return res.data;
  },

  async updateLeaveStatus(
    id: string,
    payload: { status: 'approved' | 'rejected' | 'returned'; adminMessage?: string; rejectionReason?: string }
  ): Promise<ApiResponse<LeaveRequest>> {
    const res = await api.put(`/mess-requests/${id}`, {
      status: payload.status,
      ...(payload.adminMessage !== undefined
        ? { adminMessage: payload.adminMessage }
        : payload.rejectionReason !== undefined
          ? { adminMessage: payload.rejectionReason }
          : {}),
    });
    return res.data;
  },
};
