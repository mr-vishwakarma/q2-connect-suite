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
  allowedBillingCycles?: ('MONTHLY' | 'YEARLY')[];
  trialEligible?: boolean;
  trialDays?: number;
  sortOrder?: number;
  version?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  limits: PlanLimits;
  includedFeatures: string[];
  isActive: boolean;
  isPopular?: boolean;
  badgeText?: string;
}

export interface PricingSnapshot {
  planId?: string;
  planCode?: string;
  planName?: string;
  planDescription?: string;
  planVersion?: number;
  billingCycle?: 'MONTHLY' | 'YEARLY';
  agreedPriceRupees?: number;
  finalPayableRupees?: number;
  monthlyPriceAtPurchase?: number;
  yearlyPriceAtPurchase?: number;
  currency?: string;
  trialEligible?: boolean;
  trialDays?: number;
  limits?: PlanLimits;
  includedFeatures?: string[];
  capturedAt?: string;
  source?: string;
}

export interface ScheduledPlanChange {
  targetPlanId?: string;
  targetPlanCode?: string;
  targetPlanName?: string;
  targetBillingCycle?: 'MONTHLY' | 'YEARLY';
  targetPriceRupees?: number;
  changeType?: string;
  effectiveDate?: string;
  scheduledAt?: string;
  capacityWarnings?: string[];
  acknowledgedCapacityWarning?: boolean;
  status?: 'NONE' | 'SCHEDULED' | 'APPLIED' | 'CANCELLED';
}

export interface PendingCheckoutState {
  orderId?: string;
  intent?: string;
  targetPlanId?: string;
  targetPlanCode?: string;
  targetPlanName?: string;
  targetBillingCycle?: 'MONTHLY' | 'YEARLY';
  originalAmountRupees?: number;
  prorationCreditRupees?: number;
  discountAmountRupees?: number;
  finalPayableRupees?: number;
  voucherReference?: string;
  checkoutSessionId?: string;
  status?: 'NONE' | 'CREATED' | 'FAILED' | 'COMPLETED' | 'EXPIRED';
  failureCode?: string;
  failureReason?: string;
}

export interface SubscriptionAvailableActions {
  isTrial?: boolean;
  isPaidActive?: boolean;
  isPendingPayment?: boolean;
  isExpired?: boolean;
  canActivatePlan?: boolean;
  canApplyVoucher?: boolean;
  canRenew?: boolean;
  canReactivate?: boolean;
  canUpgrade?: boolean;
  canDowngrade?: boolean;
  canStartTrial?: boolean;
}

export interface BillingHistoryLifecycleItem {
  _id?: string;
  eventType: string;
  fromStatus?: string;
  toStatus?: string;
  fromPlanName?: string;
  toPlanName?: string;
  billingCycle?: string;
  amountRupees?: number;
  activationMethod?: string;
  paymentId?: string;
  invoiceNumber?: string;
  voucherReference?: string;
  actorName?: string;
  notes?: string;
  createdAt?: string;
}

export interface OrganizationSubscription {
  _id: string;
  organizationId: string;
  planId: SaaSPlan;
  planMissing?: boolean;
  razorpayPlanId?: string;
  razorpaySubscriptionId?: string;
  orderId?: string;
  renewalMode?: 'MANUAL' | 'AUTOMATIC';
  autoRenew?: boolean;
  status:
    | 'CREATED'
    | 'PENDING_PAYMENT'
    | 'PAYMENT_FAILED'
    | 'AUTHENTICATED'
    | 'ACTIVE'
    | 'PENDING'
    | 'HALTED'
    | 'PAUSED'
    | 'CANCELLED'
    | 'COMPLETED'
    | 'EXPIRED'
    | 'TRIAL'
    | 'PAST_DUE'
    | 'SUSPENDED';
  activationMethod?: 'PENDING' | 'ONLINE_PAYMENT' | 'VOUCHER' | 'FREE_TRIAL' | 'MANUAL_OVERRIDE';
  billingCycle: 'MONTHLY' | 'YEARLY';
  agreedPriceRupees?: number;
  amount: number;
  currency: string;
  pricingSnapshot?: PricingSnapshot;
  pendingCheckout?: PendingCheckoutState;
  scheduledPlanChange?: ScheduledPlanChange;
  lastVoucherReference?: string;
  startedAt?: string;
  activatedAt?: string;
  trialStartsAt?: string;
  trialEndsAt?: string;
  trialUsed?: boolean;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextChargeAt?: string;
  cancelledAt?: string;
  nearExpiry?: {
    isNearExpiry: boolean;
    isExpired: boolean;
    daysRemaining: number | null;
    thresholdDays: number;
  };
  enabledFeatures?: string[];
  lastPayment?: BillingHistoryPayment | null;
  history?: BillingHistoryLifecycleItem[];
  availableActions?: SubscriptionAvailableActions;
  usage?: {
    studentCount: number;
    roomCount: number;
    hostelCount: number;
    staffCount: number;
  };
}

export interface CreateSubscriptionResponse {
  subscriptionId?: string;
  orderId?: string;
  localSubscriptionId: string;
  keyId: string;
  amountPaise: number;
  amountRupees: number;
  originalAmountRupees?: number;
  prorationCreditRupees?: number;
  currency: string;
  planId?: string;
  planName: string;
  planCode: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  intent?: string;
  renewalMode?: 'MANUAL' | 'AUTOMATIC';
  autoRenew?: boolean;
}

export interface VerifySubscriptionPayload {
  razorpay_payment_id: string;
  razorpay_subscription_id?: string;
  razorpay_order_id?: string;
  razorpay_signature: string;
}

