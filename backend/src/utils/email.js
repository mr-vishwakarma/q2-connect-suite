const dns = require('dns');
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first');
}
const nodemailer = require('nodemailer');

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
let fallbackTransporter = null;
let lastConfigHash = '';

/**
 * Resolves sender address cleanly matching the SMTP authentication identity
 */
function getSenderAddress() {
  const configuredFrom = (process.env.EMAIL_FROM || '').trim();
  const smtpUser = (process.env.SMTP_USER || 'mayurvish2003@gmail.com').trim();

  if (configuredFrom && configuredFrom.includes('@') && !configuredFrom.includes('@q2connect.com')) {
    return configuredFrom;
  }
  return `Q2 GIRLS HOSTEL <${smtpUser}>`;
}

/**
 * Resolves the trusted frontend base URL, strictly preventing localhost links from being emailed to users
 */
function getTrustedFrontendUrl(req = null) {
  if (req?.headers?.origin) {
    const origin = req.headers.origin.trim();
    if (
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.lovable.app') ||
      origin.endsWith('.onrender.com') ||
      (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost'))
    ) {
      return origin;
    }
  }
  const configured = (process.env.FRONTEND_URL || '').trim();
  if (configured && !configured.includes('localhost')) {
    return configured;
  }
  return 'https://q2-connect-suite.vercel.app';
}

/**
 * Creates an instrumented Nodemailer transport instance
 */
function createTransportInstance({ host, port, secure, service, user, pass, pool = false }) {
  const options = {
    pool: false, // Transactional delivery must NEVER pool idle sockets on cloud containers (prevents Connection Timeout)
    auth: { user, pass },
    connectionTimeout: 10000, // 10s connection timeout for cloud containers
    greetingTimeout: 8000,
    socketTimeout: 15000,
    family: 4, // CRITICAL: Force IPv4 to prevent hanging on cloud container IPv6 blackholes
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
 * Get configured Nodemailer transporter with resilient cloud timeouts
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

  // When Gmail is detected, direct SSL connection to smtp.gmail.com:465 with family: 4
  // provides instantaneous, reliable TLS routing on cloud containers (Render/Docker)
  if (isGmail) {
    cachedTransporter = createTransportInstance({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      family: 4,
      user,
      pass,
      pool: false,
    });
  } else {
    const isSecure = port === 465;
    cachedTransporter = createTransportInstance({
      host,
      port,
      secure: isSecure,
      family: 4,
      user,
      pass,
      pool: false,
    });
  }

  lastConfigHash = configHash;
  return cachedTransporter;
};

/**
 * Get fallback transporter using dedicated clean non-pooled direct socket
 */
const getFallbackTransporter = () => {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const isGmail = host.includes('gmail.com') || process.env.SMTP_SERVICE === 'gmail' || user.endsWith('@gmail.com');

  if (isGmail) {
    // Non-pooled dedicated fresh socket on port 465 with IPv4
    return createTransportInstance({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      family: 4,
      user,
      pass,
      pool: false,
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
    pool: false,
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
 * Explicit SMTP connection verification with structured diagnostics and auto-failover
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
    console.warn(`[email] Primary SMTP verify (${config.host}:${config.port}) encountered error: ${primaryErr.message}. Testing resilient fallback transport...`);

    try {
      const fallback = getFallbackTransporter();
      await fallback.verify();
      cachedTransporter = fallback;
      console.log('[email] Resilient fallback SMTP connection verified successfully!');
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
    } else if (errCode === 'ETIMEDOUT' || errCode === 'ECONNREFUSED' || /timeout/i.test(primaryErr.message)) {
      status = 'TRANSPORT_CONNECTION_FAILED';
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
 * @param {object} options - { to, subject, html, text, correlationId, purpose, targetUserId, targetStudentId, metadata }
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
  metadata = {},
}) => {
  if (!isValidEmail(to)) {
    throw new Error(`Invalid recipient email address: '${to}'`);
  }

  const cleanTo = to.trim().toLowerCase();
  const maskedTo = maskEmail(cleanTo);
  const effectiveCid = correlationId || `email-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const logPrefix = `[email][${effectiveCid}]`;

  // Explicit mock bypass for automated unit tests only
  if (process.env.NODE_ENV === 'test' || process.env.MOCK_EMAIL === 'true') {
    console.log(`${logPrefix} 📧 [Simulated Email] Delivered to: ${maskedTo} (Subject: ${subject})`);
    return {
      success: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      simulated: true,
      status: 'EMAIL_ACCEPTED_BY_SMTP',
    };
  }

  // Intercept and safely suppress delivery to unroutable mock/placeholder domains to prevent SMTP bounce-backs
  if (!isRoutableEmail(cleanTo)) {
    console.warn(`${logPrefix} ⚠️ Outgoing email suppressed: recipient '${cleanTo}' is on a non-routable/mock domain (${cleanTo.split('@')[1]}). Skipping SMTP delivery to protect sender reputation.`);

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

  const config = getSmtpConfigStatus();
  if (!config.configured) {
    const errorMsg = 'SMTP configuration is missing. Cannot send transactional email.';
    console.error(`${logPrefix} ❌ ${errorMsg} Missing required variables.`);
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
    const replyTo = (process.env.SMTP_USER || '').trim() || from;

    const mailOptions = {
      from,
      to: cleanTo,
      replyTo,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      headers: {
        'X-Mailer': 'Q2 Connect Suite Mailer v2',
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'Auto-Submitted': 'auto-generated',
      },
    };

    let info = null;
    let lastSendErr = null;

    // Resilient send attempt with in-flight retry loop for transient connection dropouts
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const transporter = getTransporter();
        info = await transporter.sendMail(mailOptions);
        lastSendErr = null;
        break; // Successfully handed off to SMTP provider
      } catch (sendErr) {
        lastSendErr = sendErr;
        cachedTransporter = null; // Invalidate cached transporter on error to ensure clean socket on retry
        const errCode = sendErr.code || sendErr.responseCode || 'UNKNOWN';
        const isTransient = errCode === 'ETIMEDOUT' || errCode === 'ECONNREFUSED' || errCode === 'ECONNRESET' || /timeout|connect/i.test(sendErr.message);

        if (isTransient && attempt < 2) {
          console.warn(`${logPrefix} ⚠️ Primary SMTP attempt ${attempt} encountered transient error (${sendErr.message}). Retrying fresh TLS connection in 1200ms...`);
          await new Promise((resolve) => setTimeout(resolve, 1200));
        } else {
          break;
        }
      }
    }

    // If primary transport attempts failed with a connection issue, test the fallback transport
    if (!info && lastSendErr) {
      const errCode = lastSendErr.code || lastSendErr.responseCode || 'UNKNOWN';
      const isConnectionIssue = errCode === 'ETIMEDOUT' || errCode === 'ECONNREFUSED' || errCode === 'ECONNRESET' || /timeout|connect/i.test(lastSendErr.message);

      if (isConnectionIssue) {
        console.warn(`${logPrefix} ⚠️ Primary SMTP failed (${lastSendErr.message}). Retrying with resilient fallback transport...`);
        const fallback = getFallbackTransporter();
        info = await fallback.sendMail(mailOptions);
        console.log(`${logPrefix} ✅ Resilient fallback SMTP dispatch succeeded!`);
      } else {
        throw lastSendErr;
      }
    }

    console.log(`${logPrefix} 📧 Email accepted by SMTP provider for ${maskedTo} (MessageId: ${info.messageId})`);

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

    console.error(`${logPrefix} ❌ Email dispatch failed for ${maskedTo}: ${error.message} [Status: ${classifiedStatus}, Code: ${errCode}]`);

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
 * Standard layout wrapper for Q2 Connect Suite branded emails
 */
function renderBrandedLayout({ title, subtitle, contentHtml, footerNote }) {
  const currentYear = new Date().getFullYear();
  return `
    <div style="background-color: #0b132b; padding: 32px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; min-height: 100%;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #1c2541; border: 1px solid #3a506b; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
        <!-- Header -->
        <tr>
          <td style="padding: 28px 24px 20px 24px; text-align: center; border-bottom: 1px solid rgba(255,255,255,0.08); background: linear-gradient(180deg, #1e293b 0%, #1c2541 100%);">
            <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #f59e0b;">Q2 CONNECT SUITE</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1.5px; color: #94a3b8;">${escapeHtml(subtitle || 'Hostel Operations & Resident Management')}</p>
          </td>
        </tr>

        <!-- Main Body -->
        <tr>
          <td style="padding: 32px 28px;">
            ${title ? `<h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #ffffff;">${escapeHtml(title)}</h2>` : ''}
            ${contentHtml}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding: 20px 24px; background-color: #0b132b; border-top: 1px solid rgba(255,255,255,0.08); text-align: center;">
            ${footerNote ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; line-height: 1.4;">${footerNote}</p>` : ''}
            <p style="margin: 0; font-size: 12px; color: #64748b;">
              &copy; ${currentYear} Q2 Connect Suite. All rights reserved.<br/>
              Need assistance? Contact our team at <a href="mailto:support@q2connect.com" style="color: #38bdf8; text-decoration: none;">support@q2connect.com</a>
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;
}

/**
 * Send password reset email
 * @param {object} options - { to, name, resetLink, correlationId }
 */
const sendPasswordResetEmail = async ({ to, name = null, resetLink, correlationId }) => {
  const now = new Date();
  const timeFormatted = now.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const dateFormatted = now.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const subject = `Password Reset Request — Q2 Connect Suite [${timeFormatted}]`;
  const cleanLink = resetLink.trim();
  const safeName = name ? escapeHtml(name) : null;

  const text = `Password Reset Request — Q2 Connect Suite\n\n${name ? `Hello ${name},\n\n` : ''}We received a request to reset the password for your Q2 Connect Suite account on ${dateFormatted} at ${timeFormatted} (IST).\n\nOpen the link below in your browser to set a new password:\n${cleanLink}\n\nSecurity Notice:\n- This link was requested on ${dateFormatted} at ${timeFormatted} (IST) and is valid for 2 hours.\n- If you requested multiple links, please use this newest email (${timeFormatted}).\n- If you did not request this, please ignore this email or notify security immediately. Your account remains secure.\n\nBest regards,\nQ2 Connect Suite Security Team`;

  const contentHtml = `
    <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #cbd5e1;">
      ${safeName ? `Hello <strong>${safeName}</strong>,<br/><br/>` : ''}
      We received a request to reset the password for your Q2 Connect Suite account.
    </p>

    <div style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 8px; padding: 10px 16px; margin: 16px 0; text-align: center;">
      <p style="margin: 0; font-size: 13px; color: #93c5fd;">
        🕒 Requested at: <strong>${dateFormatted}, ${timeFormatted} (IST)</strong> &bull; Valid for 2 hours
      </p>
    </div>

    <div style="background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(99,102,241,0.1)); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
      <p style="margin: 0 0 16px 0; font-size: 14px; font-weight: 600; color: #ffffff;">Click the button below to choose your new password:</p>
      <a href="${cleanLink}" style="display: inline-block; background-color: #f59e0b; color: #000000; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 700; font-size: 15px; box-shadow: 0 4px 12px rgba(245,158,11,0.3);">
        Reset My Password
      </a>
      <p style="margin: 14px 0 0 0; font-size: 12px; color: #94a3b8;">
        ⏳ Valid for <strong>2 hours</strong> &bull; Single-use only
      </p>
    </div>

    <p style="margin: 20px 0 8px 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
      If the button above doesn't work, copy and paste this URL into your browser:<br/>
      <a href="${cleanLink}" style="color: #38bdf8; word-break: break-all; font-size: 12px;">${cleanLink}</a>
    </p>

    <div style="margin-top: 24px; padding: 14px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px;">
      <p style="margin: 0; font-size: 12px; color: #fca5a5; line-height: 1.5;">
        <strong>Security Notice:</strong> If you did not request this password reset, please ignore this email or contact support immediately. Your password has not been changed.
      </p>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'Password Reset Request',
    subtitle: 'Security & Access Control',
    contentHtml,
    footerNote: 'Tip: If this email arrived in your Spam folder, please mark it as "Not Spam" to receive future security updates.',
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
 * Send welcome & account setup invitation email to newly created Secondary Admin
 * @param {object} options - { to, name, username, hostelName, orgName, activationLink, loginLink, correlationId, adminUserId }
 */
const sendSecondaryAdminWelcomeEmail = async ({
  to,
  name,
  username,
  hostelName = 'Assigned Hostel',
  orgName = 'Q2 Connect Suite',
  activationLink,
  loginLink,
  correlationId,
  adminUserId = null,
}) => {
  const safeName = escapeHtml(name || 'Administrator');
  const safeUsername = escapeHtml(username || '');
  const safeHostel = escapeHtml(hostelName || 'Assigned Hostel');
  const safeOrg = escapeHtml(orgName || 'Q2 Connect Suite');
  const frontendUrl = (process.env.FRONTEND_URL || 'https://q2-connect-suite.vercel.app').trim();
  const cleanActivationLink = (activationLink || `${frontendUrl}/login`).trim();
  const cleanLoginLink = (loginLink || `${frontendUrl}/login?role=admin`).trim();

  const subject = `Welcome to Q2 Connect Suite — Activate Your Administrator Account (${hostelName})`;

  const text = `Welcome to Q2 Connect Suite!\n\nHello ${name},\n\nYou have been designated as a Secondary Administrator for "${hostelName}" under ${orgName}.\n\nYour Account Details:\n- Admin Name: ${name}\n- User ID: ${username}\n- Email: ${to}\n- Assigned Hostel: ${hostelName}\n\nFor security reasons, permanent passwords are never sent via email. Please activate your account and choose your secure password by opening the link below (valid for 48 hours):\n${cleanActivationLink}\n\nAfter setting your password, sign in at:\n${cleanLoginLink}\n\nBest regards,\nPrimary Administration & Security Operations — Q2 Connect Suite`;

  const contentHtml = `
    <h2 style="color: #ffffff; font-size: 19px; margin: 0 0 12px 0;">Welcome, ${safeName}! 👋</h2>
    <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 20px 0;">
      You have been appointed as an <strong>Administrator</strong> for <strong>${safeHostel}</strong> under <strong>${safeOrg}</strong>. Your staff account has been provisioned.
    </p>

    <div style="background-color: #0b132b; border: 1px solid #3a506b; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
      <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0; font-weight: 700;">Account Credentials</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Assigned Role:</td>
          <td style="color: #ffffff; font-weight: 600; text-align: right;">Secondary Admin</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Login User ID:</td>
          <td style="color: #ffffff; font-weight: 600; font-family: monospace; text-align: right;">${safeUsername}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Hostel Branch:</td>
          <td style="color: #ffffff; font-weight: 600; text-align: right;">${safeHostel}</td>
        </tr>
      </table>
    </div>

    <div style="background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(99,102,241,0.1)); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 22px; text-align: center; margin-bottom: 24px;">
      <p style="color: #ffffff; font-weight: 600; font-size: 15px; margin: 0 0 8px 0;">Set Your Private Password</p>
      <p style="color: #94a3b8; font-size: 13px; margin: 0 0 16px 0;">In accordance with Q2 Security Policies, we never send permanent passwords via email. Click below to choose your secure credentials.</p>
      <a href="${cleanActivationLink}" style="display: inline-block; background-color: #f59e0b; color: #000000; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(245,158,11,0.3);">
        Activate Account & Set Password
      </a>
      <p style="color: #94a3b8; font-size: 11px; margin: 12px 0 0 0;">This single-use activation link expires in <strong>48 hours</strong>.</p>
    </div>

    <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0 0 12px 0;">
      If the button above does not work, copy and paste this link into your browser:<br/>
      <a href="${cleanActivationLink}" style="color: #38bdf8; word-break: break-all; font-size: 12px;">${cleanActivationLink}</a>
    </p>

    <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 16px; margin-top: 20px;">
      <p style="color: #94a3b8; font-size: 13px; margin: 0;">
        Once activated, you can access your dashboard anytime at: <a href="${cleanLoginLink}" style="color: #f59e0b; text-decoration: underline;">Admin Portal Login</a>
      </p>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'Administrator Invitation',
    subtitle: 'Hostel Operations & Management Platform',
    contentHtml,
    footerNote: 'This email was generated automatically by authorized Primary Admin invitation.',
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
 * Send branded welcome & account activation email to student
 * @param {object} options - { to, name, studentName, username, studentCode, studentId, studentDocId, hostel, hostelName, activationLink, loginLink, correlationId }
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

  const subject = options.subject || `Your Hostel Admission Details & Account Activation — ${rawHostel} Hostel`;
  const cleanActivationLink = (activationLink || '').trim();
  const frontendUrl = (process.env.FRONTEND_URL || 'https://q2-connect-suite.vercel.app').trim();
  const cleanLoginLink = (loginLink || `${frontendUrl}/login?role=student`).trim();

  const text = `Welcome to Q2 Connect Suite!\n\nDear ${rawName},\n\nYour resident admission into ${rawHostel} Hostel has been confirmed.\n\nYour Account Details:\n- Resident Name: ${rawName}\n- Hostel: ${rawHostel}\n- User ID: ${rawUsername}\n- Student ID: ${rawStudentCode}\n\nPlease click the link below to activate your account and securely set your password (valid for 48 hours):\n${cleanActivationLink}\n\nOnce activated, you can sign in to the Student Portal at:\n${cleanLoginLink}\n\nIf you have any questions or need assistance, contact our administration at support@q2connect.com.\n\nBest regards,\n${rawHostel} Administration — Q2 Connect Suite`;

  const contentHtml = `
    <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 12px 0;">Welcome, ${safeName}! 👋</h2>
    <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
      Your resident admission into <strong style="color: #ffffff;">${safeHostel} Hostel</strong> has been officially confirmed by the administration. Your resident profile and room allocation are now set up.
    </p>

    <div style="background-color: #0b132b; border: 1px solid #3a506b; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
      <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 10px 0; font-weight: 700;">Resident Account Details</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Student Code:</td>
          <td style="color: #ffffff; font-weight: 600; font-family: monospace; text-align: right;">${safeStudentCode}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Login User ID:</td>
          <td style="color: #ffffff; font-weight: 600; font-family: monospace; text-align: right;">${safeUsername}</td>
        </tr>
        <tr>
          <td style="color: #94a3b8; padding: 6px 0;">Branch / Hostel:</td>
          <td style="color: #ffffff; font-weight: 600; text-align: right;">${safeHostel}</td>
        </tr>
      </table>
    </div>

    <div style="background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(99,102,241,0.1)); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
      <p style="color: #ffffff; font-weight: 600; font-size: 15px; margin: 0 0 8px 0;">Step 1: Set Your Secure Password</p>
      <p style="color: #94a3b8; font-size: 13px; margin: 0 0 16px 0;">For your security, we do not send passwords via email. Click below to choose your private permanent password.</p>
      <a href="${cleanActivationLink}" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(239,68,68,0.3);">
        Activate Account & Set Password
      </a>
      <p style="color: #94a3b8; font-size: 11px; margin: 12px 0 0 0;">This single-use activation link expires in <strong>48 hours</strong>.</p>
    </div>

    <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0 0 12px 0;">
      If the button above does not work, copy and paste this link into your browser:<br/>
      <a href="${cleanActivationLink}" style="color: #38bdf8; word-break: break-all; font-size: 12px;">${cleanActivationLink}</a>
    </p>

    <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 18px; margin-top: 24px;">
      <p style="color: #94a3b8; font-size: 13px; margin: 0 0 6px 0;">
        <strong>Step 2: Sign In</strong><br/>
        After setting your password, sign in at the <a href="${cleanLoginLink}" style="color: #ef4444; text-decoration: underline;">Student Portal</a>.
      </p>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'Resident Admission Confirmed',
    subtitle: 'Smart Resident Onboarding',
    contentHtml,
    footerNote: 'Welcome to your new home! Please save this email for your records.',
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
 * Send email OTP to Primary Admin for privileged actions (Create/Delete Secondary Admin)
 * @param {object} options - { to, adminName, action, otp, expiresInMinutes, correlationId }
 */
const sendAdminActionOtpEmail = async ({ to, adminName = 'Administrator', action, otp, expiresInMinutes = 5, correlationId }) => {
  const actionLabel =
    action === 'CREATE_SECONDARY_ADMIN'
      ? 'Create New Secondary Admin'
      : action === 'DELETE_SECONDARY_ADMIN' || action === 'DEACTIVATE_SECONDARY_ADMIN'
      ? 'Deactivate Secondary Admin Account'
      : 'Privileged Admin Management Action';

  const safeAdminName = escapeHtml(adminName);
  const safeAction = escapeHtml(actionLabel);
  const subject = `[Security] Your Verification Code: ${otp} (${actionLabel})`;

  const text = `Q2 Connect Suite Security Verification\n\nHello ${adminName},\n\nYou have requested to perform the following sensitive administrative action:\n${actionLabel}\n\nYour One-Time Verification Code is:\n${otp}\n\nThis verification code expires in ${expiresInMinutes} minutes and is strictly single-use.\n\nSECURITY NOTICE:\nNever share this code with anyone. If you did not initiate this request, someone may be attempting to alter administrator privileges for your hostel. Please contact security immediately.\n\nBest regards,\nQ2 Connect Suite Security Operations`;

  const contentHtml = `
    <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 12px 0;">Privileged Action Verification Required 🛡️</h2>
    <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
      Hello <strong>${safeAdminName}</strong>,<br/>
      A request has been initiated by your Primary Admin account for:
    </p>

    <div style="background-color: #0b132b; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 12px 16px; margin-bottom: 20px;">
      <p style="color: #ffffff; font-size: 14px; margin: 0; font-weight: 600;">Action: ${safeAction}</p>
    </div>

    <div style="text-align: center; background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(99,102,241,0.1)); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; padding: 24px; margin-bottom: 24px;">
      <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; font-weight: 700;">One-Time Verification Code</p>
      <div style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #f59e0b; font-family: monospace; margin: 8px 0;">
        ${otp}
      </div>
      <p style="color: #94a3b8; font-size: 12px; margin: 8px 0 0 0;">Valid for <strong>${expiresInMinutes} minutes</strong> (Single-use)</p>
    </div>

    <div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; padding: 14px;">
      <p style="color: #fca5a5; font-size: 12px; line-height: 1.5; margin: 0;">
        <strong>Security Warning:</strong> Never share this code with anyone. Q2 support personnel will never ask for your verification code. If you did not initiate this request, change your password immediately.
      </p>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'Verification Code',
    subtitle: 'Security & Privilege Authorization',
    contentHtml,
    footerNote: 'Automated high-security verification notification.',
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
 * Send notification email to admin when a new student registration is completed
 */
const sendAdminNewStudentRegisteredNotification = async ({ to, studentName, studentEmail, studentRoom, studentHostel, studentPhone, username, correlationId }) => {
  const safeName = escapeHtml(studentName);
  const safeHostel = escapeHtml(studentHostel);
  const safeRoom = escapeHtml(studentRoom || 'Not Assigned');
  const safeUsername = escapeHtml(username || 'N/A');
  const safeEmail = escapeHtml(studentEmail);
  const safePhone = escapeHtml(studentPhone || 'N/A');
  const frontendUrl = (process.env.FRONTEND_URL || 'https://q2-connect-suite.vercel.app').trim();

  const subject = `New Student Registered: ${studentName} (${studentHostel} - Room ${studentRoom || 'N/A'})`;
  const text = `New Student Registered Successfully!\n\nDetails:\n- Student Name: ${studentName}\n- Hostel: ${studentHostel}\n- Room No: ${studentRoom || 'Unassigned'}\n- User ID: ${username}\n- Email: ${studentEmail}\n- Phone: ${studentPhone || 'N/A'}\n\nLog in to Admin Panel: ${frontendUrl}/admin/students\n\nBest regards,\nQ2 Connect Suite`;

  const contentHtml = `
    <h2 style="color: #ffffff; font-size: 18px; margin: 0 0 12px 0;">New Resident Registration Confirmed</h2>
    <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 16px 0;">A new resident student has been officially registered in the system.</p>

    <div style="background-color: #0b132b; border: 1px solid #3a506b; padding: 18px; border-radius: 8px; margin: 16px 0;">
      <p style="margin: 6px 0; font-size: 13px;"><strong>Student Name:</strong> ${safeName}</p>
      <p style="margin: 6px 0; font-size: 13px;"><strong>Hostel Branch:</strong> ${safeHostel}</p>
      <p style="margin: 6px 0; font-size: 13px;"><strong>Room Number:</strong> ${safeRoom}</p>
      <p style="margin: 6px 0; font-size: 13px;"><strong>User ID:</strong> ${safeUsername}</p>
      <p style="margin: 6px 0; font-size: 13px;"><strong>Email:</strong> ${safeEmail}</p>
      <p style="margin: 6px 0; font-size: 13px;"><strong>Phone:</strong> ${safePhone}</p>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${frontendUrl}/admin/students" style="display: inline-block; padding: 12px 24px; background-color: #f59e0b; color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
        View in Admin Panel
      </a>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'New Resident Registration',
    subtitle: 'Hostel Administration Alerts',
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
  orgName,
  branchName,
  role = 'Organization Administrator',
  setupUrl,
  tempPassword,
  correlationId,
}) => {
  const subject = `Welcome to Q2 Connect Suite — Onboarding Complete for ${orgName}`;
  const frontendUrl = (process.env.FRONTEND_URL || 'https://q2-connect-suite.vercel.app').trim();
  const activationUrl = setupUrl || `${frontendUrl}/login`;

  const text = `Welcome to Q2 Connect Suite!\n\nHello ${name},\n\nYour organization "${orgName}" (${branchName}) has been successfully onboarded.\n\nYour Administrator Account:\nEmail: ${to}\nTemporary Password: ${tempPassword || 'Set via activation link'}\n\nAccess your dashboard:\n${activationUrl}\n\nBest regards,\nQ2 Connect Suite Platform Operations Team`;

  const contentHtml = `
    <h2 style="color: #ffffff; font-size: 18px; margin-bottom: 12px;">Organization Onboarding Complete 🎉</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">Hello <strong>${escapeHtml(name)}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1;">
      Welcome to Q2 Connect Suite! Your organization <strong>${escapeHtml(orgName)}</strong> and primary branch <strong>${escapeHtml(branchName)}</strong> have been configured and provisioned.
    </p>

    <div style="background-color: #0b132b; border: 1px solid #3a506b; border-radius: 8px; padding: 18px; margin: 20px 0;">
      <p style="margin: 4px 0; font-size: 13px;"><strong>Organization:</strong> ${escapeHtml(orgName)}</p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Initial Branch:</strong> ${escapeHtml(branchName)}</p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Assigned Role:</strong> ${escapeHtml(role)}</p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Login Email:</strong> ${escapeHtml(to)}</p>
      ${tempPassword ? `<p style="margin: 4px 0; font-size: 13px;"><strong>Temporary Password:</strong> <code style="background: #1e293b; padding: 2px 6px; border-radius: 4px;">${escapeHtml(tempPassword)}</code></p>` : ''}
    </div>

    <div style="text-align: center; margin: 28px 0;">
      <a href="${activationUrl}" style="display: inline-block; padding: 12px 28px; background-color: #f59e0b; color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
        Access Your Admin Dashboard
      </a>
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'Onboarding Complete',
    subtitle: 'Platform Operations',
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
 * Send mess request status update email
 */
const sendMessRequestUpdate = async ({ to, name, status, leavingDate, returnDate, adminMessage, correlationId }) => {
  const statusColor = status === 'approved' ? '#22c55e' : '#ef4444';
  const subject = `Mess Off Request ${status.charAt(0).toUpperCase() + status.slice(1)}`;
  const text = `Mess Off Request Update\n\nHello ${name},\nYour mess off request has been ${status}.\nLeaving Date: ${leavingDate}\nReturn Date: ${returnDate}\n${adminMessage ? `Admin Note: ${adminMessage}\n` : ''}\nBest regards,\nQ2 Connect Suite`;

  const contentHtml = `
    <h2 style="color: #ffffff; font-size: 18px;">Mess Off Request Update</h2>
    <p style="color: #cbd5e1;">Hello <strong>${escapeHtml(name)}</strong>,</p>
    <p style="color: #cbd5e1;">Your mess off request has been <strong style="color: ${statusColor}; text-transform: uppercase;">${escapeHtml(status)}</strong>.</p>
    <div style="background-color: #0b132b; border: 1px solid #3a506b; padding: 18px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>Leaving Date:</strong> ${escapeHtml(leavingDate)}</p>
      <p style="margin: 4px 0;"><strong>Return Date:</strong> ${escapeHtml(returnDate)}</p>
      ${adminMessage ? `<p style="margin: 4px 0;"><strong>Admin Note:</strong> ${escapeHtml(adminMessage)}</p>` : ''}
    </div>
  `;

  const html = renderBrandedLayout({
    title: 'Mess Request Status',
    subtitle: 'Dining & Kitchen Operations',
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
  getTransporter,
  getSmtpConfigStatus,
  verifySmtpConnection,
  getSenderAddress,
  isRoutableEmail,
  sendEmail,
  sendStudentCredentials,
  sendStudentWelcomeEmail,
  sendMessRequestUpdate,
  sendPasswordResetEmail,
  sendAdminNewStudentRegisteredNotification,
  sendHostelOnboardingWelcomeEmail,
  sendAdminActionOtpEmail,
  sendSecondaryAdminWelcomeEmail,
  getTrustedFrontendUrl,
};
