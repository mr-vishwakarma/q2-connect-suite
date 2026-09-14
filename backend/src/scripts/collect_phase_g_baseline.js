/**
 * Phase G Baseline Measurement & Performance Diagnostic Script
 * 
 * Empirically measures:
 * 1. Database connection & collection stats
 * 2. Index coverage & missing indexes across all 18 primary collections
 * 3. Query execution metrics via live explain("executionStats")
 * 4. Memory footprint (RSS, Heap Total, Heap Used, External)
 * 5. Environment & Secret configuration inspection
 * 6. Health & Degraded dependency audit
 */

require('dotenv').config();
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const mongoose = require('mongoose');

// Models
const Organization = require('../models/Organization');
const Membership = require('../models/Membership');
const User = require('../models/User');
const Student = require('../models/Student');
const Hostel = require('../models/Hostel');
const Room = require('../models/Room');
const Fee = require('../models/Fee');
const FeePayment = require('../models/FeePayment');
const Expense = require('../models/Expense');
const Attendance = require('../models/Attendance');
const MessRequest = require('../models/MessRequest');
const LaundrySlot = require('../models/LaundrySlot');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const Subscription = require('../models/Subscription');
const Payment = require('../models/Payment');
const Invoice = require('../models/Invoice');
const LedgerEntry = require('../models/LedgerEntry');
const WebhookEvent = require('../models/WebhookEvent');
const AuditLog = require('../models/AuditLog');

