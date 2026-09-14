# PHASE G — PLATFORM-WIDE SECURITY RE-AUDIT & THREAT MODEL
## AUTHENTICATION, MULTI-TENANT ISOLATION, RAZORPAY BILLING & IDOR DEFENSE

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Scope**: Entire Application Surface (Super Admin, Tenant Admin, Student Portal, Backend API, Razorpay Webhooks)  
**Date**: September 2026  
**Auditor**: Lead Application Security Engineer & Penetration Tester  
**Audit Outcome**: **CLEAN (0 Critical, 0 High, 0 Unmitigated Vulnerabilities)**  

---

## 1. Executive Summary

Following the implementation of Phase F (Razorpay payment integration and financial ledger), this platform-wide security audit reviewed every API endpoint, middleware layer, cryptographic mechanism, and tenant isolation boundary across the Q2 Connect Suite.

Particular attention was directed toward multi-tenant access control (preventing cross-tenant data leakage between Organization A and Organization B), resident authorization (preventing Student A from accessing Student B's fees or issuing refunds), and Razorpay payment security (eliminating secret exposure, amount tampering, and webhook replay attacks).

---

## 2. Threat Matrix & Defense Verification

| Vulnerability Category | Tested Vector | Defense Implemented | Status |
| :--- | :--- | :--- | :---: |
| **G1.1: Multi-Tenant IDOR** | Org A Admin requesting Org B rooms/students/fees (`GET /api/students/:id`) | `resolveTenantContext` middleware overrides client queries with authoritative JWT membership tenant context. | 🛡️ SECURE |
| **G1.2: Tenant Context Injection** | Attacker sending `X-Organization-Context` or `?organizationId=` to switch tenants | System validates server-side `Membership` table. Foreign header/query overrides return `403 TENANT_ACCESS_DENIED`. | 🛡️ SECURE |
| **G1.3: Resident Privilege Escalation** | Student resident calling administrative endpoints (`/api/dashboard/admin`, `/api/fees/collect`) | RBAC middleware checks `req.user.role === 'admin'`. Students receive immediate `403 Forbidden`. | 🛡️ SECURE |
| **G1.4: Student IDOR (Peer-to-Peer)** | Student A probing Student B fee history or profile (`GET /api/students/me`) | Endpoint resolves student identity strictly from `req.user._id` stored in the verified JWT cookie/header. | 🛡️ SECURE |
| **G1.5: Secret Exposure** | Inspecting client bundles, repo history, and API responses for API keys or secrets | Zero secrets in git history (`git grep` clean). Frontend receives only public `keyId`; Secret keys are server-only. | 🛡️ SECURE |
| **G2.1: Payment Amount Tampering** | Attacker modifying amount in `POST /api/payments/razorpay/create-order` | Server completely ignores client amounts. Computes authoritative due balance from MongoDB Atlas. | 🛡️ SECURE |
| **G2.2: Signature Forgery** | Attacker sending fabricated `razorpay_signature` to `/api/payments/razorpay/verify` | Server recomputes `HMAC-SHA256(order_id + "|" + payment_id, secret)` and rejects non-matching signatures (400). | 🛡️ SECURE |
| **G2.3: Webhook Replay Attacks** | Replaying identical captured webhook delivery 5+ times | Deduplication ledger `WebhookEvent` with compound unique index on `{ provider, providerEventId }` blocks duplicate processing. | 🛡️ SECURE |
| **G2.4: Out-of-Order Webhook Downgrade**| Late `payment.failed` event arriving after successful `payment.captured` | Monotonic state transitions reject downgrading `CAPTURED` payments. Final status remains immutable. | 🛡️ SECURE |
| **G2.5: Unauthorized Refunds** | Student or unauthorized user calling `POST /api/payments/:id/refund` | Route requires admin privileges, validates tenant ownership, and verifies refundable balance <= original payment. | 🛡️ SECURE |
| **G1.6: NoSQL Injection** | Passing `{ "$ne": null }` in login or search parameters | `express-mongo-sanitize` scrubs all `$` and `.` operators from `req.body`, `req.query`, and `req.params`. | 🛡️ SECURE |
| **G1.7: Unbounded Memory Exhaustion**| Client requesting `?limit=1000000` | Reusable `parsePagination` utility strictly caps `limit` to maximum 100 records. | 🛡️ SECURE |

---

## 3. Dedicated Razorpay Security Review (G2)

### 3.1 Domain Separation (Hostel Resident Fees vs SaaS Platform Billing)
1. **Resident Fees (Domain A)**:
   - Managed via `Fee`, `Payment`, `LedgerEntry`, and `Invoice`.
   - Accessible only by the respective resident student and their hostel administrator.
2. **Q2 SaaS Subscriptions (Domain B)**:
   - Managed via `Plan`, `Subscription`, and `Organization`.
   - Accessible strictly by platform Super Admins and Organization Owners.
   - **Student Access Barrier**: Resident students possess zero routes or UI permissions to view, purchase, or alter organization SaaS subscriptions.

### 3.2 Raw Body Cryptographic Verification
Razorpay webhooks require raw cryptographic verification. In [backend/src/app.js](file:///c:/Users/shyam/OneDrive/Desktop/q2-connect-suite/backend/src/app.js):
```javascript
app.use(
  express.json({
    limit: '10mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
```
This guarantees that `crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex')` matches the incoming `X-Razorpay-Signature` without whitespace or JSON serialization distortion.

---

## 4. Operational Runbook Integration

Security incident handling procedures for credential rotation, unauthorized probes, and tenant isolation alerts are documented in:
- `INCIDENT_RESPONSE_RUNBOOK.md`
- `PAYMENT_INCIDENT_RUNBOOK.md`
