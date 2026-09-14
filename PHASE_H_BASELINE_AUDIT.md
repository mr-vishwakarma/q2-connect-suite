# PHASE H — COMPREHENSIVE PLATFORM BASELINE AUDIT

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Evaluation Scope**: Entire Q2 Platform (Super Admin, Organization Admin, Hostel Operations, Student Portal, Shared APIs, Database, Queues, Billing, Media, Backups, CI/CD, Disaster Recovery)  
**Date**: September 14, 2026  
**Auditor**: Antigravity AI Senior Principal Systems Architect & Performance Engineering Agent  
**Baseline Status**: Automated Test Suite Passing: **311 / 311 (100%)**, 0 Failures. Frontend Build Clean (2.62s).  

---

## 1. Executive Summary & Objective

Phase H shifts the engineering focus from functional hardening to **empirical scalability, capacity limits, and multi-tenant performance under load**. 

The Phase G and F/G Correction audits verified:
- Architectural correctness of multi-tenancy, RBAC, and bounded pagination.
- Razorpay Subscriptions integration exclusively for Q2 SaaS billing.
- Complete removal of online student fee checkouts (100% manual/offline hostel fee collection).
- Reclassification of the "1,000+ organizations and 100,000+ students" benchmark from an asserted capacity to an **Architectural Target — Not Yet Empirically Validated**.

The primary objective of Phase H is to empirically determine:
> **"At what scale and concurrency can Q2 safely operate while maintaining acceptable latency, zero data corruption, strict tenant isolation, and reliable background-job processing?"**

This audit inspects the current repository state before writing new scale testing and benchmarking code.

---

## 2. Current Architectural State

### 2.1 Backend Architecture
- **Runtime**: Node.js v24 LTS with Express 4.21.2 (`backend/src/app.js`).
- **Data Store**: MongoDB Atlas (multi-tenant shared cluster with logical `organizationId` partitioning).
- **Driver**: Mongoose v8.24.1.
- **Queue / Asynchronous Engine**: BullMQ v6.3.5 with Redis (ioredis v6.0.0).
- **Degraded Fallback**: When Redis is unconfigured or unreachable, the system enters `DEGRADED` mode:
  - Non-critical notifications/emails degrade safely to in-process asynchronous dispatch.
  - Critical distributed jobs (subscription reconciliation, distributed scheduled billing jobs) pause safely to prevent multi-worker concurrency hazards.
- **Media Pipeline**: Direct-to-ImageKit client uploads authorized via server-side HMAC signatures (`/api/upload/direct-auth`); zero server memory buffering.
- **Security & Headers**: Helmet, MongoSanitize, XSS-clean, Gzip compression, and Express rate limiter (1,000 req / 15 min global window).

### 2.2 Frontend Architecture
- **Framework**: React 19 + TypeScript + Vite 8.1.5 with Rolldown bundler.
- **Styling**: TailwindCSS with Shadcn UI components.
- **State Management**: React Query / Context API with Axios interceptors.
- **Code Splitting**: Dynamic lazy imports across 70+ route chunks. Production build completes in ~2.6s (vendor bundle gzip: 393 kB, CSS gzip: 22 kB).

---

## 3. Database Connection Pool & Indexing State

### 3.1 Connection Pool Settings (`backend/src/config/db.js`)
- `maxPoolSize`: **50** concurrent sockets.
- `minPoolSize`: **10** warm sockets.
- `serverSelectionTimeoutMS`: **10,000 ms**.
- `socketTimeoutMS`: **45,000 ms**.
- `family`: **4** (IPv4 enforced for DNS stability on Windows/ISP environments).

### 3.2 Current High-Volume Model Indexes

| Collection / Model | Key Indexes Defined | Query Pattern Optimized |
| :--- | :--- | :--- |
| **`Student`** | `{ organizationId: 1, createdAt: -1 }`<br>`{ organizationId: 1, hostelId: 1 }`<br>`{ organizationId: 1, studentCode: 1 }` (unique)<br>`{ email: 1 }` (unique)<br>`{ userId: 1 }` | Paginated tenant student rosters, hostel student listings, student lookups. |
| **`Room`** | `{ organizationId: 1, roomNumber: 1 }`<br>`{ organizationId: 1, hostelId: 1, status: 1 }`<br>`{ status: 1, occupiedCount: 1 }` | Room occupancy filters, vacancy searches, branch room management. |
| **`Fee`** | `{ organizationId: 1, studentId: 1, month: 1 }`<br>`{ organizationId: 1, status: 1, dueDate: 1 }`<br>`{ status: 1, dueDate: 1 }` | Fee balances, overdue fee reminders, monthly fee billing scans. |
| **`FeePayment`** | `{ organizationId: 1, feeId: 1 }`<br>`{ organizationId: 1, studentId: 1 }`<br>`{ receiptNo: 1 }` (sparse unique) | Manual payment histories, student fee receipts, collection logs. |
| **`Attendance`** | `{ organizationId: 1, date: 1, hostelId: 1 }`<br>`{ studentId: 1, date: 1 }` | Daily attendance batch queries, student attendance records. |
| **`Expense`** | `{ organizationId: 1, date: -1 }`<br>`{ organizationId: 1, category: 1 }` | Expense listings, monthly category aggregations. |
| **`Subscription`** | `{ organizationId: 1 }` (unique)<br>`{ razorpaySubscriptionId: 1 }` (unique)<br>`{ status: 1, currentPeriodEnd: 1 }` | SaaS billing lookups, webhook synchronization, renewal tracking. |
| **`Payment`** | `{ organizationId: 1, createdAt: -1 }`<br>`{ paymentId: 1 }` (unique)<br>`{ orderId: 1 }` (unique)<br>`{ billingDomain: 1 }` | SaaS payment history, duplicate payment prevention. |
| **`Invoice`** | `{ organizationId: 1, invoiceNumber: 1 }` (unique)<br>`{ subscriptionId: 1 }`<br>`{ paymentId: 1 }` | Sequential invoice lookups, tenant billing exports. |
| **`LedgerEntry`** | `{ organizationId: 1, createdAt: -1 }`<br>`{ subscriptionId: 1 }`<br>`{ externalReference: 1 }` | Double-entry financial audit trail. |
| **`WebhookEvent`** | `{ provider: 1, eventId: 1 }` (unique compound) | Webhook idempotency and duplicate delivery suppression. |
| **`InvoiceSequence`**| `{ organizationId: 1, year: 1 }` (unique compound) | Atomic `$inc` sequential invoice counters (`Q2-INV-YYYY-NNNNNN`). |

