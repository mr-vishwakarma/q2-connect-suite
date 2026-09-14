# Phase F/G Architectural Correction & Current-State Audit Report
**Project:** Q2 Group of Hostels / Q2 Connect Suite  
**Scope:** Full Platform Reconciliation — Razorpay SaaS Billing vs Student Hostel Fee Workflows  
**Date:** September 14, 2026  
**Auditor:** Antigravity AI Senior Principal Systems Architect  
**Document:** `PHASE_FG_CORRECTION_AUDIT.md`  

---

## 1. Executive Summary & Purpose

This audit establishes the empirical current state of the Q2 Connect Suite codebase following Phases F and G. 

The primary business directive for the platform is:
> **RAZORPAY IS EXCLUSIVELY FOR Q2 SAAS BILLING.**  
> Organizations purchase Q2 subscription plans using Razorpay Subscriptions (recurring billing).  
> **STUDENT HOSTEL FEES REMAIN 100% MANUAL / OFFLINE.** Hostel admins record offline collections (cash, bank transfer, offline UPI). Students do NOT pay hostel fees online through Razorpay.

The previous Phase F and G implementation reports introduced a critical scope violation by building a student online fee payment gateway flow (student checkout, student payment orders, student Pay Now buttons, and student fee refunds). This document identifies all conflicting components across frontend and backend, documents data models and legacy fields, evaluates scale and infrastructure claims, and outlines the precise architectural correction required.

---

## 2. Comprehensive Inventory of Current State & Scope Violations

### 2.1 Frontend Inspection

| File Path | Current Contents / Purpose | Scope Violation / Conflict | Required Correction |
| :--- | :--- | :--- | :--- |
| `src/components/payment/PaymentModal.tsx` | Dialog component displaying fee breakdown (Billing Period, Total Fee, Outstanding Due) and proceeding to Razorpay checkout. | Built specifically for student resident hostel fee payments. | **REMOVE** student resident checkout modal completely. |
| `src/pages/student/FeeHistory.tsx` | Student fee ledger table with "Pay Online" button, importing `PaymentModal` and `useRazorpayPayment`. | Allows student residents to launch Razorpay checkout for hostel dues. | **REMOVE** "Pay Online" button, modal, and payment hook. Preserve student read-only view of fee records and payment history. |
| `src/hooks/useRazorpayPayment.ts` | React hook orchestrating `paymentService.createOrder(activeContext.feeId)` and opening Razorpay checkout. | Couples client-side Razorpay modal to student fee IDs. | **REPLACE / REFOCUSED** exclusively for Organization SaaS subscription checkout, or remove student hook and create dedicated `useSubscriptionCheckout.ts`. |
| `src/services/api/payment.service.ts` | Client API service with `createOrder(feeId)`, `verifyPayment()`, `getMyPayments()`, `refundPayment()`. | Models student fee online payment lifecycle. | **DEPRECATE / REDIRECT** student payment APIs. Introduce dedicated `billing.service.ts` / `subscription.service.ts` for Organization SaaS plans. |
| `src/pages/admin/PaymentManagement.tsx` | Admin table listing online payments by students (`PaymentRecord` with `studentId`, `feeId`) with refund modal. | Manages student online payments and student refunds via Razorpay. | **REFOCUS / DEPRECATE** student online payment management; replace with Organization Billing & Subscription overview for admins. |
| `src/components/admin/sidebar/SidebarNavigation.tsx` | Includes `{ to: '/admin/payments', icon: CreditCard, label: 'Payments' }`. | Links to student payment management. | Update label/navigation to "SaaS Billing" or "Organization Subscription" for organization admins. |
| `src/pages/admin/Billing.tsx` | Does not exist currently. | Missing Organization SaaS Plan Catalog & Subscription UI. | **CREATE** Organization Billing UI with Plan Catalog, Current Subscription, Billing Cycle, and Razorpay Subscription checkout. |

### 2.2 Backend Inspection

