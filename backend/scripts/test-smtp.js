/**
 * SMTP Diagnostic Tool for Q2 Connect Suite
 * Usage: node scripts/test-smtp.js [recipient_email]
 */
require('dotenv').config();
const { verifySmtpConnection, sendEmail, getTransporter } = require('../src/utils/email');

async function main() {
  const recipient = process.argv[2] || process.env.SMTP_USER;

  console.log('====================================================');
  console.log('📬 Q2 CONNECT SUITE — SMTP DIAGNOSTIC SUITE');
  console.log('====================================================');
  console.log(`Host:     ${process.env.SMTP_HOST || 'smtp.gmail.com'}`);
  console.log(`Port:     ${process.env.SMTP_PORT || '587'}`);
  console.log(`User:     ${process.env.SMTP_USER || '(not set)'}`);
  console.log(`From:     ${process.env.EMAIL_FROM || '(not set)'}`);
  console.log(`Pass len: ${process.env.SMTP_PASS ? process.env.SMTP_PASS.replace(/\s+/g, '').length + ' characters' : '(empty)'}`);
  console.log('----------------------------------------------------');

  console.log('🔍 Testing SMTP Handshake & Authentication...');
  const res = await verifySmtpConnection();

  if (!res.success) {
    console.error('\n❌ SMTP CONNECTION FAILED!');
    console.error(`Error: ${res.error}`);
    console.error(`Code:  ${res.code || 'UNKNOWN'}`);
    console.log('\n💡 TROUBLESHOOTING GMAIL SMTP:');
    console.log('1. Go to your Google Account: https://myaccount.google.com/security');
    console.log('2. Ensure "2-Step Verification" is enabled.');
    console.log('3. Visit App Passwords: https://myaccount.google.com/apppasswords');
    console.log('4. Create a new App Password (e.g. named "Q2 Connect").');
    console.log('5. Copy the 16-character code and paste into backend/.env as SMTP_PASS=abcdefghijklmnop');
    console.log('6. Re-run this script: node scripts/test-smtp.js');
    console.log('====================================================\n');
    process.exit(1);
  }

  console.log('✅ SMTP Connection & Authentication Successful!');
  console.log(`📨 Sending test email to ${recipient}...`);

  try {
    const info = await sendEmail({
      to: recipient,
      subject: '✅ Q2 Connect Suite — SMTP Verification Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #22c55e; margin-top: 0;">✅ SMTP Connection Verified</h2>
          <p>This is a test notification confirming that the email delivery system for <strong>Q2 Connect Suite</strong> is operational.</p>
          <p style="color: #64748b; font-size: 13px;">Timestamp: ${new Date().toISOString()}</p>
        </div>
      `,
      text: `✅ Q2 Connect Suite — SMTP Connection Verified at ${new Date().toISOString()}`,
    });

    console.log(`🎉 Test email sent successfully! MessageId: ${info.messageId}`);
    console.log('====================================================\n');
    process.exit(0);
  } catch (sendErr) {
    console.error(`❌ Failed to send test email: ${sendErr.message}`);
    process.exit(1);
  }
}

main();
