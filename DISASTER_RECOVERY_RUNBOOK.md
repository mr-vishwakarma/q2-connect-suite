# DISASTER RECOVERY RUNBOOK
## BUSINESS CONTINUITY, POINT-IN-TIME RESTORATION (PITR) & INTEGRITY VERIFICATION

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Scope**: Disaster Recovery, Database Snapshot Restoration, RPO/RTO Targets & Failover  
**Audience**: DevOps, Database Architects, SREs, and Incident Commanders  

---

## 1. Disaster Recovery Objectives (RPO & RTO)

| Metric | Target | Actual Configured Capability | Notes |
| :--- | :---: | :---: | :--- |
| **RPO (Recovery Point Objective)** | **< 5 minutes** | **~1 minute** (Continuous PITR) | MongoDB Atlas Continuous Cloud Backups stream oplogs continuously. |
| **RTO (Recovery Time Objective)** | **< 60 minutes** | **~25 minutes** | Time required to provision a staging restore cluster and execute verification suites. |

---

## 2. Atlas Backup Architecture & Retention Policies

- **Snapshot Frequency**: Continuous oplog recording with hourly automated incremental snapshots.
- **Snapshot Retention**:
  - Daily snapshots retained for **30 days**.
  - Weekly snapshots retained for **90 days**.
  - Monthly snapshots retained for **1 year**.
- **Geographic Redundancy**: Multi-region replica set distribution (primary in `ap-south-1` Mumbai, secondary cross-region failover).

---

## 3. 10-Step Disaster Recovery Procedure

```
  [1] Identify & Declare
           │
  [2] Isolate Traffic (Maintenance Mode)
           │
  [3] Point-in-Time Restore in Atlas
           │
  [4] Verify Connection & Schemas
           │
  [5] Reconnect Redis & Clear Poison Jobs
           │
  [6] Execute Data Integrity Suite
           │
  [7] Validate Multi-Tenant Boundaries
           │
  [8] Reconcile Razorpay Financial Ledgers
           │
  [9] Verify SaaS Subscription States
           │
 [10] Lift Maintenance & Resume Traffic
```

### Detailed Step-by-Step Instructions

#### Step 1: Identify & Declare Disaster
- When unrecoverable data loss, severe corruption, or regional cloud outage is confirmed, the Incident Commander officially declares a Disaster Recovery event.

#### Step 2: Isolate the System (Maintenance Mode)
- Redirect incoming DNS traffic to the static maintenance page on Vercel or set Cloudflare maintenance mode.
- Prevent incoming mutations from entering the corrupted database cluster.

#### Step 3: Initiate Point-in-Time Restore (PITR) on MongoDB Atlas
1. Log into [MongoDB Atlas Console](https://cloud.mongodb.com).
2. Select your cluster (`q2connect`) -> **Backup** tab.
3. Click **Restore** -> **Point in Time**.
4. Select the timestamp immediately prior to the corrupting event (e.g. `2026-09-14 12:00:00 UTC`).
5. Choose **Restore to a New Cluster** (e.g. `q2connect-restored`).
6. Click **Confirm Restore**. Atlas provisions the new replica set and replays the oplog.

#### Step 4: Update Backend Connection String
- Update the `MONGODB_URI` environment variable on Render to target the restored cluster:
  `MONGODB_URI=mongodb+srv://user:pass@q2connect-restored.mongodb.net/q2connect?retryWrites=true&w=majority`
- Redeploy or restart the backend service.

#### Step 5: Reconnect Redis & Clear Poison Jobs
- Verify Redis health via `/api/health/ready`.
- Flush stalled jobs to avoid retrying corrupted tasks:
  `node src/scripts/resetDatabase.js --queues-only`

#### Step 6: Execute Data Integrity Audit
Run the automated invariant verification script to guarantee database consistency:
```bash
node src/scripts/validate_data_integrity.js
```
Expected output: **12/12 Invariants PASSED**.

#### Step 7: Verify Tenant Isolation
Run the multi-tenant regression test to guarantee zero cross-tenant data leakage:
```bash
npm run test:tenant
```
Expected output: **36/36 Scenarios PASSED**.

#### Step 8: Reconcile Financial Ledger & Razorpay State
Run Phase F financial reconciliation to verify zero duplicate payments or missing ledger entries:
```bash
npm run test:payments
```
Expected output: **72/72 Tests PASSED**.

#### Step 9: Verify SaaS Subscription States
Query the Super Admin platform health:
```bash
node src/scripts/test_super_admin_suite.js
```
Expected output: **41/41 Checks PASSED**.

#### Step 10: Lift Maintenance Mode & Resume Traffic
- Disable Cloudflare maintenance mode.
- Direct DNS to the restored production backend.
- Monitor `/api/health/ready` and latency metrics for 60 minutes post-recovery.
