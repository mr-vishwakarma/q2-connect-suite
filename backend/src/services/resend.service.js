/**
 * Q2 Connect Suite — Enterprise Resend Mail Service
 * 
 * Provides:
 * - Resend SDK client initialization with RESEND_API_KEY
 * - Transactional email delivery with bounded in-flight retries
 * - Strict sender-identity resolution on custom domain (mrvishwakarma.in)
 * - Safe structured logging with masked recipients & zero secret leakage
 * - Diagnostic status verification and safe error classification
 */

const { Resend } = require('resend');

// Singleton client cache
let resendInstance = null;
let lastApiKeyHash = '';

/**
 * Masks an email address for safe diagnostic logging (e.g. j***n@gmail.com)
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'unknown';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const [name, domain] = parts;
  const maskedName = name.length > 2 
    ? `${name[0]}***${name[name.length - 1]}`
    : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

/**
 * Masks an API key for safe diagnostics (e.g. re_abc***123)
 */
function maskApiKey(key) {
  if (!key || typeof key !== 'string') return 'NOT_CONFIGURED';
  const trimmed = key.trim();
  if (trimmed.length < 8) return '***';
  return `${trimmed.slice(0, 5)}...${trimmed.slice(-4)}`;
}

/**
 * Retrieves the Resend client instance if configured.
 * Fails closed with null if RESEND_API_KEY is missing.
 */
function getResendClient() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return null;

  if (resendInstance && lastApiKeyHash === apiKey) {
    return resendInstance;
  }

  resendInstance = new Resend(apiKey);
  lastApiKeyHash = apiKey;
  return resendInstance;
}

/**
 * Resolves authoritative sender identity matching the verified domain (mrvishwakarma.in).
 * Priority:
 * 1. RESEND_FROM_EMAIL (if set and valid)
 * 2. EMAIL_FROM (if set and matches domain or does not contain @gmail.com / @q2connect.com)
 * 3. Default verified identity: Q2 Connect Suite <noreply@mrvishwakarma.in>
 */
function getResendSenderAddress() {
  const explicitResendFrom = (process.env.RESEND_FROM_EMAIL || '').trim();
  if (explicitResendFrom && explicitResendFrom.includes('@')) {
    return explicitResendFrom;
  }

  const configuredFrom = (process.env.EMAIL_FROM || '').trim();
  if (
    configuredFrom && 
    configuredFrom.includes('@') && 
    !configuredFrom.includes('@gmail.com') && 
    !configuredFrom.includes('@q2connect.com')
  ) {
    return configuredFrom;
  }

  return 'Q2 Connect Suite <noreply@mrvishwakarma.in>';
}

/**
 * Returns safe diagnostic status of Resend configuration (NO SECRETS EXPOSED).
 */
function getResendStatus() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const sender = getResendSenderAddress();
  const isConfigured = Boolean(apiKey && apiKey.startsWith('re_'));

  return {
    provider: 'resend',
    configured: isConfigured,
    apiKeyConfigured: Boolean(apiKey),
    apiKeyMasked: maskApiKey(apiKey),
    senderAddress: sender,
    domain: sender.includes('@') ? sender.split('@')[1].replace('>', '').trim() : 'mrvishwakarma.in',
  };
}

/**
 * Explicit verification probe for Resend API configuration.
 */
async function verifyResendConnection() {
  const status = getResendStatus();
  if (!status.configured) {
    return {
      success: false,
      status: 'CONFIGURATION_MISSING',
      error: 'RESEND_API_KEY is not configured or does not start with re_',
      details: {
        provider: 'resend',
        keyPresent: status.apiKeyConfigured,
      },
    };
  }

  const client = getResendClient();
  if (!client) {
    return {
      success: false,
      status: 'CLIENT_INITIALIZATION_FAILED',
      error: 'Failed to initialize Resend client',
    };
  }

  try {
    // Probe API using domains list or api-keys list if permitted, or validate key format
    if (typeof client.domains?.list === 'function') {
      const response = await client.domains.list();
      if (response.error) {
        return {
          success: false,
          status: 'RESEND_API_ERROR',
          error: response.error.message || 'Error communicating with Resend API',
        };
      }
    }

    return {
      success: true,
      status: 'RESEND_READY',
      details: {
        provider: 'resend',
        senderAddress: status.senderAddress,
        domain: status.domain,
      },
    };
  } catch (err) {
    return {
      success: false,
      status: 'RESEND_VERIFICATION_FAILED',
      error: err.message || 'Failed to verify Resend credentials',
    };
  }
}

/**
 * Resolves authoritative Reply-To address on the custom domain (mrvishwakarma.in).
 * Never leaks or misaligns with free-tier Gmail addresses, which triggers DMARC and spam penalties.
 */
function getEffectiveReplyTo(customReplyTo = null) {
  if (customReplyTo && typeof customReplyTo === 'string' && customReplyTo.includes('@')) {
    return customReplyTo.trim();
  }
  const configuredReplyTo = (process.env.REPLY_TO_EMAIL || process.env.SUPPORT_EMAIL || '').trim();
  if (configuredReplyTo && configuredReplyTo.includes('@') && !configuredReplyTo.includes('@gmail.com') && !configuredReplyTo.includes('@q2connect.com')) {
    return configuredReplyTo;
  }
  return 'Q2 Connect Suite Support <support@mrvishwakarma.in>';
}

