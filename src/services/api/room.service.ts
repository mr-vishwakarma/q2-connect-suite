import { api } from '@/lib/api';
import { ApiResponse, Room } from '@/types';

export const roomService = {
  async getRooms(params?: { hostel?: string }): Promise<ApiResponse<Room[]>> {
    const res = await api.get('/rooms', { params });
    return res.data;
  },

  async createRoom(payload: { roomNumber: string; hostel: string; capacity: number }): Promise<ApiResponse<Room>> {
    const res = await api.post('/rooms', payload);
    return res.data;
  },

  async updateRoom(id: string, payload: Partial<Room>): Promise<ApiResponse<Room>> {
    const res = await api.put(`/rooms/${id}`, payload);
    return res.data;
  },

  async deleteRoom(id: string): Promise<ApiResponse<void>> {
    const res = await api.delete(`/rooms/${id}`);
    return res.data;
  },
};
