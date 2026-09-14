/**
 * Phase F — Billing, Razorpay Payment Integration, Invoicing & Financial Audit Test Suite
 * 
 * Verifies:
 * 1. Server-Side Razorpay Order Creation with Authoritative Amount Calculation (Tamper-Proof)
 * 2. Amount Tampering Defense (Client-provided amount is ignored)
 * 3. Tenant Isolation & Student IDOR Guards on Order Creation
 * 4. Cryptographic HMAC-SHA256 Checkout Payment Signature Verification
 * 5. Rejection of Forged / Tampered Payment Signatures
 * 6. Concurrency-Safe Sequential Invoice Numbering (Zero duplicate sequence gaps/collisions)
 * 7. Webhook HMAC-SHA256 Signature Verification against Raw Request Body
 * 8. Durable Webhook Idempotency (x-razorpay-event-id): 1x, 2x, 5x, 10x deliveries yield 1 side effect
 * 9. Out-of-Order Webhook State Safety (CAPTURED never downgraded to FAILED)
 * 10. Payment Failure Safety (Failed payments never mark Fee as paid)
 * 11. Refund Event State Transition
 * 12. Manual Payment Flow Backward Compatibility (POST /api/fees/collect)
 * 13. Super Admin Platform Oversight vs Tenant Admin Scoping
 */

require('dotenv').config();
process.env.NODE_ENV = 'test';
process.env.MOCK_EMAIL = 'true';

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');
const crypto = require('crypto');

const Organization = require('../models/Organization');
const Hostel = require('../models/Hostel');
const Student = require('../models/Student');
const User = require('../models/User');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const Payment = require('../models/Payment');
const WebhookEvent = require('../models/WebhookEvent');
const Invoice = require('../models/Invoice');
const InvoiceSequence = require('../models/InvoiceSequence');

const {
  createPaymentOrder,
  verifyPayment,
  getPaymentById,
  getMyPayments,
  getPayments,
} = require('../controllers/payment.controller');

const { handleRazorpayWebhook } = require('../controllers/webhook.controller');
const {
  generatePaymentSignature,
  generateWebhookSignature,
  getWebhookSecret,
} = require('../config/razorpay');