/**
 * Dispatches a transactional email via Resend with bounded in-flight retries.
 * 
 * @param {object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text alternative
 * @param {string} [options.correlationId] - Tracing / request identifier
 * @param {string} [options.replyTo] - Reply-to address
 * @param {string} [options.listUnsubscribe] - Optional List-Unsubscribe header for announcements
 * @param {object} [options.metadata] - Key-value metadata
 */
async function sendViaResend({
  to,
  subject,
  html,
  text,
  correlationId = null,
  replyTo = null,
  listUnsubscribe = null,
  metadata = {},
}) {
  const cleanTo = (to || '').trim().toLowerCase();
  const maskedTo = maskEmail(cleanTo);
  const effectiveCid = correlationId || `resend-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const logPrefix = `[resend][${effectiveCid}]`;

  // Check EmailSuppression list (hard bounces / spam complaints) to protect sender reputation
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const EmailSuppression = require('../models/EmailSuppression');
      const suppression = await EmailSuppression.findOne({ email: cleanTo }).lean();
      if (suppression) {
        console.warn(`${logPrefix} 🛡️ Email delivery suppressed: ${maskedTo} is on the suppression list (Reason: ${suppression.reason}). Suppressing to protect domain reputation.`);
        return {
          success: true,
          suppressed: true,
          reason: suppression.reason,
          provider: 'resend',
          messageId: `suppressed-${Date.now()}`,
          status: 'EMAIL_SUPPRESSED_BOUNCED',
          correlationId: effectiveCid,
        };
      }
    }
  } catch (suppressErr) {
    // Non-fatal suppression check
  }

  // Simulation mode check for automated unit test runs
  if (process.env.NODE_ENV === 'test' || process.env.MOCK_EMAIL === 'true') {
    console.log(`${logPrefix} 📧 [Simulated Resend] Delivered to: ${maskedTo} (Subject: ${subject})`);
    return {
      success: true,
      provider: 'resend',
      messageId: `mock-resend-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      simulated: true,
      status: 'EMAIL_ACCEPTED_BY_RESEND',
      correlationId: effectiveCid,
    };
  }

  const client = getResendClient();
  if (!client) {
    const error = new Error('RESEND_API_KEY is not configured on the backend.');
    error.status = 'CONFIGURATION_MISSING';
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  const from = getResendSenderAddress();
  const plainText = text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const effectiveReplyTo = getEffectiveReplyTo(replyTo);

  const isTransactional = ['PASSWORD_RESET', 'STUDENT_WELCOME_ACTIVATION', 'ADMIN_ACTION_OTP', 'SECONDARY_ADMIN_WELCOME'].includes(metadata?.purpose);

  const headers = {
    'X-Entity-Ref-ID': effectiveCid,
  };

  if (isTransactional) {
    headers['Auto-Submitted'] = 'auto-generated';
    headers['X-Auto-Response-Suppress'] = 'OOF, AutoReply';
  }

  if (listUnsubscribe) {
    headers['List-Unsubscribe'] = listUnsubscribe;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  const payload = {
    from,
    to: [cleanTo],
    subject,
    html,
    text: plainText,
    reply_to: effectiveReplyTo,
    headers,
    tags: [
      { name: 'correlation_id', value: effectiveCid.slice(0, 60) },
      ...(metadata?.purpose ? [{ name: 'purpose', value: String(metadata.purpose).slice(0, 60) }] : []),
    ],
  };

  let result = null;
  let lastErr = null;

  // Bounded retry loop: max 2 attempts for transient errors
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.emails.send(payload);

      if (response.error) {
        const error = new Error(response.error.message || 'Resend delivery rejected by provider');
        error.name = response.error.name || 'ResendDeliveryError';
        error.statusCode = response.error.statusCode || 500;
        throw error;
      }

      result = response.data;
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      const isTransient = 
        err.statusCode === 429 || 
        err.statusCode >= 500 || 
        /timeout|network|econnreset/i.test(err.message || '');

      if (isTransient && attempt < 2) {
        console.warn(`${logPrefix} ⚠️ Resend attempt ${attempt} encountered transient error (${err.message}). Retrying in 1000ms...`);
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } else {
        break;
      }
    }
  }

  if (!result && lastErr) {
    console.error(`${logPrefix} ❌ Resend dispatch failed for ${maskedTo}: ${lastErr.message}`);
    throw lastErr;
  }

  const messageId = result?.id || `resend-${Date.now()}`;
  console.log(`${logPrefix} 📧 Resend accepted delivery for ${maskedTo} (MessageId: ${messageId})`);

  return {
    success: true,
    provider: 'resend',
    messageId,
    accepted: true,
    status: 'EMAIL_ACCEPTED_BY_RESEND',
    correlationId: effectiveCid,
  };
}

module.exports = {
  getResendClient,
  getResendSenderAddress,
  getEffectiveReplyTo,
  getResendStatus,
  verifyResendConnection,
  sendViaResend,
  maskEmail,
  maskApiKey,
};
