const nodemailer = require('nodemailer');

/**
 * Get configured Nodemailer transporter with trimmed/sanitized credentials
 */
const getTransporter = () => {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = (process.env.SMTP_USER || '').trim();
  // Strip any spaces in the app password (e.g. 'abcd efgh ijkl mnop' -> 'abcdefghijklmnop')
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

/**
 * Verify SMTP connection health
 */
const verifySmtpConnection = async () => {
  try {
    const transporter = getTransporter();
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message, code: err.code };
  }
};

/**
 * Send a plain email
 * @param {object} options - { to, subject, html, text }
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (
    process.env.NODE_ENV === 'test' ||
    process.env.MOCK_EMAIL === 'true' ||
    !process.env.SMTP_PASS ||
    process.env.SMTP_USER === 'your_gmail@gmail.com'
  ) {
    console.log(`📧 [Simulated Email] Delivered to: ${to} (Subject: ${subject})`);
    return { messageId: `mock-${Date.now()}` };
  }
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || 'Q2 Connect Suite <noreply@q2connect.com>',
      to,
      subject,
      html,
      text,
    });
    console.log(`📧 Email sent successfully to ${to} (MessageId: ${info.messageId})`);
    return info;
  } catch (error) {
    console.error(`❌ Email delivery error to ${to}: ${error.message} [Code: ${error.code || 'UNKNOWN'}]`);
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

/**
 * Send welcome & onboarding completion email to newly onboarded hostel admin
 * @param {object} options - { to, name, orgName, branchName, role, setupUrl, tempPassword }
 */