| File Path | Current Contents / Purpose | Scope Violation / Conflict | Required Correction |
| :--- | :--- | :--- | :--- |
| `backend/src/routes/payment.routes.js` | Routes `/create-order`, `/verify`, `/my-payments`, `/student`, `/:id/refund`. | Exposes student fee online payment endpoints. Students can call `POST /create-order` with `feeId`. | **REMOVE** student payment routes. Restrict billing APIs strictly to Organization Admins and Super Admins. Return `403 Forbidden` if student attempts any SaaS billing operation. |
| `backend/src/controllers/payment.controller.js` | 702 lines handling `createPaymentOrder` (with `feeId`), `verifyPayment` (updates `Fee` to `paid`), and `refundPayment`. | Direct coupling between Razorpay orders and student `Fee` records. Uses `orders.create` instead of `subscriptions.create`. | **SEPARATE DOMAINS.** Remove student fee payment order generation. Implement Razorpay Subscriptions for Organization SaaS billing. |
| `backend/src/controllers/webhook.controller.js` | Handles `payment.captured`, `order.paid`, `payment.failed`, `refund.processed` for student `Payment` and `Fee`. | Lacks handling for Razorpay Subscription events (`subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`). | **EXPAND WEBHOOKS** to handle Razorpay subscription lifecycle events for organizations. Remove automated fee settlement from online webhooks. |
| `backend/src/config/razorpay.js` | Wrapper around Razorpay Node SDK. Implements `createOrder` using `orders.create`. | Uses one-time orders rather than Razorpay Subscriptions (`subscriptions.create`). | **IMPLEMENT** subscription methods: plan creation, subscription creation, subscription cancellation, and subscription signature verification (`payment_id + "|" + subscription_id`). |
| `backend/src/models/Payment.js` | Schema requires `studentId: ObjectId` and `feeId: ObjectId`. | Represents student hostel fee payment, not SaaS billing. | **ISOLATE** from SaaS payments. SaaS payments must reference `organizationId`, `subscriptionId`, `planId`, `invoiceId`. |
| `backend/src/models/Subscription.js` | Basic schema with `status: ['TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED']`. | Missing `razorpaySubscriptionId`, `razorpayPlanId`, `amount`, `currency`, `nextChargeAt`, and full Razorpay subscription state machine. | **UPGRADE** model to support complete Razorpay subscription state machine (`CREATED`, `AUTHENTICATED`, `ACTIVE`, `PENDING`, `HALTED`, `PAUSED`, `CANCELLED`, `COMPLETED`, `EXPIRED`). |
| `backend/src/models/Plan.js` | Schema has `priceMonthly`, `priceYearly`, `limits`. | Lacks durable mappings for `razorpayPlanIdMonthly` and `razorpayPlanIdYearly`. | **ADD** durable mapping fields for Razorpay Plan IDs. |
| `backend/src/models/Fee.js` & `FeePayment.js` | Contain `paymentMode: ['cash', 'upi', 'bank', 'online']`. | Includes `'online'` payment mode. | **DECISION:** Empirical scan of database reveals 0 records currently use `'online'`. Retain `'online'` in enum for read compatibility with legacy/audit systems, but deprecate it in write operations; admin manual UI will only offer `cash`, `upi`, `bank`. |

---

## 3. Database Data Distribution & Invariant Scan

An empirical scan of the MongoDB database was executed on September 14, 2026:
- `Fee.distinct('paymentMode')`: `[ null, 'cash', 'upi' ]` — Count with `'online'`: **0**
- `FeePayment.distinct('paymentMode')`: `[ 'cash', 'upi' ]` — Count with `'online'`: **0**
- Student fee payment history is completely preserved and functional under offline payment modes (`cash`, `upi`, `bank`).
- Removing student online payment routes will have **zero** negative impact on existing historical hostel records.

---

## 4. Evaluation of Overstated Scale, Redis & Disaster Recovery Claims

