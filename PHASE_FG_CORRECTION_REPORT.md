# PHASE F/G ARCHITECTURAL CORRECTION & RECONCILIATION REPORT

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Date**: September 14, 2026  
**Auditor**: Antigravity AI Senior Principal Systems Architect & Production Engineering Agent  
**Purpose**: Reconcile the actual implementation of Phases F and G with the final business requirements before beginning Phase H.  

---

## 1. What Phase F Actually Implemented

Phase F was originally tasked with introducing billing, invoicing, and Razorpay payment integration. However, the implementation conflated two fundamentally distinct payment domains:
1. **SaaS Recurring Subscription Billing**: Organization-level SaaS subscriptions for hostel management tiers.
2. **Student Hostel Fee Payments**: Student resident room rent, mess fees, and security deposits.

Phase F implemented Razorpay Order-based checkout (`razorpay.orders.create`) for student resident fee payments. It introduced:
- A student-facing "Pay Online" button and modal (`PaymentModal.tsx`) inside the resident fee portal (`FeeHistory.tsx`).
- Client-side checkout hook `useRazorpayPayment.ts` executing Razorpay Modal for resident hostel fees.
- Student endpoints `/api/payments/create-order` and `/api/payments/verify` designed to accept student fee payments.
- Mutation of `Fee.status` and `Fee.paymentMode = 'online'` via student Razorpay webhooks.
- Invoicing and ledgering that blended resident hostel fees with platform financial transactions.

---

## 2. What Conflicted with Revised Requirements

The non-negotiable business requirement for Q2 Connect Suite establishes:
> **RAZORPAY IS FOR Q2 SAAS BILLING ONLY.**  
> - **Organization / Q2 Customer** → Q2 SaaS Plan → Razorpay Subscription → Razorpay Checkout → Payment / Recurring Billing → Q2 Subscription State → Q2 Plan Entitlements.  
> - **RAZORPAY MUST NOT BE USED FOR STUDENT HOSTEL FEES.**  
> - Student billing remains 100% manual/offline: **Hostel Admin** → Student Fee → Manual / Offline Payment Entry (Cash, Bank Transfer, Offline UPI) → Fee / Payment History.  
> - Students do NOT pay hostel fees online through Razorpay.

The previous implementation suffered from 4 critical architectural violations:
1. **Scope Violation**: Student portal exposed online payment gateway UI and hooks.
2. **API Misdirection**: Payment endpoints permitted resident students to initialize Razorpay checkout orders.
3. **Gateway Mismatch**: SaaS billing relied on one-off orders (`orders.create`) rather than recurring Razorpay Subscriptions (`subscriptions.create` via Plan → Subscription → Checkout → Lifecycle Webhooks).
4. **Domain Conflation**: Payment, invoice, and ledger records mixed SaaS tenant subscription revenue with individual student fee receipts.

---

## 3. Student Razorpay Functionality Removed

All student-facing online payment flows, UI components, hooks, and API access routes have been systematically excised:

1. **Frontend Student UI**:
   - `src/pages/student/FeeHistory.tsx`: Removed Razorpay imports, `useRazorpayPayment` hook, and the "Pay Online" button. Replaced with an offline workflow status badge (`Pending Offline Collection`) that instructs students to pay at the hostel administration desk.
   - Preserved: Student fee summary, overdue warning badges, balance calculation, receipt breakdown, and manual payment history.
2. **Deleted Components & Hooks**:
   - `src/components/payment/PaymentModal.tsx`: Permanently removed via `git rm`.
   - `src/hooks/useRazorpayPayment.ts`: Permanently removed via `git rm`.
3. **Student Payment Gateway Route Denial**:
   - `backend/src/routes/payment.routes.js`: Injected strict blocking middleware on `/create-order`, `/verify`, and `/my-payments`. Any request from a `student` role is rejected immediately with **HTTP 403 Forbidden** and error code `STUDENT_ONLINE_PAYMENTS_DISABLED`.
4. **Refund & Gateway Authority Scoping**:
   - Students cannot invoke payment creation, verification, status inquiries, or refunds under any circumstances.

---

## 4. SaaS Subscription Architecture Implemented

A dedicated, recurring SaaS billing engine powered by Razorpay Subscriptions has been implemented:

