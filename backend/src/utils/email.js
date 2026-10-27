const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
const nodemailer = require('nodemailer');
const {
  sendViaResend,
  getResendStatus,
  getResendSenderAddress,
  getEffectiveReplyTo,
  verifyResendConnection,
} = require('../services/resend.service');

/**
 * Escapes HTML characters to prevent XSS / HTML injection in email clients
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Masks an email address for safe logging (e.g. j***n@gmail.com)
 */
function maskEmail(email) {
  if (!email || typeof email !== 'string') return 'unknown';
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length > 2 
    ? `${name[0]}***${name[name.length - 1]}`
    : `${name[0]}***`;
  return `${maskedName}@${domain}`;
}

/**
 * Basic email format validator
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Known placeholder/mock domains that cannot receive email and will bounce back
 */
const UNROUTABLE_MOCK_DOMAINS = [
  'q2connect.com',
  'q2hostel.local',
  'example.com',
  'example.org',
  'example.net',
  'test.com',
  'localhost',
  'invalid',
];

/**
 * Checks if an email belongs to a routable domain or a mock/testing placeholder domain
 */
function isRoutableEmail(email) {
  if (!isValidEmail(email)) return false;
  const parts = email.trim().toLowerCase().split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  return !UNROUTABLE_MOCK_DOMAINS.includes(domain);
}

// Dynamic transporter caching
let cachedTransporter = null;
let lastConfigHash = '';

/**
 * Resolves sender address cleanly matching the active mail transport (Resend or SMTP)
 * Defaults to authenticated domain: Hosteliq <noreply@mrvishwakarma.in>
 */
function getSenderAddress() {
  if (process.env.RESEND_API_KEY) {
    return getResendSenderAddress();
  }
  const configuredFrom = (process.env.EMAIL_FROM || '').trim();
  if (configuredFrom && configuredFrom.includes('@') && !configuredFrom.includes('@q2connect.com')) {
    return configuredFrom;
  }
  return 'Hosteliq <noreply@mrvishwakarma.in>';
}

/**
 * Resolves monitored support contact address on the custom domain
 */
function getEffectiveSupportEmail() {
  const configured = (process.env.SUPPORT_EMAIL || process.env.REPLY_TO_EMAIL || '').trim();
  if (configured && configured.includes('@') && !configured.includes('@q2connect.com') && !configured.includes('@gmail.com')) {
    return configured;
  }
  return 'support@mrvishwakarma.in';
}

/**
 * Resolves the trusted frontend base URL, strictly preventing localhost links from being emailed to users
 */
