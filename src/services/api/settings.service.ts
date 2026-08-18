import { api } from '@/lib/api';
import { ApiResponse } from '@/types';

export const settingsService = {
  async getHostelSettings(hostel: string): Promise<ApiResponse<any>> {
    const res = await api.get(`/settings/${hostel}`);
    return res.data;
  },

  async updateHostelSettings(hostel: string, payload: any): Promise<ApiResponse<any>> {
    const res = await api.put(`/settings/${hostel}`, payload);
    return res.data;
  },
};
