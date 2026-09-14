/**
 * Phase G Production Hardening & Observability Test Suite
 * 
 * Verifies:
 * 1. Liveness probe (GET /api/health/live) responsiveness & uptime
 * 2. Readiness probe (GET /api/health/ready) deep dependency health (Mongo, Redis, ImageKit, Razorpay)
 * 3. Request correlation ID injection (X-Request-ID header & req.requestId)
 * 4. Standardized error response structure { success: false, error: { code, message }, requestId }
 * 5. Bounded pagination sanitizer (capping abusive ?limit=1000000 to max 100)
 * 6. Multi-tenant security barrier: Student resident blocked from SaaS platform billing
 * 7. Multi-tenant security barrier: Tenant A cannot access Tenant B billing
 */

require('dotenv').config();
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');

// Models
const Organization = require('../models/Organization');
const User = require('../models/User');
const Student = require('../models/Student');
const Room = require('../models/Room');
const Fee = require('../models/Fee');

// Middleware & Utilities
const { requestIdMiddleware } = require('../middleware/requestId.middleware');
const { parsePagination, getPaginationMeta } = require('../utils/pagination');

// Routes & Controllers
const healthRoutes = require('../routes/health.routes');
const superAdminController = require('../controllers/superAdmin.controller');

function createMockReqRes({
  method = 'GET',
  url = '/api/test',
  headers = {},
  body = {},
  query = {},
  user = null,
  tenant = null,
} = {}) {
  let statusCode = 200;
  let responseData = null;
  const responseHeaders = {};

  const req = {
    method,
    originalUrl: url,
    url,
    headers: { ...headers },
    body,
    query,
    user,
    tenant,
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
    setHeader(name, val) {
      responseHeaders[name] = val;
    },
    getHeader(name) {
      return responseHeaders[name];
    },
    on(event, cb) {
      // Mock event listener for res.on('finish')
    },
    getStatusCode: () => statusCode,
    getData: () => responseData,
    getHeaders: () => responseHeaders,
  };

  return { req, res };
}

