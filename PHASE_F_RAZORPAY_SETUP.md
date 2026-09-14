# PHASE F — RAZORPAY ENVIRONMENT SETUP & CONFIGURATION GUIDE

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Scope**: Razorpay Merchant Account, Standard Checkout, Webhooks & Settlement  

---

## 1. Overview

This document provides step-by-step instructions for configuring Razorpay for the Q2 Connect Suite in both Test and Live environments.

---

## 2. Environment Configuration

Add the following environment variables to your backend `.env` (or Render/Heroku/AWS SSM parameter store):

```bash
# ============================================================
# RAZORPAY PAYMENT GATEWAY CONFIGURATION
# ============================================================
# Razorpay API Credentials (from Dashboard -> Settings -> API Keys)
RAZORPAY_KEY_ID=rzp_test_YourTestKeyIdHere
RAZORPAY_KEY_SECRET=YourTestKeySecretHere

# Razorpay Webhook Secret (from Dashboard -> Settings -> Webhooks)
RAZORPAY_WEBHOOK_SECRET=YourWebhookSecretHere

# Operational Mode ('test' or 'live')
RAZORPAY_ENVIRONMENT=test

# Optional account ID if operating linked accounts (leave blank for standard gateway)
# RAZORPAY_ACCOUNT_ID=
```

> **CRITICAL SECURITY RULES**:
> 1. Never commit `RAZORPAY_KEY_SECRET` or `RAZORPAY_WEBHOOK_SECRET` to version control.
> 2. The frontend Vite app receives only `keyId` from the backend via the authenticated `POST /api/payments/razorpay/create-order` response. Never expose the Secret key to Vite or React bundles.

---

## 3. Razorpay Dashboard Setup (Step-by-Step)

### Step 1: Generate API Keys
1. Log in to your [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Ensure you are in **Test Mode** (toggle in the top-right header).
3. Navigate to **Settings** (left sidebar) -> **API Keys**.
4. Click **Generate Test Key**.
5. Copy the **Key ID** and **Key Secret** immediately into your `.env` file (`RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`).

### Step 2: Register Webhook Endpoint
1. In the Razorpay Dashboard, navigate to **Settings** -> **Webhooks**.
2. Click **Add New Webhook**.
3. **Webhook URL**:
   - For local development with tunnel: `https://<your-ngrok-or-localtunnel-subdomain>/api/webhooks/razorpay`
   - For staging/production: `https://api.q2connect.com/api/webhooks/razorpay`
4. **Secret**: Enter a strong cryptographic string (e.g., `openssl rand -hex 24`). Save this string as `RAZORPAY_WEBHOOK_SECRET` in your `.env`.
5. **Alert Email**: Enter your DevOps/Finance alert email.
6. **Active Events**: Select the following mandatory payment events:
   - `payment.authorized`
   - `payment.captured`
   - `payment.failed`
   - `refund.created`
   - `refund.processed`
   - `order.paid`
7. Click **Create Webhook**.

### Step 3: Configure Checkout Branding
1. Navigate to **Settings** -> **Checkout Settings**.
2. Upload the **Q2 Connect Suite** logo (recommended size: 256x256 px, transparent PNG).
3. Set Brand Color to `#0d9488` (Teal 600) or `#4f46e5` (Indigo 600) to match Q2 UI themes.

---

## 4. Testing Procedure (Test Mode)

### Test Cards & Payment Methods
When testing in **Test Mode** with `rzp_test_...` credentials, use official Razorpay test instruments:

| Payment Method | Test Identifier / Number | Expiry / CVV / OTP | Expected Result |
| :--- | :--- | :--- | :--- |
| **Domestic Card (Success)** | `4111 1111 1111 1111` | Any future date / `123` / OTP `1234` | Immediate Capture |
| **Domestic Card (Failure)** | `4000 0000 0000 0002` | Any future date / `123` | Emits `payment.failed` |
| **UPI (Success)** | `success@razorpay` | Approves instantly in simulator | Immediate Capture |
| **UPI (Failure)** | `failure@razorpay` | Rejection simulator | Emits `payment.failed` |
| **Netbanking** | Any listed bank (e.g. HDFC, SBI) | Click "Success" on simulation screen | Immediate Capture |

---

## 5. Production Rollout Checklist

Before toggling `RAZORPAY_ENVIRONMENT=live`:
- [ ] Business entity KYC approved by Razorpay operations.
- [ ] Bank account verified for automated daily T+2 settlements.
- [ ] Production API keys generated under **Live Mode** tab.
- [ ] Production Webhook URL registered with `https://` endpoint and production secret configured.
- [ ] Host domain whitelisted under Allowed Origins.
- [ ] Production database has compound unique index on `{ organizationId: 1, invoiceNumber: 1 }`.
- [ ] Verify `npm run test:payments` passes 72/72 tests on target staging environment.
