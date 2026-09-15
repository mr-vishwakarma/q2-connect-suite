import { api } from '@/lib/api';
import {
  ApiResponse,
  Organization,
  HostelBranch,
  SubscriptionPlan,
  FeatureDefinition,
  AuditLogItem,
  SuperAdminDashboardStats,
  OnboardTenantPayload,
  SaasUserListItem,
  DetailedAnalytics,
  SecurityOverview,
  SystemHealthData,
  PlatformSettings,
  HostelMetricsData,
} from '@/types';

export const superAdminService = {
  // 1. Dashboard & Detailed Analytics
  async getDashboardStats(): Promise<ApiResponse<SuperAdminDashboardStats>> {
    const res = await api.get('/super-admin/analytics/dashboard');
    return res.data;
  },

  async getDetailedAnalytics(): Promise<ApiResponse<DetailedAnalytics>> {
    const res = await api.get('/super-admin/analytics/detailed');
    return res.data;
  },

  // 2. Organization Management
  async getOrganizations(params?: { status?: string; search?: string; page?: number; limit?: number }): Promise<ApiResponse<{ organizations: Organization[]; pagination?: any } | Organization[]>> {
    const res = await api.get('/super-admin/organizations', { params });
    return res.data;
  },

  async getOrganizationById(id: string): Promise<ApiResponse<Organization & { hostels: HostelBranch[]; subscription: any; features: any[] }>> {
    const res = await api.get(`/super-admin/organizations/${id}`);
    return res.data;
  },

  async createOrganization(payload: OnboardTenantPayload | (Partial<Organization> & { genderType?: string })): Promise<ApiResponse<{ organization: Organization; hostel: HostelBranch; adminUser?: any }>> {
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

  // 3. Hostel Management
  async getHostels(
    params?: { organizationId?: string; search?: string; page?: number; limit?: number },
    options?: { signal?: AbortSignal }
  ): Promise<ApiResponse<{ hostels: any[]; pagination: any } | HostelBranch[]>> {
    const res = await api.get('/super-admin/hostels', { params, signal: options?.signal });
    return res.data;
  },

  async getHostelMetrics(): Promise<ApiResponse<HostelMetricsData>> {
    const res = await api.get('/super-admin/hostels/metrics');
    return res.data;
  },

  async createHostel(payload: any): Promise<ApiResponse<HostelBranch>> {
    const res = await api.post('/super-admin/hostels', payload);
    return res.data;
  },

  // 4. Global User Management
  async getUsers(
    params?: { search?: string; role?: string; isActive?: string | boolean; page?: number; limit?: number },
    options?: { signal?: AbortSignal }
  ): Promise<ApiResponse<{ users: SaasUserListItem[]; pagination: any }>> {
    const res = await api.get('/super-admin/users', { params, signal: options?.signal });
    return res.data;
  },

  async getUserById(id: string): Promise<ApiResponse<SaasUserListItem>> {
    const res = await api.get(`/super-admin/users/${id}`);
    return res.data;
  },

  async updateUserStatus(id: string, isActive: boolean, reason?: string): Promise<ApiResponse<any>> {
    const res = await api.patch(`/super-admin/users/${id}/status`, { isActive, reason });
    return res.data;
  },

  async revokeUserSessions(id: string): Promise<ApiResponse<any>> {
    const res = await api.post(`/super-admin/users/${id}/revoke-sessions`);
    return res.data;
  },

  async unlockUserAccount(id: string): Promise<ApiResponse<any>> {
    const res = await api.post(`/super-admin/users/${id}/unlock`);
    return res.data;
  },

  async updateUserRole(id: string, role: string): Promise<ApiResponse<any>> {
    const res = await api.patch(`/super-admin/users/${id}/role`, { role });
    return res.data;
  },

  // 5. Plans & Pricing
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

  // 6. Subscriptions
  async getSubscriptions(
    params?: { status?: string; search?: string; page?: number; limit?: number },
    options?: { signal?: AbortSignal }
  ): Promise<ApiResponse<{ subscriptions: any[]; pagination: any }>> {
    const res = await api.get('/super-admin/subscriptions', { params, signal: options?.signal });
    return res.data;
  },

  async updateSubscription(id: string, payload: any): Promise<ApiResponse<any>> {
    const res = await api.put(`/super-admin/subscriptions/${id}`, payload);
    return res.data;
  },

  async extendSubscriptionTrial(id: string, days: number): Promise<ApiResponse<any>> {
    const res = await api.post(`/super-admin/subscriptions/${id}/extend-trial`, { days });
    return res.data;
  },

  // 7. Feature Catalog & Gating
  async getFeatures(): Promise<ApiResponse<FeatureDefinition[]>> {
    const res = await api.get('/super-admin/features');
    return res.data;
  },

  async toggleOrgFeature(payload: { organizationId: string; featureKey: string; enabled: boolean; configuration?: any }): Promise<ApiResponse<any>> {
    const res = await api.post('/super-admin/features/toggle', payload);
    return res.data;
  },

  // 8. Compliance & Audit Logs
  async getAuditLogs(params?: { organizationId?: string; action?: string; search?: string; page?: number; limit?: number }): Promise<ApiResponse<{ logs: AuditLogItem[]; pagination: any } | AuditLogItem[]>> {
    const res = await api.get('/super-admin/audit-logs', { params });
    return res.data;
  },

  // 9. Security Center
  async getSecurityOverview(): Promise<ApiResponse<SecurityOverview>> {
    const res = await api.get('/super-admin/security/overview');
    return res.data;
  },

  async unlockSecurityUser(id: string): Promise<ApiResponse<any>> {
    const res = await api.post(`/super-admin/security/unlock/${id}`);
    return res.data;
  },

  // 10. Controlled Impersonation
  async startImpersonation(payload: { targetUserId: string; organizationId: string; reason: string }): Promise<ApiResponse<{ token: string; organization: Organization; user: any }>> {
    const res = await api.post('/super-admin/impersonation/start', payload);
    return res.data;
  },

  // 11. System Health
  async getSystemHealth(): Promise<ApiResponse<SystemHealthData>> {
    const res = await api.get('/super-admin/system-health');
    return res.data;
  },

  // 12. Reports (CSV Export)
  getReportExportUrl(type: 'organizations' | 'hostels' | 'users' | 'audit-logs'): string {
    const baseURL = (api.defaults.baseURL || '/api').replace(/\/$/, '');
    return `${baseURL}/super-admin/reports/${type}/export`;
  },

  async downloadReport(type: 'organizations' | 'hostels' | 'users' | 'audit-logs'): Promise<Blob> {
    const res = await api.get(`/super-admin/reports/${type}/export`, {
      responseType: 'blob',
    });
    return res.data;
  },

  // 13. Platform Settings
  async getPlatformSettings(): Promise<ApiResponse<PlatformSettings>> {
    const res = await api.get('/super-admin/settings');
    return res.data;
  },

  async updatePlatformSettings(payload: Partial<PlatformSettings>): Promise<ApiResponse<PlatformSettings>> {
    const res = await api.put('/super-admin/settings', payload);
    return res.data;
  },
};
