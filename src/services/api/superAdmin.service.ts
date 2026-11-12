import { api } from '@/lib/api';
import {
  ApiResponse,
  Organization,
  HostelBranch,
  HostelGenderType,
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
  PaginationMeta,
  PricingSnapshot,
  ScheduledPlanChange,
  SubscriptionHistoryItem,
  TenantSubscription,
} from '@/types';
import { ApplyVoucherResponse } from './voucher.service';

export interface PopulatedOrganizationRef {
  _id?: string;
  id?: string;
  name?: string;
  slug?: string;
  contactEmail?: string;
  status?: string;
}

export interface PopulatedPlanRef extends Partial<SubscriptionPlan> {
  _id?: string;
  id?: string;
  name?: string;
  price?: number;
}

export interface SaasSubscriptionRecord {
  _id: string;
  id?: string;
  organizationId?: PopulatedOrganizationRef | string;
  planId?: PopulatedPlanRef | string;
  status: TenantSubscription['status'] | string;
  activationMethod?: TenantSubscription['activationMethod'] | 'ADMIN_OVERRIDE' | string;
  billingCycle: 'MONTHLY' | 'YEARLY' | string;
  agreedPriceRupees?: number;
  pricingSnapshot?: PricingSnapshot;
  scheduledPlanChange?: ScheduledPlanChange;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialStartsAt?: string;
  trialEndsAt?: string;
  trialUsed?: boolean;
  lastVoucherReference?: string;
  nearExpiry?: {
    isNearExpiry?: boolean;
    daysRemaining?: number;
  };
  usage?: {
    studentCount?: number;
    roomCount?: number;
    hostelCount?: number;
    staffCount?: number;
  };
  history?: (SubscriptionHistoryItem & { action?: string; reason?: string })[];
  subscriptionHistory?: (SubscriptionHistoryItem & { action?: string; reason?: string })[];
}

export interface SaasPaymentRecord {
  _id: string;
  createdAt: string;
  planId?: { _id?: string; name?: string } | null;
  amount: number;
  status: string;
  razorpayPaymentId?: string;
  failureReason?: string;
  orderId?: string;
}

export interface SaasInvoiceRecord {
  _id: string;
  invoiceNumber: string;
  planName?: string;
  createdAt: string;
  amountPaidRupees?: number;
}

export interface SaasVoucherRedemptionRecord {
  _id: string;
  voucherId?: {
    _id?: string;
    name?: string;
    reference?: string;
  };
  planId?: {
    _id?: string;
    name?: string;
  };
  billingCycle?: string;
  finalPayableRupees?: number;
}

export interface SubscriptionInspectData {
  subscription: SaasSubscriptionRecord;
  payments: SaasPaymentRecord[];
  invoices: SaasInvoiceRecord[];
  voucherRedemptions: SaasVoucherRedemptionRecord[];
}

export interface OrgFeatureToggleState {
  featureKey: string;
  enabled: boolean;
  configuration?: Record<string, unknown>;
}

export interface OrganizationDetailResponse extends Organization {
  hostels: HostelBranch[];
  subscription?: SaasSubscriptionRecord | null;
  features: OrgFeatureToggleState[];
}

export interface ProvisionedAccountSummary {
  id: string;
  name?: string;
  email?: string;
  username?: string;
  status?: string;
  temporaryPassword?: string;
  invitationEmailStatus?: string;
  invitationEmailError?: string | null;
}

export interface TenantOnboardingResult {
  organization: Organization;
  hostel: HostelBranch;
  subscription?: SaasSubscriptionRecord;
  adminUser?: ProvisionedAccountSummary;
  adminAccount?: ProvisionedAccountSummary;
  wardenAccount?: ProvisionedAccountSummary;
}

export interface HostelDirectoryItem extends Omit<HostelBranch, 'organizationId'> {
  organizationId?: PopulatedOrganizationRef | string;
}

export interface InitiateGatewayPaymentData {
  orderId: string;
  keyId: string;
  amountPaise: number;
  currency?: string;
  planName?: string;
  checkoutSessionId?: string;
}

export interface VerifiedPaymentResult {
  subscription?: SaasSubscriptionRecord;
  invoiceNumber?: string;
  status?: string;
  trialDays?: number;
}