export interface VerifySubscriptionResponse {
  subscriptionId?: string;
  orderId?: string;
  paymentId: string;
  status: string;
  activationMethod?: string;
  planId?: string;
  planName?: string;
  planCode?: string;
  billingCycle?: string;
  agreedPriceRupees?: number;
  pricingSnapshot?: PricingSnapshot;
  invoiceNumber: string;
  invoiceId?: string;
  renewalMode?: string;
  autoRenew?: boolean;
  currentPeriodEnd?: string;
}

export interface UpgradeQuoteResponse {
  currentStatus: string;
  currentPlan: SaaSPlan;
  targetPlan: SaaSPlan;
  billingCycle: 'MONTHLY' | 'YEARLY';
  currentAgreedPriceRupees: number;
  targetPriceRupees: number;
  prorationCreditRupees: number;
  finalPayableRupees: number;
  isUpgrade: boolean;
  isDowngrade: boolean;
  addedFeatures: string[];
  removedFeatures: string[];
  limitComparison: {
    current: PlanLimits;
    target: PlanLimits;
  };
  effectiveDate: string;
}

export interface DowngradeRequestResponse {
  requiresConfirmation: boolean;
  scheduled: boolean;
  effectiveDate: string;
  capacityWarnings: string[];
  removedFeatures: string[];
  usage: {
    studentCount: number;
    roomCount: number;
    hostelCount: number;
    staffCount: number;
  };
  targetLimits: PlanLimits;
  scheduledPlanChange?: ScheduledPlanChange;
  targetPlan?: SaaSPlan;
  targetPriceRupees?: number;
  billingCycle?: string;
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
  discountRupees?: number;
  currency: string;
  orderId?: string;
  paymentId?: string;
  provider?: string;
  intent?: string;
  billingCycle?: string;
  status: string;
  paymentMethod?: string;
  failureCode?: string;
  failureReason?: string;
  capturedAt?: string;
  failedAt?: string;
  createdAt?: string;
  planSnapshot?: PricingSnapshot;
  planId?: {
    _id: string;
    name: string;
    code: string;
  };
}

let plansCache: { data: SaaSPlan[]; timestamp: number } | null = null;
const PLANS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL for SaaS pricing plans

export const billingService = {
  invalidatePlansCache: () => {
    plansCache = null;
  },

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
    billingCycle: 'MONTHLY' | 'YEARLY' = 'MONTHLY',
    intent?: 'ACTIVATION' | 'RENEWAL' | 'UPGRADE' | 'REACTIVATION'
  ): Promise<CreateSubscriptionResponse> => {
    const res = await api.post('/billing/subscriptions/create', { planId, billingCycle, intent });
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

  // 4b. Record Gateway Payment Failure / Cancellation (never activates)
  recordPaymentFailed: async (payload: {
    orderId?: string;
    code?: string;
    reason?: string;
  }): Promise<void> => {
    await api.post('/billing/subscriptions/payment-failed', payload);
  },

  // 4c. Activate Configured Free Trial
  startTrial: async (payload?: {
    planId?: string;
    planCode?: string;
    billingCycle?: 'MONTHLY' | 'YEARLY';
    trialDays?: number;
  }): Promise<OrganizationSubscription> => {
    const res = await api.post('/billing/subscription/trial', payload || {});
    if (!res.data?.success || !res.data?.data) {
      throw new Error(res.data?.message || 'Failed to start free trial');
    }
    return res.data.data;
  },

  // 4d. Preview Server-Calculated Upgrade Proration Quote
  previewUpgrade: async (payload: {
    targetPlanId: string;
    billingCycle: 'MONTHLY' | 'YEARLY';
  }): Promise<UpgradeQuoteResponse> => {
    const res = await api.post('/billing/subscription/upgrade/preview', payload);
    if (!res.data?.success || !res.data?.data) {
      throw new Error(res.data?.message || 'Failed to calculate upgrade preview');
    }
    return res.data.data;
  },

  // 4e. Schedule Next-Cycle Downgrade with Capacity Checks
  requestDowngrade: async (payload: {
    targetPlanId: string;
    billingCycle?: 'MONTHLY' | 'YEARLY';
    confirmOverCapacity?: boolean;
  }): Promise<DowngradeRequestResponse> => {
    const res = await api.post('/billing/subscription/downgrade', payload);
    if (!res.data?.success || !res.data?.data) {
      throw new Error(res.data?.message || 'Failed to schedule plan downgrade');
    }
    return res.data.data;
  },

  // 4f. Cancel Scheduled Next-Cycle Downgrade
  cancelScheduledDowngrade: async (): Promise<void> => {
    const res = await api.delete('/billing/subscription/downgrade');
    if (!res.data?.success) {
      throw new Error(res.data?.message || 'Failed to cancel scheduled downgrade');
    }
  },

  // 5. Cancel Current Subscription
  cancelSubscription: async (): Promise<void> => {
    const res = await api.post('/billing/subscriptions/cancel');
    if (!res.data?.success) {
      throw new Error(res.data?.message || 'Failed to cancel subscription');
    }
  },

  // 6. Get Organization SaaS Invoices, Payments & Subscription Lifecycle History
  getBillingHistory: async (): Promise<{
    invoices: BillingHistoryInvoice[];
    payments: BillingHistoryPayment[];
    subscriptionHistory?: BillingHistoryLifecycleItem[];
  }> => {
    const res = await api.get('/billing/history');
    return res.data?.data || { invoices: [], payments: [], subscriptionHistory: [] };
  },
};