const sendHostelOnboardingWelcomeEmail = async ({
  to,
  name,
  orgName,
  branchName,
  role = 'Organization Administrator',
  setupUrl,
  tempPassword,
}) => {
  const subject = `Welcome to Q2 Connect Suite — Onboarding Complete for ${orgName}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const activationUrl = setupUrl || `${frontendUrl}/login`;

  const text = `Welcome to Q2 Connect Suite!\n\nHello ${name},\n\nYour organization "${orgName}" (${branchName}) has been successfully onboarded.\n\nYour Administrator Account:\nEmail: ${to}\nTemporary Password: ${tempPassword || 'Set via activation link'}\n\nAccess your dashboard:\n${activationUrl}\n\nBest regards,\nQ2 Connect Suite Platform Operations Team`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #f59e0b; font-size: 24px; margin: 0;">Q2 Connect Suite</h1>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">Smart Multi-Branch Hostel Management Platform</p>
      </div>
      
      <h2 style="color: #0f172a; font-size: 18px; margin-bottom: 12px;">Organization Onboarding Complete 🎉</h2>
      <p style="font-size: 14px; line-height: 1.6;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6;">
        Welcome to Q2 Connect Suite! Your organization <strong>${orgName}</strong> and primary branch <strong>${branchName}</strong> have been configured and provisioned.
      </p>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 20px 0;">
        <p style="margin: 4px 0; font-size: 13px;"><strong>Organization:</strong> ${orgName}</p>
        <p style="margin: 4px 0; font-size: 13px;"><strong>Initial Branch:</strong> ${branchName}</p>
        <p style="margin: 4px 0; font-size: 13px;"><strong>Assigned Role:</strong> ${role}</p>
        <p style="margin: 4px 0; font-size: 13px;"><strong>Login Email:</strong> ${to}</p>
        ${tempPassword ? `<p style="margin: 4px 0; font-size: 13px;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${tempPassword}</code></p>` : ''}
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${activationUrl}" style="display: inline-block; padding: 12px 28px; background-color: #f59e0b; color: #000000; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">
          Access Your Admin Dashboard
        </a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 15px;">
        Need assistance setting up your room tariffs or staff credentials? Contact support at support@q2connect.com.
      </p>
    </div>
  `;

  try {
    return await sendEmail({ to, subject, html, text });
  } catch (err) {
    console.error(`❌ [email] Onboarding welcome email failed delivery to ${to}: ${err.message}`);
    console.warn(`\n============================================================`);
    console.warn(`🚨 ONBOARDING CREDENTIALS DELIVERY FALLBACK NOTICE:`);
    console.warn(`Organization:   ${orgName} (${branchName})`);
    console.warn(`Admin Email:    ${to}`);
    console.warn(`Activation/URL: ${activationUrl}`);
    if (tempPassword) {
      console.warn(`Temporary Pass: ${tempPassword}`);
    }
    console.warn(`SMTP Error:     ${err.message}`);
    console.warn(`Action Required: Verify SMTP_PASS app password in backend/.env`);
    console.warn(`============================================================\n`);
    return null;
  }
};

/**
 * Send branded welcome & account activation email to student
 * @param {object} options - { to, name, username, studentCode, hostel, activationLink, loginLink }
 */
const sendStudentWelcomeEmail = async ({ to, name, username, studentCode, hostel, activationLink, loginLink }) => {
  const subject = `Welcome to ${hostel || 'Q2'} Hostel — Activate Your Resident Account`;
  const text = `Welcome to Q2 Connect Suite!\n\nDear ${name},\n\nYour resident admission into ${hostel || 'Q2'} Hostel has been confirmed.\n\nYour Account Details:\n- Resident Name: ${name}\n- Hostel: ${hostel || 'Q2'}\n- User ID: ${username}\n- Student ID: ${studentCode || username}\n\nPlease click the link below to activate your account and securely set your password (valid for 48 hours):\n${activationLink}\n\nOnce activated, you can log in to the Student Portal at:\n${loginLink || 'http://localhost:8080/login?role=student'}\n\nIf you have any questions or need assistance, contact our administration at support@q2connect.com.\n\nBest regards,\n${hostel || 'Q2'} Administration — Q2 Connect Suite`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="text-align: center; padding-bottom: 24px; border-bottom: 1px solid #334155;">
        <h1 style="color: #ef4444; font-size: 28px; margin: 0; font-weight: 800; letter-spacing: -0.5px;">Q2 CONNECT SUITE</h1>
        <p style="color: #94a3b8; font-size: 14px; margin: 6px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Smart Hostel & Resident Management</p>
      </div>

      <div style="padding: 24px 0;">
        <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 12px 0;">Welcome, ${name}! 👋</h2>
        <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
          Your resident admission into <strong style="color: #ffffff;">${hostel || 'Q2'} Hostel</strong> has been officially confirmed by the administration. Your resident profile and room allocation are now set up.
        </p>

        <div style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 18px; margin-bottom: 24px;">
          <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 10px 0; font-weight: 600;">Your Resident Details</p>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="color: #94a3b8; padding: 6px 0;">Student ID:</td>
              <td style="color: #ffffff; font-weight: 600; font-family: monospace; text-align: right;">${studentCode || username}</td>
            </tr>
            <tr>
              <td style="color: #94a3b8; padding: 6px 0;">Login User ID:</td>
              <td style="color: #ffffff; font-weight: 600; font-family: monospace; text-align: right;">${username}</td>
            </tr>
            <tr>
              <td style="color: #94a3b8; padding: 6px 0;">Branch / Hostel:</td>
              <td style="color: #ffffff; font-weight: 600; text-align: right;">${hostel || 'Q2'}</td>
            </tr>
          </table>
        </div>

        <div style="background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(99,102,241,0.1)); border: 1px solid rgba(239,68,68,0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <p style="color: #ffffff; font-weight: 600; font-size: 15px; margin: 0 0 8px 0;">Step 1: Set Your Secure Password</p>
          <p style="color: #94a3b8; font-size: 13px; margin: 0 0 16px 0;">For your security, we do not send passwords via email. Click below to choose your private permanent password.</p>
          <a href="${activationLink}" style="display: inline-block; background-color: #ef4444; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 12px rgba(239,68,68,0.3);">
            Activate Account & Set Password
          </a>
          <p style="color: #64748b; font-size: 11px; margin: 12px 0 0 0;">This single-use activation link expires in 48 hours.</p>
        </div>

        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0 0 12px 0;">
          If the button above does not work, copy and paste this link into your browser:<br/>
          <a href="${activationLink}" style="color: #38bdf8; word-break: break-all;">${activationLink}</a>
        </p>

        <div style="border-top: 1px solid #334155; padding-top: 18px; margin-top: 24px;">
          <p style="color: #94a3b8; font-size: 13px; margin: 0 0 6px 0;">
            <strong>Step 2: Sign In</strong><br/>
            After setting your password, sign in at the <a href="${loginLink || 'http://localhost:8080/login?role=student'}" style="color: #ef4444; text-decoration: underline;">Student Portal</a>.
          </p>
          <p style="color: #64748b; font-size: 12px; margin: 12px 0 0 0;">
            Need help? Contact hostel administration or email <a href="mailto:support@q2connect.com" style="color: #94a3b8;">support@q2connect.com</a>.
          </p>
        </div>
      </div>

      <div style="border-top: 1px solid #1e293b; padding-top: 16px; text-align: center; color: #64748b; font-size: 12px;">
        <p style="margin: 0;">© ${new Date().getFullYear()} Q2 Connect Suite. All rights reserved.</p>
      </div>
    </div>
  `;
  return sendEmail({ to, subject, html, text });
};

module.exports = { 
  getTransporter,
  verifySmtpConnection,
  sendEmail, 
  sendStudentCredentials, 
  sendStudentWelcomeEmail,
  sendMessRequestUpdate, 
  sendPasswordResetEmail,
  sendAdminNewStudentRegisteredNotification,
  sendHostelOnboardingWelcomeEmail,
};

