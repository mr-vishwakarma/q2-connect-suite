/**
 * Razorpay Checkout Client Utility (Phase F)
 * 
 * Dynamically loads the official Razorpay Checkout SDK script and provides
 * a promise-based checkout initialization with failure handling.
 */

export interface RazorpayCheckoutOptions {
  orderId: string;
  amountPaise: number;
  currency?: string;
  keyId: string;
  studentName?: string;
  studentEmail?: string;
  studentPhone?: string;
  description?: string;
}

export interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      return resolve(true);
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('[Razorpay] Failed to load Razorpay checkout script from CDN');
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions,
  onSuccess: (response: RazorpayPaymentResponse) => void,
  onFailure?: (error: any) => void
): Promise<void> {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded) {
    throw new Error('Payment gateway SDK could not be loaded. Please check your internet connection.');
  }

  const razorpayOptions = {
    key: options.keyId,
    amount: options.amountPaise,
    currency: options.currency || 'INR',
    name: 'Q2 Connect Suite',
    description: options.description || 'Hostel Fee Payment',
    order_id: options.orderId,
    prefill: {
      name: options.studentName || '',
      email: options.studentEmail || '',
      contact: options.studentPhone || '',
    },
    theme: {
      color: '#f59e0b', // Q2 Primary Amber
    },
    handler: function (response: RazorpayPaymentResponse) {
      onSuccess(response);
    },
    modal: {
      ondismiss: function () {
        if (onFailure) {
          onFailure({ message: 'Checkout modal was dismissed by user' });
        }
      },
    },
  };

  const rzp = new (window as any).Razorpay(razorpayOptions);
  rzp.on('payment.failed', function (response: any) {
    if (onFailure) {
      onFailure(response.error);
    }
  });
  rzp.open();
}