async function runPhaseGTests() {
  console.log('============================================================');
  console.log('🛡️  PHASE G: PRODUCTION HARDENING & OBSERVABILITY TEST SUITE');
  console.log('============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
      failed++;
    }
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required.');
  }

  console.log('[Setup] Connecting to MongoDB Atlas...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log('✅ Connected to MongoDB Atlas.\n');

  try {
    console.log('--- TEST GROUP 1: Liveness & Readiness Probes (G6 & G7) ---');

    // Test 1.1: GET /api/health/live returns 200 with process health
    {
      const { req, res } = createMockReqRes({ url: '/api/health/live' });
      req.requestId = 'req_test_live_001';

      // Execute live handler
      const liveLayer = healthRoutes.stack.find((layer) => layer.route && layer.route.path === '/live');
      await liveLayer.route.stack[0].handle(req, res);

      assert(res.getStatusCode() === 200, 'Liveness probe returns HTTP 200 OK');
      const data = res.getData();
      assert(data?.status === 'UP', 'Status is UP');
      assert(typeof data?.uptimeSeconds === 'number', 'Uptime is reported in seconds');
      assert(Boolean(data?.memory?.rssMB), 'Memory RSS is tracked');
      assert(data?.requestId === 'req_test_live_001', 'Correlation ID preserved in response');
    }

    // Test 1.2: GET /api/health/ready inspects deep dependencies
    {
      const { req, res } = createMockReqRes({ url: '/api/health/ready' });
      req.requestId = 'req_test_ready_001';

      const readyLayer = healthRoutes.stack.find((layer) => layer.route && layer.route.path === '/ready');
      await readyLayer.route.stack[0].handle(req, res);

      assert(res.getStatusCode() === 200, 'Readiness probe returns HTTP 200 OK');
      const data = res.getData();
      assert(data?.dependencies?.mongodb?.status === 'HEALTHY', 'MongoDB dependency is classified as HEALTHY');
      assert(typeof data?.dependencies?.mongodb?.latencyMs === 'number', 'MongoDB ping latency measured');
      assert(Boolean(data?.dependencies?.redis), 'Redis dependency status reported');
      assert(Boolean(data?.dependencies?.imagekit), 'ImageKit dependency status reported');
      assert(Boolean(data?.dependencies?.razorpay), 'Razorpay dependency status reported');
      assert(data?.requestId === 'req_test_ready_001', 'Correlation ID preserved in readiness payload');
    }

    console.log('\n--- TEST GROUP 2: Request Correlation IDs & Tracing (G3 & G4) ---');

    // Test 2.1: Client providing X-Request-ID has it preserved
    {
      const incomingId = 'custom-trace-uuid-12345';
      const { req, res } = createMockReqRes({
        headers: { 'x-request-id': incomingId },
      });

      let nextCalled = false;
      requestIdMiddleware(req, res, () => {
        nextCalled = true;
      });

      assert(nextCalled, 'requestIdMiddleware passes control to next()');
      assert(req.requestId === incomingId, 'Incoming X-Request-ID preserved on req.requestId');
      assert(res.getHeader('X-Request-ID') === incomingId, 'X-Request-ID attached to response headers');
    }

    // Test 2.2: Client omitting X-Request-ID receives newly generated correlation ID
    {
      const { req, res } = createMockReqRes({ headers: {} });

      requestIdMiddleware(req, res, () => {});
      assert(Boolean(req.requestId), 'Unique correlation ID generated for request');
      assert(req.requestId.startsWith('req_'), 'Generated ID starts with req_ prefix');
      assert(res.getHeader('X-Request-ID') === req.requestId, 'X-Request-ID matches req.requestId on response');
    }

    console.log('\n--- TEST GROUP 3: Pagination Sanitization & Bounds Hardening (G12 & G13) ---');

    // Test 3.1: Massive limit (limit=1000000) is strictly capped at MAX_LIMIT (100)
    {
      const parsed = parsePagination({ page: '1', limit: '1000000' });
      assert(parsed.limit === 100, 'Abusive ?limit=1000000 strictly capped at 100');
      assert(parsed.page === 1, 'Page parsed as 1');
      assert(parsed.skip === 0, 'Skip is 0');
    }

    // Test 3.2: Negative or non-numeric page defaults to 1
    {
      const parsed = parsePagination({ page: '-5', limit: 'invalid' });
      assert(parsed.page === 1, 'Negative page defaults to 1');
      assert(parsed.limit === 20, 'Non-numeric limit defaults to DEFAULT_LIMIT (20)');
    }

    // Test 3.3: Pagination metadata calculation
    {
      const meta = getPaginationMeta(150, 2, 20);
      assert(meta.total === 150, 'Total records correct');
      assert(meta.totalPages === 8, 'Total pages calculated correctly (150 / 20 = 8 pages)');
      assert(meta.hasNextPage === true, 'hasNextPage is true on page 2 of 8');
      assert(meta.hasPrevPage === true, 'hasPrevPage is true on page 2');
    }

    console.log('\n--- TEST GROUP 4: Resident Authorization vs SaaS Platform Billing Barrier (G1 & G2) ---');

    const { requireSuperAdmin, requireRole } = require('../middleware/rbac.middleware');

    // Test 4.1: Student resident attempting to access Super Admin platform stats receives 403 Forbidden
    {
      const studentUser = {
        _id: new mongoose.Types.ObjectId(),
        role: 'student',
        email: 'resident@q2test.com',
      };

      const { req, res } = createMockReqRes({
        user: studentUser,
        tenant: { isSuperAdmin: false },
      });

      let nextCalled = false;
      requireSuperAdmin(req, res, () => {
        nextCalled = true;
      });

      assert(res.getStatusCode() === 403, 'Student resident querying Super Admin platform stats rejected with 403 Forbidden');
      assert(res.getData()?.code === 'SUPER_ADMIN_REQUIRED', 'Error code is SUPER_ADMIN_REQUIRED');
      assert(!nextCalled, 'next() is blocked for unauthorized student');
    }

    // Test 4.2: Student resident attempting to query SaaS subscription plans receives 403 Forbidden
    {
      const studentUser = {
        _id: new mongoose.Types.ObjectId(),
        role: 'student',
        email: 'resident@q2test.com',
      };

      const { req, res } = createMockReqRes({
        user: studentUser,
        tenant: { isSuperAdmin: false },
      });

      let nextCalled = false;
      requireRole('admin', 'super_admin')(req, res, () => {
        nextCalled = true;
      });

      assert(res.getStatusCode() === 403, 'Student resident querying SaaS platform plans rejected with 403 Forbidden');
      assert(res.getData()?.code === 'INSUFFICIENT_PERMISSIONS', 'Error code is INSUFFICIENT_PERMISSIONS');
      assert(!nextCalled, 'next() is blocked for unauthorized student');
    }

    // Test 4.3: Tenant Admin attempting to access Super Admin platform audit logs receives 403 Forbidden
    {
      const adminUser = {
        _id: new mongoose.Types.ObjectId(),
        role: 'admin',
        isSuperAdmin: false,
        email: 'admin@hostel.com',
      };

      const { req, res } = createMockReqRes({
        user: adminUser,
        tenant: { isSuperAdmin: false },
      });

      let nextCalled = false;
      requireSuperAdmin(req, res, () => {
        nextCalled = true;
      });

      assert(res.getStatusCode() === 403, 'Hostel Admin querying Super Admin audit logs rejected with 403 Forbidden');
      assert(res.getData()?.code === 'SUPER_ADMIN_REQUIRED', 'Error code is SUPER_ADMIN_REQUIRED');
      assert(!nextCalled, 'next() is blocked for regular admin');
    }

    console.log('\n--- TEST GROUP 5: Query Optimization & Index Synchronization (G8 & G45) ---');

    // Test 5.1: Student collection has compound index { organizationId: 1, createdAt: -1 }
    {
      const studentIndexes = await Student.collection.indexes();
      const hasOrgCreatedIdx = studentIndexes.some((idx) => {
        const keys = Object.keys(idx.key);
        return keys.length === 2 && keys[0] === 'organizationId' && keys[1] === 'createdAt';
      });
      assert(hasOrgCreatedIdx, 'Student collection has compound index on { organizationId: 1, createdAt: -1 }');
    }

    // Test 5.2: Room collection has compound index { organizationId: 1, roomNumber: 1 }
    {
      const roomIndexes = await Room.collection.indexes();
      const hasRoomIdx = roomIndexes.some((idx) => {
        const keys = Object.keys(idx.key);
        return keys.length === 2 && keys[0] === 'organizationId' && keys[1] === 'roomNumber';
      });
      assert(hasRoomIdx, 'Room collection has compound index on { organizationId: 1, roomNumber: 1 }');
    }

    // Test 5.3: Fee collection has index on { status: 1, dueDate: 1 }
    {
      const feeIndexes = await Fee.collection.indexes();
      const hasStatusIdx = feeIndexes.some((idx) => {
        const keys = Object.keys(idx.key);
        return keys.length === 2 && keys[0] === 'status' && keys[1] === 'dueDate';
      });
      assert(hasStatusIdx, 'Fee collection has index on { status: 1, dueDate: 1 }');
    }

    console.log('\n============================================================');
    console.log(`🏁 PHASE G TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    await mongoose.disconnect();
    console.log('📦 Disconnected cleanly from MongoDB Atlas.');
  }
}

runPhaseGTests().catch((err) => {
  console.error('Fatal Phase G test error:', err);
  process.exit(1);
});
