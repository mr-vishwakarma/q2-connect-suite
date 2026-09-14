# PHASE I BASELINE AUDIT — RELIABILITY, RESILIENCE & FAILURE RECOVERY AUDIT

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Date**: September 14, 2026  
**Auditor**: Antigravity Platform Engineering  
**Scope**: Architecture Resilience, Fault Tolerance, Failure Boundaries & Recovery Mechanisms  

---

## 1. Executive Summary

Phase I establishes the empirical failure recovery, fault resilience, multi-instance safety, and business continuity baseline for the entire Q2 Connect Suite.

Prior phases established:
- **Phases A–E**: Tenant isolation, query optimization, BullMQ distributed queues, concurrency protection, and media pipeline hardening.
- **Phase F/G**: SaaS billing through Razorpay Subscriptions (with student hostel fee payments strictly manual/offline), platform hardening, structured logging, request correlation IDs, and bounded pagination.
- **Phase H**: Large-scale capacity validation confirming Tier 1 scale (100 orgs, 13,401 students, 95,492 documents, 146.20 mixed RPS, 0.00% error rate).

Phase I audits how the system behaves when components fail: database drops, Redis disconnects, process crashes, duplicate webhooks, worker interruptions, and multi-instance concurrent execution.

---

## 2. Infrastructure & Architectural Baseline

| Component | Current Implementation | Configuration | Resilience Behavior |
| :--- | :--- | :--- | :--- |
| **Node.js Process** | Express 4.21.2 | Multi-core Windows host / Linux container | Graceful shutdown hooks on `SIGTERM` / `SIGINT` with 10s force timeout |
| **Database** | MongoDB Atlas (Shared Cluster) | `maxPoolSize: 50`, `minPoolSize: 10`, `serverSelectionTimeoutMS: 10000` | Reconnects automatically on transient network drops; connection pool throttled if saturated |
| **Caching / Queue** | BullMQ 6.3.5 / IORedis 6.0.0 | Max 10 retries, exponential backoff (200ms–3000ms) | Degraded in-process fallback when Redis is unconfigured or unreachable |
| **Liveness Probe** | `/api/health/live` | Process uptime, memory RSS, heap usage | Independent of all external dependencies; 200 OK while event loop is alive |
| **Readiness Probe**| `/api/health/ready` | MongoDB ping, Redis status, ImageKit/Razorpay credentials | Returns 200 OPERATIONAL/DEGRADED or 503 UNAVAILABLE if MongoDB fails |
| **SaaS Billing** | Razorpay Subscriptions API | Server-side HMAC-SHA256 verification | Idempotent via `WebhookEvent`, `Payment`, and `InvoiceSequence` |
| **Student Payments**| Manual / Offline Cash/UPI/Bank | MongoDB multi-document transactions | Idempotency key deduplication, receipt uniqueness, atomic balance updates |
| **Room Allocation** | MongoDB `$expr` check | Atomic `findOneAndUpdate` within session | Strict capacity invariant: `$occupiedCount < $capacity` |

---

## 3. Detailed Component Failure & Recovery Paths

### 3.1 Graceful Process Shutdown (`backend/src/app.js`)
- **Signal Trap**: Captures `SIGTERM` and `SIGINT`.
- **Drain Sequence**:
  1. `httpServer.close()`: Stops accepting new inbound HTTP requests while in-flight requests finish.
  2. `shutdownBackgroundSystem()`: Closes BullMQ email and scheduled workers, closes queue event listeners, terminates Redis command and subscriber clients.
  3. `mongoose.connection.close(false)`: Flushes writes and closes MongoDB socket pool cleanly.
  4. Force-kill timer: `setTimeout(..., 10000)` prevents hanging if sockets or locks stall.

### 3.2 Health Diagnostics & Traffic Gating (`backend/src/routes/health.routes.js`)
- **Liveness (`/api/health/live`)**:
  - Validates that the event loop is turning and memory is bounded.
  - Returns `{ status: "UP", memory: { rssMB, heapUsedMB }, uptimeSeconds }`.
- **Readiness (`/api/health/ready`)**:
  - Executes `mongoose.connection.db.admin().ping()`. If ping fails or readyState != 1, returns `HTTP 503 UNAVAILABLE`, signaling ingress load balancers (Cloudflare / Render) to stop routing traffic to this instance.
  - Checks Redis state. If Redis is down, status degrades to `DEGRADED`, but HTTP status remains `200` to keep transactional core operations online.

### 3.3 MongoDB Connection & Reconnection (`backend/src/config/db.js`)
- Uses Mongoose connection pool:
  - `maxPoolSize: 50`
  - `minPoolSize: 10`
  - `serverSelectionTimeoutMS: 10000`
  - `socketTimeoutMS: 45000`
  - `family: 4` (IPv4 force to prevent IPv6 DNS delays on Windows/cloud)
- In development, unhandled connection failure logs and sets reconnect listeners. In production, initial connection failure fails closed (`process.exit(1)`).

