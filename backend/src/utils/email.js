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
  const text = `Welcome to Q2 Connect Suite!\n\nHello ${name},\n\nYour hostel management account has been created. Here are your temporary login credentials:\n\nUser ID (for login): ${username}\nTemporary Password: ${password}\n\nFor security reasons, please set a new permanent password using the link below:\n${resetLink}\n\nNote: If you don't see this email in your inbox, please check your Spam or Junk folder.\n\nBest regards,\nQ2 Connect Suite Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333333;">
      <h2 style="color: #6366f1;">Welcome to Q2 Connect Suite!</h2>
      <p>Hello <strong>${name}</strong>,</p>
      <p>Your hostel management account has been created. Here are your temporary login credentials:</p>
      <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 5px 0;"><strong>User ID (for login):</strong> ${username}</p>
        <p style="margin: 5px 0;"><strong>Temporary Password:</strong> ${password}</p>
      </div>
      <p style="color: #ef4444;"><strong>For security reasons, please set a new permanent password using the link below:</strong></p>
      <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0;">Set Your Password</a>
      <p style="margin-top: 15px;">If the button doesn't work, copy and paste this link into your browser:</p>
      <p><a href="${resetLink}" style="color: #6366f1;">${resetLink}</a></p>
      <p style="background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 6px; font-size: 13px; color: #92400e;">
        <strong>Tip:</strong> If this email arrived in your Spam/Junk folder, please mark it as <em>"Not Spam"</em> so you don't miss future notifications.
      </p>
      <p>Best regards,<br/>Q2 Connect Suite Team</p>
    </div>
  `;
  return sendEmail({ to, subject, html, text });
};

/**
 * Send password reset email
 * @param {object} options - { to, resetLink }
 */
const sendPasswordResetEmail = async ({ to, resetLink }) => {
  const subject = 'Password Reset Request - Q2 Connect Suite';
  const text = `Password Reset Request\n\nYou requested a password reset for your Q2 Connect Suite account.\n\nClick or paste the link below into your browser to set a new password (valid for 24 hours):\n${resetLink}\n\nNote: If you don't see this email in your inbox, please check your Spam or Junk folder.\n\nIf you did not request this, please ignore this email.\n\nBest regards,\nQ2 Connect Suite Team`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333333;">
      <h2 style="color: #6366f1;">Password Reset</h2>
      <p>You requested a password reset for your Q2 Connect Suite account.</p>
      <p>Click the button below to set a new password. This link is valid for 24 hours.</p>
      <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">Reset Password</a>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p><a href="${resetLink}" style="color: #6366f1;">${resetLink}</a></p>
      <p style="background: #fffbeb; border: 1px solid #fef3c7; padding: 10px; border-radius: 6px; font-size: 13px; color: #92400e;">
        <strong>Tip:</strong> If this email arrived in your Spam/Junk folder, please mark it as <em>"Not Spam"</em>.
      </p>
      <p>If you did not request this, please ignore this email.</p>
      <p>Best regards,<br/>Q2 Connect Suite Team</p>
    </div>
  `;
  return sendEmail({ to, subject, html, text });
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

/**
 * Send notification email to admin when a new student registration is completed
 * @param {object} options - { to, studentName, studentEmail, studentRoom, studentHostel, studentPhone, username }
 */
const sendAdminNewStudentRegisteredNotification = async ({ to, studentName, studentEmail, studentRoom, studentHostel, studentPhone, username }) => {
  const subject = `New Student Registered: ${studentName} (${studentHostel} - Room ${studentRoom || 'N/A'})`;
  const text = `New Student Registered Successfully!\n\nDetails:\n- Student Name: ${studentName}\n- Hostel: ${studentHostel}\n- Room No: ${studentRoom || 'Unassigned'}\n- User ID: ${username}\n- Email: ${studentEmail}\n- Phone: ${studentPhone || 'N/A'}\n\nLog in to the Admin Dashboard to manage this student: ${process.env.FRONTEND_URL || 'https://q2-connect-suite.vercel.app'}/admin/students\n\nBest regards,\nQ2 Connect Suite`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333333;">
      <h2 style="color: #6366f1;">New Student Registration Confirmed</h2>
      <p>A new resident student has been officially registered in the system.</p>
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 6px 0;"><strong>Student Name:</strong> ${studentName}</p>
        <p style="margin: 6px 0;"><strong>Hostel Branch:</strong> ${studentHostel}</p>
        <p style="margin: 6px 0;"><strong>Room Number:</strong> ${studentRoom || 'Not Assigned'}</p>
        <p style="margin: 6px 0;"><strong>User ID:</strong> ${username}</p>
        <p style="margin: 6px 0;"><strong>Email:</strong> ${studentEmail}</p>
        <p style="margin: 6px 0;"><strong>Phone:</strong> ${studentPhone || 'N/A'}</p>
      </div>
      <a href="${process.env.FRONTEND_URL || 'https://q2-connect-suite.vercel.app'}/admin/students" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 10px 0;">View in Admin Panel</a>
      <p style="margin-top: 15px; font-size: 12px; color: #64748b;">Q2 Connect Suite Automated Administrative Notification</p>
    </div>
  `;
  try {
    return await sendEmail({ to, subject, html, text });
  } catch (err) {
    console.warn(`[email] Admin notification email skipped or failed: ${err.message}`);
    return null;
  }
};

module.exports = { 
  sendEmail, 
  sendStudentCredentials, 
  sendMessRequestUpdate, 
  sendPasswordResetEmail,
  sendAdminNewStudentRegisteredNotification
};

