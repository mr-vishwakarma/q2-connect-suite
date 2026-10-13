require('dotenv').config();
const { verifySmtpConnection, sendStudentWelcomeEmail } = require('../utils/email');
const { addEmailJob } = require('../queues/queueManager');

async function testEmailDelivery() {
  console.log('============================================================');
  console.log('📬 TESTING STUDENT REGISTRATION EMAIL DELIVERY');
  console.log('============================================================\n');

  console.log('Configuration Check:');
  console.log(`- SMTP Host: ${process.env.SMTP_HOST}`);
  console.log(`- SMTP Port: ${process.env.SMTP_PORT}`);
  console.log(`- SMTP User: ${process.env.SMTP_USER}`);
  console.log(`- Email From: ${process.env.EMAIL_FROM}`);
  console.log(`- Pass configured: ${Boolean(process.env.SMTP_PASS)} (length: ${process.env.SMTP_PASS?.length})\n`);

  // Step 1: Verify SMTP Connection
  console.log('Step 1: Testing SMTP Connection to Gmail...');
  const verifyResult = await verifySmtpConnection();
  if (verifyResult.success) {
    console.log('  ✅ SMTP Server Connection Verified Successfully!\n');
  } else {
    console.error('  ❌ SMTP Connection Failed:', verifyResult.error, verifyResult.code);
    process.exit(1);
  }

  // Step 2: Send Test Student Registration Activation Email
  const testRecipient = process.env.SMTP_USER || 'mayurvish2003@gmail.com';
  console.log(`Step 2: Sending Test Student Registration Welcome Email to: ${testRecipient}...`);

  const dummyPayload = {
    to: testRecipient,
    studentName: 'Aarav Sharma (Test Student)',
    studentId: 'STD-2026-TEST',
    username: 'aarav_test',
    hostelName: 'Q2 Girls & Premium Hostel',
    activationLink: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/reset-password?token=test_crypto_activation_token_${Date.now()}`,
    loginLink: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/login?role=student`,
    supportContact: '+91 9876543210',
  };

  try {
    const result = await sendStudentWelcomeEmail(dummyPayload);
    console.log('\n  ✅ Email Sent Successfully by Nodemailer Transporter!');
    console.log(`  - Message ID: ${result.messageId}`);
    console.log(`  - Accepted by Server: ${JSON.stringify(result.accepted)}`);
    console.log(`  - Server Response: ${result.response}`);
    console.log('\n============================================================');
    console.log('🎉 SUCCESS: Registration activation email successfully dispatched to inbox!');
    console.log('============================================================\n');
  } catch (err) {
    console.error('\n  ❌ Failed to deliver email:', err.message, err.code);
    process.exit(1);
  }

  process.exit(0);
}

testEmailDelivery();