function getTrustedFrontendUrl(req = null) {
  if (req?.headers?.origin) {
    const origin = req.headers.origin.trim();
    if (
      origin === 'https://mrvishwakarma.in' ||
      origin === 'https://www.mrvishwakarma.in' ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.lovable.app') ||
      origin.endsWith('.onrender.com') ||
      (process.env.NODE_ENV === 'development' && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')))
    ) {
      return origin;
    }
  }

  const siteUrl = (process.env.SITE_URL || '').trim();
  if (siteUrl && !siteUrl.includes('localhost')) {
    return siteUrl;
  }

  const configured = (process.env.FRONTEND_URL || process.env.CLIENT_URL || '').trim();
  if (configured && !configured.includes('localhost')) {
    return configured;
  }

  return 'https://mrvishwakarma.in';
}

/**
 * Creates an instrumented Nodemailer transport instance
 */
function createTransportInstance({ host, port, secure, service, user, pass }) {
  const options = {
    pool: false, // Transactional delivery must NEVER pool idle sockets on cloud containers
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    family: 4, // Force IPv4 to prevent hanging on cloud container IPv6 issues
    tls: {
      rejectUnauthorized: true,
      minVersion: 'TLSv1.2',
    },
  };

  if (service) {
    options.service = service;
  } else {
    options.host = host;
    options.port = port;
    options.secure = secure;
  }

  return nodemailer.createTransport(options);
}

/**
 * Get configured Nodemailer transporter
 */
const getTransporter = () => {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const isGmail = host.includes('gmail.com') || process.env.SMTP_SERVICE === 'gmail' || user.endsWith('@gmail.com');
  const defaultPort = isGmail ? '465' : '587';
  const port = parseInt(process.env.SMTP_PORT || defaultPort, 10);

  const configHash = `${host}:${port}:${user}:${pass ? 'set' : 'none'}:${isGmail ? 'gmail' : 'custom'}`;

  if (cachedTransporter && lastConfigHash === configHash) {
    return cachedTransporter;
  }

  cachedTransporter = createTransportInstance({
    host: isGmail ? 'smtp.gmail.com' : host,
    port: isGmail ? 465 : port,
    secure: isGmail ? true : port === 465,
    family: 4,
    user,
    pass,
  });

  lastConfigHash = configHash;
  return cachedTransporter;
};

/**
 * Get fallback transporter
 */
const getFallbackTransporter = () => {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const isGmail = host.includes('gmail.com') || process.env.SMTP_SERVICE === 'gmail' || user.endsWith('@gmail.com');

  if (isGmail) {
    return createTransportInstance({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      family: 4,
      user,
      pass,
    });
  }

  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const altPort = port === 465 ? 587 : 465;
  return createTransportInstance({
    host,
    port: altPort,
    secure: altPort === 465,
    family: 4,
    user,
    pass,
  });
};

/**
 * Safe summary of SMTP configuration presence (NO SECRETS RETURNED)
 */
const getSmtpConfigStatus = () => {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const isGmail = host.includes('gmail.com') || process.env.SMTP_SERVICE === 'gmail';
  const defaultPort = isGmail ? '465' : '587';
  const port = parseInt(process.env.SMTP_PORT || defaultPort, 10);
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const from = getSenderAddress();

  const isConfigured = Boolean(host && user && pass);

  return {
    configured: isConfigured,
    host,
    port,
    secure: port === 465,
    userMasked: user ? maskEmail(user) : 'NOT_CONFIGURED',
    fromConfigured: Boolean(from),
    fromMasked: from.includes('@') ? maskEmail(from) : from,
  };
};

/**
 * Comprehensive mail configuration status (Resend + SMTP) without secret leakage
 */
const getMailConfigStatus = () => {
  const resendStatus = getResendStatus();
  const smtpStatus = getSmtpConfigStatus();
  const primaryProvider = resendStatus.configured ? 'resend' : (smtpStatus.configured ? 'smtp' : 'none');

  return {
    primaryProvider,
    configured: Boolean(resendStatus.configured || smtpStatus.configured),
    from: getSenderAddress(),
    supportEmail: getEffectiveSupportEmail(),
    resend: resendStatus,
    smtp: smtpStatus,
  };
};

/**
 * Diagnostic mail connection verification (Resend or SMTP)
 */
const verifyMailConnection = async () => {
  if (process.env.RESEND_API_KEY) {
    return verifyResendConnection();
  }
  return verifySmtpConnection();
};

/**
 * Explicit SMTP connection verification
 */
const verifySmtpConnection = async () => {
  const config = getSmtpConfigStatus();
  if (!config.configured) {
    return {
      success: false,
      status: 'CONFIGURATION_MISSING',
      error: 'SMTP credentials or host are missing in environment variables.',
      details: {
        hostPresent: Boolean(process.env.SMTP_HOST),
        userPresent: Boolean(process.env.SMTP_USER),
        passPresent: Boolean(process.env.SMTP_PASS),
      },
    };
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    return {
      success: true,
      status: 'EMAIL_ACCEPTED_BY_SMTP',
      details: {
        host: config.host,
        port: config.port,
        secure: config.secure,
      },
    };
  } catch (primaryErr) {
    try {
      const fallback = getFallbackTransporter();
      await fallback.verify();
      cachedTransporter = fallback;
      return {
        success: true,
        status: 'EMAIL_ACCEPTED_BY_SMTP',
        details: {
          host: config.host,
          port: config.port === 465 ? 587 : 465,
          secure: config.port !== 465,
          fallbackActive: true,
        },
      };
    } catch (fallbackErr) {
      console.error(`[email] Fallback verify also failed: ${fallbackErr.message}`);
    }

    const errCode = primaryErr.code || primaryErr.responseCode || 'UNKNOWN';
    let status = 'TRANSPORT_CONNECTION_FAILED';

    if (errCode === 'EAUTH' || primaryErr.responseCode === 535 || /auth|credentials|login/i.test(primaryErr.message)) {
      status = 'SMTP_AUTHENTICATION_FAILED';
    }

    return {
      success: false,
      status,
      error: primaryErr.message,
      code: errCode,
    };
  }
};

/**
 * Send a transactional email using the centralized reusable transport with in-flight retries and durable logging
 * @param {object} options
 */
const sendEmail = async ({
  to,
  subject,
  html,
  text,
  correlationId = null,
  purpose = 'GENERAL_NOTIFICATION',
  targetUserId = null,
  targetStudentId = null,
  replyTo = null,
  listUnsubscribe = null,
  metadata = {},
}) => {
  if (!isValidEmail(to)) {
    throw new Error(`Invalid recipient email address: '${to}'`);
  }

  const cleanTo = to.trim().toLowerCase();
  const maskedTo = maskEmail(cleanTo);
  const effectiveCid = correlationId || `email-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const logPrefix = `[email][${effectiveCid}]`;

  // Simulation mode bypass for automated tests
  if (process.env.NODE_ENV === 'test' || process.env.MOCK_EMAIL === 'true') {
    console.log(`${logPrefix} 📧 [Simulated Email] Delivered to: ${maskedTo} (Subject: ${subject})`);
    return {
      success: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      simulated: true,
      status: 'EMAIL_ACCEPTED_BY_SMTP',
    };
  }

  // Suppression check for hard-bounced or complained recipients to protect domain reputation
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const EmailSuppression = require('../models/EmailSuppression');
      const suppression = await EmailSuppression.findOne({ email: cleanTo }).lean();
      if (suppression) {
        console.warn(`${logPrefix} 🛡️ Email delivery suppressed: ${maskedTo} is on suppression list (${suppression.reason}). Skipping to protect domain reputation.`);
        return {
          success: true,
          suppressed: true,
          reason: suppression.reason,
          messageId: `suppressed-${Date.now()}`,
          status: 'EMAIL_SUPPRESSED_BOUNCED',
        };
      }
    }
  } catch (suppressErr) {
    // Non-fatal suppression check
  }

  // Intercept unroutable mock/placeholder domains
  if (!isRoutableEmail(cleanTo)) {
    console.warn(`${logPrefix} ⚠️ Outgoing email suppressed: recipient '${cleanTo}' is on a non-routable/mock domain. Skipping to protect sender reputation.`);

    try {
      const mongoose = require('mongoose');
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const EmailLog = require('../models/EmailLog');
        await EmailLog.create({
          recipient: cleanTo,
          recipientMasked: maskedTo,
          purpose,
          subject,
          status: 'SUPPRESSED_UNROUTABLE',
          correlationId: effectiveCid,
          targetUserId,
          targetStudentId,
          metadata,
          lastError: `Recipient domain ${cleanTo.split('@')[1]} is a non-routable mock placeholder`,
        });
      }
    } catch (e) {
      // Non-fatal logging error
    }

    return {
      success: true,
      suppressed: true,
      reason: 'UNROUTABLE_MOCK_DOMAIN',
      recipient: maskedTo,
      messageId: `suppressed-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      status: 'EMAIL_SUPPRESSED_UNROUTABLE_DOMAIN',
    };
  }

  // 1. Primary: If Resend API Key is set, deliver transactional email via Resend SDK
  if (process.env.RESEND_API_KEY) {
    let emailLogEntry = null;
    try {
      const mongoose = require('mongoose');
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        const EmailLog = require('../models/EmailLog');
        emailLogEntry = await EmailLog.create({
          recipient: cleanTo,
          recipientMasked: maskedTo,
          purpose,
          subject,
          status: 'PROCESSING',
          provider: 'resend',
          correlationId: effectiveCid,
          targetUserId,
          targetStudentId,
          metadata,
          attempts: 1,
        });
      }
    } catch (logErr) {
      // Non-fatal logging error
    }

    try {
      const result = await sendViaResend({
        to: cleanTo,
        subject,
        html,
        text,
        correlationId: effectiveCid,
        replyTo: replyTo || getEffectiveSupportEmail(),
        listUnsubscribe,
        metadata: { purpose, targetUserId, targetStudentId, ...metadata },
      });

      if (emailLogEntry) {
        if (result.suppressed) {
          emailLogEntry.status = 'SUPPRESSED_BOUNCED';
        } else {
          emailLogEntry.status = 'RESEND_ACCEPTED';
          emailLogEntry.resendMessageId = result.messageId;
          emailLogEntry.deliveredAt = new Date();
        }
        await emailLogEntry.save().catch(() => {});
      }

      return {
        success: true,
        provider: 'resend',
        messageId: result.messageId,
        accepted: !result.suppressed,
        suppressed: Boolean(result.suppressed),
        status: result.suppressed ? 'EMAIL_SUPPRESSED_BOUNCED' : 'EMAIL_ACCEPTED_BY_RESEND',
        correlationId: effectiveCid,
      };
    } catch (resendErr) {
      console.warn(`${logPrefix} ⚠️ Resend dispatch error (${resendErr.message}). Checking SMTP fallback availability...`);
      const smtpConfig = getSmtpConfigStatus();
      if (!smtpConfig.configured) {
        if (emailLogEntry) {
          emailLogEntry.status = 'FAILED_PERMANENT';
          emailLogEntry.lastError = resendErr.message;
          emailLogEntry.failedAt = new Date();
          await emailLogEntry.save().catch(() => {});
        }
        throw resendErr;
      }
      console.log(`${logPrefix} 🔄 Falling back to SMTP transport...`);
    }
  }

  // 2. Fallback: SMTP Transport
  const config = getSmtpConfigStatus();
  if (!config.configured) {
    const errorMsg = 'Email transport configuration is missing (neither Resend nor SMTP configured).';
    console.error(`${logPrefix} ❌ ${errorMsg}`);
    const error = new Error(errorMsg);
    error.status = 'CONFIGURATION_MISSING';
    error.code = 'CONFIG_MISSING';
    throw error;
  }

  let emailLogEntry = null;
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const EmailLog = require('../models/EmailLog');
      emailLogEntry = await EmailLog.create({
        recipient: cleanTo,
        recipientMasked: maskedTo,
        purpose,
        subject,
        status: 'PROCESSING',
        correlationId: effectiveCid,
        targetUserId,
        targetStudentId,
        metadata,
        attempts: 1,
      });
    }
  } catch (logErr) {
    // Non-fatal logging error
  }

  try {
    const from = getSenderAddress();
    const effectiveReplyTo = replyTo || getEffectiveSupportEmail();

    const headers = {
      'X-Mailer': 'Hosteliq Mailer v2',
      'X-Entity-Ref-ID': effectiveCid,
    };

    const isTransactional = ['PASSWORD_RESET', 'STUDENT_WELCOME_ACTIVATION', 'ADMIN_ACTION_OTP', 'SECONDARY_ADMIN_WELCOME'].includes(purpose);
    if (isTransactional) {
      headers['Auto-Submitted'] = 'auto-generated';
      headers['X-Auto-Response-Suppress'] = 'OOF, AutoReply';
    }

    if (listUnsubscribe) {
      headers['List-Unsubscribe'] = listUnsubscribe;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }

    const mailOptions = {
      from,
      to: cleanTo,
      replyTo: effectiveReplyTo,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      headers,
    };

    let info = null;
    let lastSendErr = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const transporter = getTransporter();
        info = await transporter.sendMail(mailOptions);
        lastSendErr = null;
        break;
      } catch (sendErr) {
        lastSendErr = sendErr;
        cachedTransporter = null;
        const errCode = sendErr.code || sendErr.responseCode || 'UNKNOWN';
        const isTransient = errCode === 'ETIMEDOUT' || errCode === 'ECONNREFUSED' || errCode === 'ECONNRESET' || /timeout|connect/i.test(sendErr.message);

        if (isTransient && attempt < 2) {
          console.warn(`${logPrefix} ⚠️ Primary SMTP attempt ${attempt} transient error (${sendErr.message}). Retrying in 1200ms...`);
          await new Promise((resolve) => setTimeout(resolve, 1200));
        } else {
          break;
        }
      }
    }

    if (!info && lastSendErr) {
      const errCode = lastSendErr.code || lastSendErr.responseCode || 'UNKNOWN';
      const isConnectionIssue = errCode === 'ETIMEDOUT' || errCode === 'ECONNREFUSED' || errCode === 'ECONNRESET' || /timeout|connect/i.test(lastSendErr.message);

      if (isConnectionIssue) {
        console.warn(`${logPrefix} ⚠️ Primary SMTP failed. Retrying with fallback transport...`);
        const fallback = getFallbackTransporter();
        info = await fallback.sendMail(mailOptions);
        console.log(`${logPrefix} ✅ Fallback SMTP dispatch succeeded!`);
      } else {
        throw lastSendErr;
      }
    }

    console.log(`${logPrefix} 📧 Email accepted by SMTP for ${maskedTo} (MessageId: ${info.messageId})`);

    if (emailLogEntry) {
      emailLogEntry.status = 'SMTP_ACCEPTED';
      emailLogEntry.smtpMessageId = info.messageId;
      emailLogEntry.deliveredAt = new Date();
      await emailLogEntry.save().catch(() => {});
    }

    return {
      success: true,
      messageId: info.messageId,
      accepted: true,
      status: 'EMAIL_ACCEPTED_BY_SMTP',
      correlationId: effectiveCid,
    };
  } catch (error) {
    const errCode = error.code || error.responseCode || 'UNKNOWN';
    let classifiedStatus = 'TRANSPORT_CONNECTION_FAILED';

    if (errCode === 'EAUTH' || error.responseCode === 535 || /auth|credentials/i.test(error.message)) {
      classifiedStatus = 'SMTP_AUTHENTICATION_FAILED';
    } else if (/rejected|recipient/i.test(error.message) || error.responseCode >= 500) {
      classifiedStatus = 'MESSAGE_REJECTED';
    }

    console.error(`${logPrefix} ❌ Email dispatch failed for ${maskedTo}: ${error.message}`);

    if (emailLogEntry) {
      emailLogEntry.status = classifiedStatus === 'SMTP_AUTHENTICATION_FAILED' || classifiedStatus === 'MESSAGE_REJECTED' ? 'FAILED_PERMANENT' : 'FAILED_RETRYABLE';
      emailLogEntry.lastError = error.message;
      emailLogEntry.lastErrorCode = String(errCode);
      emailLogEntry.failedAt = new Date();
      await emailLogEntry.save().catch(() => {});
    }

    error.status = classifiedStatus;
    throw error;
  }
};