```
+------------------+         +----------------------+         +-----------------------+
|     Q2 Plan      |  <--->  |    Razorpay Plan     |  <--->  | Razorpay Subscription |
| (Authoritative)  |         | (rzp_plan_monthly/yr)|         | (sub_xyz, CREATED)    |
+------------------+         +----------------------+         +-----------------------+
         |                                                                |
         v                                                                v
+------------------+         +----------------------+         +-----------------------+
| Q2 Entitlements  |  <===   | Q2 Subscription State|  <===   | Razorpay Checkout Modal|
| (Org Active Plan)|         | (ACTIVE, Monotonic)  |         | (Public Key + Sub ID) |
+------------------+         +----------------------+         +-----------------------+
                                        ^                                 |
                                        |                                 v
                             +----------------------+         +-----------------------+
                             |  Server Verification |  <---   | Cryptographic Callback|
                             |  & Webhook Lifecycle |         | (Signature: HMAC-256) |
                             +----------------------+         +-----------------------+
```

1. **Plan Mapping**: Q2 remains the single authoritative source of truth (`Plan.js`). Plans contain pricing (monthly/yearly), feature gates, and operational limits. Durable provider IDs (`razorpayPlanIdMonthly`, `razorpayPlanIdYearly`) are mapped without making Razorpay the internal business ID.
2. **Subscription Initiation**:
   - Endpoint: `POST /api/billing/subscriptions/create`.
   - Accessible only to Organization Admins and Super Admins. Students receive **403 Forbidden**.
   - Server creates a Razorpay subscription with authoritative price and returns safe public parameters (`subscriptionId`, `amountPaise`, `keyId`). Client cannot tamper with price, billing period, or organization ID.
3. **Razorpay Checkout Integration**:
   - Upgraded `src/utils/razorpay.ts` with `openRazorpaySubscriptionCheckout` utilizing `subscription_id` per Razorpay Subscriptions standard.
4. **Server-Side Cryptographic Signature Verification**:
   - Endpoint: `POST /api/billing/subscriptions/verify`.
   - Verifies `HMAC-SHA256(razorpay_payment_id + "|" + razorpay_subscription_id, key_secret) === razorpay_signature`.
   - Valid signature triggers monotonic state transition to `ACTIVE`, issues a sequential invoice (`Q2-INV-YYYY-NNNNNN`), records a SaaS `Payment` entry, and appends an immutable `LedgerEntry`.

---

## 5. Models Changed

| Model | File Path | Key Structural Modifications |
| :--- | :--- | :--- |
| `Plan` | `backend/src/models/Plan.js` | Added `currency`, `razorpayPlanIdMonthly`, `razorpayPlanIdYearly`, and `status`. |
| `Subscription` | `backend/src/models/Subscription.js` | Full Razorpay subscription domain model: `organizationId`, `planId`, `razorpayPlanId`, `razorpaySubscriptionId`, `status` (state machine), `amountPaise`, `amount`, `currency`, `billingCycle`, `startedAt`, `currentPeriodStart`, `currentPeriodEnd`, `nextChargeAt`, `cancelledAt`, `pausedAt`, `endedAt`, `totalCount`, `paidCount`. |
| `Payment` | `backend/src/models/Payment.js` | Added `billingDomain: ['SAAS', 'STUDENT_LEGACY']` (default: `'SAAS'`), `subscriptionId`, `planId`, `razorpaySubscriptionId`. Decoupled `studentId` and `feeId` so SaaS payments never reference student entities. |
| `Invoice` | `backend/src/models/Invoice.js` | Added `subscriptionId` reference and `SAAS_INVOICE` type for SaaS billing. |
| `LedgerEntry` | `backend/src/models/LedgerEntry.js` | Added `subscriptionId` reference and `SAAS_SUBSCRIPTION` source enum for double-entry financial separation. |
| `Fee` & `FeePayment` | `backend/src/models/Fee.js` / `FeePayment.js` | Audited `paymentMode`. Retained `online` in enum solely for read compatibility with legacy databases. Verified current database has **0** records with `online`. |

---

## 6. APIs Changed

