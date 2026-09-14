# PHASE J PRODUCTION CHECKLIST — EXTERNAL PROVISIONING & ENVIRONMENT MATRIX

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Phase**: Phase J — Final Production Readiness Gate, Go-Live Validation & Production Handoff  
**Date**: September 14, 2026  
**Purpose**: Definitive operational checklist of external cloud services and environment variables required for live production cutover.  

---

## 1. External Cloud Infrastructure Provisioning Checklist

Before directing live tenant traffic to the production cluster, the human operations and DevOps team must complete the following provisioning items:

### 1.1 MongoDB Atlas Dedicated Cluster
- [ ] **Cluster Tier**: Provision MongoDB Atlas M10 or M20 dedicated cluster (Shared M0 is prohibited for live multi-tenant production).
- [ ] **High Availability**: Multi-AZ Replica Set enabled (3 nodes minimum).
- [ ] **Backups**: Continuous Cloud Backups with Point-in-Time Recovery (PITR) enabled.
- [ ] **Network Access**: IP Access List configured to allow Render outbound IPs or `0.0.0.0/0` with strong SCRAM-SHA-256 authentication.
- [ ] **TLS**: TLS v1.3 mandatory on all connections.
- [ ] **Database Users**: Create dedicated production application user with `readWrite` access to `q2connect_production`.

### 1.2 Hosted Cloud Redis (BullMQ Queues & Caching)
- [ ] **Provider**: Provision Upstash Redis or AWS ElastiCache for Redis instance.
- [ ] **Security**: TLS enabled (`rediss://...`) with strong password authentication.
- [ ] **Eviction Policy**: Configured to `noeviction` (required for BullMQ queue state persistence).
- [ ] **Persistence**: AOF (Append Only File) or RDB snapshots enabled.

### 1.3 Razorpay Payment Gateway (SaaS Subscriptions ONLY)
- [ ] **KYC & Business Activation**: Completed business verification on Razorpay Dashboard.
- [ ] **API Keys**: Generate Live API Key ID and Live Key Secret (`rzp_live_...`).
- [ ] **Subscription Plans**: Create monthly and yearly SaaS subscription plans in Razorpay dashboard and map plan IDs to `Plan` records.
- [ ] **Live Webhook Endpoint**: Configure `https://api.q2connect.com/api/webhooks/razorpay` in Razorpay Webhooks dashboard.
- [ ] **Webhook Secret**: Generate and configure high-entropy `RAZORPAY_WEBHOOK_SECRET`.
- [ ] **Subscribed Events**: Select `subscription.authenticated`, `subscription.activated`, `subscription.charged`, `subscription.halted`, `subscription.cancelled`.

### 1.4 ImageKit Media CDN
- [ ] **Production Account**: Set up dedicated production ImageKit account.
- [ ] **Keys**: Retrieve `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, and `IMAGEKIT_URL_ENDPOINT`.
- [ ] **Security**: Restrict private key permissions strictly to server-side token generation.

### 1.5 Production Email Service (SMTP / SES)
- [ ] **Provider**: Set up Amazon SES, SendGrid, or Google Workspace SMTP.
- [ ] **Domain Verification**: Configure SPF, DKIM, and DMARC records on `q2connect.com`.
- [ ] **Sender Address**: Configure `support@q2connect.com` / `billing@q2connect.com`.

### 1.6 Uptime & Health Monitoring
- [ ] **Synthetic Probes**: Configure BetterStack, Datadog, or UptimeRobot to ping:
  - `https://api.q2connect.com/api/health/live` (every 30 seconds)
  - `https://api.q2connect.com/api/health/ready` (every 60 seconds)
- [ ] **Alert Routing**: Route P0 alerts to engineering on-call escalation via PagerDuty/Slack.

---

## 2. Definitive Environment Variable Matrix

The following table defines the contract for all environment variables across backend and frontend environments:

| Variable | Required? | Scope | Environment Usage | Missing Variable Behavior |
| :--- | :---: | :---: | :--- | :--- |
| `NODE_ENV` | Yes | Public | `production`, `staging`, `development`, `test` | Defaults to `development`. |
| `PORT` | Yes | Public | Port for HTTP server (e.g. `5000` or Render `$PORT`) | Defaults to `5000`. |
| `MONGODB_URI` | **MANDATORY** | **SECRET** | MongoDB connection string (Atlas replica set) | **FAILS CLOSED** (Process exits with code 1). |
| `JWT_SECRET` | **MANDATORY** | **SECRET** | HMAC key for signing access tokens (min 32 chars) | Auth token generation fails. |
| `JWT_REFRESH_SECRET`| **MANDATORY** | **SECRET** | HMAC key for signing refresh tokens (min 32 chars) | Refresh token generation fails. |
| `ADMIN_REGISTRATION_SECRET` | **MANDATORY** | **SECRET** | Bootstrap secret for registering first administrator | Admin bootstrap registration disabled (503). |
| `GOOGLE_CLIENT_ID` | Yes | Public | Google OAuth Web Client ID | Google OAuth disabled (503). |
| `REDIS_URL` | Recommended | **SECRET** | `rediss://default:<pw>@<host>:<port>` | Background queues fall back to in-process degraded mode. |
| `RAZORPAY_KEY_ID` | **MANDATORY** | Public/Server | `rzp_live_...` (Production) / `rzp_test_...` (Staging) | Mock billing provider active. |
| `RAZORPAY_KEY_SECRET` | **MANDATORY** | **SECRET** | Razorpay private secret for checkout & refunds | Billing verification fails closed. |
| `RAZORPAY_WEBHOOK_SECRET` | **MANDATORY** | **SECRET** | Shared secret for HMAC webhook signature verification | Webhook verification fails closed (HTTP 400). |
| `RAZORPAY_ENVIRONMENT` | Yes | Public | `live` (Production) / `test` (Staging) | Defaults to `test`. |
| `IMAGEKIT_PUBLIC_KEY` | Yes | Public | Client token generation parameter | Client photo uploads disabled. |
| `IMAGEKIT_PRIVATE_KEY` | Yes | **SECRET** | Server-side signature generation key | Media authorization fails. |
| `IMAGEKIT_URL_ENDPOINT` | Yes | Public | `https://ik.imagekit.io/<id>` | Media delivery fails. |
| `SMTP_HOST` | Yes | Public | SMTP host (e.g. `email-smtp.us-east-1.amazonaws.com`) | Emails fall back to mock logger. |
| `SMTP_PORT` | Yes | Public | SMTP port (`587` or `465`) | Defaults to `587`. |
| `SMTP_USER` | Yes | **SECRET** | SMTP auth username | Email dispatch disabled. |
| `SMTP_PASS` | Yes | **SECRET** | SMTP auth password | Email dispatch disabled. |
| `EMAIL_FROM` | Yes | Public | `Q2 Connect Suite <noreply@q2connect.com>` | Defaults to generic sender. |
| `FRONTEND_URL` | Yes | Public | `https://app.q2connect.com` (CORS whitelist) | CORS rejects non-whitelisted origins. |

---

## 3. Current Configuration State in Repository

| Resource / Credential | Development / Staging Status | Production Status | Action Required by Human Operator |
| :--- | :---: | :---: | :--- |
| **MongoDB Atlas** | Configured (M0 Staging Cluster) | 🟡 Not Configured | Provision M10+ dedicated cluster in Atlas console. |
| **Cloud Redis** | Degraded Fallback Operational | 🟡 Not Configured | Provision Upstash or AWS ElastiCache instance. |
| **Razorpay Gateway** | Test Keys / Simulated Mode | 🟡 Not Configured | Generate Live API keys & Webhook secret in Razorpay. |
| **ImageKit CDN** | Staging Keys Configured | 🟡 Not Configured | Input production ImageKit keys into Render. |
| **SMTP Provider** | Staging / Mock Active | 🟡 Not Configured | Configure AWS SES or SendGrid credentials. |
| **Vercel Frontend** | Built & Verified Locally | 🟡 Not Configured | Link GitHub repo to Vercel and attach domain. |
| **Render Backend** | Verified on Local / Staging | 🟡 Not Configured | Create Render Web Service and paste production env vars. |