/**
 * Clean, lightweight, professional email layout designed for high deliverability and spam avoidance.
 * Features:
 * - High-contrast readable typography on pure white (#ffffff) card
 * - Light neutral canvas (#f8fafc) compatible with mobile and desktop email clients
 * - Hidden preheader to prevent preview snippet bleed in inbox lists
 * - Zero dark background inversion traps
 * - Authentic, verified organization identity in header & footer
 * - Zero spam trigger phrases ("mark as not spam" completely removed)
 */
function renderBrandedLayout({ title, subtitle, preheader, contentHtml, footerNote, unsubscribeUrl }) {
  const currentYear = new Date().getFullYear();
  const safePreheader = preheader ? escapeHtml(preheader) : '';
  const supportEmail = getEffectiveSupportEmail();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(title || 'Hosteliq')}</title>
  <!--[if mso]>
  <style type="text/css">
    body, table, td {font-family: Arial, Helvetica, sans-serif !important;}
  </style>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #334155;">
  ${safePreheader ? `
  <!-- Hidden preheader text to control inbox preview snippet -->
  <div style="display: none; font-size: 1px; color: #f8fafc; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden; mso-hide: all;">
    ${safePreheader}
    &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
  </div>` : ''}

  <div style="background-color: #f8fafc; padding: 32px 16px; min-height: 100%;">
    <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);">
      <!-- Brand Header -->
      <tr>
        <td style="padding: 24px 28px 20px 28px; border-bottom: 1px solid #e2e8f0; background-color: #ffffff;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <span style="font-size: 18px; font-weight: 800; letter-spacing: -0.3px; color: #0f172a; text-transform: uppercase;">HOSTELIQ</span>
                <p style="margin: 3px 0 0 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 600; color: #64748b;">${escapeHtml(subtitle || 'Accommodation & Resident Platform')}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Main Body -->
      <tr>
        <td style="padding: 28px 28px 24px 28px; background-color: #ffffff;">
          ${title ? `<h1 style="margin: 0 0 16px 0; font-size: 19px; font-weight: 700; color: #0f172a; line-height: 1.3;">${escapeHtml(title)}</h1>` : ''}
          ${contentHtml}
        </td>
      </tr>

      <!-- Trust & Support Footer -->
      <tr>
        <td style="padding: 20px 28px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: left; font-size: 12px; line-height: 1.5; color: #64748b;">
          ${footerNote ? `<p style="margin: 0 0 8px 0; color: #475569;">${footerNote}</p>` : ''}
          <p style="margin: 0 0 4px 0; color: #64748b;">
            You received this message because your account is registered with <strong>Hosteliq</strong>.
          </p>
          <p style="margin: 0; color: #64748b;">
            Questions or assistance? Contact our team at <a href="mailto:${supportEmail}" style="color: #2563eb; text-decoration: none;">${supportEmail}</a>
          </p>
          ${unsubscribeUrl ? `
          <p style="margin: 8px 0 0 0; font-size: 11px;">
            <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Manage email preferences or unsubscribe</a>
          </p>` : ''}
          <p style="margin: 10px 0 0 0; font-size: 11px; color: #94a3b8;">
            &copy; ${currentYear} Hosteliq &bull; Accommodation & Resident Operations
          </p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;
}

