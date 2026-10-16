import { api } from '@/lib/api';

export interface VoucherPlanRef {
  _id: string;
  name: string;
  code: string;
  priceMonthly: number;
  priceYearly: number;
}

export interface VoucherOrgRef {
  _id: string;
  name: string;
}

export interface VoucherUserRef {
  _id: string;
  name: string;
  email: string;
}

export interface Voucher {
  _id: string;
  reference: string;
  name: string;
  description?: string;
  codeMasked: string;
  discountAmountRupees: number;
  eligiblePlans: VoucherPlanRef[];
  eligibleBillingIntervals: ('MONTHLY' | 'YEARLY')[];
  validFrom: string;
  expiresAt: string;
  globalRedemptionLimit: number;
  currentRedemptionCount: number;
  maxRedemptionsPerOrg: number;
  scope: 'GLOBAL' | 'SPECIFIC_ORGANIZATION' | 'SELECTED_ORGANIZATIONS';
  restrictedToOrgIds: VoucherOrgRef[];
  subscriptionEligibility: 'ALL' | 'NEW_SUBSCRIPTIONS_ONLY' | 'EXISTING_SUBSCRIPTIONS_ONLY';
  discountDurationCycles: number;
  minSubscriptionAmountRupees?: number;
  status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'EXPIRED' | 'EXHAUSTED' | 'REVOKED';
  effectiveStatus?: string;
  internalNotes?: string;
  createdBy?: VoucherUserRef;
  createdAt: string;
  updatedAt: string;
}

export interface CreateVoucherPayload {
  name: string;
  description?: string;
  discountAmountRupees: number;
  eligiblePlans?: string[];
  eligibleBillingIntervals?: ('MONTHLY' | 'YEARLY')[];
  validFrom?: string;
  expiresAt: string;
  globalRedemptionLimit?: number;
  maxRedemptionsPerOrg?: number;
  scope?: 'GLOBAL' | 'SPECIFIC_ORGANIZATION' | 'SELECTED_ORGANIZATIONS';
  restrictedToOrgIds?: string[];
  subscriptionEligibility?: 'ALL' | 'NEW_SUBSCRIPTIONS_ONLY' | 'EXISTING_SUBSCRIPTIONS_ONLY';
  discountDurationCycles?: number;
  minSubscriptionAmountRupees?: number;
  internalNotes?: string;
}

export interface CreateVoucherResponse {
  voucher: Voucher;
  credentials: {
    code: string;
    pin: string;
    warning: string;
  };
}

export interface VoucherRedemptionItem {
  _id: string;
  voucherId: {
    _id: string;
    name: string;
    reference: string;
    codeMasked: string;
    discountAmountRupees: number;
  };
  organizationId: {
    _id: string;
    name: string;
    email?: string;
  };
  planId: {
    _id: string;
    name: string;
    code: string;
  };
  invoiceId?: {
    _id: string;
    invoiceNumber: string;
    totalRupees: number;
    status: string;
  };
  billingCycle: 'MONTHLY' | 'YEARLY';
  originalAmountRupees: number;
  discountAmountRupees: number;
  finalPayableRupees: number;
  isZeroPayable: boolean;
  status: string;
  redeemedBy: {
    _id: string;
    name: string;
    email: string;
  };
  redeemedAt: string;
}

export interface ApplyVoucherPayload {
  code: string;
  pin: string;
  planId: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
}

export interface ApplyVoucherResponse {
  voucherReference: string;
  voucherName: string;
  codeMasked: string;
  originalAmount: number;
  discountAmount: number;
  finalPayable: number;
  isZeroPayable: boolean;
  billingCycle: 'MONTHLY' | 'YEARLY';
  planId: string;
  planName: string;
  discountDurationCycles: number;
}

export interface RedeemZeroPayablePayload {
  code: string;
  pin: string;
  planId: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
  idempotencyKey?: string;
}

export interface RedeemZeroPayableResponse {
  subscriptionId: string;
  invoiceNumber: string;
  planName: string;
  billingCycle: string;
  originalAmount: number;
  discountAmount: number;
  finalPayable: number;
  currentPeriodEnd: string;
}

export interface ReservePartialPayload {
  code: string;
  pin: string;
  planId: string;
  billingCycle: 'MONTHLY' | 'YEARLY';
}

export interface ReservePartialResponse {
  checkoutSessionId: string;
  orderId: string;
  keyId: string;
  amountPaise: number;
  amountRupees: number;
  originalAmount: number;
  discountAmount: number;
  currency: string;
  planName: string;
  billingCycle: string;
  voucherReference: string;
}

export interface VerifyPartialPayload {
  checkoutSessionId: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export const voucherService = {
  // Super Admin: List Vouchers
  getVouchers: async (params: {
    page?: number;
    limit?: number;
    status?: string;
    scope?: string;
    planId?: string;
    search?: string;
  } = {}) => {
    const res = await api.get('/super-admin/vouchers', { params });
    return res.data;
  },

  // Super Admin: Create Voucher (Credentials returned ONCE)
  createVoucher: async (payload: CreateVoucherPayload): Promise<CreateVoucherResponse> => {
    const res = await api.post('/super-admin/vouchers', payload);
    return res.data?.data;
  },

  // Super Admin: Get Voucher by ID
  getVoucherById: async (id: string): Promise<Voucher & { redemptions: VoucherRedemptionItem[] }> => {
    const res = await api.get(`/super-admin/vouchers/${id}`);
    return res.data?.data;
  },

  // Super Admin: Update Status (ACTIVE, SUSPENDED, REVOKED)
  updateVoucherStatus: async (id: string, status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED', reason?: string) => {
    const res = await api.patch(`/super-admin/vouchers/${id}/status`, { status, reason });
    return res.data;
  },

  // Super Admin: Redemptions Report
  getRedemptionsReport: async (params: {
    page?: number;
    limit?: number;
    voucherId?: string;
    organizationId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  } = {}) => {
    const res = await api.get('/super-admin/vouchers/reports/redemptions', { params });
    return res.data;
  },

  // Hostel Admin: Preview Voucher Discount
  applyVoucher: async (payload: ApplyVoucherPayload): Promise<ApplyVoucherResponse> => {
    const res = await api.post('/billing/vouchers/apply', payload);
    return res.data?.data;
  },

  // Hostel Admin: Zero-Payable Atomic Redemption
  redeemZeroPayable: async (payload: RedeemZeroPayablePayload): Promise<RedeemZeroPayableResponse> => {
    const res = await api.post('/billing/vouchers/redeem-zero-payable', payload);
    return res.data?.data;
  },

  // Hostel Admin: Reserve Voucher for Partial Discount
  reservePartial: async (payload: ReservePartialPayload): Promise<ReservePartialResponse> => {
    const res = await api.post('/billing/vouchers/reserve-partial', payload);
    return res.data?.data;
  },

  // Hostel Admin: Verify Partial Payment & Finalize
  verifyPartial: async (payload: VerifyPartialPayload) => {
    const res = await api.post('/billing/vouchers/verify-partial', payload);
    return res.data?.data;
  },
};
