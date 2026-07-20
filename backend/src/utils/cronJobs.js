const cron = require('node-cron');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const Fee = require('../models/Fee');

// Configure NodeMailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // Standard configuration for Gmail
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Initializes all background cron jobs.
 */
const initCronJobs = () => {
  // Run every day at 10:00 AM
  cron.schedule('0 10 * * *', async () => {
    console.log('Running automated fee reminder cron job...');
    try {
      // Find all unpaid fees
      const unpaidFees = await Fee.find({ status: { $ne: 'paid' } }).populate('student_id');
      
      if (!unpaidFees.length) {
        console.log('No unpaid fees to remind.');
        return;
      }

      for (const fee of unpaidFees) {
        const student = fee.student_id;
        
        // Skip if student has no email or is not valid
        if (!student || !student.email) continue;
        
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: student.email,
          subject: `Fee Reminder: Unpaid Fees for ${fee.month}`,
          text: `Dear ${student.name},\n\nThis is a gentle reminder that your hostel fees for ${fee.month} (Amount: ₹${fee.amount}) are currently pending.\n\nPlease clear the dues at your earliest convenience to avoid any late fees.\n\nThank you,\nQ2 Connect Hostel Management`
        };

        try {
          // Send the email
          await transporter.sendMail(mailOptions);
          console.log(`Sent reminder email to ${student.email}`);
        } catch (mailError) {
          console.error(`Failed to send reminder to ${student.email}:`, mailError.message);
        }
      }
      
    } catch (error) {
      console.error('Cron Job Error:', error);
    }
  });
  
  console.log('Cron jobs initialized successfully.');
};

module.exports = { initCronJobs };