/**
 * Send Student Announcement or General Update Email
 * Adheres strictly to the copy and structure in Section 6.
 * 
 * @param {object} options
 * @param {string} options.to - Student email address
 * @param {string} options.studentName - Full student name
 * @param {string} options.announcementTitle - Specific announcement title
 * @param {string} options.announcementSummary - 1-2 sentence concise summary
 * @param {string} options.date - Date of the update/event
 * @param {string} options.time - Time of the update/event
 * @param {string} options.details - Location or relevant operational details
 * @param {string} [options.actionUrl] - Direct HTTPS link to view announcement
 * @param {string} [options.supportEmail] - Monitored support contact
 * @param {string} [options.correlationId] - Tracing ID
 */
const sendStudentAnnouncementEmail = async ({
  to,
  studentName = 'Student',
  announcementTitle,
  announcementSummary,
  date = 'As announced',
  time = 'Standard hours',
  details = 'Please refer to student portal for full notes',
  actionUrl,
  supportEmail = null,
  correlationId = null,
}) => {
  const safeName = escapeHtml(studentName);
  const safeTitle = escapeHtml(announcementTitle);
  const safeSummary = escapeHtml(announcementSummary);
  const safeDate = escapeHtml(date);
  const safeTime = escapeHtml(time);
  const safeDetails = escapeHtml(details);
  const effectiveSupport = supportEmail || getEffectiveSupportEmail();

  const frontendUrl = getTrustedFrontendUrl();
  const cleanActionUrl = (actionUrl || `${frontendUrl}/student/announcements`).trim();

  const subject = `A student update from Hosteliq: ${announcementTitle}`;
  const preheader = announcementSummary;

  const text = `A student update from Hosteliq: ${announcementTitle}

Hello ${studentName},

You are receiving this message because your student account is registered with Hosteliq.

${announcementTitle}

${announcementSummary}

Details:
- Date: ${date}
- Time: ${time}
- Location or relevant information: ${details}

View announcement:
${cleanActionUrl}

If you have questions, reply to this email or contact ${effectiveSupport}.

Hosteliq
Student communications`;

  const contentHtml = `
    <p style="margin: 0 0 14px 0; font-size: 15px; color: #334155; line-height: 1.6;">
      Hello <strong>${safeName}</strong>,
    </p>
    <p style="margin: 0 0 18px 0; font-size: 14px; color: #64748b; line-height: 1.5;">
      You are receiving this message because your student account is registered with Hosteliq.
    </p>

    <div style="background-color: #f8fafc; border-left: 4px solid #0f172a; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
      <h2 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 700; color: #0f172a;">${safeTitle}</h2>
      <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.5;">${safeSummary}</p>
    </div>

    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px; font-size: 14px; color: #334155; border-collapse: collapse;">
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #64748b; width: 140px;">Date:</td>
        <td style="padding: 6px 0; color: #0f172a; font-weight: 500;">${safeDate}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Time:</td>
        <td style="padding: 6px 0; color: #0f172a; font-weight: 500;">${safeTime}</td>
      </tr>
      <tr>
        <td style="padding: 6px 0; font-weight: 600; color: #64748b;">Location / Details:</td>
        <td style="padding: 6px 0; color: #0f172a; font-weight: 500;">${safeDetails}</td>
      </tr>
    </table>

    <div style="margin: 24px 0 20px 0;">
      <a href="${cleanActionUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        View announcement
      </a>
    </div>

    <p style="margin: 20px 0 0 0; font-size: 13px; color: #64748b; line-height: 1.5;">
      If you have questions, reply to this email or contact <a href="mailto:${effectiveSupport}" style="color: #2563eb; text-decoration: none;">${effectiveSupport}</a>.
    </p>
  `;

  const html = renderBrandedLayout({
    title: 'Student Update',
    subtitle: 'Official Resident Communications',
    preheader,
    contentHtml,
    footerNote: 'Hosteliq &bull; Student communications',
  });

  const unsubscribeUrl = `${frontendUrl}/student/preferences`;

  return sendEmail({
    to,
    subject,
    html,
    text,
    correlationId,
    purpose: 'STUDENT_ANNOUNCEMENT',
    listUnsubscribe: `<${unsubscribeUrl}>, <mailto:${effectiveSupport}>`,
    metadata: { announcementTitle, studentName },
  });
};

/**
 * Send branded welcome & account activation email to student
 */
