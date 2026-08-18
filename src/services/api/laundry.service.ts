import { api } from '@/lib/api';
import { ApiResponse, LaundrySlot } from '@/types';

export const laundryService = {
  async getLaundrySlots(params?: { hostel?: string; date?: string }): Promise<ApiResponse<LaundrySlot[]>> {
    const res = await api.get('/laundry', { params });
    return res.data;
  },

  async bookLaundrySlot(payload: { date: string; timeSlot: string; notes?: string; hostel?: string }): Promise<ApiResponse<LaundrySlot>> {
    const res = await api.post('/laundry', payload);
    return res.data;
  },

  async cancelLaundrySlot(id: string): Promise<ApiResponse<void>> {
    const res = await api.delete(`/laundry/${id}`);
    return res.data;
  },

  async updateLaundryStatus(id: string, payload: { status: string }): Promise<ApiResponse<LaundrySlot>> {
    const res = await api.put(`/laundry/${id}/status`, payload);
    return res.data;
  },
};
