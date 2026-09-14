/**
 * @deprecated Migrated in Phase D to BullMQ distributed background job architecture.
 * See: backend/src/jobs/lateFee.job.js and backend/src/schedulers/distributedScheduler.js
 * 
 * This file is retained as a compatibility stub and does not register in-process crons.
 */

module.exports = {
  deprecated: true,
  migratedTo: 'backend/src/jobs/lateFee.job.js',
};