---

## 4. Redis & BullMQ Queue Architecture

### 4.1 Redis Configuration (`backend/src/config/redis.js`)
- `maxRetriesPerRequest`: `null` (BullMQ requirement).
- `connectTimeout`: `10,000 ms`.
- Bounded reconnect strategy: Exponential backoff up to 10 attempts (max delay: 3,000 ms), then flags `DEGRADED`.
- Error classification: Automatically reconnects on `READONLY`, `ETIMEDOUT`, `ECONNRESET`.

### 4.2 BullMQ Queue Topology (`backend/src/queues/queueManager.js`)
1. **`email-queue`**:
   - Concurrency: 5 workers.
   - Bounded retries: 3 attempts with exponential backoff (initial delay: 2,000 ms).
   - Job retention limits: Max 500 completed jobs (24h retention), max 1,000 failed jobs (7d retention).
2. **`scheduled-queue`**:
   - Concurrency: 2 workers.
   - Bounded retries: 2 attempts.
   - Managed distributed schedulers:
     - `late-fee-daily-midnight` (`0 0 * * *`)
     - `fee-reminder-daily-10am` (`0 10 * * *`)

---

## 5. API Limits, Pagination & Query Bounds

- **Bounded Pagination Utility** (`backend/src/utils/pagination.js`):
  - `DEFAULT_PAGE`: 1
  - `DEFAULT_LIMIT`: 20
  - `MAX_LIMIT`: **100** (abusive queries like `?limit=1000000` are strictly clamped).
- **Express Rate Limiter**: 1,000 requests per 15 minutes per IP.
- **Request Body Limits**: 10 MB payload limit with raw buffer preservation for cryptographic webhook verification.
- **NoSQL Injection & XSS Defenses**: Parameterized Mongoose queries; `express-mongo-sanitize` strips `$` and `.` operators; `xss-clean` sanitizes request bodies.

---

## 6. Heavy Queries, Aggregations & Export Inspection

### 6.1 Heavy Aggregations Identified
1. **Super Admin Dashboard Stats** (`/api/super-admin/analytics/dashboard`):
   - Computes platform-wide MRR, active organizations, hostels, and total students.
   - Currently uses `Promise.all` across collections, executing in 110–130 ms.
2. **Organization Admin Analytics** (`/api/analytics`):
   - Aggregates monthly occupancy rates, fee collection percentages, and category expenses.
   - Uses multi-stage pipelines (`$match`, `$group`, `$sort`).
3. **Overdue Fee Scanner** (`backend/src/jobs/feeReminder.job.js`):
   - Scans unpaid and partial fees where `dueDate < now`.
   - Uses cursor streaming (`.cursor({ batchSize: 100 })`) to prevent high Node.js memory pressure.

### 6.2 Reports & Streaming Exports (`backend/src/services/reportExport.service.js`)
- Streams CSV output using Mongoose cursor (`.cursor()`) directly writing to Express HTTP response stream.
- Zero buffering of large record sets into Node.js heap.
- Header `Content-Type: text/csv` with chunked transfer encoding.

---

## 7. Existing Instrumentation & Load Testing Scripts

The repository currently contains:
1. `run_phase_g_load_test.js`: In-process concurrency harness measuring RPS and p50/p95/p99 across 9 domains up to 50 concurrent streams.
2. `generate_large_scale_dataset.js`: Seeding script creating organizations, hostels, rooms, students, and fees.
3. `collect_phase_g_baseline.js`: Micro-benchmark script collecting latency percentiles on single-tenant vs multi-tenant queries.
4. `validate_data_integrity.js`: 12 platform database invariant checks.

### Identified Gaps to be Solved in Phase H:
- **Uniform vs Realistic Data**: The Phase G generator produced uniform numbers of rooms and students per organization. Phase H must implement **power-law distribution** with hot tenants (small, medium, large, very large).
- **Missing Domain Scale Models**: Attendance, mess, laundry, expenses, notifications, subscriptions, invoices, and ledger entries were not populated at scale.
- **Noisy-Neighbor Benchmark**: No benchmark measured whether a hot tenant pounding operations degrades neighboring tenant operations.
- **Manual Payment Concurrency Contention**: Need specific concurrency tests simulating 2, 5, 10, and 20 simultaneous admins recording payments against identical fee documents.

---

## 8. Audit Conclusion & Phase H Roadmap

The codebase is in a verified, clean state with zero regressions:
- All 311 tests passing.
- Zero secrets committed.
- Clean separation between SaaS billing and manual hostel fees.

**Next Step**: Implement `backend/src/scripts/generate_phase_h_dataset.js` and `PHASE_H_DATASET_STRATEGY.md` with realistic distributions across Tier 1 (100 orgs / 10k students), Tier 2 (500 orgs / 50k students), and Tier 3 (1,000+ orgs / 100k students).
