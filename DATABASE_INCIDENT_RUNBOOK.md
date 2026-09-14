# DATABASE INCIDENT RUNBOOK
## MONGODB ATLAS MONITORING, CONNECTION POOLS, SLOW QUERIES & FAILOVER

**Project**: Q2 Group of Hostels / Q2 Connect Suite  
**Scope**: MongoDB Atlas Dedicated Sharded Cluster & Mongoose ORM  
**Audience**: Database Administrators, Backend SREs, and Platform Engineers  

---

## 1. Symptoms & Incident Classification

| Symptom | Probable Cause | Severity | Immediate Action |
| :--- | :--- | :--- | :--- |
| **API requests hanging or timing out (> 10s)** | Connection pool exhaustion or replica set election underway. | SEV-1 | Inspect Atlas cluster health and increase `maxPoolSize` if connections maxed. |
| **p95 API response times spiking (> 1000ms)** | Missing compound index triggering full collection scan (`COLLSCAN`). | SEV-2 | Run `explain("executionStats")` on suspect query and build missing index. |
| **`MongoServerSelectionError` on startup** | Network DNS resolution failure or IP whitelist restriction on Atlas. | SEV-1 | Verify Atlas Network Access whitelist (`0.0.0.0/0` or static Render IPs) & DNS override. |
| **Duplicate key error (`E11000`)** | Concurrency race condition or missing compound uniqueness scoping. | SEV-3 | Verify query uniqueness scope (e.g. `{ organizationId: 1, invoiceNumber: 1 }`). |

---

## 2. Diagnostics & Investigation Commands

### Check Current Atlas Connection & Ping Latency
```bash
# In backend directory:
node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  async function test() {
    const t0 = Date.now();
    await mongoose.connect(process.env.MONGODB_URI);
    const pingRes = await mongoose.connection.db.admin().ping();
    console.log('Atlas Ping:', pingRes, 'Latency:', Date.now() - t0, 'ms');
    process.exit(0);
  }
  test();
"
```

### Identify Running Operations & In-Flight Locks
```bash
node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const ops = await mongoose.connection.db.admin().command({ currentOp: 1, secs_running: { \$gt: 3 } });
    console.log('Operations running > 3s:', JSON.stringify(ops.inprog, null, 2));
    process.exit(0);
  }
  test();
"
```

### Run Execution Plan on Slow Query
```bash
node -e "
  require('dotenv').config();
  const mongoose = require('mongoose');
  const Student = require('./src/models/Student');
  async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    const exp = await Student.find({ organizationId: new mongoose.Types.ObjectId() })
      .sort({ createdAt: -1 })
      .limit(20)
      .explain('executionStats');
    console.log('Execution Time:', exp.executionStats.executionTimeMillis, 'ms');
    console.log('Winning Plan:', exp.queryPlanner.winningPlan);
    process.exit(0);
  }
  test();
"
```

---

## 3. Recovery Procedures

1. **If Connections Are Maxed (Pool Exhaustion)**:
   - Increase `maxPoolSize` in [backend/src/config/db.js](file:///c:/Users/shyam/OneDrive/Desktop/q2-connect-suite/backend/src/config/db.js):
     ```javascript
     maxPoolSize: 100, // Adjusted from 50
     ```
2. **If an Index is Missing in Production**:
   - Create index in background mode to avoid locking writes:
     `await Model.collection.createIndex({ organizationId: 1, createdAt: -1 }, { background: true });`
3. **If Atlas Undergoes Primary Replica Election**:
   - Mongoose handles reconnects automatically via `retryWrites=true&w=majority` in `MONGODB_URI`.
   - Node process does not need restart unless connection pool is stale.
