import { useState, useCallback } from 'react';
import { paymentService, CreateOrderResponse, VerifyPaymentResponse } from '@/services/api/payment.service';
import { openRazorpayCheckout } from '@/utils/razorpay';
import { toast } from 'react-toastify';

export type PaymentLifecycleState =
  | 'IDLE'
  | 'CONFIRMING'
  | 'CREATING_ORDER'
  | 'CHECKOUT_OPEN'
  | 'VERIFYING'
  | 'PROCESSING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export interface PaymentFlowContext {
  feeId: string;
  month: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  studentName?: string;
  studentEmail?: string;
  studentPhone?: string;
}

export function useRazorpayPayment(onPaymentComplete?: () => void) {
  const [state, setState] = useState<PaymentLifecycleState>('IDLE');
  const [activeContext, setActiveContext] = useState<PaymentFlowContext | null>(null);
  const [orderData, setOrderData] = useState<CreateOrderResponse | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerifyPaymentResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Open Confirmation Summary Modal
  const initiatePayment = useCallback((ctx: PaymentFlowContext) => {
    setActiveContext(ctx);
    setErrorMessage(null);
    setVerificationResult(null);
    setState('CONFIRMING');
  }, []);

  // 2. Dismiss Confirmation Modal
  const dismissConfirmation = useCallback(() => {
    if (state === 'CONFIRMING') {
      setState('IDLE');
      setActiveContext(null);
    }
  }, [state]);

  // 3. Confirm and Launch Razorpay Checkout
  const proceedToCheckout = useCallback(async () => {
    if (!activeContext) return;

    try {
      setState('CREATING_ORDER');
      const order = await paymentService.createOrder(activeContext.feeId);
      setOrderData(order);

      setState('CHECKOUT_OPEN');

      await openRazorpayCheckout(
        {
          orderId: order.orderId,
          amountPaise: order.amountPaise,
          currency: order.currency,
          keyId: order.keyId,
          studentName: activeContext.studentName,
          studentEmail: activeContext.studentEmail,
          studentPhone: activeContext.studentPhone,
          description: `Hostel Fee for ${order.month}`,
        },
        async (response) => {
          // Signature received from Checkout modal -> verify with server
          try {
            setState('VERIFYING');
            const result = await paymentService.verifyPayment(response);
            setVerificationResult(result);
            setState('SUCCESS');
            toast.success(`Payment verified! Invoice: ${result.invoiceNumber}`);
            if (onPaymentComplete) onPaymentComplete();
          } catch (verifyErr: any) {
            console.error('[PaymentHook] Verification error:', verifyErr);
            // If server verification timed out, transition to PROCESSING so user can poll
            setState('PROCESSING');
            setErrorMessage(verifyErr.response?.data?.message || 'Payment received; verifying with bank...');
          }
        },
        (dismissErr) => {
          console.log('[PaymentHook] Checkout dismissed:', dismissErr?.message);
          setState('CANCELLED');
        }
      );
    } catch (err: any) {
      console.error('[PaymentHook] Order creation error:', err);
      const msg = err.response?.data?.message || err.message || 'Failed to initiate payment';
      setErrorMessage(msg);
      setState('FAILED');
      toast.error(msg);
    }
  }, [activeContext, onPaymentComplete]);

  // 4. Reset flow
  const resetPaymentState = useCallback(() => {
    setState('IDLE');
    setActiveContext(null);
    setOrderData(null);
    setVerificationResult(null);
    setErrorMessage(null);
  }, []);

  return {
    state,
    activeContext,
    orderData,
    verificationResult,
    errorMessage,
    initiatePayment,
    dismissConfirmation,
    proceedToCheckout,
    resetPaymentState,
  };
}
