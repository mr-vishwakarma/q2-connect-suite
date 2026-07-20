const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send a plain email
 * @param {object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      html,
      text,
    });
    console.log(`📧 Email sent: ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`❌ Email error: ${error.message}`);
    throw error;
  }
};

/**
 * Send student credentials email after registration
 * @param {object} options - { to, name, username, password, resetLink }
 */
const sendStudentCredentials = async ({ to, name, username, password, resetLink }) => {
  const subject = 'Your Q2 Connect Suite Account Credentials';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #6366f1;">Welcome to Q2 Connect Suite!</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your hostel management account has been created. Here are your temporary login credentials:</p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>User ID (for login):</strong> ${username}</p>
        <p><strong>Temporary Password:</strong> ${password}</p>
      </div>
      <p style="color: #ef4444;"><strong>For security reasons, please set a new permanent password using the link below:</strong></p>
      <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0;">Set Your Password</a>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p><a href="${resetLink}">${resetLink}</a></p>
      <p>Best regards,<br/>Q2 Connect Suite Team</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
};

/**
 * Send password reset email
 * @param {object} options - { to, resetLink }
 */
const sendPasswordResetEmail = async ({ to, resetLink }) => {
  const subject = 'Password Reset Request - Q2 Connect Suite';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #6366f1;">Password Reset</h2>
      <p>You requested a password reset for your Q2 Connect Suite account.</p>
      <p>Click the button below to set a new password. This link is valid for 24 hours.</p>
      <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">Reset Password</a>
      <p>If you did not request this, please ignore this email.</p>
      <p>Best regards,<br/>Q2 Connect Suite Team</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
};

/**
 * Send mess request status update email
 * @param {object} options - { to, name, status, leavingDate, returnDate, adminMessage }
 */
const sendMessRequestUpdate = async ({ to, name, status, leavingDate, returnDate, adminMessage }) => {
  const statusColor = status === 'approved' ? '#22c55e' : '#ef4444';
  const subject = `Mess Off Request ${status.charAt(0).toUpperCase() + status.slice(1)}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #6366f1;">Mess Off Request Update</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your mess off request has been <strong style="color: ${statusColor};">${status}</strong>.</p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>Leaving Date:</strong> ${leavingDate}</p>
        <p><strong>Return Date:</strong> ${returnDate}</p>
        ${adminMessage ? `<p><strong>Admin Note:</strong> ${adminMessage}</p>` : ''}
      </div>
      <p>Best regards,<br/>Q2 Connect Suite Team</p>
    </div>
  `;
  return sendEmail({ to, subject, html });
};

module.exports = { sendEmail, sendStudentCredentials, sendMessRequestUpdate, sendPasswordResetEmail };
