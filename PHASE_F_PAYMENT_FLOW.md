# PHASE F — END-TO-END PAYMENT & FINANCIAL FLOW SPECIFICATION

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Scope**: Architecture, Sequences, State Machines & Concurrency  

---

## 1. End-to-End Payment Sequence Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Student as Resident Student
    participant Browser as React Frontend (Vite)
    participant Modal as PaymentModal / SDK
    participant API as Express API Server
    participant DB as MongoDB Atlas
    participant RZP as Razorpay Gateway
    participant Webhook as Webhook Listener

    Student->>Browser: Views Fee Details & clicks "Pay Now"
    Browser->>Modal: Open PaymentModal (State: CONFIRMING)
    Student->>Modal: Clicks "Proceed to Secure Payment"
    Modal->>API: POST /api/payments/razorpay/create-order { feeId }
    Note over API: Derive authoritative due amount from DB.<br/>Compute paise = (amount + lateFee - discount - paidAmount) * 100
    API->>RZP: orders.create({ amount: paise, currency: 'INR' })
    RZP-->>API: { id: "order_xyz", amount, currency }
    API->>DB: Payment.create({ orderId, amountPaise, status: 'CREATED' })
    API-->>Modal: 201 Created { orderId, amount, keyId, student }
    Modal->>RZP: openRazorpayCheckout(options)
    Note over Modal,RZP: Standard Checkout iframe opens on screen
    Student->>RZP: Completes payment (UPI / Card / Netbanking)
    RZP-->>Modal: handler callback { razorpay_payment_id, razorpay_order_id, razorpay_signature }
    Modal->>API: POST /api/payments/razorpay/verify { ...credentials }
    Note over API: Verify HMAC-SHA256 signature server-side
    API->>DB: Atomically update Payment status -> 'CAPTURED'
    API->>DB: Credit Fee.paidAmount & update status -> 'paid'
    API->>DB: InvoiceSequence.increment & create Invoice
    API->>DB: Append immutable LedgerEntry (CREDIT / ONLINE_PAYMENT)
    API-->>Modal: 200 OK { status: 'CAPTURED', invoiceNumber }
    Modal->>Student: Shows SUCCESS screen with "Download Invoice" button

    par Async Webhook Guarantee
        RZP->>Webhook: POST /api/webhooks/razorpay (event: payment.captured)
        Webhook->>DB: WebhookEvent.create({ providerEventId })
        Note over Webhook: If event already exists in DB,<br/>acknowledge 200 OK and return duplicate: true
        Webhook->>DB: Ensure Payment is marked CAPTURED & Ledger intact
        Webhook-->>RZP: 200 OK { status: 'ok', processed: true }
    end
```

---

## 2. Frontend Payment Modal State Machine

```
              ┌───────────────┐
              │  CONFIRMING   │
              └───────┬───────┘
                      │ (Click "Proceed to Pay")
                      ▼
              ┌───────────────┐
              │CREATING_ORDER │
              └───────┬───────┘
                      │ (Order created)
                      ▼
              ┌───────────────┐
              │ CHECKOUT_OPEN │◀────────┐
              └───────┬───────┘         │
                      │                 │ (Retry)
         ┌────────────┼────────────┐    │
(Success)│            │(Cancelled) │(Error)
         ▼            ▼            ▼    │
   ┌───────────┐┌───────────┐┌──────────┼┐
   │ VERIFYING ││ CANCELLED ││  FAILED  ││
   └─────┬─────┘└───────────┘└──────────┼┘
         │                              │
         ├──────────────────────────────┤
  (OK)   ▼                              │ (Verification Failed)
   ┌───────────┐                        │
   │  SUCCESS  │                        │
   └───────────┘                        │
         ▲                              │
         └──────(Status Polling)────────┘