const sendStudentWelcomeEmail = async (options) => {
  const { to, activationLink, loginLink, correlationId } = options;
  const rawName = options.name || options.studentName || 'Student';
  const rawUsername = options.username || '';
  const rawStudentCode = options.studentCode || options.studentId || options.username || '';
  const rawHostel = options.hostel || options.hostelName || 'Q2';
  const targetStudentId = options.studentDocId || options.studentId || null;

  const safeName = escapeHtml(rawName);
  const safeUsername = escapeHtml(rawUsername);
  const safeStudentCode = escapeHtml(rawStudentCode);
  const safeHostel = escapeHtml(rawHostel);

  const subject = options.subject || `Welcome to Hosteliq — Activate Your Resident Account (${rawHostel})`;
  const preheader = `Your resident admission into ${rawHostel} Hostel is confirmed. Activate your account to sign in.`;

  const cleanActivationLink = (activationLink || '').trim();
  const frontendUrl = getTrustedFrontendUrl();
  const cleanLoginLink = (loginLink || `${frontendUrl}/login?role=student`).trim();

  const text = `Welcome to Hosteliq!

Hello ${rawName},

Your resident admission into ${rawHostel} Hostel has been confirmed. Your resident account is ready.

Account Details:
- Resident Name: ${rawName}
- Hostel Branch: ${rawHostel}
- User ID: ${rawUsername}
- Student Code: ${rawStudentCode}

Step 1: Set Your Secure Password
Please open the link below to activate your account and choose your private password (link expires in 48 hours):
${cleanActivationLink}

Step 2: Sign In
After setting your password, sign in to the Student Portal at:
${cleanLoginLink}

If you have any questions or require assistance, please contact our support team at ${getEffectiveSupportEmail()}.

Best regards,
${rawHostel} Administration & Operations
Hosteliq`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Hello <strong>${safeName}</strong>,
    </p>
    <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      Your resident admission into <strong>${safeHostel} Hostel</strong> has been confirmed. Your resident profile and room allocation are now active in the system.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 22px;">
      <p style="margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: #64748b;">Resident Account Details</p>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; padding: 5px 0;">Student Code:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right; font-family: monospace;">${safeStudentCode}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 5px 0;">Login User ID:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right; font-family: monospace;">${safeUsername}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 5px 0;">Hostel Branch:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${safeHostel}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 22px;">
      <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Step 1: Set Your Secure Password</p>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">Permanent passwords are never sent via email for your privacy and protection.</p>
      <a href="${cleanActivationLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Activate Account & Set Password
      </a>
      <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748b;">
        This single-use activation link expires in <strong>48 hours</strong>.
      </p>
    </div>

    <p style="margin: 0 0 10px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
      If the button above does not work, copy and paste this link into your browser:<br/>
      <a href="${cleanActivationLink}" style="color: #2563eb; word-break: break-all; font-size: 12px;">${cleanActivationLink}</a>
    </p>

    <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 20px;">
      <p style="margin: 0; font-size: 13px; color: #475569; line-height: 1.5;">
        <strong>Step 2: Sign In</strong><br/>
        After choosing your password, you can access your resident dashboard at the <a href="${cleanLoginLink}" style="color: #2563eb; text-decoration: underline;">Student Portal</a>.
      </p>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'Resident Account Activation',
    subtitle: 'Hostel Onboarding',
    preheader,
    contentHtml,
    footerNote: 'Welcome to your hostel residence! Please retain this email for your records.',
  });

  return sendEmail({
    to,
    subject,
    html,
    text,
    correlationId,
    purpose: 'STUDENT_WELCOME_ACTIVATION',
    targetStudentId,
    metadata: {
      name: rawName,
      username: rawUsername,
      studentCode: rawStudentCode,
      hostel: rawHostel,
    },
  });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async ({ to, name = null, resetLink, correlationId }) => {
  const subject = 'Reset Your Hosteliq Password';
  const preheader = 'We received a request to reset your password. This link is valid for 2 hours.';
  const cleanLink = resetLink.trim();
  const safeName = name ? escapeHtml(name) : null;
  const supportEmail = getEffectiveSupportEmail();

  const text = `Password Reset Request — Hosteliq

${name ? `Hello ${name},\n\n` : ''}We received a request to reset the password for your Hosteliq account.

Click the link below or copy it into your browser to set a new password (valid for 2 hours):
${cleanLink}

Security Notice:
- This single-use password reset link is valid for 2 hours from when it was requested.
- If you did not make this request, you can safely ignore this email. Your current password remains secure and unchanged.

Need help? Contact support at ${supportEmail}.

Best regards,
Hosteliq Security Team`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      ${safeName ? `Hello <strong>${safeName}</strong>,<br/><br/>` : ''}
      We received a request to reset the password for your Hosteliq account.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 22px; text-align: center; margin: 20px 0;">
      <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #0f172a;">Click below to set your new password:</p>
      <a href="${cleanLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Reset Password
      </a>
      <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748b;">
        This single-use link expires in <strong>2 hours</strong>.
      </p>
    </div>

    <p style="margin: 0 0 16px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
      If the button does not work, copy and paste this link into your browser:<br/>
      <a href="${cleanLink}" style="color: #2563eb; word-break: break-all; font-size: 12px;">${cleanLink}</a>
    </p>

    <div style="background-color: #f1f5f9; border-left: 4px solid #64748b; border-radius: 4px; padding: 12px 16px; margin-top: 20px;">
      <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
        <strong>Security Notice:</strong> If you did not request this password reset, no action is needed. Your password remains unchanged.
      </p>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'Password Reset',
    subtitle: 'Security & Access Control',
    preheader,
    contentHtml,
  });

  return sendEmail({
    to,
    subject,
    html,
    text,
    correlationId,
    purpose: 'PASSWORD_RESET',
  });
};

/**
 * Send Fee Reminder Email to Resident
 */
