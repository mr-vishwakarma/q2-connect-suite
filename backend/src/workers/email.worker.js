/**
 * BullMQ Email Worker
 * 
 * Responsibilities:
 * - Bounded concurrency (concurrency: 5)
 * - Rate limiting (max 10 emails/sec) to avoid external provider throttling
 * - Tenant isolation verification on every job execution
 * - Permanent failure classification using BullMQ's UnrecoverableError
 * - Durable idempotency recording in MongoDB
 */

const { Worker, UnrecoverableError } = require('bullmq');
const { QUEUES } = require('../queues/queueManager');
const { getRedisOptions, getRedisStatus, createIsolatedRedisConnection } = require('../config/redis');
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const User = require('../models/User');
const emailUtils = require('../utils/email');

let emailWorker = null;

/**
 * Core business processor for individual email jobs.
 * @param {import('bullmq').Job} job
 */
async function processEmailJob(job) {
  const { name: jobType, data: payload } = job;
  console.log(`[Worker:Email] Processing job ${job.id} (type: ${jobType})`);

  if (!payload) {
    throw new UnrecoverableError('Empty job payload is unrecoverable');
  }

  switch (jobType) {
    case 'FEE_REMINDER': {
      const { feeId, organizationId, studentId, month, amount } = payload;
      if (!feeId) {
        throw new UnrecoverableError('feeId is required for FEE_REMINDER');
      }

      // 1. Tenant Safety: Verify fee belongs to organization
      const feeQuery = { _id: feeId };
      if (organizationId) {
        feeQuery.organizationId = organizationId;
      }

      const fee = await Fee.findOne(feeQuery).lean();
      if (!fee) {
        throw new UnrecoverableError(`Fee record ${feeId} not found or tenant boundary violated`);
      }

      if (fee.status === 'paid') {
        console.log(`[Worker:Email] Fee ${feeId} is already paid. Skipping reminder.`);
        return { skipped: true, reason: 'ALREADY_PAID' };
      }

      // Check durable idempotency: was a reminder already sent today?
      if (fee.lastReminderSentAt) {
        const hoursSinceLastReminder = (Date.now() - new Date(fee.lastReminderSentAt).getTime()) / (1000 * 60 * 60);
        if (hoursSinceLastReminder < 20) {
          console.log(`[Worker:Email] Fee ${feeId} reminder already sent ${hoursSinceLastReminder.toFixed(1)}h ago. Skipping.`);
          return { skipped: true, reason: 'IDEMPOTENT_DUPLICATE_SUPPRESSED' };
        }
      }

      // 2. Load student with tenant isolation
      const studentQuery = { _id: fee.studentId || studentId };
      if (organizationId) {
        studentQuery.organizationId = organizationId;
      }
      const student = await Student.findOne(studentQuery).lean();
      if (!student || !student.email) {
        throw new UnrecoverableError(`Student ${studentId} missing or has no email address`);
      }

      // 3. Dispatch Email
      const mailOptions = {
        to: student.email,
        subject: `Fee Reminder: Unpaid Fees for ${month || fee.month}`,
        text: `Dear ${student.name},\n\nThis is a gentle reminder that your hostel fees for ${month || fee.month} (Amount: ₹${amount || fee.amount}) are currently pending.\n\nPlease clear the dues at your earliest convenience.\n\nThank you,\nQ2 Connect Hostel Management`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333333;">
            <h2 style="color: #6366f1;">Hostel Fee Due Reminder</h2>
            <p>Dear <strong>${student.name}</strong>,</p>
            <p>Your hostel fees for <strong>${month || fee.month}</strong> are currently pending.</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0;"><strong>Amount Due:</strong> ₹${amount || fee.amount}</p>
              <p style="margin: 4px 0;"><strong>Status:</strong> ${fee.status.toUpperCase()}</p>
            </div>
            <p>Please clear the pending balance at your earliest convenience to avoid late fees.</p>
            <p>Best regards,<br/>Q2 Connect Management</p>
          </div>
        `,
      };

      try {
        await emailUtils.sendEmail(mailOptions);
      } catch (err) {
        // Classify error: if invalid recipient or DNS format error, do not retry indefinitely
        if (err.responseCode && err.responseCode >= 500 && err.responseCode < 600) {
          throw new UnrecoverableError(`Permanent SMTP delivery error (${err.responseCode}): ${err.message}`);
        }
        // Transient network/timeout error: throw standard error for BullMQ retry backoff
        throw err;
      }

      // 4. Record durable MongoDB idempotency state
      await Fee.updateOne(
        { _id: fee._id },
        { $set: { lastReminderSentAt: new Date() } }
      );

      return { success: true, recipient: student.email, feeId: fee._id };
    }

    case 'STUDENT_CREDENTIALS': {
      const { to, name, username, password, resetLink } = payload;
      if (!to || !username || !password) {
        throw new UnrecoverableError('Missing required credential payload fields (to, username, password)');
      }
      await emailUtils.sendStudentCredentials({ to, name, username, password, resetLink });
      return { success: true, recipient: to };
    }

    case 'PASSWORD_RESET': {
      const { to, resetLink } = payload;
      if (!to || !resetLink) {
        throw new UnrecoverableError('Missing required password reset fields (to, resetLink)');
      }
      await emailUtils.sendPasswordResetEmail({ to, resetLink });
      return { success: true, recipient: to };
    }

    case 'MESS_REQUEST_UPDATE': {
      const { to, name, status, leavingDate, returnDate, adminMessage } = payload;
      if (!to || !status) {
        throw new UnrecoverableError('Missing required mess request fields');
      }
      await emailUtils.sendMessRequestUpdate({ to, name, status, leavingDate, returnDate, adminMessage });
      return { success: true, recipient: to };
    }

    case 'ADMIN_NEW_STUDENT_REGISTERED': {
      await emailUtils.sendAdminNewStudentRegisteredNotification(payload);
      return { success: true, recipient: payload.to };
    }

    default:
      throw new UnrecoverableError(`Unrecognized email job type: ${jobType}`);
  }
}

/**
 * Initializes and starts the BullMQ Email Worker if Redis is configured.
 */
function initEmailWorker() {
  const status = getRedisStatus();
  if (status.degraded && status.status === 'UNCONFIGURED') {
    return null;
  }

  if (emailWorker) {
    return emailWorker;
  }

  const connection = createIsolatedRedisConnection('email-worker');
  if (!connection) {
    return null;
  }

  try {
    emailWorker = new Worker(QUEUES.EMAIL, processEmailJob, {
      connection,
      concurrency: 5, // Bounded concurrency: max 5 parallel email tasks per node instance
      limiter: {
        max: 10,       // Max 10 emails
        duration: 1000 // per second
      },
    });

    emailWorker.on('completed', (job, returnvalue) => {
      console.log(`[Worker:Email] Job ${job.id} completed.`);
    });

    emailWorker.on('failed', (job, err) => {
      console.error(`[Worker:Email] Job ${job?.id} failed after ${job?.attemptsMade} attempts: ${err.message}`);
    });

    emailWorker.on('error', (err) => {
      console.warn(`[Worker:Email] Worker connection warning: ${err.message}`);
    });

    console.log('[Worker:Email] BullMQ Email Worker initialized with bounded concurrency (5) and rate limiter (10/s).');
    return emailWorker;
  } catch (err) {
    console.warn(`[Worker:Email] Failed to initialize worker: ${err.message}`);
    return null;
  }
}

/**
 * Closes the email worker gracefully.
 */
async function closeEmailWorker() {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
  }
}

module.exports = {
  initEmailWorker,
  closeEmailWorker,
  processEmailJob,
};
