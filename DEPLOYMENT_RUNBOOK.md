# DEPLOYMENT RUNBOOK
## PRODUCTION RELEASE, ZERO-DOWNTIME ROLLOUT & ROLLBACK PROCEDURES

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Stack**: Vercel (Frontend SPA) + Render (Node.js API) + MongoDB Atlas + Redis  
**Audience**: Release Managers, DevOps, and Platform Engineers  

---

## 1. Production Architecture & Infrastructure Topology

```
                  ┌────────────────────────┐
                  │   Cloudflare / DNS     │
                  └───────────┬────────────┘
                              │
             ┌────────────────┴────────────────┐
             ▼                                 ▼
   ┌───────────────────┐             ┌───────────────────┐
   │  Vercel Frontend  │             │   Render Backend  │
   │  (React 18 + Vite)│             │ (Node.js Express) │
   │  Static CDN Edge  │             │  Stateless Nodes  │
   └───────────────────┘             └─────────┬─────────┘
                                               │
                         ┌─────────────────────┴─────────────────────┐
                         ▼                                           ▼
               ┌───────────────────┐                       ┌───────────────────┐
               │   MongoDB Atlas   │                       │    Redis / Upstash │
               │ Dedicated Sharded │                       │ (BullMQ Queues)   │
               └───────────────────┘                       └───────────────────┘
```

---

## 2. Pre-Deployment Checklist

Before pushing code to production (`main` branch):
- [ ] Automated tests green: `npm test` passes 284/284 tests locally.
- [ ] Frontend typecheck passes: `npx tsc --noEmit` returns 0 errors.
- [ ] Frontend production build passes: `npm run build` succeeds cleanly.
- [ ] Git secret scan clean: zero exposed keys or credentials in tracked files.
- [ ] Production environment variables configured on Render and Vercel dashboards.
- [ ] Razorpay webhook registered with production URL: `https://api.q2connect.com/api/webhooks/razorpay`.

---

## 3. Deployment Procedure

### Step 1: Trigger Deployment
- Merging to `main` initiates automated GitHub Actions CI (`.github/workflows/ci.yml`).
- Vercel automatically deploys the frontend build from git commit tag.
- Render automatically executes `npm install` and starts the Node.js service via `npm start`.

### Step 2: Post-Deployment Smoke Verification
Immediately following deployment, run the verification harness:
```bash
# 1. Verify Liveness Probe
curl -i https://api.q2connect.com/api/health/live
# Expected: HTTP 200 { "status": "UP" }

# 2. Verify Readiness Probe & Dependencies
curl -i https://api.q2connect.com/api/health/ready
# Expected: HTTP 200 { "status": "OPERATIONAL", "dependencies": { "mongodb": { "status": "HEALTHY" } } }

# 3. Verify Public Frontend Access
curl -i https://q2connect.com/
# Expected: HTTP 200 with HTML shell
```

---

## 4. Emergency Rollback Procedures

### Frontend Rollback (Vercel)
1. Open **Vercel Dashboard -> Project -> Deployments**.
2. Locate the previous stable deployment.
3. Click the `...` context menu and select **Promote to Production**.
4. Instant rollback completes in < 5 seconds across edge CDN nodes.

### Backend Rollback (Render / Git)
```bash
# Revert the faulty commit on main
git revert HEAD -m 1
git push origin main
```
Render automatically builds and deploys the reverted revision without manual container intervention.
