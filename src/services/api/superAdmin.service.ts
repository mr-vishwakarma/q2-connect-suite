import { api } from '@/lib/api';
import {
  ApiResponse,
  Organization,
  HostelBranch,
  SubscriptionPlan,
  FeatureDefinition,
  AuditLogItem,
  SuperAdminDashboardStats,
} from '@/types';

export const superAdminService = {
  async getDashboardStats(): Promise<ApiResponse<SuperAdminDashboardStats>> {
    const res = await api.get('/super-admin/analytics/dashboard');
    return res.data;
  },

  async getOrganizations(params?: { status?: string; search?: string }): Promise<ApiResponse<Organization[]>> {
    const res = await api.get('/super-admin/organizations', { params });
    return res.data;
  },

  async getOrganizationById(id: string): Promise<ApiResponse<Organization & { hostels: HostelBranch[]; subscription: any; features: any[] }>> {
    const res = await api.get(`/super-admin/organizations/${id}`);
    return res.data;
  },

  async createOrganization(payload: Partial<Organization> & { genderType?: string }): Promise<ApiResponse<{ organization: Organization; hostel: HostelBranch }>> {
    const res = await api.post('/super-admin/organizations', payload);
    return res.data;
  },

  async updateOrganization(id: string, payload: Partial<Organization>): Promise<ApiResponse<Organization>> {
    const res = await api.put(`/super-admin/organizations/${id}`, payload);
    return res.data;
  },

  async suspendOrganization(id: string, isSuspended: boolean): Promise<ApiResponse<Organization>> {
    const res = await api.patch(`/super-admin/organizations/${id}/suspend`, { isSuspended });
    return res.data;
  },

  async getHostels(params?: { organizationId?: string }): Promise<ApiResponse<HostelBranch[]>> {
    const res = await api.get('/super-admin/hostels', { params });
    return res.data;
  },

  async createHostel(payload: Partial<HostelBranch>): Promise<ApiResponse<HostelBranch>> {
    const res = await api.post('/super-admin/hostels', payload);
    return res.data;
  },

  async getPlans(): Promise<ApiResponse<SubscriptionPlan[]>> {
    const res = await api.get('/super-admin/plans');
    return res.data;
  },

  async createPlan(payload: Partial<SubscriptionPlan>): Promise<ApiResponse<SubscriptionPlan>> {
    const res = await api.post('/super-admin/plans', payload);
    return res.data;
  },

  async updatePlan(id: string, payload: Partial<SubscriptionPlan>): Promise<ApiResponse<SubscriptionPlan>> {
    const res = await api.put(`/super-admin/plans/${id}`, payload);
    return res.data;
  },

  async getFeatures(): Promise<ApiResponse<FeatureDefinition[]>> {
    const res = await api.get('/super-admin/features');
    return res.data;
  },

  async toggleOrgFeature(payload: { organizationId: string; featureKey: string; enabled: boolean; configuration?: any }): Promise<ApiResponse<any>> {
    const res = await api.post('/super-admin/features/toggle', payload);
    return res.data;
  },

  async getAuditLogs(params?: { organizationId?: string; action?: string }): Promise<ApiResponse<AuditLogItem[]>> {
    const res = await api.get('/super-admin/audit-logs', { params });
    return res.data;
  },

  async startImpersonation(payload: { targetUserId: string; organizationId: string; reason: string }): Promise<ApiResponse<{ token: string; organization: Organization }>> {
    const res = await api.post('/super-admin/impersonation/start', payload);
    return res.data;
  },
};