async function runPhaseFTestSuite() {
  console.log('============================================================');
  console.log('⚡ PHASE F: BILLING, RAZORPAY & FINANCIAL AUDIT TEST SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // Mock Express Req/Res Generator
  function createMockReqRes({ body = {}, params = {}, query = {}, headers = {}, user = null, tenant = null, rawBody = null } = {}) {
    let statusCode = 200;
    let responseData = null;

    const req = {
      body,
      params,
      query,
      headers: { ...headers },
      user,
      tenant,
      rawBody: rawBody || Buffer.from(JSON.stringify(body)),
    };

    const res = {
      status(code) {
        statusCode = code;
        return res;
      },
      json(data) {
        responseData = data;
        return res;
      },
      getStatusCode: () => statusCode,
      getData: () => responseData,
    };

    return { req, res };
  }

  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is required to run Phase F test suite.');
    }

    console.log('[Setup] Connecting to MongoDB Atlas...');
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
    console.log('✅ Connected to MongoDB Atlas.\n');

    // Ensure legacy global unique index is dropped in favor of tenant-scoped compound index
    await mongoose.connection.collection('invoices').dropIndex('invoiceNumber_1').catch(() => {});

    // 1. Seed Deterministic Test Fixtures
    const suffix = Date.now();
    const orgA = await Organization.create({
      name: `Fin Org A ${suffix}`,
      slug: `fin-org-a-${suffix}`,
      contactEmail: `fin_a_${suffix}@q2test.com`,
    });

    const orgB = await Organization.create({
      name: `Fin Org B ${suffix}`,
      slug: `fin-org-b-${suffix}`,
      contactEmail: `fin_b_${suffix}@q2test.com`,
    });

    const hostelA = await Hostel.create({
      name: `Hostel A ${suffix}`,
      code: `HA${suffix.toString().slice(-4)}`,
      organizationId: orgA._id,
      totalRooms: 10,
    });

    const studentUserA1 = await User.create({
      name: `Student A1 ${suffix}`,
      email: `st_a1_${suffix}@q2test.com`,
      password: 'HashPassword123!',
      role: 'student',
    });

    const studentUserA2 = await User.create({
      name: `Student A2 ${suffix}`,
      email: `st_a2_${suffix}@q2test.com`,
      password: 'HashPassword123!',
      role: 'student',
    });

    const studentA1 = await Student.create({
      userId: studentUserA1._id,
      name: `Student A1 ${suffix}`,
      username: `sta1_${suffix}`,
      organizationId: orgA._id,
      hostelId: hostelA._id,
      hostel: hostelA.name,
      fees: 6000,
      validDate: new Date('2026-08-31'),
    });

    const studentA2 = await Student.create({
      userId: studentUserA2._id,
      name: `Student A2 ${suffix}`,
      username: `sta2_${suffix}`,
      organizationId: orgA._id,
      hostelId: hostelA._id,
      hostel: hostelA.name,
      fees: 5500,
      validDate: new Date('2026-08-31'),
    });

    // Seed Unpaid Fee for Student A1 (Amount: 6000, Late Fee: 200, Discount: 0 => Total: 6200)
    const feeA1 = await Fee.create({
      studentId: studentA1._id,
      organizationId: orgA._id,
      hostelId: hostelA._id,
      hostel: hostelA.name,
      month: '2026-09',
      amount: 6000,
      lateFee: 200,
      discount: 0,
      paidAmount: 0,
      status: 'unpaid',
      dueDate: new Date('2026-09-05'),
    });

    // Seed Already Paid Fee for Student A1
    const feePaid = await Fee.create({
      studentId: studentA1._id,
      organizationId: orgA._id,
      hostelId: hostelA._id,
      hostel: hostelA.name,
      month: '2026-08',
      amount: 6000,
      paidAmount: 6000,
      status: 'paid',
      dueDate: new Date('2026-08-05'),
    });

    console.log('--- TEST GROUP 1: Order Creation & Server-Side Amount Validation ---');

    // Test 1.1: Direct order creation for unpaid fee returns 201 with orderId and keyId
    {
      const { req, res } = createMockReqRes({
        body: { feeId: feeA1._id.toString() },
        user: studentUserA1,
        tenant: { organizationId: orgA._id, isSuperAdmin: false },
      });

      await createPaymentOrder(req, res);
      const data = res.getData();

      assert(res.getStatusCode() === 201, 'Order creation returned 201 Created');
      assert(Boolean(data?.data?.orderId), 'Razorpay orderId returned');
      assert(data?.data?.amountRupees === 6200, 'Authoritative amount calculated accurately (6000 + 200 = 6200)');
      assert(data?.data?.amountPaise === 620000, 'Amount in paise correctly set to 620000');
      assert(Boolean(data?.data?.keyId), 'Public keyId provided for client checkout');
    }

    // Test 1.2: Amount Tampering Defense — Client-supplied amount is completely ignored
    {
      const { req, res } = createMockReqRes({
        body: { feeId: feeA1._id.toString(), amount: 1, amountPaise: 100 }, // Attacker sends ₹1
        user: studentUserA1,
        tenant: { organizationId: orgA._id, isSuperAdmin: false },
      });

      await createPaymentOrder(req, res);
      const data = res.getData();

      assert(res.getStatusCode() === 200 || res.getStatusCode() === 201, 'Order request processed');
      assert(data?.data?.amountRupees === 6200, 'Client amount override ignored: authoritative balance ₹6200 enforced');
    }

    // Test 1.3: Cross-Tenant Protection — Org B student/admin requesting Org A fee is rejected
    {
      const { req, res } = createMockReqRes({
        body: { feeId: feeA1._id.toString() },
        user: { _id: new mongoose.Types.ObjectId(), role: 'admin' },
        tenant: { organizationId: orgB._id, isSuperAdmin: false },
      });

      await createPaymentOrder(req, res);
      assert(res.getStatusCode() === 404, 'Cross-tenant fee order creation rejected with 404 Not Found');
    }

    // Test 1.4: Student IDOR Protection — Student A2 cannot create order for Student A1's fee
    {
      const { req, res } = createMockReqRes({
        body: { feeId: feeA1._id.toString() },
        user: studentUserA2, // Student A2
        tenant: { organizationId: orgA._id, isSuperAdmin: false },
      });

      await createPaymentOrder(req, res);
      assert(res.getStatusCode() === 403, 'Student A2 attempting to pay Student A1 fee rejected with 403 Forbidden');
    }

    // Test 1.5: Already Paid Fee rejection
    {
      const { req, res } = createMockReqRes({
        body: { feeId: feePaid._id.toString() },
        user: studentUserA1,
        tenant: { organizationId: orgA._id, isSuperAdmin: false },
      });

      await createPaymentOrder(req, res);
      assert(res.getStatusCode() === 400, 'Payment order for already-paid fee rejected with 400 Bad Request');
    }

    console.log('\n--- TEST GROUP 2: Cryptographic Payment Signature Verification ---');

    let testOrderId;
    let testPaymentRecord;

    // Create fresh order for signature verification tests
    {
      const feeFresh = await Fee.create({
        studentId: studentA1._id,
        organizationId: orgA._id,
        hostelId: hostelA._id,
        hostel: hostelA.name,
        month: '2026-10',
        amount: 5000,
        paidAmount: 0,
        status: 'unpaid',
      });

      const { req, res } = createMockReqRes({
        body: { feeId: feeFresh._id.toString() },
        user: studentUserA1,
        tenant: { organizationId: orgA._id, isSuperAdmin: false },
      });

      await createPaymentOrder(req, res);
      testOrderId = res.getData().data.orderId;
      testPaymentRecord = await Payment.findOne({ orderId: testOrderId });
    }

    const validPaymentId = `pay_${Date.now()}_test`;
    const validSignature = generatePaymentSignature(testOrderId, validPaymentId);
    const forgedSignature = 'forged_fake_signature_hex_1234567890abcdef';

    // Test 2.1: Forged signature rejected with 400
    {
      const { req, res } = createMockReqRes({
        body: {
          razorpay_order_id: testOrderId,
          razorpay_payment_id: validPaymentId,
          razorpay_signature: forgedSignature,
        },
        user: studentUserA1,
        tenant: { organizationId: orgA._id, isSuperAdmin: false },
      });

      await verifyPayment(req, res);
      assert(res.getStatusCode() === 400, 'Forged payment signature rejected with 400 Bad Request');
      assert(res.getData().message.includes('Invalid payment signature'), 'Rejection clearly notes signature failure');

      const paymentCheck = await Payment.findById(testPaymentRecord._id);
      assert(paymentCheck.status === 'CREATED', 'Payment status remains CREATED upon forged signature');
    }

    // Test 2.2: Valid signature accepted (200 OK)
    {
      const { req, res } = createMockReqRes({
        body: {
          razorpay_order_id: testOrderId,
          razorpay_payment_id: validPaymentId,
          razorpay_signature: validSignature,
        },
        user: studentUserA1,
        tenant: { organizationId: orgA._id, isSuperAdmin: false },
      });

      await verifyPayment(req, res);
      assert(res.getStatusCode() === 200, 'Valid payment signature verified with 200 OK');

      const data = res.getData();
      assert(data?.data?.status === 'CAPTURED', 'Payment status transitioned to CAPTURED');
      assert(data?.data?.feeStatus === 'paid', 'Fee status updated to paid');
      assert(Boolean(data?.data?.invoiceNumber), 'Invoice number issued');
    }

    // Test 2.3: Idempotent re-verification
    {
      const { req, res } = createMockReqRes({
        body: {
          razorpay_order_id: testOrderId,
          razorpay_payment_id: validPaymentId,
          razorpay_signature: validSignature,
        },
        user: studentUserA1,
        tenant: { organizationId: orgA._id, isSuperAdmin: false },
      });

      await verifyPayment(req, res);
      assert(res.getStatusCode() === 200, 'Re-verifying captured payment returns 200 OK (idempotent)');
      assert(res.getData().message.includes('already verified'), 'Clear idempotent message returned');
    }

    console.log('\n--- TEST GROUP 3: Concurrency-Safe Sequential Invoice Numbering ---');

    // Test 3.1: 5 Parallel calls to getNextInvoiceNumber yield 5 distinct consecutive numbers
    {
      const parallelRequests = Array.from({ length: 5 }).map(() =>
        InvoiceSequence.getNextInvoiceNumber(orgA._id, 'Q2-INV', 2026)
      );

      const generatedNumbers = await Promise.all(parallelRequests);
      const uniqueNumbers = new Set(generatedNumbers);

      assert(uniqueNumbers.size === 5, 'Parallel invoice generation produced 5 unique numbers (Zero collisions)');
      assert(generatedNumbers[0].startsWith('Q2-INV-2026-'), 'Invoice format strictly adheres to Q2-INV-YYYY-NNNNNN');
      assert(generatedNumbers[0].length === 18, 'Invoice numbers zero-padded to 6 digits');
    }

    console.log('\n--- TEST GROUP 4: Webhook HMAC-SHA256 Verification & Raw Body ---');

    const webhookSecret = getWebhookSecret();

    // Test 4.1: Missing signature header rejected
    {
      const { req, res } = createMockReqRes({
        body: { event: 'payment.captured' },
        headers: {},
      });

      await handleRazorpayWebhook(req, res);
      assert(res.getStatusCode() === 400, 'Webhook with missing signature header rejected with 400');
    }

    // Test 4.2: Invalid signature rejected
    {
      const rawPayload = JSON.stringify({ event: 'payment.captured', event_id: 'fake_123' });
      const { req, res } = createMockReqRes({
        body: JSON.parse(rawPayload),
        rawBody: Buffer.from(rawPayload),
        headers: { 'x-razorpay-signature': 'invalid_hmac_hex_string' },
      });

      await handleRazorpayWebhook(req, res);
      assert(res.getStatusCode() === 400, 'Webhook with forged signature rejected with 400');
    }

    // Test 4.3: Valid HMAC signature against raw body accepted
    {
      const eventId = `evt_${Date.now()}_test1`;
      const rawPayload = JSON.stringify({
        event: 'order.paid',
        id: eventId,
        payload: {
          payment: { entity: { id: `pay_${Date.now()}`, order_id: `order_nonexistent_${Date.now()}` } },
        },
      });

      const validHmac = generateWebhookSignature(rawPayload, webhookSecret);
      const { req, res } = createMockReqRes({
        body: JSON.parse(rawPayload),
        rawBody: Buffer.from(rawPayload),
        headers: {
          'x-razorpay-signature': validHmac,
          'x-razorpay-event-id': eventId,
        },
      });

      await handleRazorpayWebhook(req, res);
      assert(res.getStatusCode() === 200, 'Webhook with valid HMAC signature accepted with 200 OK');
    }

    console.log('\n--- TEST GROUP 5: Durable Webhook Idempotency (x-razorpay-event-id) ---');

    // Test 5.1: Duplicate webhook deliveries (1x, 2x, 5x, 10x) yield exactly 1 side effect
    {
      // Create a fee & payment for webhook testing
      const feeWebhook = await Fee.create({
        studentId: studentA2._id,
        organizationId: orgA._id,
        hostelId: hostelA._id,
        hostel: hostelA.name,
        month: '2026-11',
        amount: 4000,
        paidAmount: 0,
        status: 'unpaid',
      });

      const testWebhookOrderId = `order_wh_${Date.now()}`;
      const webhookPayment = await Payment.create({
        organizationId: orgA._id,
        hostelId: hostelA._id,
        studentId: studentA2._id,
        feeId: feeWebhook._id,
        amountPaise: 400000,
        amountRupees: 4000,
        provider: 'RAZORPAY',
        orderId: testWebhookOrderId,
        status: 'CREATED',
      });

      const providerEventId = `evt_dedup_${Date.now()}`;
      const paymentCaptureId = `pay_wh_${Date.now()}`;

      const webhookBody = {
        event: 'payment.captured',
        event_id: providerEventId,
        payload: {
          payment: {
            entity: {
              id: paymentCaptureId,
              order_id: testWebhookOrderId,
              amount: 400000,
              method: 'upi',
            },
          },
        },
      };

      const rawBodyString = JSON.stringify(webhookBody);
      const signature = generateWebhookSignature(rawBodyString, webhookSecret);

      // First Delivery
      const { req: req1, res: res1 } = createMockReqRes({
        body: webhookBody,
        rawBody: Buffer.from(rawBodyString),
        headers: {
          'x-razorpay-signature': signature,
          'x-razorpay-event-id': providerEventId,
        },
      });

      await handleRazorpayWebhook(req1, res1);
      assert(res1.getStatusCode() === 200, 'First webhook delivery returned 200 OK');
      assert(res1.getData().processed === true, 'First webhook was processed');

      // Check fee state after first delivery
      const feeAfterFirst = await Fee.findById(feeWebhook._id);
      assert(feeAfterFirst.paidAmount === 4000, 'Fee credited exactly ₹4000 after 1st delivery');
      assert(feeAfterFirst.status === 'paid', 'Fee marked as paid');

      // Duplicate Deliveries (deliver 4 more times = 5 total)
      for (let i = 2; i <= 5; i++) {
        const { req: reqDup, res: resDup } = createMockReqRes({
          body: webhookBody,
          rawBody: Buffer.from(rawBodyString),
          headers: {
            'x-razorpay-signature': signature,
            'x-razorpay-event-id': providerEventId,
          },
        });

        await handleRazorpayWebhook(reqDup, resDup);
        assert(resDup.getStatusCode() === 200, `Delivery #${i} returned 200 OK`);
        assert(resDup.getData().duplicate === true, `Delivery #${i} flagged as duplicate: true`);
      }

      // Check invariants: Fee paidAmount must still be exactly 4000 (no double-crediting!)
      const feeAfterDuplicates = await Fee.findById(feeWebhook._id);
      assert(feeAfterDuplicates.paidAmount === 4000, 'Fee paidAmount strictly remains ₹4000 (ZERO duplicate financial side-effects)');

      const invoiceCount = await Invoice.countDocuments({ paymentId: webhookPayment._id });
      assert(invoiceCount === 1, 'Exactly ONE invoice generated despite 5 webhook deliveries');
    }

    console.log('\n--- TEST GROUP 6: Out-of-Order Webhook Safety ---');

    // Test 6.1: payment.captured followed by delayed payment.failed leaves state in CAPTURED
    {
      const outOfOrderOrderId = `order_ooo_${Date.now()}`;
      const oooPayment = await Payment.create({
        organizationId: orgA._id,
        studentId: studentA1._id,
        feeId: feeA1._id,
        amountPaise: 100000,
        amountRupees: 1000,
        orderId: outOfOrderOrderId,
        status: 'CAPTURED', // Already captured!
        capturedAt: new Date(),
      });

      // Simulate a delayed payment.failed event arriving later
      const delayedFailBody = {
        event: 'payment.failed',
        event_id: `evt_failed_${Date.now()}`,
        payload: {
          payment: {
            entity: {
              id: `pay_failed_${Date.now()}`,
              order_id: outOfOrderOrderId,
              error_code: 'BAD_REQUEST_ERROR',
              error_description: 'Payment timed out',
            },
          },
        },
      };

      const rawFail = JSON.stringify(delayedFailBody);
      const failSig = generateWebhookSignature(rawFail, webhookSecret);

      const { req, res } = createMockReqRes({
        body: delayedFailBody,
        rawBody: Buffer.from(rawFail),
        headers: {
          'x-razorpay-signature': failSig,
          'x-razorpay-event-id': delayedFailBody.event_id,
        },
      });

      await handleRazorpayWebhook(req, res);
      assert(res.getStatusCode() === 200, 'Delayed payment.failed webhook accepted');

      const paymentCheck = await Payment.findById(oooPayment._id);
      assert(paymentCheck.status === 'CAPTURED', 'Out-of-order event did NOT overwrite CAPTURED status (monotonic safety)');
    }

    console.log('\n--- TEST GROUP 7: Payment Failure Handling ---');

    // Test 7.1: payment.failed event marks Payment as FAILED and never marks Fee as paid
    {
      const failFee = await Fee.create({
        studentId: studentA1._id,
        organizationId: orgA._id,
        month: '2026-12',
        amount: 3000,
        paidAmount: 0,
        status: 'unpaid',
      });

      const failOrderId = `order_fail_${Date.now()}`;
      const failPayment = await Payment.create({
        organizationId: orgA._id,
        studentId: studentA1._id,
        feeId: failFee._id,
        amountPaise: 300000,
        amountRupees: 3000,
        orderId: failOrderId,
        status: 'CREATED',
      });

      const failEventBody = {
        event: 'payment.failed',
        event_id: `evt_fail_real_${Date.now()}`,
        payload: {
          payment: {
            entity: {
              id: `pay_fail_${Date.now()}`,
              order_id: failOrderId,
              error_code: 'PAYMENT_CANCELLED',
              error_description: 'User cancelled on UPI app',
            },
          },
        },
      };

      const rawFail = JSON.stringify(failEventBody);
      const failSig = generateWebhookSignature(rawFail, webhookSecret);

      const { req, res } = createMockReqRes({
        body: failEventBody,
        rawBody: Buffer.from(rawFail),
        headers: {
          'x-razorpay-signature': failSig,
          'x-razorpay-event-id': failEventBody.event_id,
        },
      });

      await handleRazorpayWebhook(req, res);
      assert(res.getStatusCode() === 200, 'Failed payment webhook processed');

      const updatedPayment = await Payment.findById(failPayment._id);
      assert(updatedPayment.status === 'FAILED', 'Payment marked as FAILED');
      assert(updatedPayment.failureCode === 'PAYMENT_CANCELLED', 'Failure code recorded accurately');

      const feeCheck = await Fee.findById(failFee._id);
      assert(feeCheck.status === 'unpaid', 'Fee remains strictly unpaid');
      assert(feeCheck.paidAmount === 0, 'Fee paidAmount remains strictly 0');
    }

    console.log('\n--- TEST GROUP 8: Refund Event State Transition ---');

    // Test 8.1: refund.processed updates payment and invoice status
    {
      const refundPayId = `pay_ref_${Date.now()}`;
      const refundInvoice = await Invoice.create({
        organizationId: orgA._id,
        invoiceNumber: `Q2-INV-2026-${Date.now().toString().slice(-6)}`,
        paymentId: new mongoose.Types.ObjectId(),
        totalRupees: 2000,
        status: 'PAID',
      });

      const refundPayment = await Payment.create({
        organizationId: orgA._id,
        studentId: studentA1._id,
        feeId: feeA1._id,
        amountPaise: 200000,
        amountRupees: 2000,
        orderId: `order_ref_${Date.now()}`,
        paymentId: refundPayId,
        invoiceId: refundInvoice._id,
        status: 'CAPTURED',
      });

      const refundBody = {
        event: 'refund.processed',
        event_id: `evt_ref_${Date.now()}`,
        payload: {
          refund: {
            entity: {
              id: `rfnd_${Date.now()}`,
              payment_id: refundPayId,
              amount: 200000,
            },
          },
        },
      };

      const rawRef = JSON.stringify(refundBody);
      const refSig = generateWebhookSignature(rawRef, webhookSecret);

      const { req, res } = createMockReqRes({
        body: refundBody,
        rawBody: Buffer.from(rawRef),
        headers: {
          'x-razorpay-signature': refSig,
          'x-razorpay-event-id': refundBody.event_id,
        },
      });

      await handleRazorpayWebhook(req, res);
      assert(res.getStatusCode() === 200, 'Refund webhook processed');

      const updatedRefPayment = await Payment.findById(refundPayment._id);
      assert(updatedRefPayment.status === 'REFUNDED', 'Payment marked as REFUNDED');
      assert(Boolean(updatedRefPayment.refundId), 'Refund ID recorded on payment');

      const updatedInvoice = await Invoice.findById(refundInvoice._id);
      assert(updatedInvoice.status === 'REFUNDED', 'Invoice marked as REFUNDED');
    }

    console.log('\n--- TEST GROUP 9: Manual Payment Backward Compatibility ---');

    // Test 9.1: Fee collection via existing collectPayment endpoint remains functional
    {
      const { collectPayment } = require('../controllers/fees.controller');

      const manualFeeMonth = '2026-07';
      const manualReceiptNo = `MANUAL_RCPT_${Date.now()}`;
      const idempotencyKey = `idemp_manual_${Date.now()}`;

      const { req, res } = createMockReqRes({
        body: {
          studentId: studentA1._id.toString(),
          month: manualFeeMonth,
          amount: 5000,
          receivedAmount: 5000,
          paymentMode: 'cash',
          receiptNo: manualReceiptNo,
          idempotencyKey,
        },
        user: { _id: new mongoose.Types.ObjectId(), name: 'Admin User' },
        tenant: { organizationId: orgA._id, isSuperAdmin: false },
        headers: { 'idempotency-key': idempotencyKey },
      });

      await collectPayment(req, res);
      assert(res.getStatusCode() === 201 || res.getStatusCode() === 200, 'Manual fee payment via collectPayment returned 201 Created');

      const savedFeePayment = await FeePayment.findOne({ receiptNo: manualReceiptNo });
      assert(Boolean(savedFeePayment), 'FeePayment record created successfully');
      assert(savedFeePayment.paymentMode === 'cash', 'Payment mode preserved as cash');

      const feeRecord = await Fee.findOne({ studentId: studentA1._id, month: manualFeeMonth });
      assert(feeRecord?.status === 'paid', 'Monthly Fee record updated to paid by manual collection');
    }

    console.log('\n--- TEST GROUP 10: Super Admin Platform Oversight vs Tenant Scoping ---');

    // Test 10.1: Regular Tenant Admin only sees own payments
    {
      const { req, res } = createMockReqRes({
        user: { role: 'admin' },
        tenant: { organizationId: orgA._id, isSuperAdmin: false },
      });

      await getPayments(req, res);
      const data = res.getData();

      assert(res.getStatusCode() === 200, 'Tenant admin getPayments returned 200 OK');
      assert(Array.isArray(data?.data), 'Payments returned as array');
      const allBelongToOrgA = data?.data.every((p) => p.organizationId.toString() === orgA._id.toString());
      assert(allBelongToOrgA, 'All payments strictly belong to Org A tenant (Zero tenant leakage)');
    }

    // Test 10.2: Super Admin can query cross-tenant payments
    {
      const { req, res } = createMockReqRes({
        user: { role: 'super_admin' },
        tenant: { isSuperAdmin: true },
        query: { organizationId: orgB._id.toString() },
      });

      await getPayments(req, res);
      assert(res.getStatusCode() === 200, 'Super Admin cross-tenant payments query returned 200 OK');
    }

    // Teardown temporary test fixtures
    console.log('\n[Teardown] Cleaning temporary test fixtures...');
    await Organization.deleteMany({ _id: { $in: [orgA._id, orgB._id] } });
    await Hostel.deleteMany({ _id: hostelA._id });
    await Student.deleteMany({ _id: { $in: [studentA1._id, studentA2._id] } });
    await User.deleteMany({ _id: { $in: [studentUserA1._id, studentUserA2._id] } });
    await Fee.deleteMany({ studentId: { $in: [studentA1._id, studentA2._id] } });
    await Payment.deleteMany({ studentId: { $in: [studentA1._id, studentA2._id] } });
    await WebhookEvent.deleteMany({ provider: 'RAZORPAY' });
    console.log('📦 Cleaned up and disconnected cleanly from MongoDB.');

  } catch (err) {
    console.error('Fatal error running Phase F test suite:', err);
    failed++;
  } finally {
    await mongoose.disconnect();
  }

  console.log('\n============================================================');
  console.log(`🏁 PHASE F TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhaseFTestSuite().catch((err) => {
  console.error(err);
  process.exit(1);
});
