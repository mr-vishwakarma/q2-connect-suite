/**
 * @deprecated Migrated in Phase D to BullMQ distributed background job architecture.
 * See: backend/src/jobs/feeReminder.job.js, backend/src/workers/email.worker.js, and backend/src/schedulers/distributedScheduler.js
 * 
 * This file is retained as a compatibility stub and does not register in-process crons.
 */

const initCronJobs = () => {
  console.log('[Notice] Legacy initCronJobs called; replaced by BullMQ distributed scheduler in Phase D.');
};

module.exports = { initCronJobs };
