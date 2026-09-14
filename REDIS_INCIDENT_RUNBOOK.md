# REDIS & BULLMQ INCIDENT RUNBOOK
## CONNECTION DEGRADATION, QUEUE BACKLOGS & WORKER RECOVERY

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Scope**: Redis Server, BullMQ Distributed Queues, Email Workers, Repeatable Schedulers  
**Audience**: Backend Engineers, Platform SREs, and DevOps  

---

## 1. Common Symptoms & Severity Levels

| Symptom | Probable Cause | Severity | Immediate Action |
| :--- | :--- | :--- | :--- |
| **`[Redis] Connection warning (ECONNREFUSED)`** | Redis host unreachable, network issue, or instance restart. | SEV-2 | Verify Redis service; Q2 operates in **Degraded Fallback Mode** automatically. |
| **Transactional emails delayed or missing** | Email queue worker stalled or BullMQ concurrency blocked. | SEV-2 | Inspect `email-queue` backlog; restart background workers via PM2/Render. |
| **Scheduled late fees not running at midnight** | BullMQ repeatable job definition missing or Redis evicted scheduled key. | SEV-3 | Re-trigger `initDistributedScheduler()` or run manual sync script. |
| **Redis Out-of-Memory (`OOM command not allowed`)** | Unbounded completed/failed job retention filling Redis RAM. | SEV-2 | Verify retention limits in `queueManager.js` (`removeOnComplete: 500`, `removeOnFail: 1000`). |

---

## 2. Diagnostic & Health Inspection Commands

### Check Redis Health Status from Application Perspective
```bash
# Query the live application readiness probe
curl -s http://localhost:5000/api/health/ready | grep -o '"redis":{[^}]*}'
```

### Inspect Redis Status via In-Process Diagnostic
```bash
node -e "
  require('dotenv').config();
  const { getRedisStatus } = require('./src/config/redis');
  console.log('Redis Diagnostics:', getRedisStatus());
"
```

### Check BullMQ Queue Depths & Inactive Jobs
```bash
node -e "
  require('dotenv').config();
  const { getQueue } = require('./src/queues/queueManager');
  async function check() {
    const q = getQueue('email-queue');
    if (!q) {
      console.log('Queue running in inline Degraded Mode.');
      process.exit(0);
    }
    const counts = await q.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
    console.log('Email Queue Job Counts:', counts);
    process.exit(0);
  }
  check();
"
```

---

## 3. Recovery Procedures

### Scenario A: Redis Outage / Network Partition
1. **Zero Downtime Graceful Degradation**:
   - Q2's architecture is engineered with a fail-open degraded mode.
   - When Redis is down, `addEmailJob()` automatically switches to asynchronous inline dispatch using `sendEmailInline()`.
   - Core API endpoints, user logins, student registration, and payment checkouts continue without interruption.
2. **Restoring Redis**:
   - Restart the Redis instance (e.g., Render Redis service or Upstash).
   - Once network connectivity returns, `ioredis` reconnects automatically using bounded exponential backoff.
   - The status updates from `DEGRADED` to `READY`.

### Scenario B: Clearing Stalled or Poison Pill Jobs
If an unrecoverable job causes worker timeouts:
```bash
node -e "
  require('dotenv').config();
  const { getQueue } = require('./src/queues/queueManager');
  async function clean() {
    const q = getQueue('email-queue');
    if (q) {
      await q.clean(5000, 100, 'failed');
      console.log('Cleaned failed jobs from email queue.');
    }
    process.exit(0);
  }
  clean();
"
```
