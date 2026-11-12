import { api } from '@/lib/api';
import { ApiResponse, AuthResponse, StudentApiRecord, User } from '@/types';

export interface AuthLoginCredentials {
  email?: string;
  username?: string;
  password: string;
  isAdminLogin?: boolean;
  portal?: string;
}

export interface GoogleProfilePreview {
  email: string;
  name: string;
  picture?: string;
  suggestedUsername?: string;
}

export interface GoogleLoginResponseData {
  success?: boolean;
  status?: 'active' | 'pending_approval' | 'approved' | 'new_resident' | 'rejected' | string;
  message?: string;
  user?: User & { _id?: string; isSuperAdmin?: boolean; isPrimaryAdmin?: boolean };
  student?: StudentApiRecord | null;
  accessToken?: string;
  refreshToken?: string;
  features?: Record<string, boolean>;
  canCompleteSetup?: boolean;
  setupToken?: string;
  googleProfile?: GoogleProfilePreview;
}

export interface AdminRegistrationPayload {
  name: string;
  email: string;
  password: string;
  username?: string;
  phone?: string;
  hostel?: string;
  adminSecret?: string;
}

export const authService = {
  async login(credentials: AuthLoginCredentials): Promise<ApiResponse<AuthResponse>> {
    const res = await api.post('/auth/login', credentials);
    return res.data;
  },

  async superAdminLogin(credentials: { email?: string; username?: string; password: string }): Promise<ApiResponse<AuthResponse>> {
    const res = await api.post('/auth/super-admin/login', { ...credentials, portal: 'SUPER_ADMIN' });
    return res.data;
  },

  async adminLogin(credentials: { email?: string; username?: string; password: string }): Promise<ApiResponse<AuthResponse>> {
    const res = await api.post('/auth/admin/login', { ...credentials, portal: 'ADMIN' });
    return res.data;
  },

  async studentLogin(credentials: { email?: string; username?: string; password: string }): Promise<ApiResponse<AuthResponse>> {
    const res = await api.post('/auth/login', { ...credentials, portal: 'STUDENT' });
    return res.data;
  },

  async googleLogin(credential: string): Promise<ApiResponse<GoogleLoginResponseData> & GoogleLoginResponseData> {
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

  async registerAdmin(payload: AdminRegistrationPayload): Promise<ApiResponse<AuthResponse>> {
    const res = await api.post('/auth/register-admin', payload);
    return res.data;
  },

  async getMe(): Promise<ApiResponse<{ user: User; student?: StudentApiRecord | null }>> {
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
    const res = await api.post('/auth/reset-password', { token, password, newPassword: password });
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
