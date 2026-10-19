const Student = require('../models/Student');

const studentService = {
  async getAlertsCount(hostel, organizationId) {
    const filter = { isActive: { $ne: false } };
    if (organizationId) filter.organizationId = organizationId;
    if (hostel && hostel !== 'All') {
      filter.hostel = { $regex: new RegExp(`^${String(hostel).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }

    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(23, 59, 59, 999);

    filter.$or = [
      { validDate: { $lte: fiveDaysFromNow } },
      { validDate: null },
      { validDate: { $exists: false } },
    ];

    const count = await Student.countDocuments(filter);
    return count;
  },

  async getAlertStudents(hostel, organizationId) {
    const filter = { isActive: { $ne: false } };
    if (organizationId) filter.organizationId = organizationId;
    if (hostel && hostel !== 'All') {
      filter.hostel = { $regex: new RegExp(`^${String(hostel).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') };
    }

    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    fiveDaysFromNow.setHours(23, 59, 59, 999);

    filter.$or = [
      { validDate: { $lte: fiveDaysFromNow } },
      { validDate: null },
      { validDate: { $exists: false } },
    ];

    const students = await Student.find(filter)
      .select('name username phone parentPhone roomNo fees startDate validDate hostel userId')
      .sort({ validDate: 1, createdAt: -1 })
      .lean();

    return students;
  },

  /**
   * Single source of truth for student welcome & activation email dispatch.
   * Ensures:
   * 1. A fresh single-use activation token is generated, sha256-hashed and persisted to user.activationToken
   * 2. activationExpires is set to 48 hours from now and mustChangePassword is set to true
   * 3. Constructs trusted activation link (/reset-password?token=${rawToken}&type=activation)
   * 4. Updates student.welcomeEmailStatus
   * 5. Performs guaranteed direct SMTP delivery with BullMQ queue fallback, recording audit in EmailLog
   */
  async dispatchStudentWelcomeEmail({ student, user, hostelDoc = null, req = null }) {
    if (!student || !user) {
      throw new Error('Both student and user instances are required to dispatch welcome email');
    }
    const studentEmail = (student.email || user.email || '').trim().toLowerCase();
    if (!studentEmail) {
      throw new Error('Student has no registered email address');
    }

    const crypto = require('crypto');
    const emailUtils = require('../utils/email');

    // Always generate a fresh single-use activation token for security and reliability
    const rawActivationToken = crypto.randomBytes(32).toString('hex');
    const hashedActivationToken = crypto.createHash('sha256').update(rawActivationToken).digest('hex');
    const activationExpires = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours

    user.activationToken = hashedActivationToken;
    user.activationExpires = activationExpires;
    user.mustChangePassword = true;
    user.temporaryPasswordIssuedAt = new Date();
    await user.save({ validateBeforeSave: false });

    student.welcomeEmailStatus = 'pending';
    student.welcomeEmailError = null;
    await student.save({ validateBeforeSave: false });

    const frontendUrl = emailUtils.getTrustedFrontendUrl(req);
    const activationLink = `${frontendUrl}/reset-password?token=${rawActivationToken}&type=activation`;
    const loginLink = `${frontendUrl}/login?role=student`;
    const correlationId = req?.requestId || `welcome-activation-${student._id}-${Date.now()}`;
    const resolvedHostelName = hostelDoc?.name || student.hostel || 'Q2';

    const payload = {
      to: studentEmail,
      name: student.name,
      studentName: student.name,
      studentId: student.studentCode || student.username,
      studentCode: student.studentCode || student.username,
      username: student.username || user.username,
      hostel: resolvedHostelName,
      hostelName: resolvedHostelName,
      activationLink,
      loginLink,
      studentDocId: student._id.toString(),
      supportContact: hostelDoc?.contactPhone || 'support@q2connect.com',
      correlationId,
    };

    // Prioritize direct delivery so email is guaranteed delivered before response ends (essential on serverless)
    try {
      const info = await emailUtils.sendStudentWelcomeEmail(payload);
      await Student.updateOne(
        { _id: student._id },
        {
          $set: {
            welcomeEmailStatus: 'sent',
            welcomeEmailSentAt: new Date(),
            welcomeEmailError: null,
          },
        }
      );
      return { success: true, method: 'direct', messageId: info?.messageId, recipient: studentEmail };
    } catch (directErr) {
      console.warn(`[studentService.dispatchStudentWelcomeEmail] Direct SMTP attempt failed (${directErr.message}). Enqueueing as backup...`);
      try {
        const { addEmailJob } = require('../queues/queueManager');
        const queueRes = await addEmailJob('STUDENT_WELCOME_ACTIVATION', payload, {
          jobId: `welcome-activation-${student._id}-${Date.now()}`,
        });
        return { success: true, method: 'queued', recipient: studentEmail, queueResult: queueRes };
      } catch (queueErr) {
        console.error(`[studentService.dispatchStudentWelcomeEmail] Both direct and queue dispatch failed: ${queueErr.message}`);
        await Student.updateOne(
          { _id: student._id },
          {
            $set: {
              welcomeEmailStatus: 'failed',
              welcomeEmailError: directErr.message || queueErr.message,
            },
          }
        );
        throw directErr;
      }
    }
  },
};

module.exports = studentService;