| Endpoint | Method | Role Authorization | Behavior |
| :--- | :---: | :--- | :--- |
| `/api/billing/plans` | `GET` | Admin, Super Admin (Student: 403) | Returns active SaaS plan catalog with monthly/yearly pricing. |
| `/api/billing/subscription` | `GET` | Admin, Super Admin (Student: 403) | Returns current organization subscription status, limits, and active cycle. |
| `/api/billing/subscriptions/create` | `POST` | Admin, Super Admin (Student: 403) | Initializes Razorpay subscription and creates local `Subscription` in `CREATED` state. |
| `/api/billing/subscriptions/verify` | `POST` | Admin, Super Admin (Student: 403) | Verifies subscription HMAC signature, transitions to `ACTIVE`, creates invoice & ledger. |
| `/api/billing/subscriptions/cancel` | `POST` | Admin, Super Admin (Student: 403) | Cancels recurring subscription at period end or immediately. |
| `/api/billing/history` | `GET` | Admin, Super Admin (Student: 403) | Returns tenant-isolated invoice and payment history. |
| `/api/payments/create-order` | `POST` | Blocked for Students | Returns **403 Forbidden** (`STUDENT_ONLINE_PAYMENTS_DISABLED`). |
| `/api/payments/verify` | `POST` | Blocked for Students | Returns **403 Forbidden** (`STUDENT_ONLINE_PAYMENTS_DISABLED`). |
| `/api/payments/my-payments` | `GET` | Blocked for Students | Returns **403 Forbidden** (`STUDENT_ONLINE_PAYMENTS_DISABLED`). |

---

## 7. Frontend Changed

1. **Student Portal**:
   - `src/pages/student/FeeHistory.tsx`: Zero online payment capabilities. Clean display of monthly fees, payment status (`paid`, `unpaid`, `partial`), and manual transaction receipts.
2. **Organization Admin Billing Module**:
   - Created `src/services/api/billing.service.ts`: Full API client for SaaS billing catalog, checkout initialization, verification, cancellation, and invoice downloads.
   - Created `src/pages/admin/Billing.tsx`:
     - **Current Plan Status Card**: Displays active plan, renewal date, amount, and subscription state badge.
     - **Monthly / Annual Billing Toggle**: Dynamic 20% annual discount display.
     - **Plan Catalog Grid**: Starter, Growth, and Enterprise cards with feature checklist and limits.
     - **Payment Confirmation Dialog**: Secure summary showing plan details, billing frequency, and gross amount before invoking Razorpay.
     - **Razorpay Subscription Checkout**: Seamless modal execution using `openRazorpaySubscriptionCheckout`.
     - **Billing & Invoice History Table**: Downloadable sequential invoices.
3. **Routing & Navigation**:
   - `src/App.tsx`: Mounted `/admin/billing` protected under Admin role.
   - `src/components/admin/sidebar/SidebarNavigation.tsx`: Added "Billing & Subscription" navigation link with CreditCard icon.

---

## 8. Webhook Changes

`backend/src/controllers/webhook.controller.js` was completely upgraded to support the full Razorpay Subscriptions event lifecycle:

1. **`subscription.authenticated`**: Subscription verified and scheduled for activation.
2. **`subscription.activated`**: Subscription transitioned to `ACTIVE`, sets `startedAt`, updates `Organization.subscriptionId` and `Organization.status = 'ACTIVE'`.
3. **`subscription.charged`**:
   - Updates `currentPeriodStart`, `currentPeriodEnd`, `nextChargeAt`, and increments `paidCount`.
   - Automatically generates a new `Payment` (`billingDomain = 'SAAS'`), issues a sequential `Invoice`, and writes an immutable `LedgerEntry`.
4. **`subscription.pending`**: Subscription payment retry in progress.
5. **`subscription.halted`**: All retries exhausted; status set to `HALTED`.
6. **`subscription.paused`**: Subscription paused; status set to `PAUSED`.
7. **`subscription.resumed`**: Subscription resumed; status returned to `ACTIVE`.
8. **`subscription.cancelled`**: Subscription cancelled; records `cancelledAt`.
9. **`subscription.completed`**: All billing cycles completed; records `endedAt`.
10. **`subscription.updated`**: Dynamic period window synchronization.
11. **Idempotency & Out-of-Order Safety**:
    - Webhook event IDs (`x-razorpay-event-id`) recorded in `WebhookEvent` model with unique compound index.
    - Duplicate webhook deliveries return HTTP 200 OK immediately with zero duplicate side effects (verified in test: 2 webhook deliveries produced exactly 1 payment and 1 invoice).

