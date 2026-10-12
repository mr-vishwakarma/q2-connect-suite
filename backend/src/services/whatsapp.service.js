/**
 * WhatsApp Notification Service (MSG91 Provider Abstraction)
 *
 * Implements:
 * - Parent notification on leave approval
 * - Idempotency & deduplication
 * - Guardian contact validation
 * - Graceful unconfigured provider fallback
 * - Bounded backoff retry
 */

const MessRequest = require('../models/MessRequest');

function isWhatsAppConfigured() {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_WHATSAPP_TEMPLATE_ID;
  return Boolean(authKey && authKey.trim() && templateId && templateId.trim());
}

/**
 * Format and validate parent phone number
 * @param {string} phone
 * @returns {string|null}
 */
function cleanPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return null;
  // If 10 digits, prepend standard India country code 91
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Sends Leave Approval notification to parent/guardian
 */
async function sendLeaveApprovalParentNotification({
  leaveRequestId,
  studentName,
  hostelName = 'Q2 Hostel',
  startDate,
  endDate,
  approverName = 'Hostel Administration',
  parentPhone,
}) {
  if (!leaveRequestId) {
    throw new Error('leaveRequestId is required for leave approval notification');
  }

  // 1. Check idempotency: Fetch current request status
  const existingReq = await MessRequest.findById(leaveRequestId);
  if (!existingReq) {
    return { success: false, status: 'NOT_FOUND', message: 'Leave request not found' };
  }

  if (existingReq.parentNotificationStatus === 'SENT') {
    return {
      success: true,
      status: 'SENT',
      duplicate: true,
      message: 'Notification was already sent for this approval event.',
    };
  }

  // 2. Validate guardian phone
  const cleanedPhone = cleanPhoneNumber(parentPhone);
  if (!cleanedPhone) {
    await MessRequest.findByIdAndUpdate(leaveRequestId, {
      parentNotificationStatus: 'SKIPPED_NO_PHONE',
      parentNotificationError: 'No verified parent/guardian phone number provided in student profile.',
    });
    return {
      success: false,
      status: 'SKIPPED_NO_PHONE',
      message: 'Parent WhatsApp notification skipped: Guardian contact number is not registered.',
    };
  }

  // 3. Check provider configuration
  if (!isWhatsAppConfigured()) {
    console.warn(`[WhatsApp Service] MSG91 WhatsApp not configured. Notification for leave request ${leaveRequestId} marked as NOT_CONFIGURED.`);
    await MessRequest.findByIdAndUpdate(leaveRequestId, {
      parentNotificationStatus: 'NOT_CONFIGURED',
      parentNotificationError: 'MSG91_AUTH_KEY or MSG91_WHATSAPP_TEMPLATE_ID not configured in server environment.',
    });
    return {
      success: false,
      status: 'NOT_CONFIGURED',
      message: 'WhatsApp provider is not configured. Delivery blocked by missing provider credentials.',
    };
  }

  // 4. Configured Provider Execution with Bounded Retry
  const maxRetries = 3;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // MSG91 WhatsApp Outbound API call
      const authKey = process.env.MSG91_AUTH_KEY;
      const integratedNumber = process.env.MSG91_WHATSAPP_INTEGRATED_NUMBER;
      const templateId = process.env.MSG91_WHATSAPP_TEMPLATE_ID;

      const payload = {
        integrated_number: integratedNumber,
        content_type: 'template',
        payload: {
          to: cleanedPhone,
          type: 'template',
          template: {
            name: templateId,
            language: { code: 'en', policy: 'deterministic' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: studentName || 'Student' },
                  { type: 'text', text: String(startDate) },
                  { type: 'text', text: String(endDate) },
                  { type: 'text', text: approverName || 'Administration' },
                  { type: 'text', text: hostelName },
                ],
              },
            ],
          },
        },
      };

      const response = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authkey: authKey,
        },
        body: JSON.stringify(payload),
      });

      const resData = await response.json().catch(() => ({}));

      if (!response.ok || resData.type === 'error') {
        throw new Error(resData.message || `MSG91 HTTP ${response.status}`);
      }

      // Success
      await MessRequest.findByIdAndUpdate(leaveRequestId, {
        parentNotificationStatus: 'SENT',
        parentNotificationSentAt: new Date(),
        parentNotificationError: null,
      });

      return {
        success: true,
        status: 'SENT',
        providerResponse: resData,
      };
    } catch (err) {
      lastError = err;
      console.warn(`[WhatsApp Service] Attempt ${attempt}/${maxRetries} failed: ${err.message}`);
      if (attempt < maxRetries) {
        // Exponential backoff delay (1s, 2s)
        await new Promise((res) => setTimeout(res, attempt * 1000));
      }
    }
  }

  // All retries failed
  await MessRequest.findByIdAndUpdate(leaveRequestId, {
    parentNotificationStatus: 'FAILED',
    parentNotificationError: lastError?.message || 'Failed after 3 retries',
  });

  return {
    success: false,
    status: 'FAILED',
    message: lastError?.message || 'Notification delivery failed',
  };
}

/**
 * Queue asynchronous notification job
 */
function queueLeaveApprovalNotification(payload) {
  // Mark request as QUEUED first
  MessRequest.findByIdAndUpdate(payload.leaveRequestId, {
    parentNotificationStatus: 'QUEUED',
  }).catch((err) => console.warn('[WhatsApp] Failed to mark QUEUED status:', err.message));

  // Process asynchronously without blocking main thread
  setImmediate(async () => {
    try {
      await sendLeaveApprovalParentNotification(payload);
    } catch (err) {
      console.error('[WhatsApp Service] Async notification error:', err);
    }
  });
}

module.exports = {
  isWhatsAppConfigured,
  cleanPhoneNumber,
  sendLeaveApprovalParentNotification,
  queueLeaveApprovalNotification,
};
