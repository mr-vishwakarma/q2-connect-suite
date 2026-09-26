/**
 * Script to resend Onboarding Welcome Email for any onboarded organization admin
 * Usage: node scripts/resend-onboarding-email.js [admin_email]
 */
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4']); // Ensure DNS resolves SRV records on Windows
require('dotenv').config();
const mongoose = require('mongoose');
const { sendHostelOnboardingWelcomeEmail, verifySmtpConnection } = require('../src/utils/email');

async function main() {
  const targetEmail = process.argv[2] || 'zylook8@gmail.com';

  console.log('====================================================');
  console.log('📬 Q2 CONNECT SUITE — RESEND ONBOARDING EMAIL');
  console.log(`Target Recipient: ${targetEmail}`);
  console.log('====================================================');

  console.log('🔍 Testing SMTP Connection before proceeding...');
  const smtpCheck = await verifySmtpConnection();
  if (!smtpCheck.success) {
    console.error('❌ Cannot send email: SMTP Authentication failed.');
    console.error(`Reason: ${smtpCheck.error}`);
    console.error('\n⚠️ Please update SMTP_PASS in backend/.env with a valid 16-character Google App Password first.');
    process.exit(1);
  }

  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
  const Org = mongoose.model('Organization', new mongoose.Schema({}, { strict: false }));
  const Hostel = mongoose.model('Hostel', new mongoose.Schema({}, { strict: false }));
  const Membership = mongoose.model('Membership', new mongoose.Schema({}, { strict: false }));

  const user = await User.findOne({ email: targetEmail.toLowerCase() });
  if (!user) {
    console.error(`❌ User not found with email: ${targetEmail}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const membership = await Membership.findOne({ userId: user._id });
  let org = null;
  if (membership && membership.organizationId) {
    org = await Org.findById(membership.organizationId);
  } else if (user.activeOrganizationId) {
    org = await Org.findById(user.activeOrganizationId);
  }

  const orgName = org ? org.name : 'Your Organization';
  const hostel = org ? await Hostel.findOne({ organizationId: org._id }) : null;
  const branchName = hostel ? hostel.name : 'Main Campus';

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
  const setupUrl = `${frontendUrl}/login?email=${encodeURIComponent(user.email)}&activated=true`;

  console.log(`Found Admin: ${user.name}`);
  console.log(`Organization: ${orgName}`);
  console.log(`Branch:       ${branchName}`);
  console.log(`Login URL:    ${setupUrl}`);

  console.log('\nSending onboarding email...');
  const result = await sendHostelOnboardingWelcomeEmail({
    to: user.email,
    name: user.name,
    orgName,
    branchName,
    role: 'Organization Owner & Administrator',
    setupUrl,
    tempPassword: user.hasPassword ? '(Use the password entered during onboarding)' : undefined,
  });

  if (result) {
    console.log(`🎉 Success! Welcome email was delivered to ${user.email}`);
  } else {
    console.log(`⚠️ Email sending returned null (delivery failed). Check logs above.`);
  }

  await mongoose.disconnect();
  console.log('====================================================\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
