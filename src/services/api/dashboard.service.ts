import { api } from '@/lib/api';
import { ApiResponse } from '@/types';

export const dashboardService = {
  async getAdminDashboard(params?: { hostel?: string }): Promise<ApiResponse<any>> {
    const res = await api.get('/dashboard/admin', { params });
    return res.data;
  },

  async getStudentDashboard(): Promise<ApiResponse<any>> {
    const res = await api.get('/dashboard/student');
    return res.data;
  },

  async getAnalytics(params?: { hostel?: string }): Promise<ApiResponse<any>> {
    const res = await api.get('/analytics', { params });
    return res.data;
  },
};