const sendFeeReminderEmail = async ({
  to,
  studentName = 'Resident',
  month = 'Current Billing Cycle',
  amount,
  dueDate = 'Immediately',
  paymentUrl = null,
  hostelName = 'Hostel',
  correlationId = null,
}) => {
  const safeName = escapeHtml(studentName);
  const safeMonth = escapeHtml(month);
  const safeAmount = escapeHtml(String(amount || '0'));
  const safeHostel = escapeHtml(hostelName);
  const frontendUrl = getTrustedFrontendUrl();
  const cleanPaymentUrl = (paymentUrl || `${frontendUrl}/student/fees`).trim();
  const supportEmail = getEffectiveSupportEmail();

  const subject = `Fee Notice: Pending Hostel Dues for ${month}`;
  const preheader = `A balance of ₹${amount} is pending for ${month} at ${hostelName}. View and clear dues online.`;

  const text = `Hostel Fee Notice — Hosteliq

Dear ${studentName},

This is a reminder that your hostel fees for ${month} at ${hostelName} are currently pending.

Summary of Dues:
- Resident Name: ${studentName}
- Hostel: ${hostelName}
- Billing Month: ${month}
- Amount Due: ₹${amount}
- Due Date: ${dueDate}

You can review your fee statement and complete online payment through the resident portal:
${cleanPaymentUrl}

If you have already settled this payment, please disregard this notice or contact management.

Best regards,
${hostelName} Accounts & Administration
Hosteliq`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">
      Dear <strong>${safeName}</strong>,
    </p>
    <p style="margin: 0 0 18px 0; font-size: 14px; line-height: 1.6; color: #475569;">
      This is a formal notification that your hostel accommodation fee for <strong>${safeMonth}</strong> at <strong>${safeHostel}</strong> is currently pending.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 22px;">
      <p style="margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: #64748b;">Fee Statement</p>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Billing Cycle:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${safeMonth}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 6px 0;">Hostel Branch:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${safeHostel}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 6px 0; border-top: 1px solid #e2e8f0; font-weight: 600;">Amount Due:</td>
          <td style="color: #0f172a; font-weight: 700; font-size: 16px; text-align: right; border-top: 1px solid #e2e8f0;">₹${safeAmount}</td>
        </tr>
      </table>
    </div>

    <div style="margin: 22px 0;">
      <a href="${cleanPaymentUrl}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 13px 26px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Review & Pay Fees Online
      </a>
    </div>

    <p style="margin: 16px 0 0 0; font-size: 12px; color: #64748b; line-height: 1.5;">
      If you have already settled this payment or have billing questions, please contact administration at <a href="mailto:${supportEmail}" style="color: #2563eb; text-decoration: none;">${supportEmail}</a>.
    </p>
  `;

  const html = renderBrandedLayout({
    title: 'Hostel Fee Due Notice',
    subtitle: 'Finance & Accounts',
    preheader,
    contentHtml,
  });

  return sendEmail({
    to,
    subject,
    html,
    text,
    correlationId,
    purpose: 'FEE_REMINDER',
    metadata: { studentName, month, amount, hostelName },
  });
};

/**
 * Send mess request status update email
 */
const sendMessRequestUpdate = async ({ to, name, status, leavingDate, returnDate, adminMessage, correlationId }) => {
  const statusFormatted = status === 'approved' ? 'Approved' : 'Rejected';
  const statusColor = status === 'approved' ? '#15803d' : '#b91c1c';
  const subject = `Update on Your Mess Request: ${statusFormatted}`;
  const preheader = `Your mess leave request has been ${statusFormatted.toLowerCase()}. View details inside.`;

  const text = `Mess Leave Request Update — Hosteliq

Hello ${name},

Your mess leave request has been ${statusFormatted.toUpperCase()}.

Request Details:
- Status: ${statusFormatted}
- Leaving Date: ${leavingDate}
- Return Date: ${returnDate}
${adminMessage ? `- Note from Administration: ${adminMessage}\n` : ''}
Log in to your Student Portal to review your meal calendar:
${getTrustedFrontendUrl()}/student/mess

Best regards,
Kitchen & Dining Operations
Hosteliq`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">Hello <strong>${escapeHtml(name)}</strong>,</p>
    <p style="margin: 0 0 18px 0; font-size: 14px; color: #475569;">
      Your mess off / leave request has been evaluated and marked as:
      <strong style="color: ${statusColor}; text-transform: uppercase;">${escapeHtml(statusFormatted)}</strong>.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 8px; margin: 18px 0;">
      <p style="margin: 4px 0; font-size: 14px;"><strong>Leaving Date:</strong> ${escapeHtml(leavingDate)}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Return Date:</strong> ${escapeHtml(returnDate)}</p>
      ${adminMessage ? `<p style="margin: 8px 0 0 0; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #475569;"><strong>Admin Note:</strong> ${escapeHtml(adminMessage)}</p>` : ''}
    </div>

    <div style="margin: 20px 0;">
      <a href="${getTrustedFrontendUrl()}/student/mess" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        View Meal Schedule
      </a>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'Mess Request Status',
    subtitle: 'Dining & Kitchen Operations',
    preheader,
    contentHtml,
  });

  return sendEmail({
    to,
    subject,
    html,
    text,
    correlationId,
    purpose: 'MESS_REQUEST_UPDATE',
    metadata: { name, status, leavingDate, returnDate },
  });
};

/**
 * Send email OTP to Primary Admin for privileged actions
 */
const sendAdminActionOtpEmail = async ({ to, adminName = 'Administrator', action, otp, expiresInMinutes = 5, correlationId }) => {
  const actionLabel =
    action === 'CREATE_SECONDARY_ADMIN'
      ? 'Create New Secondary Administrator'
      : action === 'DELETE_SECONDARY_ADMIN' || action === 'DEACTIVATE_SECONDARY_ADMIN'
      ? 'Deactivate Secondary Administrator Account'
      : 'Privileged Administrative Action';

  const safeAdminName = escapeHtml(adminName);
  const safeAction = escapeHtml(actionLabel);
  const subject = `Security Verification Code: ${otp}`;
  const preheader = `Your verification code is ${otp}. Valid for ${expiresInMinutes} minutes.`;

  const text = `Hosteliq Security Verification

Hello ${adminName},

You initiated a privileged administrative request:
${actionLabel}

Your One-Time Verification Code is:
${otp}

This verification code expires in ${expiresInMinutes} minutes and is single-use.

Security Notice:
Never share this verification code with anyone. Hosteliq staff will never ask for your verification code.

Best regards,
Hosteliq Security Operations`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #334155;">
      Hello <strong>${safeAdminName}</strong>,
    </p>
    <p style="margin: 0 0 14px 0; font-size: 14px; color: #475569;">
      A request has been initiated by your administrator account for:
      <strong>${safeAction}</strong>
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 22px; text-align: center; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1.2px; font-weight: 700; color: #64748b;">Verification Code</p>
      <div style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #0f172a; font-family: monospace; margin: 6px 0;">
        ${otp}
      </div>
      <p style="margin: 8px 0 0 0; font-size: 12px; color: #64748b;">Valid for <strong>${expiresInMinutes} minutes</strong> (Single-use)</p>
    </div>

    <div style="background-color: #f1f5f9; border-left: 4px solid #64748b; border-radius: 4px; padding: 12px 16px;">
      <p style="margin: 0; font-size: 12px; color: #475569; line-height: 1.5;">
        <strong>Security Notice:</strong> Never share this code with anyone. If you did not initiate this request, change your password immediately.
      </p>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'Verification Code',
    subtitle: 'Security & Access Control',
    preheader,
    contentHtml,
  });

  return sendEmail({
    to,
    subject,
    html,
    text,
    correlationId,
    purpose: 'ADMIN_ACTION_OTP',
  });
};

/**
 * Send welcome & account setup invitation email to newly created Secondary Admin
 */
const sendSecondaryAdminWelcomeEmail = async ({
  to,
  name,
  username,
  hostelName = 'Assigned Hostel',
  orgName = 'Hosteliq',
  activationLink,
  loginLink,
  correlationId,
  adminUserId = null,
}) => {
  const safeName = escapeHtml(name || 'Administrator');
  const safeUsername = escapeHtml(username || '');
  const safeHostel = escapeHtml(hostelName || 'Assigned Hostel');
  const safeOrg = escapeHtml(orgName || 'Hosteliq');
  const frontendUrl = getTrustedFrontendUrl();
  const cleanActivationLink = (activationLink || `${frontendUrl}/login`).trim();
  const cleanLoginLink = (loginLink || `${frontendUrl}/login?role=admin`).trim();

  const subject = `Staff Account Provisioned — Activate Your Administrator Account (${hostelName})`;
  const preheader = `You have been appointed as an administrator for ${hostelName}. Set your password to get started.`;

  const text = `Welcome to Hosteliq!

Hello ${name},

You have been appointed as an Administrator for "${hostelName}" under ${orgName}. Your staff account is provisioned.

Account Details:
- Administrator Name: ${name}
- User ID: ${username}
- Assigned Hostel: ${hostelName}

Please open the link below to activate your account and choose your secure password (valid for 48 hours):
${cleanActivationLink}

After activation, you can sign in anytime at:
${cleanLoginLink}

Best regards,
Administration & Operations — Hosteliq`;

  const contentHtml = `
    <p style="margin: 0 0 14px 0; font-size: 15px; color: #334155;">Hello <strong>${safeName}</strong>,</p>
    <p style="margin: 0 0 18px 0; font-size: 14px; color: #475569; line-height: 1.6;">
      You have been appointed as an <strong>Administrator</strong> for <strong>${safeHostel}</strong> under <strong>${safeOrg}</strong>. Your staff account has been provisioned.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 22px;">
      <p style="margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; font-weight: 700; color: #64748b;">Account Details</p>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; padding: 5px 0;">Assigned Role:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">Secondary Admin</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 5px 0;">Login User ID:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right; font-family: monospace;">${safeUsername}</td>
        </tr>
        <tr>
          <td style="color: #64748b; padding: 5px 0;">Hostel Branch:</td>
          <td style="color: #0f172a; font-weight: 600; text-align: right;">${safeHostel}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 22px;">
      <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: 700; color: #0f172a;">Set Your Private Password</p>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #64748b;">Permanent passwords are never sent via email. Click below to choose your secure credentials.</p>
      <a href="${cleanActivationLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-weight: 600; font-size: 14px;">
        Activate Account & Set Password
      </a>
      <p style="margin: 12px 0 0 0; font-size: 12px; color: #64748b;">This activation link expires in <strong>48 hours</strong>.</p>
    </div>

    <p style="margin: 0 0 16px 0; font-size: 12px; color: #64748b; line-height: 1.5;">
      If the button above does not work, copy and paste this link into your browser:<br/>
      <a href="${cleanActivationLink}" style="color: #2563eb; word-break: break-all; font-size: 12px;">${cleanActivationLink}</a>
    </p>
  `;

  const html = renderBrandedLayout({
    title: 'Staff Account Activation',
    subtitle: 'Administrator Provisioning',
    preheader,
    contentHtml,
  });

  return sendEmail({
    to,
    subject,
    html,
    text,
    correlationId,
    purpose: 'SECONDARY_ADMIN_WELCOME',
    targetUserId: adminUserId,
    metadata: { name, username, hostelName, orgName },
  });
};

/**
 * Send notification email to admin when a new student registration is completed
 */
const sendAdminNewStudentRegisteredNotification = async ({
  to,
  studentName,
  studentEmail,
  studentRoom,
  studentHostel,
  studentPhone,
  username,
  correlationId,
}) => {
  const safeName = escapeHtml(studentName);
  const safeHostel = escapeHtml(studentHostel);
  const safeRoom = escapeHtml(studentRoom || 'Not Assigned');
  const safeUsername = escapeHtml(username || 'N/A');
  const safeEmail = escapeHtml(studentEmail);
  const safePhone = escapeHtml(studentPhone || 'N/A');
  const frontendUrl = getTrustedFrontendUrl();

  const subject = `New Resident Registered: ${studentName} (${studentHostel} - Room ${studentRoom || 'N/A'})`;
  const preheader = `A new student has been registered: ${studentName} in room ${studentRoom || 'N/A'}.`;

  const text = `New Resident Registered Successfully

Details:
- Student Name: ${studentName}
- Hostel Branch: ${studentHostel}
- Room Number: ${studentRoom || 'Unassigned'}
- User ID: ${username}
- Email: ${studentEmail}
- Phone: ${studentPhone || 'N/A'}

View in Admin Panel:
${frontendUrl}/admin/students

Best regards,
Hosteliq Operations`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 14px; color: #334155;">
      A new resident student has been registered in the system.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 18px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 6px 0; font-size: 13px;"><strong>Student Name:</strong> ${safeName}</p>
      <p style="margin: 6px 0; font-size: 13px;"><strong>Hostel Branch:</strong> ${safeHostel}</p>
      <p style="margin: 6px 0; font-size: 13px;"><strong>Room Number:</strong> ${safeRoom}</p>
      <p style="margin: 6px 0; font-size: 13px;"><strong>User ID:</strong> ${safeUsername}</p>
      <p style="margin: 6px 0; font-size: 13px;"><strong>Email:</strong> ${safeEmail}</p>
      <p style="margin: 6px 0; font-size: 13px;"><strong>Phone:</strong> ${safePhone}</p>
    </div>

    <div style="margin: 20px 0;">
      <a href="${frontendUrl}/admin/students" style="display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
        View in Admin Panel
      </a>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'New Resident Registration',
    subtitle: 'Hostel Administration Alerts',
    preheader,
    contentHtml,
  });

  try {
    return await sendEmail({
      to,
      subject,
      html,
      text,
      correlationId,
      purpose: 'ADMIN_NEW_STUDENT_REGISTERED',
      metadata: { studentName, studentEmail, studentHostel, studentRoom, username },
    });
  } catch (err) {
    console.warn(`[email] Admin notification email skipped or failed: ${err.message}`);
    return null;
  }
};

/**
 * Send welcome & onboarding completion email to newly onboarded hostel admin
 */
const sendHostelOnboardingWelcomeEmail = async ({
  to,
  name,
  username,
  orgName,
  branchName,
  role = 'Organization Administrator',
  activationLink,
  setupUrl,
  loginLink,
  correlationId,
}) => {
  const subject = `Welcome to Hosteliq — Account Activation for ${orgName}`;
  const preheader = `Your hostel ${branchName} has been onboarded. Set your password to activate your account.`;
  const frontendUrl = getTrustedFrontendUrl();
  const effectiveActivationUrl = activationLink || setupUrl || `${frontendUrl}/reset-password`;
  const effectiveLoginUrl = loginLink || `${frontendUrl}/login?role=admin`;
  const supportEmail = getEffectiveSupportEmail();

  const text = `Welcome to Hosteliq!

Hello ${name},

Your hostel property "${branchName}" under "${orgName}" has been successfully onboarded and provisioned.

Hostel Administrator Account:
- Hostel Name: ${branchName}
- Organization: ${orgName}
- Assigned Role: ${role}
- Login Email: ${to}
${username ? `- Username: ${username}\n` : ''}
To establish your password and activate your account, open the following single-use activation link (valid for 7 days):
${effectiveActivationUrl}

Once activated, you can sign in to Hosteliq at:
${effectiveLoginUrl}

For security purposes, we never send permanent passwords via email. You will set your own secure password upon clicking the link.

If you have any questions or require assistance, please contact our support desk at ${supportEmail}.

Best regards,
Hosteliq Platform Operations Team`;

  const contentHtml = `
    <p style="font-size: 14px; line-height: 1.6; color: #334155;">Hello <strong>${escapeHtml(name)}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #475569;">
      Welcome to Hosteliq! Your hostel property <strong>${escapeHtml(branchName)}</strong> under <strong>${escapeHtml(orgName)}</strong> has been successfully provisioned.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
      <p style="margin: 4px 0; font-size: 13px;"><strong>Hostel Property:</strong> ${escapeHtml(branchName)}</p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Organization:</strong> ${escapeHtml(orgName)}</p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Assigned Role:</strong> ${escapeHtml(role)}</p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Admin Login Email:</strong> <span style="font-family: monospace; color: #0f172a;">${escapeHtml(to)}</span></p>
      ${username ? `<p style="margin: 4px 0; font-size: 13px;"><strong>Admin Username:</strong> <span style="font-family: monospace; color: #0f172a;">${escapeHtml(username)}</span></p>` : ''}
    </div>

    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 18px; margin: 18px 0;">
      <p style="margin: 0; font-size: 13px; color: #166534; line-height: 1.5;">
        🔒 <strong>Security Notice:</strong> For maximum account security, no permanent passwords are sent over email. Please use the secure button below to set your password and activate your account.
      </p>
    </div>

    <div style="margin: 26px 0; text-align: center;">
      <a href="${effectiveActivationUrl}" style="display: inline-block; padding: 13px 30px; background-color: #f59e0b; color: #000000; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 14px; letter-spacing: 0.2px;">
        Set Password &amp; Activate Account
      </a>
      <p style="font-size: 12px; color: #64748b; margin-top: 10px;">
        This single-use activation link is valid for 7 days.
      </p>
    </div>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6;">
      <p style="margin: 0 0 6px 0;"><strong>Signing in later:</strong> Once activated, access the Hosteliq admin portal at <a href="${effectiveLoginUrl}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(effectiveLoginUrl)}</a>.</p>
      <p style="margin: 0;"><strong>Need support?</strong> Reach our team anytime at <a href="mailto:${supportEmail}" style="color: #2563eb;">${escapeHtml(supportEmail)}</a>.</p>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'Welcome to Hosteliq',
    subtitle: 'Hostel Admin Onboarding',
    preheader,
    contentHtml,
  });

  return sendEmail({
    to,
    subject,
    html,
    text,
    correlationId,
    purpose: 'HOSTEL_ONBOARDING_WELCOME',
    metadata: { orgName, branchName, role },
  });
};

