import { api } from '@/lib/api';
import { ApiResponse, AuthResponse, User } from '@/types';

export const authService = {
  async login(credentials: { email?: string; username?: string; password: string; isAdminLogin?: boolean }): Promise<ApiResponse<AuthResponse>> {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },

  async googleLogin(credential: string): Promise<ApiResponse<any>> {
    const res = await api.post('/auth/google', { credential });
    return res.data;
  },

  async completeGoogleSetup(payload: {
    setupToken: string;
    username: string;
    password: string;
    phone?: string;
    hostel?: string;
  }): Promise<ApiResponse<AuthResponse>> {
    const res = await api.post('/auth/complete-google-setup', payload);
    return res.data;
  },

  async register(payload: { name: string; email: string; username?: string; phone?: string; password: string; hostel?: string }): Promise<ApiResponse<AuthResponse>> {
    const res = await api.post('/auth/register', payload);
    return res.data;
  },

  async registerAdmin(payload: any): Promise<ApiResponse<any>> {
    const res = await api.post('/auth/register-admin', payload);
    return res.data;
  },

  async getMe(): Promise<ApiResponse<{ user: User; student?: any }>> {
    const res = await api.get('/auth/me');
    return res.data;
  },

  async logout(): Promise<ApiResponse<void>> {
    const res = await api.post('/auth/logout');
    return res.data;
  },

  async forgotPassword(email: string): Promise<ApiResponse<{ message: string }>> {
    const res = await api.post('/auth/forgot-password', { email });
    return res.data;
  },

  async resetPassword(token: string, password: string): Promise<ApiResponse<{ message: string }>> {
    const res = await api.post('/auth/reset-password', { token, password });
    return res.data;
  },

  async getAdmins(): Promise<ApiResponse<User[]>> {
    const res = await api.get('/auth/admins');
    return res.data;
  },

  async deleteAdmin(adminId: string): Promise<ApiResponse<void>> {
    const res = await api.delete(`/auth/admins/${adminId}`);
    return res.data;
  },
};
