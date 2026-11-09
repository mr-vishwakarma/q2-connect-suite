const Enquiry = require('../models/Enquiry');
const { sendEmail, escapeHtml } = require('../utils/email');

/**
 * Validates whether string is non-empty and within bounds
 */
const isValidText = (str, min = 1, max = 255) => {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  return trimmed.length >= min && trimmed.length <= max;
};

/**
 * Validates email format strictly
 */
const isValidEmailFormat = (email) => {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
};

/**
 * Validates phone / contact number format
 */
const isValidPhoneFormat = (phone) => {
  if (typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  return /^\+?[0-9]{7,15}$/.test(cleaned);
};

const ALLOWED_HOSTEL_TYPES = ['Boys Hostel', 'Girls Hostel', 'Co-living', 'Other'];
const ALLOWED_BED_CAPACITIES = ['Under 50', '50–100', '101–250', '251–500', 'Above 500'];

/**
 * POST /api/enquiries (or /api/connect)
 * Public endpoint for new hostel owners and prospective partners to submit an enquiry
 */
const submitEnquiry = async (req, res) => {
  try {
    const {
      fullName,
      workEmail,
      contactNumber,
      hostelName,
      city,
      state,
      hostelType,
      approxBeds,
      message,
      hp_website, // Honeypot trap field
    } = req.body;

    // 1. Honeypot check: If bot filled the hidden honeypot field, silently return success without persisting
    if (hp_website && typeof hp_website === 'string' && hp_website.trim().length > 0) {
      console.warn(`[enquiry][bot-trap] Honeypot field triggered from IP: ${req.ip || 'unknown'}`);
      return res.status(200).json({
        success: true,
        message: 'Your enquiry has been received successfully. Our team will get in touch using the contact details you provided.',
        data: {
          enquiryId: `ENQ-${Date.now()}-BOT`,
        },
      });
    }

    // 2. Server-side validation
    const errors = {};

    if (!isValidText(fullName, 2, 100)) {
      errors.fullName = 'Full name is required (2 to 100 characters)';
    }

    if (!isValidEmailFormat(workEmail)) {
      errors.workEmail = 'A valid work email address is required';
    }

    if (!isValidPhoneFormat(contactNumber)) {
      errors.contactNumber = 'A valid contact number is required (7 to 15 digits)';
    }

    if (!isValidText(hostelName, 2, 150)) {
      errors.hostelName = 'Hostel or organization name is required (2 to 150 characters)';
    }

    if (!isValidText(city, 2, 100)) {
      errors.city = 'City is required';
    }

    if (!isValidText(state, 2, 100)) {
      errors.state = 'State is required';
    }

    if (!ALLOWED_HOSTEL_TYPES.includes(hostelType)) {
      errors.hostelType = `Please select a valid hostel type (${ALLOWED_HOSTEL_TYPES.join(', ')})`;
    }

    if (!ALLOWED_BED_CAPACITIES.includes(approxBeds)) {
      errors.approxBeds = `Please select an approximate bed capacity range`;
    }

    if (message && typeof message === 'string' && message.trim().length > 2000) {
      errors.message = 'Additional message cannot exceed 2000 characters';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed. Please correct the highlighted errors.',
        errors,
      });
    }

    // 3. Generate structured unique Enquiry ID
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const enquiryId = `ENQ-${Date.now().toString().slice(-6)}-${randomSuffix}`;

    // 4. Extract client metadata safely
    const ipAddress = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '')
      .toString()
      .split(',')[0]
      .trim();
    const userAgent = (req.headers['user-agent'] || '').substring(0, 300);

    // 5. Persist the enquiry to MongoDB
    const newEnquiry = await Enquiry.create({
      enquiryId,
      fullName: fullName.trim(),
      workEmail: workEmail.trim().toLowerCase(),
      contactNumber: contactNumber.trim(),
      hostelName: hostelName.trim(),
      city: city.trim(),
      state: state.trim(),
      hostelType,
      approxBeds,
      message: message ? message.trim() : '',
      status: 'new',
      source: 'website_connect_form',
      ipAddress,
      userAgent,
    });

    console.log(`[enquiry] Successfully recorded enquiry ${enquiryId} for "${newEnquiry.hostelName}" by ${newEnquiry.fullName}`);

    // 6. Asynchronous Notification Email Dispatch (Non-blocking: persistence is already guaranteed)
    const correlationId = `enq-email-${enquiryId}`;

    // A. Internal notification to Hosteliq operations team
    const internalNotificationEmail = (
      process.env.ENQUIRY_NOTIFICATION_EMAIL ||
      process.env.SUPPORT_EMAIL ||
      'support@mrvishwakarma.in'
    ).trim();

    const internalHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <div style="margin-bottom: 20px; border-bottom: 2px solid #f1f5f9; padding-bottom: 16px;">
          <h2 style="margin: 0; color: #0f172a; font-size: 20px;">🛎️ New Hostel IQ Demo & Partnership Enquiry</h2>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">Reference: <strong style="color: #0f172a;">${escapeHtml(enquiryId)}</strong></p>
        </div>

        <div style="background-color: #f8fafc; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 6px 0; color: #64748b; width: 140px;">Contact Name:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${escapeHtml(newEnquiry.fullName)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Work Email:</td>
              <td style="padding: 6px 0; color: #0284c7; font-weight: 600;"><a href="mailto:${escapeHtml(newEnquiry.workEmail)}">${escapeHtml(newEnquiry.workEmail)}</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Contact Number:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;"><a href="tel:${escapeHtml(newEnquiry.contactNumber)}">${escapeHtml(newEnquiry.contactNumber)}</a></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Hostel / Org:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${escapeHtml(newEnquiry.hostelName)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Location:</td>
              <td style="padding: 6px 0; color: #0f172a;">${escapeHtml(newEnquiry.city)}, ${escapeHtml(newEnquiry.state)}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Hostel Type:</td>
              <td style="padding: 6px 0; color: #0f172a;"><span style="display:inline-block; padding: 2px 8px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-size: 12px; font-weight: 600;">${escapeHtml(newEnquiry.hostelType)}</span></td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #64748b;">Bed Capacity:</td>
              <td style="padding: 6px 0; color: #0f172a; font-weight: 600;">${escapeHtml(newEnquiry.approxBeds)}</td>
            </tr>
          </table>
        </div>

        ${newEnquiry.message ? `
          <div style="margin-bottom: 20px;">
            <p style="margin: 0 0 6px; font-size: 13px; font-weight: 600; color: #475569;">Requirements / Notes:</p>
            <div style="padding: 12px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; color: #334155; line-height: 1.5; white-space: pre-wrap;">
              ${escapeHtml(newEnquiry.message)}
            </div>
          </div>
        ` : ''}

        <div style="font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 14px;">
          Submitted via Hosteliq Connect With Us form on ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.
        </div>
      </div>
    `;

    // B. Visitor acknowledgement email
    const visitorHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0;">
        <h2 style="margin: 0 0 12px; color: #0f172a; font-size: 22px;">Thank you for connecting with Hostel IQ</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #475569;">
          Hello <strong>${escapeHtml(newEnquiry.fullName)}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #475569;">
          We have received your enquiry for <strong>${escapeHtml(newEnquiry.hostelName)}</strong> (Reference ID: <strong style="color: #0f172a;">${escapeHtml(enquiryId)}</strong>).
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #475569;">
          Our solution specialist will review your property's requirements and reach out to you directly at <strong>${escapeHtml(newEnquiry.contactNumber)}</strong> or <strong>${escapeHtml(newEnquiry.workEmail)}</strong> to schedule a live walkthrough and explore how Hostel IQ can streamline your property operations.
        </p>
        <div style="background-color: #f8fafc; border-left: 4px solid #ff4d5a; border-radius: 4px; padding: 14px; margin: 20px 0;">
          <p style="margin: 0; font-size: 13px; color: #334155; line-height: 1.5;">
            <strong>Need immediate assistance?</strong> You can reply directly to this email or contact our support desk at <a href="mailto:${escapeHtml(internalNotificationEmail)}" style="color: #ff4d5a; text-decoration: none;">${escapeHtml(internalNotificationEmail)}</a>.
          </p>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
          Best regards,<br />
          <strong>Hostel IQ Enterprise Team</strong><br />
          <span style="font-size: 12px; color: #94a3b8;">A Smarter Way to Manage Your Hostel</span>
        </p>
      </div>
    `;

    // Non-blocking email dispatch
    Promise.allSettled([
      sendEmail({
        to: internalNotificationEmail,
        subject: `[Hostel IQ] New Enquiry: ${newEnquiry.hostelName} - ${newEnquiry.fullName}`,
        html: internalHtml,
        text: `New Enquiry from ${newEnquiry.fullName} (${newEnquiry.workEmail}, ${newEnquiry.contactNumber}) for ${newEnquiry.hostelName}. Ref: ${enquiryId}`,
        correlationId,
      }),
      sendEmail({
        to: newEnquiry.workEmail,
        subject: `Thank you for contacting Hostel IQ [${enquiryId}]`,
        html: visitorHtml,
        text: `Hello ${newEnquiry.fullName}, thank you for reaching out to Hostel IQ. Your enquiry for ${newEnquiry.hostelName} has been received (Ref: ${enquiryId}). Our team will be in touch shortly.`,
        correlationId,
      }),
    ]).then((results) => {
      results.forEach((resItem, idx) => {
        if (resItem.status === 'rejected') {
          console.warn(`[enquiry][email-warning] Notification email ${idx === 0 ? 'internal' : 'visitor'} dispatch note:`, resItem.reason?.message || resItem.reason);
        }
      });
    }).catch((err) => {
      console.warn('[enquiry][email-warning] Background email notice:', err?.message || err);
    });

    // 7. Return clean success response
    return res.status(201).json({
      success: true,
      message: 'Your enquiry has been received successfully. Our team will get in touch using the contact details you provided.',
      data: {
        enquiryId: newEnquiry.enquiryId,
        createdAt: newEnquiry.createdAt,
      },
    });
  } catch (error) {
    console.error('[enquiry][error] Failed to create enquiry:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to submit your enquiry at this moment. Please try again or reach out to support.',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
    });
  }
};

module.exports = {
  submitEnquiry,
};