### 3.4 Redis & BullMQ Degraded Fallback (`backend/src/config/redis.js`)
- Configured with `maxRetriesPerRequest: null` (strict requirement for BullMQ).
- Exponential backoff strategy up to 10 retry attempts.
- When `REDIS_URL` is absent or unreachable:
  - System logs: `Background queue system running in DEGRADED mode`.
  - Transactional emails are executed asynchronously inline via `addEmailJob` fallback without throwing unhandled rejections.
  - Distributed scheduled crons do not execute in-process to prevent duplicate execution across multiple backend pods.

### 3.5 Distributed Repeatable Scheduler (`backend/src/schedulers/distributedScheduler.js`)
- Tasks registered:
  - `LATE_FEE_CALCULATION`: `0 0 * * *` (`repeatable:late-fee-daily`)
  - `FEE_REMINDER_DISPATCHER`: `0 10 * * *` (`repeatable:fee-reminders-daily`)
- Uses deterministic repeat keys in Redis. If multiple instances boot simultaneously, BullMQ's distributed lock ensures exactly one logical repeatable job is registered in Redis.

### 3.6 Webhook Processing & Financial Idempotency (`backend/src/controllers/webhook.controller.js`)
- Ingestion steps:
  1. HMAC-SHA256 signature verification against unmodified raw body (`req.rawBody`).
  2. Query `WebhookEvent` by `(provider, providerEventId)`.
  3. If exists, returns `HTTP 200 { duplicate: true }` without executing side effects.
  4. Durably inserts `WebhookEvent` with status `RECEIVED`.
  5. Processes event (e.g. `subscription.charged`, `payment.captured`).
  6. Checks `Payment.findOne({ paymentId })` before creating financial records.
  7. Generates atomic sequential invoice (`InvoiceSequence.getNextInvoiceNumber`).
  8. Creates double-entry `LedgerEntry` record.
  9. Updates `WebhookEvent` status to `PROCESSED`.

### 3.7 Manual Student Fee Payment Concurrency (`backend/src/controllers/fees.controller.js`)
- Wraps payment collection inside a multi-document MongoDB transaction (`mongoose.startSession()`).
- Checks `idempotencyKey` inside session; returns previous payment if duplicate.
- Checks `receiptNo` uniqueness within tenant.
- Atomically checks if fee is already fully paid.
- Creates `FeePayment` and updates `Fee.paidAmount` and `Fee.status` atomically.
- If any step throws or network disconnects, calls `session.abortTransaction()`.

### 3.8 Room Bed Allocation Concurrency (`backend/src/controllers/students.controller.js`)
- Atomically allocates room bed using:
  ```javascript
  Room.findOneAndUpdate(
    {
      roomNumber: roomNo,
      hostel,
      organizationId: orgId,
      $expr: { $lt: [{ $ifNull: ['$occupiedCount', 0] }, '$capacity'] }
    },
    [
      {
        $set: {
          occupiedCount: { $add: [{ $ifNull: ['$occupiedCount', 0] }, 1] },
          status: {
            $cond: {
              if: { $gte: [{ $add: [{ $ifNull: ['$occupiedCount', 0] }, 1] }, '$capacity'] },
              then: 'full',
              else: 'available'
            }
          }
        }
      }
    ],
    { session, new: true }
  );
  ```
- If bed capacity is exhausted, returns `null`, triggering `session.abortTransaction()` and returning `400 Bad Request`.

---

## 4. Disaster Recovery & Backup Status

- **Configured Capability**: Continuous oplog recording with hourly automated incremental snapshots on MongoDB Atlas (dedicated clusters).
- **Target RPO**: < 5 minutes.
- **Target RTO**: < 60 minutes.
- **Empirical Status**: Staging currently runs on MongoDB Atlas M0 (Free Tier), which does NOT support continuous PITR or live snapshot downloads. Therefore, live automated PITR restoration on Atlas M0 cannot be measured directly in staging; a collection-level snapshot/restore drill must be executed to measure local restore latency and verify database state invariants.

---

## 5. Identified Baseline Resilience Gaps

1. **Multi-Instance Rate Limiting**: Global in-memory `express-rate-limit` is process-local. Across multiple backend instances without Redis store, rate limits apply per-instance rather than globally.
2. **Crash Consistency in Subscription Verification**: In `billing.controller.js` `verifySubscription`, payment creation, invoice creation, and ledger creation execute sequentially without an overarching `session.startTransaction()`. While guarded by `existingPayment` check, a mid-flight crash between Payment and Ledger creation could leave a ledger-less payment until reconciled.
3. **Poison Webhook Handling**: If an invalid or corrupted payload passes signature verification but crashes during JSON processing, `WebhookEvent` may remain in `RECEIVED` state indefinitely without automated dead-letter triage.

---

## 6. Audit Conclusion

The Q2 Connect Suite architecture has strong failure-handling fundamentals:
- Bounded connections and queries.
- Strict multi-document transactions in student fee payments.
- Atomic expression updates for room bed allocation.
- HMAC verification and idempotency keys in SaaS billing.
- Graceful shutdown sequences across Express, BullMQ, and MongoDB.

Phase I will systematically test these failure modes, simulate multi-instance concurrent execution, execute backup/restore drills, and eliminate identified resilience gaps.
