/**
 * Razorpay Configuration & Cryptographic Verification Utility (Phase F/G Reconciliation)
 * 
 * Provides:
 * - Razorpay SDK client initialization
 * - SaaS Subscription Plan & Subscription creation
 * - Cryptographic HMAC-SHA256 signature verification for Subscriptions & Webhooks
 * - Deterministic simulated test-mode fallback for automated test suites
 */

const crypto = require('crypto');
const Razorpay = require('razorpay');

const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy_key_id';
const keySecret = process.env.RAZORPAY_KEY_SECRET || 'dummy_key_secret_123456';
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret_123456';

let razorpayInstance = null;

function isConfigured() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_KEY_ID !== 'rzp_test_dummy_key_id' &&
    process.env.NODE_ENV !== 'test'
  );
}

function getClient() {
  if (!razorpayInstance) {
    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayInstance;
}

/**
 * Creates a Razorpay Subscription Plan.
 * In test mode or when unconfigured, returns deterministic mock plan.
 */
async function createPlan({ period = 'monthly', interval = 1, item }) {
  if (isConfigured()) {
    const client = getClient();
    return await client.plans.create({
      period,
      interval,
      item: {
        name: item.name,
        amount: item.amount,
        currency: item.currency || 'INR',
        description: item.description,
      },
    });
  }

  // Simulated Test Mode / Mock Plan
  const planId = `plan_test_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  return {
    id: planId,
    entity: 'plan',
    interval,
    period,
    item: {
      id: `item_${Date.now()}`,
      active: true,
      name: item.name,
      description: item.description,
      amount: item.amount,
      unit_amount: item.amount,
      currency: item.currency || 'INR',
    },
    created_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Creates a Razorpay Subscription for an Organization.
 * In test mode or when unconfigured, returns deterministic mock subscription.
 */
async function createSubscription({
  planId,
  totalCount = 12,
  quantity = 1,
  customerNotify = 1,
  startAt,
  notes = {},
}) {
  if (isConfigured()) {
    const client = getClient();
    const params = {
      plan_id: planId,
      total_count: totalCount,
      quantity,
      customer_notify: customerNotify,
      notes,
    };
    if (startAt) params.start_at = Math.floor(new Date(startAt).getTime() / 1000);
    return await client.subscriptions.create(params);
  }

  // Simulated Test Mode / Mock Subscription
  const subscriptionId = `sub_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    id: subscriptionId,
    entity: 'subscription',
    plan_id: planId,
    status: 'created',
    current_start: nowSec,
    current_end: nowSec + 30 * 24 * 3600,
    ended_at: null,
    quantity,
    charge_at: nowSec,
    start_at: nowSec,
    end_at: nowSec + totalCount * 30 * 24 * 3600,
    total_count: totalCount,
    paid_count: 0,
    remaining_count: totalCount,
    customer_notify: Boolean(customerNotify),
    created_at: nowSec,
    notes,
    short_url: `https://rzp.io/i/sub_${subscriptionId}`,
  };
}

/**
 * Fetches Razorpay Subscription details from provider.
 */
async function fetchSubscription(subscriptionId) {
  if (isConfigured()) {
    const client = getClient();
    return await client.subscriptions.fetch(subscriptionId);
  }

  // Simulated Test Mode Response
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    id: subscriptionId,
    entity: 'subscription',
    status: 'active',
    current_start: nowSec,
    current_end: nowSec + 30 * 24 * 3600,
    paid_count: 1,
    remaining_count: 11,
  };
}

/**
 * Cancels a Razorpay Subscription.
 */
async function cancelSubscription({ subscriptionId, cancelAtCycleEnd = false }) {
  if (isConfigured()) {
    const client = getClient();
    return await client.subscriptions.cancel(subscriptionId, cancelAtCycleEnd);
  }

  return {
    id: subscriptionId,
    status: 'cancelled',
    ended_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Generates an HMAC-SHA256 Subscription Checkout Signature.
 * Formula per Razorpay Subscriptions specification:
 * HMAC-SHA256(payment_id + "|" + subscription_id, secret)
 */
function generateSubscriptionSignature(subscriptionId, paymentId, secret = keySecret) {
  const body = `${paymentId}|${subscriptionId}`;
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Verifies Razorpay Subscriptions Checkout signature.
 * Formula: HMAC-SHA256(razorpay_payment_id + "|" + razorpay_subscription_id, secret) === razorpay_signature
 */
function verifySubscriptionSignature({
  subscriptionId,
  paymentId,
  signature,
  secret = keySecret,
}) {
  if (!subscriptionId || !paymentId || !signature) {
    return false;
  }

  try {
    const expectedSignature = generateSubscriptionSignature(subscriptionId, paymentId, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (err) {
    return false;
  }
}

/**
 * Creates a Razorpay Order (One-Time).
 */
async function createOrder({ amountPaise, currency = 'INR', receipt, notes = {} }) {
  if (isConfigured()) {
    const client = getClient();
    return await client.orders.create({
      amount: amountPaise,
      currency,
      receipt: String(receipt || Date.now()),
      notes,
    });
  }

  // Simulated Test Mode / Mock Order
  const orderId = `order_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  return {
    id: orderId,
    entity: 'order',
    amount: amountPaise,
    amount_paid: 0,
    amount_due: amountPaise,
    currency,
    receipt: receipt || String(Date.now()),
    status: 'created',
    attempts: 0,
    notes,
    created_at: Math.floor(Date.now() / 1000),
  };
}

/**
 * Generates an HMAC-SHA256 payment signature for one-time orders.
 * Formula: HMAC-SHA256(order_id + "|" + payment_id, secret)
 */
function generatePaymentSignature(orderId, paymentId, secret = keySecret) {
  const body = `${orderId}|${paymentId}`;
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Verifies Razorpay Checkout payment response signature for one-time orders.
 */
function verifyPaymentSignature({ orderId, paymentId, signature, secret = keySecret }) {
  if (!orderId || !paymentId || !signature) {
    return false;
  }

  try {
    const expectedSignature = generatePaymentSignature(orderId, paymentId, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (err) {
    return false;
  }
}

/**
 * Generates an HMAC-SHA256 webhook signature against a raw payload buffer or string.
 */
function generateWebhookSignature(rawBody, secret = webhookSecret) {
  const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  return crypto.createHmac('sha256', secret).update(bodyBuffer).digest('hex');
}

/**
 * Verifies Razorpay Webhook signature against the raw request body.
 */
function verifyWebhookSignature({ rawBody, signature, secret = webhookSecret }) {
  if (!rawBody || !signature) {
    return false;
  }

  try {
    const expectedSignature = generateWebhookSignature(rawBody, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  } catch (err) {
    return false;
  }
}

module.exports = {
  isConfigured,
  getClient,
  createPlan,
  createSubscription,
  fetchSubscription,
  cancelSubscription,
  generateSubscriptionSignature,
  verifySubscriptionSignature,
  createOrder,
  generatePaymentSignature,
  verifyPaymentSignature,
  generateWebhookSignature,
  verifyWebhookSignature,
  getPublicKey: () => keyId,
  getWebhookSecret: () => webhookSecret,
};
