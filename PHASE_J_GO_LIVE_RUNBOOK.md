# PHASE J GO-LIVE RUNBOOK — DEPLOYMENT, SMOKE VERIFICATION & ROLLBACK EXECUTION

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Phase**: Phase J — Final Production Readiness Gate, Go-Live Validation & Production Handoff  
**Date**: September 14, 2026  
**Target Environments**: Vercel (Frontend), Render (Backend), MongoDB Atlas (Database), Upstash/AWS (Redis)  

---

## 1. Go-Live Ownership Matrix

| Operational Domain | Primary Responsible Role | Escalation / Backup Role | Contact / Channel |
| :--- | :--- | :--- | :--- |
| **Application & API** | Lead Backend Engineer | Systems Architect | `#war-room-deploy` |
| **Database & Backups** | Lead Database Administrator | Infrastructure Engineer | `#war-room-db` |
| **Redis & Queues** | Platform DevOps Engineer | Backend Engineer | `#war-room-infra` |
| **Razorpay & Billing** | Financial Systems Engineer | Product Operations Lead | `#war-room-payments` |
| **Frontend & UX** | Lead Frontend Engineer | Full-Stack Engineer | `#war-room-frontend` |
| **Infrastructure & DNS** | DevOps / SRE Lead | Lead Cloud Architect | `#war-room-infra` |
| **Cybersecurity** | Lead Security Engineer | Compliance Officer | `#security-oncall` |
| **Incident Commander** | VP of Engineering | Head of Product | Escalation Hotline |

---

## 2. Pre-Flight Verification Checklist (T - 2 Hours)

Execute before initiating production DNS cutover:
- [ ] **Automated CI/CD Pipeline**: Verify latest commit on `main` has a green status on GitHub Actions (`.github/workflows/ci.yml`).
- [ ] **Clean Git Status**: Verify `git status` on local deployment machine is clean with zero uncommitted changes.
- [ ] **Secret Scan**: Run repository-wide secret scan to ensure zero credentials exist in source.
- [ ] **External Provisioning**: Confirm Atlas M10+ cluster, Cloud Redis, and ImageKit accounts are live.
- [ ] **Continuous Backups**: Verify Atlas Continuous Cloud Backup (PITR) is active.
- [ ] **Environment Variables**: Verify all mandatory variables from `PHASE_J_PRODUCTION_CHECKLIST.md` are populated in Render and Vercel dashboards.

---

## 3. Production Deployment Sequence (T - 30 Minutes)

### Step 1: Database Baseline Initialization
1. Connect to production MongoDB Atlas cluster:
   ```bash
   mongosh "mongodb+srv://<cluster>.mongodb.net/q2connect_production" --username <admin_user>
   ```
2. Verify replica set status:
   ```javascript
   rs.status().ok
   ```
3. Run initial index synchronization:
   ```bash
   cd backend && node src/scripts/resetDatabase.js --dry-run
   ```

### Step 2: Backend Service Deployment (Render)
1. Deploy latest Git commit to Render Web Service.
2. Monitor build logs in Render dashboard.
3. Validate startup log output:
   - `🚀 Q2 Connect Suite Backend running on port 5000`
   - `✅ MongoDB Connected: <cluster_host>`
   - `✅ Distributed background system initialized`
4. Confirm health probes via cURL:
   ```bash
   curl -I https://api.q2connect.com/api/health/live
   # Expected: HTTP/1.1 200 OK
   curl -s https://api.q2connect.com/api/health/ready | jq .status
   # Expected: "OPERATIONAL"
   ```

### Step 3: Frontend SPA Deployment (Vercel)
1. Trigger production deployment on Vercel from branch `main`.
2. Verify production build output in `< 15 seconds`.
3. Confirm deployment status is `Ready` with custom domain `https://app.q2connect.com`.

---

## 4. Post-Deployment 15-Point Smoke Test Checklist

Execute using a designated test organization (`smoke-test-org`) on live production:

| # | Workflow Step | Test Procedure | Expected Result | Verified |
| :-: | :--- | :--- | :--- | :---: |
| **1** | **Health Probes** | `GET /api/health/live` & `/api/health/ready` | HTTP 200, status OPERATIONAL. | [ ] |
| **2** | **Admin Login** | Log in with test admin credentials | JWT returned, redirected to `/dashboard`. | [ ] |
| **3** | **Role Routing** | Inspect user role on profile | Role matches `admin`, admin UI rendered. | [ ] |
| **4** | **Tenant Routing** | Verify active organization slug in context | Context bound strictly to `smoke-test-org`. | [ ] |
| **5** | **Organization Dashboard** | View student and room metric cards | Total counts match database numbers. | [ ] |
| **6** | **Student Management** | Register a new student (`smoke_student_01`) | HTTP 201, student created under org. | [ ] |
| **7** | **Room Allocation** | Assign student to room `101-A` | Occupancy increments atomically. | [ ] |
| **8** | **Manual Fee Entry** | Record manual cash payment (₹5,000) | Fee status updated to paid, receipt generated. | [ ] |
| **9** | **Attendance Marking** | Mark student present for current date | Attendance record saved. | [ ] |
| **10**| **Notifications** | Trigger a broadcast notification | Notification appears in student portal. | [ ] |
| **11**| **Billing Catalog** | Navigate to `/billing` as admin | Plan cards displayed with authoritative prices. | [ ] |
| **12**| **Subscription Setup**| Click Subscribe on Starter plan | Razorpay modal opens with subscription ID. | [ ] |
| **13**| **Invoice Access** | Navigate to billing history | Sequential invoice `Q2-INV-YYYY-NNNNNN` listed. | [ ] |
| **14**| **Super Admin** | Log in as Super Admin persona | Platform analytics and org list accessible. | [ ] |
| **15**| **Logout** | Click Logout in profile dropdown | Token cleared, redirected to `/login`. | [ ] |

---

## 5. Instant Rollback Procedure

If any Critical Blocker (P0) occurs during smoke testing:

```
ROLLBACK TRIGGERS (AUTOMATIC ABORT):
- Any cross-tenant data leak
- Authentication failure on valid credentials
- Webhook signature failure
- Database connection failure
- High latency spike (P95 > 2,000ms)
```

### Rollback Execution Steps (< 90 Seconds):

1. **Frontend Instant Rollback (Vercel)**:
   - Go to Vercel Dashboard -> Project -> Deployments.
   - Locate the previous stable production deployment.
   - Click `...` -> **Promote to Production**.
   - Rollback completes instantly at CDN edge (< 10 seconds).

2. **Backend Rollback (Render)**:
   - Go to Render Dashboard -> Web Service -> Manual Deploy.
   - Select **Deploy a specific commit**.
   - Input the previous verified commit SHA (`66199e1`).
   - Click **Deploy**. Container switches over in < 60 seconds.

3. **Post-Rollback Triage**:
   - Run `validate_data_integrity.js` against database to confirm zero data corruption:
     ```bash
     cd backend && npm run test:integrity
     ```
   - Notify `#war-room-deploy` that rollback is complete.
