import { api } from '@/lib/api';
import { ApiResponse, LaundrySlot } from '@/types';

export const laundryService = {
  async getLaundrySlots(params?: { hostel?: string; date?: string }): Promise<ApiResponse<{
    totalMachines: number;
    operatingHours: string[];
    hostel: string;
    bookings: LaundrySlot[];
  } | LaundrySlot[]>> {
    const queryParams = {
      ...params,
      date: params?.date || new Date().toISOString().split('T')[0],
    };
    const res = await api.get('/laundry/slots', { params: queryParams });
    return res.data;
  },

  async getMyBookings(): Promise<ApiResponse<LaundrySlot[]>> {
    const res = await api.get('/laundry/my-bookings');
    return res.data;
  },

  async bookLaundrySlot(payload: { date: string; timeSlot: string; machineNumber?: number; notes?: string; hostel?: string }): Promise<ApiResponse<LaundrySlot>> {
    const res = await api.post('/laundry/book', payload);
    return res.data;
  },

  async cancelLaundrySlot(id: string): Promise<ApiResponse<void>> {
    const res = await api.delete(`/laundry/cancel/${id}`);
    return res.data;
  },

  async toggleMaintenanceBlock(payload: { date: string; timeSlot: string; hostel?: string; notes?: string }): Promise<ApiResponse<LaundrySlot>> {
    const res = await api.post('/laundry/admin/block', payload);
    return res.data;
  },
};
