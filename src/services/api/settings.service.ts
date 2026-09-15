import { api } from '@/lib/api';
import { ApiResponse } from '@/types';

const settingsCache = new Map<string, { data: ApiResponse<any>; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache for non-sensitive hostel config

export const settingsService = {
  async getHostelSettings(hostel: string, forceRefresh = false): Promise<ApiResponse<any>> {
    const cached = settingsCache.get(hostel);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }

    const res = await api.get(`/settings/${hostel}`);
    if (res.data?.success) {
      settingsCache.set(hostel, { data: res.data, timestamp: Date.now() });
    }
    return res.data;
  },

  async updateHostelSettings(hostel: string, payload: any): Promise<ApiResponse<any>> {
    const res = await api.put(`/settings/${hostel}`, payload);
    // Invalidate stale cache upon modification
    settingsCache.delete(hostel);
    return res.data;
  },

  clearCache(hostel?: string) {
    if (hostel) {
      settingsCache.delete(hostel);
    } else {
      settingsCache.clear();
    }
  },
};
