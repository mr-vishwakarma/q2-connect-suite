# PAYMENT INCIDENT RUNBOOK
## RAZORPAY GATEWAY, SIGNATURE, WEBHOOK & FINANCIAL RECONCILIATION PROCEDURES

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Scope**: Online Checkout, Signature Verification, Webhook Processing, Refunds & Invoicing  
**Audience**: Finance Operations, Payments SRE, and Backend Engineers  

---

## 1. Common Symptoms & Root Cause Matrix

| Symptom | Probable Cause | Severity | Immediate Action |
| :--- | :--- | :--- | :--- |
| **"Invalid payment signature" on Checkout** | Secret mismatch or order ID mismatch between frontend and backend. | SEV-2 | Verify `RAZORPAY_KEY_SECRET` matches Razorpay Dashboard API Keys. |
| **Resident charged, but fee shows "unpaid"** | Client network dropped before verification; webhook delayed or dropped. | SEV-2 | Inspect `Payment` document by `orderId` or run reconciliation resync. |
| **Webhook signature verification fails (400)** | Raw request body corrupted by premature JSON parser, or incorrect `RAZORPAY_WEBHOOK_SECRET`. | SEV-2 | Confirm `req.rawBody` buffer capture and verify webhook secret in Razorpay Dashboard. |
| **Duplicate payments for same fee record** | Student launched multiple browser tabs simultaneously. | SEV-1 | Atomic transaction guard prevents double fee crediting; issue administrative refund on duplicate. |
| **Invoice number generation collision** | Sequence counter contention without atomic operator. | SEV-1 | `InvoiceSequence.findOneAndUpdate` with `$inc` prevents collisions. |

---

## 2. Diagnostic & Investigation Procedures

### Step 1: Locate the Transaction by Provider Order ID
```bash
# In backend directory:
node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  const Payment = require('./src/models/Payment');
  const Fee = require('./src/models/Fee');
  
  async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const p = await Payment.findOne({ orderId: process.argv[1] }).lean();
    console.log('Payment:', p);
    if (p) {
      const f = await Fee.findById(p.feeId).lean();
      console.log('Fee:', f);
    }
    process.exit(0);
  }
  check();
" "order_xxxxxxx"
```

### Step 2: Check Webhook Event Log
Inspect the `WebhookEvent` collection for the incoming Razorpay event ID (`x-razorpay-event-id`):
```bash
node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  const WebhookEvent = require('./src/models/WebhookEvent');
  
  async function check() {
    await mongoose.connect(process.env.MONGODB_URI);
    const ev = await WebhookEvent.findOne({ providerEventId: process.argv[1] }).lean();
    console.log('Webhook Event:', ev);
    process.exit(0);
  }
  check();
" "evt_xxxxxxx"
```

---

## 3. Reconciliation & Recovery Steps

### Scenario A: Payment Captured on Razorpay, but Pending on Q2
1. Log into [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Confirm the payment status is **Captured** and copy the `Payment ID` (`pay_xxxx`).
3. If webhook was missed, trigger manual reconciliation using the admin resync endpoint:
   `POST /api/payments/:id/verify` with the valid `razorpay_payment_id` and signature, or resend the webhook event from Razorpay Dashboard (**Settings -> Webhooks -> Resend**).
4. Verify that:
   - `Fee.status === 'paid'`
   - Exactly one `Invoice` exists
   - Exactly one `LedgerEntry` with `type: 'CREDIT'` and `source: 'ONLINE_PAYMENT'` is written.

### Scenario B: Issuing an Administrative Refund
If an erroneous or duplicate charge occurred:
1. Navigate to **Admin Portal -> Payments (`/admin/payments`)**.
2. Locate the captured payment.
3. Click **"Issue Refund"**.
4. Enter the refund amount in Rupees (supports partial or full refund) and reason.
5. Confirm. The system automatically:
   - Submits refund request to Razorpay.
   - Updates `Payment.refundedAmountRupees`.
   - Decrements `Fee.paidAmount`.
   - Appends an immutable reversing `LedgerEntry` (`type: 'DEBIT'`, `source: 'REFUND'`).
   - Appends a compliance record to `AuditLog`.
