/**
 * Razorpay Configuration & Cryptographic Verification Utility (Phase F)
 * 
 * Provides:
 * - Razorpay SDK client initialization
 * - Cryptographic HMAC-SHA256 signature verification for Checkout and Webhooks
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
 * Creates a Razorpay Order.
 * In test mode or when unconfigured, returns deterministic mock order.
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
 * Generates an HMAC-SHA256 payment signature (used for testing or verification).
 */
function generatePaymentSignature(orderId, paymentId, secret = keySecret) {
  const body = `${orderId}|${paymentId}`;
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Verifies Razorpay Checkout payment response signature.
 * Formula: HMAC-SHA256(order_id + "|" + payment_id, secret) === signature
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
 * Must use the exact raw bytes received over the network.
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
  createOrder,
  generatePaymentSignature,
  verifyPaymentSignature,
  generateWebhookSignature,
  verifyWebhookSignature,
  getPublicKey: () => keyId,
  getWebhookSecret: () => webhookSecret,
};