export interface CreateHostelPayload {
  organizationId?: string;
  name: string;
  code: string;
  capacity?: number;
  genderType?: HostelGenderType | string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  wardenName?: string;
  wardenPhone?: string;
  contactPhone?: string;
  contactEmail?: string;
}

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
  async getOrganizations(params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ organizations: Organization[]; pagination?: PaginationMeta } | Organization[]>> {
    const res = await api.get('/super-admin/organizations', { params });
    return res.data;
  },

  async getOrganizationById(id: string): Promise<ApiResponse<OrganizationDetailResponse>> {
    const res = await api.get(`/super-admin/organizations/${id}`);
    return res.data;
  },

  async createOrganization(
    payload: OnboardTenantPayload | (Partial<Organization> & { genderType?: string })
  ): Promise<ApiResponse<TenantOnboardingResult>> {
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
    params?: {
      organizationId?: string;
      status?: string;
      genderType?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    options?: { signal?: AbortSignal }
  ): Promise<ApiResponse<{ hostels: HostelDirectoryItem[]; pagination?: PaginationMeta } | HostelDirectoryItem[]>> {
    const res = await api.get('/super-admin/hostels', { params, signal: options?.signal });
    return res.data;
  },

  async getHostelMetrics(): Promise<ApiResponse<HostelMetricsData>> {
    const res = await api.get('/super-admin/hostels/metrics');
    return res.data;
  },

  async createHostel(payload: CreateHostelPayload): Promise<ApiResponse<HostelBranch>> {
    const res = await api.post('/super-admin/hostels', payload);
    return res.data;
  },

  // 4. Global User Management
  async getUsers(
    params?: {
      search?: string;
      role?: string;
      status?: string;
      isLocked?: boolean;
      isActive?: string | boolean;
      page?: number;
      limit?: number;
    },
    options?: { signal?: AbortSignal }
  ): Promise<ApiResponse<{ users: SaasUserListItem[]; pagination: PaginationMeta }>> {
    const res = await api.get('/super-admin/users', { params, signal: options?.signal });
    return res.data;
  },

  async getUserById(id: string): Promise<ApiResponse<SaasUserListItem>> {
    const res = await api.get(`/super-admin/users/${id}`);
    return res.data;
  },

  async updateUserStatus(id: string, isActive: boolean, reason?: string): Promise<ApiResponse<SaasUserListItem>> {
    const res = await api.patch(`/super-admin/users/${id}/status`, { isActive, reason });
    return res.data;
  },

  async revokeUserSessions(id: string): Promise<ApiResponse<{ revoked?: boolean }>> {
    const res = await api.post(`/super-admin/users/${id}/revoke-sessions`);
    return res.data;
  },

  async unlockUserAccount(id: string): Promise<ApiResponse<{ unlocked?: boolean }>> {
    const res = await api.post(`/super-admin/users/${id}/unlock`);
    return res.data;
  },

  async updateUserRole(id: string, role: string): Promise<ApiResponse<SaasUserListItem>> {
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

  async deletePlan(id: string): Promise<ApiResponse<{ deleted?: boolean }>> {
    const res = await api.delete(`/super-admin/plans/${id}`);
    return res.data;
  },

  async seedDefaultPlans(): Promise<ApiResponse<SubscriptionPlan[]>> {
    const res = await api.post('/super-admin/plans/seed-defaults');
    return res.data;
  },

  // 6. Subscriptions & Tenant Onboarding Activation
  async getSubscriptions(
    params?: {
      status?: string;
      billingCycle?: string;
      activationMethod?: string;
      hasScheduledChange?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    options?: { signal?: AbortSignal }
  ): Promise<ApiResponse<{ subscriptions: SaasSubscriptionRecord[]; pagination: PaginationMeta }>> {
    const res = await api.get('/super-admin/subscriptions', { params, signal: options?.signal });
    return res.data;
  },

  async getSubscriptionById(id: string): Promise<ApiResponse<SubscriptionInspectData>> {
    const res = await api.get(`/super-admin/subscriptions/${id}`);
    return res.data;
  },

  async updateSubscription(
    id: string,
    payload: Partial<Pick<SaasSubscriptionRecord, 'status' | 'billingCycle'>> & { planId?: string }
  ): Promise<ApiResponse<SaasSubscriptionRecord>> {
    const res = await api.put(`/super-admin/subscriptions/${id}`, payload);
    return res.data;
  },

  async extendSubscriptionTrial(id: string, days: number): Promise<ApiResponse<SaasSubscriptionRecord>> {
    const res = await api.post(`/super-admin/subscriptions/${id}/extend-trial`, { days });
    return res.data;
  },

  async initiateOrgPayment(
    orgId: string,
    payload: { planId: string; billingCycle: 'MONTHLY' | 'YEARLY'; intent?: string }
  ): Promise<ApiResponse<InitiateGatewayPaymentData>> {
    const res = await api.post(`/super-admin/organizations/${orgId}/subscription/initiate-payment`, payload);
    return res.data;
  },

  async verifyOrgPayment(
    orgId: string,
    payload: {
      razorpay_payment_id: string;
      razorpay_order_id?: string;
      razorpay_subscription_id?: string;
      razorpay_signature: string;
    }
  ): Promise<ApiResponse<VerifiedPaymentResult>> {
    const res = await api.post(`/super-admin/organizations/${orgId}/subscription/verify-payment`, payload);
    return res.data;
  },

  async recordOrgPaymentFailure(
    orgId: string,
    payload: { orderId?: string; code?: string; reason?: string }
  ): Promise<ApiResponse<{ recorded?: boolean }>> {
    const res = await api.post(`/super-admin/organizations/${orgId}/subscription/payment-failed`, payload);
    return res.data;
  },

  async startOrgTrial(
    orgId: string,
    payload: { planId: string; billingCycle: 'MONTHLY' | 'YEARLY'; trialDays?: number }
  ): Promise<ApiResponse<VerifiedPaymentResult>> {
    const res = await api.post(`/super-admin/organizations/${orgId}/subscription/trial`, payload);
    return res.data;
  },

  async previewOrgVoucher(
    orgId: string,
    payload: { code: string; pin: string; planId: string; billingCycle: 'MONTHLY' | 'YEARLY' }
  ): Promise<ApiResponse<ApplyVoucherResponse>> {
    const res = await api.post(`/super-admin/organizations/${orgId}/subscription/voucher/preview`, payload);
    return res.data;
  },

  async redeemOrgVoucher(
    orgId: string,
    payload: {
      code: string;
      pin: string;
      planId: string;
      billingCycle: 'MONTHLY' | 'YEARLY';
      idempotencyKey?: string;
    }
  ): Promise<ApiResponse<VerifiedPaymentResult>> {
    const res = await api.post(`/super-admin/organizations/${orgId}/subscription/voucher/redeem`, payload);
    return res.data;
  },

  async reserveOrgVoucherPartial(
    orgId: string,
    payload: { code: string; pin: string; planId: string; billingCycle: 'MONTHLY' | 'YEARLY' }
  ): Promise<ApiResponse<InitiateGatewayPaymentData & { checkoutSessionId: string }>> {
    const res = await api.post(`/super-admin/organizations/${orgId}/subscription/voucher/reserve-partial`, payload);
    return res.data;
  },

  async verifyOrgVoucherPartial(
    orgId: string,
    payload: {
      checkoutSessionId: string;
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }
  ): Promise<ApiResponse<VerifiedPaymentResult>> {
    const res = await api.post(`/super-admin/organizations/${orgId}/subscription/voucher/verify-partial`, payload);
    return res.data;
  },

  // 7. Feature Catalog & Gating
  async getFeatures(): Promise<ApiResponse<FeatureDefinition[]>> {
    const res = await api.get('/super-admin/features');
    return res.data;
  },

  async createFeature(payload: Partial<FeatureDefinition>): Promise<ApiResponse<FeatureDefinition>> {
    const res = await api.post('/super-admin/features', payload);
    return res.data;
  },

  async updateFeature(id: string, payload: Partial<FeatureDefinition>): Promise<ApiResponse<FeatureDefinition>> {
    const res = await api.put(`/super-admin/features/${id}`, payload);
    return res.data;
  },

  async toggleFeature(id: string, defaultEnabled: boolean): Promise<ApiResponse<FeatureDefinition>> {
    const res = await api.patch(`/super-admin/features/${id}/toggle`, { defaultEnabled });
    return res.data;
  },

  async deleteFeature(id: string): Promise<ApiResponse<{ deleted?: boolean }>> {
    const res = await api.delete(`/super-admin/features/${id}`);
    return res.data;
  },

  async seedDefaultFeatures(): Promise<ApiResponse<FeatureDefinition[]>> {
    const res = await api.post('/super-admin/features/seed-defaults');
    return res.data;
  },

  async toggleOrgFeature(payload: {
    organizationId: string;
    featureKey: string;
    enabled: boolean;
    configuration?: Record<string, unknown>;
  }): Promise<ApiResponse<OrgFeatureToggleState>> {
    const res = await api.post('/super-admin/features/toggle', payload);
    return res.data;
  },

  // 8. Compliance & Audit Logs
  async getAuditLogs(params?: {
    organizationId?: string;
    action?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<{ logs: AuditLogItem[]; pagination?: PaginationMeta } | AuditLogItem[]>> {
    const res = await api.get('/super-admin/audit-logs', { params });
    return res.data;
  },

  // 9. Security Center
  async getSecurityOverview(): Promise<ApiResponse<SecurityOverview>> {
    const res = await api.get('/super-admin/security/overview');
    return res.data;
  },

  async unlockSecurityUser(id: string): Promise<ApiResponse<{ unlocked?: boolean }>> {
    const res = await api.post(`/super-admin/security/unlock/${id}`);
    return res.data;
  },

  // 10. Controlled Impersonation
  async startImpersonation(payload: {
    targetUserId: string;
    organizationId: string;
    reason: string;
  }): Promise<ApiResponse<{ token: string; organization: Organization; user: Record<string, unknown> }>> {
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

  // 14. Account Invitations & Staff Provisioning
  async resendInvitation(
    userId: string
  ): Promise<ApiResponse<{ success: boolean; user?: ProvisionedAccountSummary; alreadyActive?: boolean; message?: string }>> {
    const res = await api.post(`/super-admin/users/${userId}/resend-invitation`);
    return res.data;
  },

  async provisionHostelWarden(
    hostelId: string,
    payload: { name: string; email?: string; phone?: string; username?: string }
  ): Promise<ApiResponse<{ wardenAccount: ProvisionedAccountSummary }>> {
    const res = await api.post(`/super-admin/hostels/${hostelId}/provision-warden`, payload);
    return res.data;
  },
};
