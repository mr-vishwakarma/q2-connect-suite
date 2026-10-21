const crypto = require('crypto');
const EmailLog = require('../models/EmailLog');
const EmailSuppression = require('../models/EmailSuppression');
const Student = require('../models/Student');

/**
 * Verifies Svix signature from Resend Webhooks.
 * Resend signs webhooks using Svix with headers:
 * - svix-id
 * - svix-timestamp
 * - svix-signature
 */
function verifySvixSignature({ rawBody, svixId, svixTimestamp, svixSignature, secret }) {
  if (!secret) return false;
  if (!svixId || !svixTimestamp || !svixSignature) return false;

  // Prevent replay attacks (verify timestamp within 5 minutes)
  const timestampSec = parseInt(svixTimestamp, 10);
  const currentSec = Math.floor(Date.now() / 1000);
  if (isNaN(timestampSec) || Math.abs(currentSec - timestampSec) > 300) {
    return false;
  }

  try {
    const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    const secretBuffer = Buffer.from(cleanSecret, 'base64');
    const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', secretBuffer)
      .update(toSign)
      .digest('base64');

    // svix-signature header format: "v1,signature1 v1,signature2"
    const signatures = svixSignature.split(' ').map((sig) => {
      const parts = sig.split(',');
      return parts.length === 2 ? parts[1] : sig;
    });

    return signatures.some((sig) => {
      try {
        const sigBuffer = Buffer.from(sig, 'base64');
        const expectedBuffer = Buffer.from(expectedSignature, 'base64');
        return sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);
      } catch (e) {
        return false;
      }
    });
  } catch (err) {
    return false;
  }
}

/**
 * Handles incoming webhook events from Resend (delivery, bounce, complaint, open, click)
 * Route: POST /api/webhooks/resend
 */
const handleResendWebhook = async (req, res) => {
  const svixId = req.headers['svix-id'];
  const svixTimestamp = req.headers['svix-timestamp'];
  const svixSignature = req.headers['svix-signature'];
  const webhookSecret = (process.env.RESEND_WEBHOOK_SECRET || process.env.RESEND_SIGNING_SECRET || '').trim();

  const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

  // If a secret is configured, enforce strict cryptographic signature verification
  if (webhookSecret) {
    const isValid = verifySvixSignature({
      rawBody,
      svixId,
      svixTimestamp,
      svixSignature,
      secret: webhookSecret,
    });

    if (!isValid) {
      console.warn('[Resend:Webhook] ⚠️ Webhook signature verification failed');
      return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('[Resend:Webhook] ⚠️ Warning: RESEND_WEBHOOK_SECRET is not configured on production');
  }

  const payload = req.body || {};
  const eventType = payload.type;
  const eventData = payload.data || {};
  const emailId = eventData.email_id || eventData.id;
  const recipients = Array.isArray(eventData.to) ? eventData.to : (eventData.to ? [eventData.to] : []);
  const primaryRecipient = recipients[0] ? String(recipients[0]).trim().toLowerCase() : null;

  if (!eventType) {
    return res.status(400).json({ success: false, message: 'Missing event type' });
  }

  console.log(`[Resend:Webhook] 📨 Received event: ${eventType} for message: ${emailId || 'unknown'}`);

  try {
    switch (eventType) {
      case 'email.delivered': {
        if (emailId) {
          await EmailLog.updateMany(
            { resendMessageId: emailId },
            {
              $set: {
                status: 'DELIVERED',
                deliveredAt: new Date(payload.created_at || Date.now()),
                webhookEventId: svixId,
              },
            }
          );
        }
        break;
      }

      case 'email.bounced': {
        const bounceInfo = eventData.bounce || {};
        const bounceReason = bounceInfo.message || bounceInfo.type || 'Permanent bounce reported by destination MX';

        if (emailId) {
          await EmailLog.updateMany(
            { resendMessageId: emailId },
            {
              $set: {
                status: 'BOUNCED',
                bouncedAt: new Date(payload.created_at || Date.now()),
                bounceReason,
                webhookEventId: svixId,
              },
            }
          );
        }

        // Add recipient to permanent suppression list
        if (primaryRecipient) {
          await EmailSuppression.findOneAndUpdate(
            { email: primaryRecipient },
            {
              $set: {
                reason: 'HARD_BOUNCE',
                provider: 'resend',
                resendMessageId: emailId,
                details: bounceInfo,
                suppressedAt: new Date(),
              },
            },
            { upsert: true }
          );

          // Update student status if applicable
          await Student.updateMany(
            { email: primaryRecipient },
            {
              $set: {
                welcomeEmailStatus: 'failed',
                welcomeEmailError: `Bounced: ${bounceReason}`,
              },
            }
          );
          console.warn(`[Resend:Webhook] 🛑 Recipient ${primaryRecipient} suppressed due to hard bounce: ${bounceReason}`);
        }
        break;
      }

      case 'email.complained': {
        if (emailId) {
          await EmailLog.updateMany(
            { resendMessageId: emailId },
            {
              $set: {
                status: 'COMPLAINED',
                complainedAt: new Date(payload.created_at || Date.now()),
                complaintFeedbackType: eventData.complaint?.type || 'Spam Complaint',
                webhookEventId: svixId,
              },
            }
          );
        }

        // Add recipient to permanent suppression list
        if (primaryRecipient) {
          await EmailSuppression.findOneAndUpdate(
            { email: primaryRecipient },
            {
              $set: {
                reason: 'SPAM_COMPLAINT',
                provider: 'resend',
                resendMessageId: emailId,
                details: eventData.complaint || {},
                suppressedAt: new Date(),
              },
            },
            { upsert: true }
          );
          console.warn(`[Resend:Webhook] 🛑 Recipient ${primaryRecipient} suppressed due to spam complaint.`);
        }
        break;
      }

      case 'email.opened': {
        if (emailId) {
          await EmailLog.updateMany(
            { resendMessageId: emailId, status: { $ne: 'CLICKED' } },
            { $set: { status: 'OPENED' } }
          );
        }
        break;
      }

      case 'email.clicked': {
        if (emailId) {
          await EmailLog.updateMany(
            { resendMessageId: emailId },
            { $set: { status: 'CLICKED' } }
          );
        }
        break;
      }

      default:
        // Ignore unhandled events gracefully
        break;
    }

    return res.status(200).json({ success: true, processed: true, event: eventType });
  } catch (err) {
    console.error(`[Resend:Webhook] ❌ Error processing webhook: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = {
  handleResendWebhook,
  verifySvixSignature,
};
