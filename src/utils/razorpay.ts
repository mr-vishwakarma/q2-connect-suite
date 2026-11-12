/**
 * Razorpay Subscription Checkout Client Utility
 * 
 * Dynamically loads the official Razorpay Checkout SDK script and provides
 * subscription-based checkout initialization with server verification callback.
 */

export interface RazorpaySubscriptionCheckoutOptions {
  subscriptionId: string;
  keyId: string;
  amountPaise?: number;
  currency?: string;
  organizationName?: string;
  adminEmail?: string;
  adminPhone?: string;
  description?: string;
}

export interface RazorpaySubscriptionResponse {
  razorpay_payment_id: string;
  razorpay_subscription_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailureError {
  code?: string;
  description?: string;
  source?: string;
  step?: string;
  reason?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

interface RazorpayInstance {
  on: (event: string, callback: (response: { error: RazorpayFailureError }) => void) => void;
  open: () => void;
}

interface RazorpayBaseOptions {
  key: string;
  name: string;
  description: string;
  prefill: {
    name: string;
    email: string;
    contact: string;
  };
  theme: {
    color: string;
  };
  modal: {
    ondismiss: () => void;
  };
}

interface RazorpaySubscriptionSdkOptions extends RazorpayBaseOptions {
  subscription_id: string;
  amount?: number;
  handler: (response: RazorpaySubscriptionResponse) => void;
}

interface RazorpayOrderSdkOptions extends RazorpayBaseOptions {
  order_id: string;
  amount: number;
  currency: string;
  handler: (response: RazorpayOrderResponse) => void;
}

type RazorpayConstructor = new (
  options: RazorpaySubscriptionSdkOptions | RazorpayOrderSdkOptions
) => RazorpayInstance;

interface WindowWithRazorpay extends Window {
  Razorpay?: RazorpayConstructor;
}

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as WindowWithRazorpay).Razorpay) {
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

export async function openRazorpaySubscriptionCheckout(
  options: RazorpaySubscriptionCheckoutOptions,
  onSuccess: (response: RazorpaySubscriptionResponse) => void,
  onFailure?: (error: RazorpayFailureError) => void
): Promise<void> {
  const isLoaded = await loadRazorpayScript();
  const RazorpayCtor = typeof window !== 'undefined' ? (window as WindowWithRazorpay).Razorpay : undefined;
  if (!isLoaded || !RazorpayCtor) {
    throw new Error('Payment gateway SDK could not be loaded. Please check your network connection.');
  }

  const razorpayOptions: RazorpaySubscriptionSdkOptions = {
    key: options.keyId,
    subscription_id: options.subscriptionId,
    name: 'Hosteliq',
    description: options.description || 'Hosteliq SaaS Plan Subscription',
    prefill: {
      name: options.organizationName || '',
      email: options.adminEmail || '',
      contact: options.adminPhone || '',
    },
    theme: {
      color: '#9333ea', // Hosteliq Brand Purple
    },
    handler: function (response: RazorpaySubscriptionResponse) {
      onSuccess(response);
    },
    modal: {
      ondismiss: function () {
        if (onFailure) {
          onFailure({ message: 'Checkout was dismissed by user' });
        }
      },
    },
  };

  if (options.amountPaise) {
    razorpayOptions.amount = options.amountPaise;
  }

  const rzp = new RazorpayCtor(razorpayOptions);
  rzp.on('payment.failed', function (response) {
    if (onFailure) {
      onFailure(response.error);
    }
  });
  rzp.open();
}

export interface RazorpayOrderCheckoutOptions {
  orderId: string;
  keyId: string;
  amountPaise: number;
  currency?: string;
  organizationName?: string;
  adminEmail?: string;
  adminPhone?: string;
  description?: string;
}

export interface RazorpayOrderResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function openRazorpayOrderCheckout(
  options: RazorpayOrderCheckoutOptions,
  onSuccess: (response: RazorpayOrderResponse) => void,
  onFailure?: (error: RazorpayFailureError) => void
): Promise<void> {
  const isLoaded = await loadRazorpayScript();
  const RazorpayCtor = typeof window !== 'undefined' ? (window as WindowWithRazorpay).Razorpay : undefined;
  if (!isLoaded || !RazorpayCtor) {
    throw new Error('Payment gateway SDK could not be loaded. Please check your network connection.');
  }

  const razorpayOptions: RazorpayOrderSdkOptions = {
    key: options.keyId,
    order_id: options.orderId,
    amount: options.amountPaise,
    currency: options.currency || 'INR',
    name: 'Hosteliq',
    description: options.description || 'Hosteliq SaaS Discounted Subscription',
    prefill: {
      name: options.organizationName || '',
      email: options.adminEmail || '',
      contact: options.adminPhone || '',
    },
    theme: {
      color: '#9333ea',
    },
    handler: function (response: RazorpayOrderResponse) {
      onSuccess(response);
    },
    modal: {
      ondismiss: function () {
        if (onFailure) {
          onFailure({ message: 'Checkout was dismissed by user' });
        }
      },
    },
  };

  const rzp = new RazorpayCtor(razorpayOptions);
  rzp.on('payment.failed', function (response) {
    if (onFailure) {
      onFailure(response.error);
    }
  });
  rzp.open();
}
