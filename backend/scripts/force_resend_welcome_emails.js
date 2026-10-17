/**
 * Force Resend Activation Welcome Emails to Unconfirmed Students
 * 
 * Usage: node scripts/force_resend_welcome_emails.js
 */

const mongoose = require('mongoose');
const crypto = require('crypto');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const { sendStudentWelcomeEmail, verifySmtpConnection } = require('../src/utils/email');

async function run() {
  console.log('========================================================');
  console.log('   Q2 CONNECT SUITE — FORCE RESEND WELCOME EMAILS       ');
  console.log('========================================================\n');

  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not defined in environment!');
    process.exit(1);
  }

  // 1. Verify SMTP connection before attempting dispatches
  console.log('1. Verifying SMTP transport connection...');
  const smtpCheck = await verifySmtpConnection();
  if (!smtpCheck.success) {
    console.error('❌ SMTP transport verification failed:', smtpCheck);
    process.exit(1);
  }
  console.log(`✅ SMTP verified successfully (${smtpCheck.details.host}:${smtpCheck.details.port}, secure: ${smtpCheck.details.secure})\n`);

  // 2. Connect to MongoDB
  console.log('2. Connecting to MongoDB Atlas...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB.\n');

  const db = mongoose.connection.db;

  // 3. Fast indexed query for unconfirmed students
  const users = await db.collection('users').find({
    role: 'student',
    $or: [
      { mustChangePassword: true },
      { activationToken: { $exists: true, $ne: null } }
    ]
  }).toArray();

  const unconfirmed = [];
  for (const user of users) {
    if (!user.email || !user.email.includes('@')) continue;
    const student = await db.collection('students').findOne({ userId: user._id });
    if (!student) continue;

    unconfirmed.push({ student, user });
  }

  console.log(`Identified ${unconfirmed.length} unconfirmed registered students:\n`);
  unconfirmed.forEach((item, idx) => {
    console.log(` [${idx + 1}] ${item.student.name} <${item.student.email}> | Code: ${item.student.studentCode || 'N/A'} | Status: ${item.student.welcomeEmailStatus || 'untracked'}`);
  });

  if (unconfirmed.length === 0) {
    console.log('\n✅ No unconfirmed students found. All students have already completed activation!');
    await mongoose.disconnect();
    return;
  }

  // Frontend URL for activation links (use production Vercel app or configured URL)
  const frontendUrl = (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.includes('localhost'))
    ? process.env.FRONTEND_URL.trim()
    : 'https://q2-connect-suite.vercel.app';

  console.log(`\nUsing Activation URL base: ${frontendUrl}\n`);
  console.log('3. Forcefully generating new activation tokens and dispatching emails...\n');

  const dispatchResults = [];

  for (const { student, user } of unconfirmed) {
    const rawActivationToken = crypto.randomBytes(32).toString('hex');
    const hashedActivationToken = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
    const activationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    // Update User with fresh activation token and ensure mustChangePassword is true
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          activationToken: hashedActivationToken,
          activationExpires,
          mustChangePassword: true,
          status: 'ACTIVE',
          isActive: true,
        }
      }
    );

    const activationLink = `${frontendUrl}/reset-password?token=${rawActivationToken}`;
    const loginLink = `${frontendUrl}/login?role=student`;
    const correlationId = `force-cli-${student._id}-${Date.now()}`;

    try {
      console.log(`   -> Sending to ${student.name} <${student.email}>...`);
      const emailResult = await sendStudentWelcomeEmail({
        to: student.email.toLowerCase(),
        name: student.name,
        username: student.username || user.username,
        studentCode: student.studentCode || student.username,
        hostel: student.hostel || 'Q2',
        activationLink,
        loginLink,
        correlationId,
      });

      // Update Student record
      await db.collection('students').updateOne(
        { _id: student._id },
        {
          $set: {
            welcomeEmailStatus: 'sent',
            welcomeEmailSentAt: new Date(),
            welcomeEmailError: null,
          }
        }
      );

      console.log(`      ✅ Accepted by SMTP! MessageId: ${emailResult.messageId}`);
      dispatchResults.push({
        name: student.name,
        email: student.email,
        studentCode: student.studentCode,
        status: 'SUCCESS',
        messageId: emailResult.messageId,
      });
    } catch (err) {
      console.error(`      ❌ Dispatch failed: ${err.message}`);
      await db.collection('students').updateOne(
        { _id: student._id },
        {
          $set: {
            welcomeEmailStatus: 'failed',
            welcomeEmailError: err.message,
          }
        }
      );

      dispatchResults.push({
        name: student.name,
        email: student.email,
        studentCode: student.studentCode,
        status: 'FAILED',
        error: err.message,
      });
    }

    // Brief delay between sends to respect rate limits
    await new Promise(r => setTimeout(r, 600));
  }

  console.log('\n========================================================');
  console.log('                 DISPATCH SUMMARY                       ');
  console.log('========================================================');
  console.table(dispatchResults);

  const successful = dispatchResults.filter(r => r.status === 'SUCCESS').length;
  console.log(`\nDispatched: ${successful}/${dispatchResults.length} emails successfully delivered to SMTP provider.`);

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error('Fatal error during force resend execution:', err);
  process.exit(1);
});