async function collectBaseline() {
  console.log('============================================================');
  console.log('📊 PHASE G: PLATFORM BASELINE MEASUREMENT & AUDIT HARNESS');
  console.log('============================================================\n');

  const startTime = Date.now();
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    console.error('❌ MONGODB_URI is required.');
    process.exit(1);
  }

  console.log('[1/5] Connecting to MongoDB Atlas...');
  const connStart = Date.now();
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  const connLatency = Date.now() - connStart;
  console.log(`✅ MongoDB Connected in ${connLatency}ms: ${mongoose.connection.host}\n`);

  // [2/5] System & Process Metrics
  const mem = process.memoryUsage();
  console.log('[2/5] Node.js Runtime & Resource Baseline:');
  console.log(`  - Node.js Version: ${process.version}`);
  console.log(`  - Platform: ${process.platform} (${process.arch})`);
  console.log(`  - Memory RSS: ${(mem.rss / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Heap Total: ${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - Heap Used: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  - External / C++ buffers: ${(mem.external / 1024 / 1024).toFixed(2)} MB\n`);

  // [3/5] Collection Counts & Index Verification
  console.log('[3/5] Database Inventory & Index Audit:');
  const collections = [
    { name: 'organizations', model: Organization },
    { name: 'memberships', model: Membership },
    { name: 'users', model: User },
    { name: 'students', model: Student },
    { name: 'hostels', model: Hostel },
    { name: 'rooms', model: Room },
    { name: 'fees', model: Fee },
    { name: 'feepayments', model: FeePayment },
    { name: 'expenses', model: Expense },
    { name: 'attendances', model: Attendance },
    { name: 'messrequests', model: MessRequest },
    { name: 'laundryslots', model: LaundrySlot },
    { name: 'notifications', model: Notification },
    { name: 'settings', model: Settings },
    { name: 'subscriptions', model: Subscription },
    { name: 'payments', model: Payment },
    { name: 'invoices', model: Invoice },
    { name: 'ledgerentries', model: LedgerEntry },
    { name: 'webhookevents', model: WebhookEvent },
    { name: 'auditlogs', model: AuditLog },
  ];

  const inventory = [];
  for (const item of collections) {
    try {
      const count = await item.model.countDocuments();
      const indexes = await item.model.collection.indexes();
      inventory.push({
        collection: item.name,
        count,
        indexCount: indexes.length,
        indexKeys: indexes.map(idx => Object.keys(idx.key).join('+')),
      });
      console.log(`  📁 ${item.name.padEnd(16)} | Docs: ${String(count).padStart(6)} | Indexes: ${indexes.length} (${indexes.map(i => i.name).join(', ')})`);
    } catch (err) {
      console.warn(`  ⚠️ ${item.name}: ${err.message}`);
    }
  }

  // [4/5] Live Query Performance & explain("executionStats")
  console.log('\n[4/5] Query Performance Benchmarks (explain executionStats):');
  
  // Benchmark 1: Tenant-scoped Student listing
  try {
    const org = await Organization.findOne().lean();
    if (org) {
      const studentExp = await Student.find({ organizationId: org._id })
        .sort({ createdAt: -1 })
        .limit(20)
        .explain('executionStats');
      
      const stats = studentExp.executionStats;
      console.log(`  ⚡ [Student.find]: Time: ${stats.executionTimeMillis}ms | Docs Examined: ${stats.totalDocsExamined} | Docs Returned: ${stats.nReturned} | Index: ${studentExp.queryPlanner?.winningPlan?.inputStage?.indexName || 'COLLSCAN'}`);
    }
  } catch (err) {
    console.warn('  ⚠️ Student explain error:', err.message);
  }

  // Benchmark 2: Tenant-scoped Room listing with occupancy
  try {
    const org = await Organization.findOne().lean();
    if (org) {
      const roomExp = await Room.find({ organizationId: org._id })
        .sort({ roomNumber: 1 })
        .limit(20)
        .explain('executionStats');
      
      const stats = roomExp.executionStats;
      console.log(`  ⚡ [Room.find]: Time: ${stats.executionTimeMillis}ms | Docs Examined: ${stats.totalDocsExamined} | Docs Returned: ${stats.nReturned} | Index: ${roomExp.queryPlanner?.winningPlan?.inputStage?.indexName || 'COLLSCAN'}`);
    }
  } catch (err) {
    console.warn('  ⚠️ Room explain error:', err.message);
  }

  // Benchmark 3: Unpaid Fee scan for billing/reminders
  try {
    const feeExp = await Fee.find({ status: 'unpaid' })
      .sort({ dueDate: 1 })
      .limit(50)
      .explain('executionStats');
    
    const stats = feeExp.executionStats;
    console.log(`  ⚡ [Fee.find (status: unpaid)]: Time: ${stats.executionTimeMillis}ms | Docs Examined: ${stats.totalDocsExamined} | Docs Returned: ${stats.nReturned} | Index: ${feeExp.queryPlanner?.winningPlan?.inputStage?.indexName || 'COLLSCAN'}`);
  } catch (err) {
    console.warn('  ⚠️ Fee explain error:', err.message);
  }

  // Benchmark 4: Payment order lookup
  try {
    const payExp = await Payment.find({ status: 'CAPTURED' })
      .sort({ createdAt: -1 })
      .limit(20)
      .explain('executionStats');
    
    const stats = payExp.executionStats;
    console.log(`  ⚡ [Payment.find (status: CAPTURED)]: Time: ${stats.executionTimeMillis}ms | Docs Examined: ${stats.totalDocsExamined} | Docs Returned: ${stats.nReturned} | Index: ${payExp.queryPlanner?.winningPlan?.inputStage?.indexName || 'COLLSCAN'}`);
  } catch (err) {
    console.warn('  ⚠️ Payment explain error:', err.message);
  }

  // [5/5] Dependency Health & Configuration Audit
  console.log('\n[5/5] Subsystem Health & Configuration Audit:');
  const redisConfigured = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
  const imagekitConfigured = Boolean(process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY);
  const razorpayConfigured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

  console.log(`  - MongoDB Atlas: OPERATIONAL (latency: ${connLatency}ms)`);
  console.log(`  - Redis Server: ${redisConfigured ? 'CONFIGURED' : 'UNCONFIGURED (Graceful Degraded Mode Active)'}`);
  console.log(`  - ImageKit SDK: ${imagekitConfigured ? 'CONFIGURED' : 'UNCONFIGURED (Local Temp Storage Active)'}`);
  console.log(`  - Razorpay Gateway: ${razorpayConfigured ? 'CONFIGURED' : 'UNCONFIGURED (Deterministic Test Simulation Active)'}`);

  console.log(`\n✅ Baseline diagnostic completed in ${Date.now() - startTime}ms.`);
  await mongoose.disconnect();
}

collectBaseline().catch((err) => {
  console.error('Fatal baseline measurement error:', err);
  process.exit(1);
});