### 4.1 Scale Test Claims
- **Previous Claim:** Phase G report claimed the platform supports 1,000+ organizations and 100,000+ students based on a seeded test of 5 organizations, 10 hostels, and 250 students.
- **Correction:** This was an architectural projection, NOT an empirically validated load benchmark.
- **Resolution:** The claim is formally retracted and reclassified as:
  > *"Architectural Target: 1,000+ organizations and 100,000+ students. Empirically Validated Baseline (Phase G): 5 organizations, 10 hostels, 250 students, 210 RPS invoice sequence throughput. Scaled validation to be conducted in Phase H."*

### 4.2 Redis & BullMQ Resilience Claims
- **Previous Claim:** When Redis is absent or unreachable, the system silently downgrades to inline asynchronous execution.
- **Correction:** Non-critical background work (e.g. transactional notification emails) may gracefully degrade to inline dispatch, but **critical distributed financial jobs** (subscription renewal, billing reconciliation, invoice processing) cannot run safely in uncoordinated in-process crons across multiple horizontal instances.
- **Resolution:** The application correctly reports dependency status as `DEGRADED_UNCONFIGURED`. Distributed financial crons are explicitly gated on a functional Redis instance; if Redis is unavailable, the system reports degraded status rather than falsely claiming distributed guarantees.

### 4.3 Backup & Disaster Recovery Claims
- **Previous Claim:** "RPO < 5 min, RTO < 60 min measured."
- **Correction:** Continuous Cloud Backup and Point-in-Time Recovery (PITR) are architectural capabilities of MongoDB Atlas M10+ replica sets. Because the development/staging cluster is on a shared Atlas tier without live continuous oplog restoration drills, these figures represent **Target Objectives**, not empirically validated production metrics.
- **Resolution:** Formally separated in documentation:
  - **Target RPO:** `< 5 minutes`
  - **Target RTO:** `< 60 minutes`
  - **Empirical Validation Status:** `NOT YET VALIDATED ON DEDICATED ATLAS TIER` (Scheduled for staging restore drill once M10+ is provisioned).

---

## 5. Architectural Correction Roadmap

1. **Frontend Student Decoupling:**
   - Remove "Pay Online" button and modal from [FeeHistory.tsx](file:///c:/Users/shyam/OneDrive/Desktop/q2-connect-suite/src/pages/student/FeeHistory.tsx).
   - Delete [PaymentModal.tsx](file:///c:/Users/shyam/OneDrive/Desktop/q2-connect-suite/src/components/payment/PaymentModal.tsx).
   - Deprecate student functions in `useRazorpayPayment.ts`.
2. **Backend Route Hardening:**
   - Block students from any payment or billing endpoints (`403 Forbidden`).
   - Remove `/api/payments/create-order` with student `feeId`.
3. **Organization SaaS Billing Architecture:**
   - Upgrade [Subscription.js](file:///c:/Users/shyam/OneDrive/Desktop/q2-connect-suite/backend/src/models/Subscription.js) to model full Razorpay subscription attributes and state machine.
   - Upgrade [Plan.js](file:///c:/Users/shyam/OneDrive/Desktop/q2-connect-suite/backend/src/models/Plan.js) with durable Razorpay plan mappings.
   - Implement `createSubscription`, `verifySubscription`, `cancelSubscription`, and `getSubscriptionStatus` in backend controllers.
   - Implement Razorpay Subscriptions webhook handlers (`subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`).
4. **Organization Billing UI:**
   - Build a clean Organization Billing page (`Billing.tsx`) for Organization Admins displaying Plan Catalog, Current Plan, Billing Cycle, and launching Razorpay Checkout for recurring subscriptions.
5. **Scale Test Plan:**
   - Produce `PHASE_H_SCALE_TEST_PLAN.md` detailing tier scenarios (Tier 1: 100 orgs / 10k students; Tier 2: 500 orgs / 50k students; Tier 3: 1,000 orgs / 100k students).
6. **Final Correction Report:**
   - Compile `PHASE_FG_CORRECTION_REPORT.md` answering the final Definition of Done and Stop Condition.

---
*Audit completed on September 14, 2026. Ready to proceed with execution of corrections.*