/**
 * Send Warden account invitation email addressed to the Hostel Admin.
 * The Hostel Admin can forward this email or the activation link to the Warden.
 */
const sendWardenInvitationToAdminEmail = async ({
  adminEmail,
  adminName,
  wardenName,
  wardenEmail,
  wardenUsername,
  wardenPhone,
  branchName,
  orgName,
  activationLink,
  loginLink,
  correlationId,
}) => {
  const subject = `Warden Account Invitation — Action Required for ${branchName}`;
  const preheader = `A Warden account for ${wardenName} has been provisioned. Please forward the activation link.`;
  const frontendUrl = getTrustedFrontendUrl();
  const effectiveActivationUrl = activationLink || `${frontendUrl}/reset-password`;
  const effectiveLoginUrl = loginLink || `${frontendUrl}/login?role=admin`;
  const supportEmail = getEffectiveSupportEmail();

  const text = `Hosteliq Warden Account Provisioned

Hello ${adminName},

A dedicated Warden account has been provisioned for your hostel "${branchName}" under "${orgName}".

Warden Account Details:
- Assigned Hostel: ${branchName}
- Warden Name: ${wardenName}
- Login Email: ${wardenEmail}
- Login Username: ${wardenUsername}
${wardenPhone ? `- Registered Phone: ${wardenPhone}\n` : ''}
Action Required from Hostel Administrator:
Please forward this email or provide the secure single-use activation link below to your Warden (${wardenName}).

Warden Secure Activation Link (Valid for 7 days):
${effectiveActivationUrl}

The Warden will use this link to establish their initial password and sign in to their branch dashboard at:
${effectiveLoginUrl}

Security Notice:
The Warden account is strictly restricted to operations for "${branchName}" and does not possess Organization Owner or Super Admin privileges.

If you have any questions or need to reassign this account, please contact support at ${supportEmail}.

Best regards,
Hosteliq Platform Operations Team`;

  const contentHtml = `
    <p style="font-size: 14px; line-height: 1.6; color: #334155;">Hello <strong>${escapeHtml(adminName)}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #475569;">
      A dedicated Warden account has been successfully provisioned for your hostel property <strong>${escapeHtml(branchName)}</strong> under <strong>${escapeHtml(orgName)}</strong>.
    </p>

    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
      <p style="margin: 4px 0; font-size: 13px;"><strong>Assigned Hostel:</strong> ${escapeHtml(branchName)}</p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Warden Name:</strong> ${escapeHtml(wardenName)}</p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Warden Login Email:</strong> <span style="font-family: monospace; color: #0f172a;">${escapeHtml(wardenEmail)}</span></p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Warden Username:</strong> <span style="font-family: monospace; color: #0f172a;">${escapeHtml(wardenUsername)}</span></p>
      ${wardenPhone ? `<p style="margin: 4px 0; font-size: 13px;"><strong>Warden Phone:</strong> ${escapeHtml(wardenPhone)}</p>` : ''}
      <p style="margin: 4px 0; font-size: 13px;"><strong>Role:</strong> <span style="display: inline-block; padding: 2px 8px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-weight: 600;">Warden</span></p>
    </div>

    <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #1e40af;">
        📋 Action Required from Hostel Administrator
      </p>
      <p style="margin: 0; font-size: 13px; color: #1e3a8a; line-height: 1.5;">
        Please forward this email or copy the single-use activation link below to your Warden (<strong>${escapeHtml(wardenName)}</strong>). They will need this link to set their password before they can sign in.
      </p>
    </div>

    <div style="margin: 26px 0; text-align: center;">
      <a href="${effectiveActivationUrl}" style="display: inline-block; padding: 13px 30px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 14px; letter-spacing: 0.2px;">
        Warden Activation Link
      </a>
      <p style="font-size: 12px; color: #64748b; margin-top: 10px;">
        Link expires in 7 days and is invalidated after first use.
      </p>
      <p style="font-size: 11px; color: #94a3b8; word-break: break-all; margin-top: 4px;">
        ${escapeHtml(effectiveActivationUrl)}
      </p>
    </div>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.6;">
      <p style="margin: 0 0 6px 0;"><strong>Signing in:</strong> Wardens sign in via the standard Hosteliq staff portal at <a href="${effectiveLoginUrl}" style="color: #2563eb; text-decoration: underline;">${escapeHtml(effectiveLoginUrl)}</a>.</p>
      <p style="margin: 0;"><strong>Data Isolation &amp; Security:</strong> The Warden is authorized strictly for branch <em>${escapeHtml(branchName)}</em> and cannot access foreign hostels or administrative settings.</p>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'Warden Account Invitation',
    subtitle: 'Hostel Staff Provisioning',
    preheader,
    contentHtml,
  });

  return sendEmail({
    to: adminEmail,
    subject,
    html,
    text,
    correlationId,
    purpose: 'WARDEN_ACCOUNT_INVITATION',
    metadata: { adminEmail, wardenName, wardenEmail, branchName, orgName },
  });
};

/**
 * Send student credentials email after registration (backward compatibility)
 */
const sendStudentCredentials = async ({ to, name, username, password, resetLink, correlationId }) => {
  return sendStudentWelcomeEmail({
    to,
    name,
    username,
    studentCode: username,
    activationLink: resetLink,
    correlationId,
  });
};

module.exports = {
  escapeHtml,
  maskEmail,
  isValidEmail,
  isRoutableEmail,
  getTransporter,
  getSmtpConfigStatus,
  verifySmtpConnection,
  getMailConfigStatus,
  verifyMailConnection,
  getResendStatus,
  sendViaResend,
  getSenderAddress,
  getEffectiveSupportEmail,
  getTrustedFrontendUrl,
  renderBrandedLayout,
  sendEmail,
  sendStudentAnnouncementEmail,
  sendStudentCredentials,
  sendStudentWelcomeEmail,
  sendFeeReminderEmail,
  sendMessRequestUpdate,
  sendPasswordResetEmail,
  sendAdminNewStudentRegisteredNotification,
  sendHostelOnboardingWelcomeEmail,
  sendWardenInvitationToAdminEmail,
  sendAdminActionOtpEmail,
  sendSecondaryAdminWelcomeEmail,
};

