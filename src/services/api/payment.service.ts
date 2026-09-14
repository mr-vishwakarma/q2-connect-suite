import { api } from '@/lib/api';

export interface CreateOrderResponse {
  orderId: string;
  paymentRecordId: string;
  amountPaise: number;
  amountRupees: number;
  currency: string;
  keyId: string;
  feeId: string;
  month: string;
  studentName?: string;
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface VerifyPaymentResponse {
  paymentId: string;
  orderId: string;
  amountRupees: number;
  status: string;
  invoiceNumber: string;
  invoiceId?: string;
}

export interface PaymentRecord {
  _id: string;
  organizationId: string;
  hostelId?: string;
  studentId: {
    _id: string;
    name: string;
    username: string;
    hostel?: string;
  };
  feeId: {
    _id: string;
    month: string;
  };
  amountPaise: number;
  amountRupees: number;
  currency: string;
  provider: string;
  orderId: string;
  paymentId?: string;
  status: 'CREATED' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'REFUNDED';
  receiptNo?: string;
  invoiceId?: string;
  capturedAt?: string;
  failedAt?: string;
  refundedAt?: string;
  refundId?: string;
  refundedAmountRupees?: number;
  notes?: string;
  createdAt: string;
}

export const paymentService = {
  // Create Razorpay order for fee
  createOrder: async (feeId: string): Promise<CreateOrderResponse> => {
    const res = await api.post('/payments/create-order', { feeId });
    if (!res.data?.success || !res.data?.data) {
      throw new Error(res.data?.message || 'Failed to create payment order');
    }
    return res.data.data;
  },

  // Verify payment cryptographic signature with server
  verifyPayment: async (payload: VerifyPaymentPayload): Promise<VerifyPaymentResponse> => {
    const res = await api.post('/payments/verify', payload);
    if (!res.data?.success || !res.data?.data) {
      throw new Error(res.data?.message || 'Payment signature verification failed');
    }
    return res.data.data;
  },

  // Get payment status by ID
  getPaymentById: async (paymentId: string): Promise<PaymentRecord> => {
    const res = await api.get(`/payments/${paymentId}`);
    if (!res.data?.success || !res.data?.data) {
      throw new Error(res.data?.message || 'Payment record not found');
    }
    return res.data.data;
  },

  // Get logged-in student's payment history
  getMyPayments: async (): Promise<PaymentRecord[]> => {
    const res = await api.get('/payments/my-payments');
    return res.data?.data || [];
  },

  // Get all payments (Admin / Super Admin)
  getPayments: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    studentId?: string;
    organizationId?: string;
  }): Promise<{
    data: PaymentRecord[];
    total: number;
    page: number;
    totalPages: number;
  }> => {
    const res = await api.get('/payments', { params });
    return {
      data: res.data?.data || [],
      total: res.data?.total || 0,
      page: res.data?.page || 1,
      totalPages: res.data?.totalPages || 1,
    };
  },

  // Issue administrative refund (Admin only)
  refundPayment: async (
    paymentId: string,
    payload: { amountRupees?: number; reason?: string }
  ): Promise<{ refundId: string; refundedAmountRupees: number; paymentStatus: string }> => {
    const res = await api.post(`/payments/${paymentId}/refund`, payload);
    if (!res.data?.success || !res.data?.data) {
      throw new Error(res.data?.message || 'Failed to process refund');
    }
    return res.data.data;
  },
};
