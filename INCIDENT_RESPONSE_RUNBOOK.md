# INCIDENT RESPONSE RUNBOOK
## SEVERITY CLASSIFICATION, TRIAGE & ESCALATION PROCEDURES

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Scope**: Production System Incidents across Web, API, Database, and Payment Gateways  
**Audience**: DevOps, SRE, On-Call Engineers, and Engineering Leadership  

---

## 1. Incident Severity Levels

| Severity | Definition | Target Response (SLA) | Examples |
| :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core service completely unavailable, data corruption, active security breach, payment gateway outage. | **< 15 minutes** | MongoDB Atlas down, duplicate payment processing, cross-tenant data leak. |
| **SEV-2 (Major)** | Major module failure affecting substantial users without workaround; degraded performance. | **< 45 minutes** | Resident checkout failing, email delivery stalled, student registration failing. |
| **SEV-3 (Moderate)** | Minor feature failure with available workaround; background job queue delays. | **< 4 hours** | Scheduled late fee cron delayed, PDF receipt generation slow, report export timeout. |
| **SEV-4 (Low)** | Cosmetic UI bugs, minor logging warning, non-impacting documentation inconsistency. | **< 24 hours** | Typo in email template, non-critical table sorting anomaly. |

---

## 2. General Incident Response Workflow

```
               ┌───────────────────────┐
               │   Incident Detected   │
               │ (Alert / User Report) │
               └───────────┬───────────┘
                           │
                           ▼
               ┌───────────────────────┐
               │ Triage & Classify Sev │
               └───────────┬───────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
   ┌───────────────────┐       ┌───────────────────┐
   │    SEV-1 / SEV-2  │       │    SEV-3 / SEV-4  │
   │ War Room + Status │       │ Standard Ticket   │
   └─────────┬─────────┘       └───────────────────┘
             │
             ▼
   ┌───────────────────┐
   │ Contain & Mitigate│ (Rollback / Failover / Degrade)
   └─────────┬─────────┘
             │
             ▼
   ┌───────────────────┐
   │ Root Cause & Fix  │
   └─────────┬─────────┘
             │
             ▼
   ┌───────────────────┐
   │ Post-Mortem & RCA │
   └───────────────────┘
```

---

## 3. Immediate Diagnostic Commands

### Check Service Health
```bash
# 1. Check Liveness Probe (process up?)
curl -i https://api.q2connect.com/api/health/live

# 2. Check Readiness Probe (dependencies healthy?)
curl -i https://api.q2connect.com/api/health/ready
```

### Check Logs & Correlation Traces
```bash
# Trace a specific failed request using its correlation ID
grep "req_xxxxxx" /var/log/q2/backend.log

# Inspect recent 5xx error events
grep -i '"level":"ERROR"' /var/log/q2/backend.log | tail -n 50
```

### Verify Database Connection & Replica Set
```bash
# In backend directory:
node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 })
    .then(() => { console.log('✅ Atlas OK'); process.exit(0); })
    .catch(e => { console.error('❌ Connection Failed:', e.message); process.exit(1); });
"
```

---

## 4. Mitigation Procedures

1. **If Backend Crashes or Memory Leaks**:
   - Restart Render backend instance or trigger deployment rollback:
     `git revert HEAD && git push origin main`
2. **If Redis is Unreachable**:
   - Q2 backend automatically falls back to **Degraded Mode** (inline email delivery, scheduler graceful bypass).
   - Core API and student checkouts remain operational.
3. **If Cross-Tenant Leak is Suspected**:
   - Immediately terminate active sessions and revoke JWT tokens:
     Set `JWT_SECRET` rotation parameter and restart backend.