```

### State Definitions
1. **`CONFIRMING`**: Displays billing summary, fee month, outstanding balance, and breakdown before launching external SDK.
2. **`CREATING_ORDER`**: Disables buttons, requests server-side order generation, and guards against duplicate clicks.
3. **`CHECKOUT_OPEN`**: Razorpay Standard Checkout modal is visible.
4. **`VERIFYING`**: Client received credentials from Razorpay handler; communicates with `/api/payments/razorpay/verify`.
5. **`SUCCESS`**: Payment confirmed, receipt/invoice available for direct download.
6. **`PROCESSING`**: Displayed if verification timed out or network dropped; polls `/api/payments/:id` for up to 10 attempts.
7. **`CANCELLED`**: Resident closed modal before entering payment details; offers one-click retry.
8. **`FAILED`**: Gateway or bank rejected transaction; displays clear error message and enables retry.

---

## 3. Monotonic Payment State Machine

To prevent delayed or out-of-order webhook delivery from downgrading finalized transactions, state transitions enforce monotonic precedence:

```mermaid
stateDiagram-v2
    [*] --> CREATED
    CREATED --> INITIATED
    INITIATED --> AUTHORIZED
    INITIATED --> FAILED
    AUTHORIZED --> CAPTURED
    AUTHORIZED --> FAILED
    CAPTURED --> REFUNDED: Administrative Refund or refund.processed
    FAILED --> [*]
    REFUNDED --> [*]
```

### Transition Invariants
- **`CAPTURED` is terminal for forward progress**: Once a payment is `CAPTURED`, an incoming delayed `payment.failed` event will be acknowledged with 200 OK, but ignored internally without downgrading the payment status.
- **Refund Transitions**: Only `CAPTURED` or `AUTHORIZED` payments can transition to `REFUNDED`.

---

## 4. Concurrency & Race Condition Hardening

### Scenario A: Double-Click / Parallel Pay Requests
- **Frontend Guard**: `isProcessing` lock disables the button immediately upon the first click.
- **Backend Guard**: An atomic database transaction locks the fee. If the fee is already `paid`, order creation returns `400 Bad Request`.

### Scenario B: Parallel Payment Verification
- When concurrent calls hit `/api/payments/razorpay/verify` for the same `orderId`:
  - The first transaction atomically sets `status: 'CAPTURED'` and updates the fee.
  - Subsequent requests detect `status === 'CAPTURED'` and return `200 OK` with `{ message: 'Payment already verified (idempotent)' }`, avoiding duplicate fee crediting or ledger entries.

### Scenario C: Webhook Delivery Race
- If the Razorpay webhook arrives before the frontend verification returns:
  - The webhook verifies HMAC, sets `status: 'CAPTURED'`, updates the fee, and creates the ledger entry.
  - When the frontend verification subsequently runs, it recognizes the payment is already captured, returning the final status safely.
- If duplicate webhook deliveries arrive (e.g. Razorpay sends the same event 5 times):
  - The compound unique index on `{ provider: 1, providerEventId: 1 }` blocks duplicates.
  - Deliveries 2 through 5 return `200 OK` with `{ duplicate: true }` without executing side effects.

---

## 5. Administrative Refund Flow & Ledger Reversal

```mermaid
sequenceDiagram
    actor Admin as Hostel Admin
    participant API as Payment Controller
    participant DB as MongoDB
    participant RZP as Razorpay Gateway

    Admin->>API: POST /api/payments/:id/refund { amountRupees, reason }
    Note over API: Verify Admin Role & Tenant Isolation
    API->>DB: Find Payment & verify status in ['CAPTURED', 'AUTHORIZED']
    Note over API: Check (refundedAmount + requested) <= totalAmount
    API->>RZP: payments.refund(paymentId, { amount: requestedPaise })
    RZP-->>API: { id: "rfnd_abc", status: "processed" }
    API->>DB: Increment Payment.refundedAmountRupees
    API->>DB: Reduce Fee.paidAmount by refundRupees
    API->>DB: Append reversing LedgerEntry (type: 'DEBIT', source: 'REFUND')
    API->>DB: Append AuditLog (action: 'PAYMENT_REFUNDED')
    API-->>Admin: 200 OK { refundId, refundedAmountRupees }
```