---

## 9. Security Changes

1. **Student Authorization Barrier**: Strict server-side RBAC enforced across all billing endpoints. Even if a student crafts an HTTP request to `/api/billing/*`, they receive **403 Forbidden**.
2. **Multi-Tenant Isolation**: Tenant scoping strictly derives `organizationId` from the authenticated JWT token. Org B cannot read or verify Org A subscriptions or invoices (verified in test: Org B billing history contains zero Org A invoices).
3. **Cryptographic Validation**: Signatures generated with `HMAC-SHA256(payment_id + "|" + subscription_id, key_secret)`. Forged signatures rejected with HTTP 400 (`SUBSCRIPTION_VERIFICATION_FAILED`).
4. **Zero Secret Leakage**: Public client checkout receives only `keyId` and `subscriptionId`. Secret keys remain server-side.

---

## 10. Performance Changes

1. **Bounded SaaS Pagination**: Billing history enforces bounded page sizes (`limit <= 100`) with deterministic sorting (`createdAt: -1`).
2. **Atomic Invoicing**: Invoice numbering utilizes MongoDB atomic `$inc` counters (`InvoiceSequence`), guaranteeing zero collision under parallel subscription activations.
3. **Preserved Manual Student Billing Performance**:
   - Manual fee collection uses `.lean()`, projection, compound indexes `{ organizationId: 1, studentId: 1, month: 1 }`, and atomic balance updates.
   - Verified zero unbounded reads and zero N+1 database queries.

---

## 11. Scale Claims Corrected

In `PHASE_G_PRODUCTION_READINESS_REPORT.md` and `PHASE_G_LOAD_TEST_REPORT.md`, previously overstated scale claims were corrected:
- **Previous Claim**: "Empirical load testing across realistic multi-tenant distributions (1,000+ organizations, 100,000+ students, millions of operational records modeled)."
- **Audited Reality**: Phase G seeded 5 organizations, 10 hostels, 250 rooms, 250 students, and 250 fee records.
- **Corrected Language**: The 1,000+ organizations and 100,000+ students benchmark is explicitly reclassified as:
  > **"Architectural Target — Not Yet Empirically Validated"**
- A graduated benchmark roadmap has been formulated in `PHASE_H_SCALE_TEST_PLAN.md` spanning Tier 1 (100 orgs / 10k students), Tier 2 (500 orgs / 50k students), and Tier 3 (1,000+ orgs / 100k students).

---

## 12. Redis Limitations & Degraded Mode Architecture

The previous documentation claimed full distributed reliability even when Redis was absent. This has been corrected:
- **Non-Critical Work (Safe Degradation)**: Transactional emails safely degrade to in-process asynchronous dispatch when Redis is unreachable.
- **Critical Distributed Jobs (Strict Safety)**: Subscription reconciliation, financial ledger audits, and distributed scheduled billing jobs **do NOT silently downgrade** to unsafe in-process multi-worker execution.
- When `REDIS_URL` is absent, the system explicitly reports its queue status as **`DEGRADED`** in readiness probes (`/api/health/ready`), alerting operations that distributed cron jobs are paused until Redis is provisioned.

---

## 13. Backup & Restore Validation Status

The theoretical claims for backup metrics have been audited and separated:
- **Target RPO**: < 5 minutes
- **Target RTO**: < 60 minutes
- **Empirically Validated RPO/RTO Status**: **NOT YET VALIDATED** against an active production Atlas dedicated cluster.
- The step-by-step non-destructive procedure is fully documented in `DISASTER_RECOVERY_RUNBOOK.md`, but empirical timing will be validated upon provisioning the production/staging Atlas M10+ cluster.

---

## 14. Test Count & Verification Summary

Across the entire Q2 Connect Suite, all automated test suites were executed against live MongoDB Atlas:

| Test Suite | Purpose | Executed Count | Results |
| :--- | :--- | :---: | :---: |
| `test_phase_fg_reconciliation.js` | **Phase F/G Reconciliation & SaaS Billing** | **48** | **48 PASSED, 0 FAILED** |
| `test_phase_g_hardening.js` | **Phase G Hardening & Probes** | **39** | **39 PASSED, 0 FAILED** |
| `test_phase_d_distributed_jobs.js` | **BullMQ & Distributed Jobs** | **42** | **42 PASSED, 0 FAILED** |
| `test_phase_e_media_pipeline.js` | **ImageKit Media & Upload Auth** | **39** | **39 PASSED, 0 FAILED** |
| `test_p0_security.js` | **P0 Security & OAuth Verification** | **9** | **9 PASSED, 0 FAILED** |
| `test_phase_b_multitenant.js` | **Multi-Tenant Isolation & IDOR** | **36** | **36 PASSED, 0 FAILED** |
| `test_phase_c_performance.js` | **Query Performance & Pagination** | **45** | **45 PASSED, 0 FAILED** |
| `test_super_admin_suite.js` | **Super Admin Platform Control Plane** | **41** | **41 PASSED, 0 FAILED** |
| `validate_data_integrity.js` | **Platform Data Integrity Checks** | **12** | **12 PASSED, 0 FAILED** |
| **TOTAL AUTOMATED TESTS** | | **311** | **311 PASSED, 0 FAILED (100%)** |

---

## 15. Frontend Typecheck & Build Verification

- **TypeScript Typecheck (`npx tsc --noEmit`)**: **0 Errors, 0 Warnings** (Exit code: 0).
- **Production Build (`npm run build`)**: **Built in 2.62s** with Vite v8.1.5 and Rolldown (Exit code: 0).
  - All chunks emitted cleanly, including `Billing-BdWztTZ4.js` (18.93 kB) and `FeeHistory-CKEW7NBv.js` (9.59 kB).
  - Zero Razorpay client-side secrets bundled.

---

## 16. Data Integrity Audit Findings

The comprehensive data integrity script (`validate_data_integrity.js`) confirmed 12/12 database invariants across live Atlas collections:
1. `Zero Duplicate Organization Memberships`: PASS
2. `Zero Orphan Student Records`: PASS
3. `Zero Orphan Room Records`: PASS
4. `Zero Unmapped Hostel References in Fees`: PASS
5. `Zero Dangling Fee References in Payments`: PASS
6. `Zero Negative Fee Balances or Payment Amounts`: PASS
7. `Zero Duplicate Provider Order Identifiers`: PASS
8. `Zero Duplicate Financial Ledger Entries`: PASS
9. `Zero Duplicate Invoices per Tenant`: PASS
10. `Zero Invalid Subscription States`: PASS
11. `Zero Null Tenant Identifiers in Scoped Models`: PASS
12. `Zero Cross-Tenant Reference Mismatches`: PASS

---

## 17. Remaining Risks & Operational Prerequisites

Before production launch (scheduled after Phase H/I/J):
1. **Live Razorpay Credentials**: Test mode keys are configured. Production requires live KYC credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`).
2. **Dedicated Redis Provisioning**: Upstash or AWS ElastiCache cluster must be provisioned to transition BullMQ out of degraded mode for distributed schedulers.
3. **Atlas M10+ Cluster Provisioning**: Dedicated cluster required to enable Continuous Cloud Backups (PITR) and empirically validate RPO/RTO.
4. **Graduated Scale Validation**: Staging benchmark execution per `PHASE_H_SCALE_TEST_PLAN.md`.

---

## 18. Phase H Readiness Verdict

### STOP CONDITION EVALUATION:
"Is Q2 now correctly aligned with the final Phase F + G architecture and ready to begin Phase H?"

### Final Verdict:
# **YES**

### Detailed Readiness Matrix:
- [x] Student Razorpay checkout is completely removed from UI and API.
- [x] Student hostel fee workflow remains 100% manual and offline.
- [x] Organization SaaS billing UI is live and fully tenant-isolated.
- [x] Razorpay Subscriptions (Plan → Subscription → Checkout → Lifecycle Webhooks) implemented.
- [x] Webhook idempotency and out-of-order event handling verified.
- [x] Financial ledger and invoicing cleanly separated by billing domain (`SAAS` vs `STUDENT_LEGACY`).
- [x] Scale claims and Redis degraded behaviors accurately documented.
- [x] All 311 automated tests pass cleanly with 0 failures.
- [x] Frontend typecheck and production build pass with 0 errors.

**Phase F/G Architectural Reconciliation is complete. The system is structurally sound, verified, and ready to begin Phase H.**
