import { api } from '@/lib/api';

export interface PlanLimits {
  maxStudents: number;
  maxRooms: number;
  maxHostels: number;
  maxStaff: number;
  storageGb: number;
}

export interface SaaSPlan {
  _id: string;
  name: string;
  code: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  limits: PlanLimits;
  includedFeatures: string[];
  isActive: boolean;
  isPopular?: boolean;
}

export interface OrganizationSubscription {
  _id: string;
  organizationId: string;
  planId: SaaSPlan;
  razorpayPlanId?: string;
  razorpaySubscriptionId?: string;
  status: 'CREATED' | 'AUTHENTICATED' | 'ACTIVE' | 'PENDING' | 'HALTED' | 'PAUSED' | 'CANCELLED' | 'COMPLETED' | 'EXPIRED' | 'TRIAL' | 'PAST_DUE';
  billingCycle: 'MONTHLY' | 'YEARLY';
  amount: number;
  currency: string;
  startedAt?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextChargeAt?: string;
  cancelledAt?: string;
  usage: {
    studentCount: number;
    roomCount: number;
    hostelCount: number;
    staffCount: number;
  };
}

export interface CreateSubscriptionResponse {
  subscriptionId: string;
  localSubscriptionId: string;
  keyId: string;
  amountPaise: number;
  amountRupees: number;
  currency: string;
  planName: string;
  planCode: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
}

export interface VerifySubscriptionPayload {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

export interface VerifySubscriptionResponse {
  subscriptionId: string;
  paymentId: string;
  status: string;
  invoiceNumber: string;
  invoiceId?: string;
}

export interface BillingHistoryInvoice {
  _id: string;
  invoiceNumber: string;
  invoiceType: string;
  subtotalRupees: number;
  taxRupees: number;
  totalRupees: number;
  currency: string;
  status: string;
  issuedAt: string;
  paidAt?: string;
}

export interface BillingHistoryPayment {
  _id: string;
  amountRupees: number;
  currency: string;
  paymentId: string;
  status: string;
  capturedAt: string;
  planId?: {
    _id: string;
    name: string;
    code: string;
  };
}

let plansCache: { data: SaaSPlan[]; timestamp: number } | null = null;
const PLANS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for SaaS pricing plans

export const billingService = {
  // 1. Get Plan Catalog (Cached)
  getPlans: async (forceRefresh = false): Promise<SaaSPlan[]> => {
    if (!forceRefresh && plansCache && Date.now() - plansCache.timestamp < PLANS_CACHE_TTL_MS) {
      return plansCache.data;
    }
    const res = await api.get('/billing/plans');
    const plans = res.data?.data || [];
    plansCache = { data: plans, timestamp: Date.now() };
    return plans;
  },

  // 2. Get Organization's Current Subscription & Entitlements
  getSubscription: async (): Promise<OrganizationSubscription> => {
    const res = await api.get('/billing/subscription');
    if (!res.data?.success || !res.data?.data) {
      throw new Error(res.data?.message || 'Failed to load subscription details');
    }
    return res.data.data;
  },

  // 3. Initialize Razorpay Subscription Checkout
  createSubscription: async (
    planId: string,
    billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY'
  ): Promise<CreateSubscriptionResponse> => {
    const res = await api.post('/billing/subscriptions/create', { planId, billingCycle });
    if (!res.data?.success || !res.data?.data) {
      throw new Error(res.data?.message || 'Failed to initialize subscription checkout');
    }
    return res.data.data;
  },

  // 4. Verify Subscription Signature with Backend
  verifySubscription: async (
    payload: VerifySubscriptionPayload
  ): Promise<VerifySubscriptionResponse> => {
    const res = await api.post('/billing/subscriptions/verify', payload);
    if (!res.data?.success || !res.data?.data) {
      throw new Error(res.data?.message || 'Subscription verification failed');
    }
    return res.data.data;
  },

  // 5. Cancel Current Subscription
  cancelSubscription: async (): Promise<void> => {
    const res = await api.post('/billing/subscriptions/cancel');
    if (!res.data?.success) {
      throw new Error(res.data?.message || 'Failed to cancel subscription');
    }
  },

  // 6. Get Organization SaaS Invoices and Payments History
  getBillingHistory: async (): Promise<{
    invoices: BillingHistoryInvoice[];
    payments: BillingHistoryPayment[];
  }> => {
    const res = await api.get('/billing/history');
    return res.data?.data || { invoices: [], payments: [] };
  },
};
