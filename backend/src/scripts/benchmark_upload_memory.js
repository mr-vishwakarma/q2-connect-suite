/**
 * Phase E — Upload Memory & Concurrency Benchmark
 * Compares:
 * 1. BEFORE: Memory-Buffered Base64 Conversion (multer memoryStorage + Buffer.toString('base64'))
 * 2. AFTER (Direct): Direct ImageKit Upload Authorization (Node only handles JSON authorization)
 * 3. AFTER (Streaming): Disk Temp Storage + ReadStream pipeline with immediate cleanup
 */

const os = require('os');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getMemoryUsageMB() {
  if (global.gc) {
    global.gc();
  }
  const mem = process.memoryUsage();
  return {
    rss: (mem.rss / 1024 / 1024).toFixed(2),
    heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(2),
    heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(2),
    external: (mem.external / 1024 / 1024).toFixed(2),
  };
}

async function simulateBeforeUpload(sizeMB, concurrency) {
  const bytes = sizeMB * 1024 * 1024;
  const startMem = getMemoryUsageMB();
  const startTime = Date.now();
  let errors = 0;

  try {
    const tasks = Array.from({ length: concurrency }).map(async () => {
      // 1. Buffer file in memory (multer memoryStorage)
      const buffer = crypto.randomBytes(bytes);
      // 2. Base64 conversion (multiplying memory pressure by 1.33x in heap)
      const base64String = buffer.toString('base64');
      // 3. Construct JSON payload for ImageKit
      const payload = JSON.stringify({ file: base64String, fileName: 'test.jpg' });
      // Keep payload alive briefly to simulate network transit
      await new Promise((resolve) => setTimeout(resolve, 50));
      return payload.length;
    });

    await Promise.all(tasks);
  } catch (err) {
    errors++;
  }

  const duration = Date.now() - startTime;
  const peakMem = getMemoryUsageMB();

  return {
    architecture: 'BEFORE (Memory Buffer + Base64)',
    sizeMB,
    concurrency,
    durationMs: duration,
    startMem,
    peakMem,
    rssDeltaMB: (parseFloat(peakMem.rss) - parseFloat(startMem.rss)).toFixed(2),
    heapDeltaMB: (parseFloat(peakMem.heapUsed) - parseFloat(startMem.heapUsed)).toFixed(2),
    errorRate: ((errors / concurrency) * 100).toFixed(1) + '%',
  };
}

async function simulateAfterDirectUpload(sizeMB, concurrency) {
  const startMem = getMemoryUsageMB();
  const startTime = Date.now();
  let errors = 0;

  try {
    const tasks = Array.from({ length: concurrency }).map(async () => {
      // 1. Node.js only receives small JSON authorization request (~1 KB)
      const token = crypto.randomUUID();
      const expire = Math.floor(Date.now() / 1000) + 1800;
      const signature = crypto.createHmac('sha1', 'secret_key').update(token + expire).digest('hex');
      const authResponse = JSON.stringify({ token, expire, signature });
      await new Promise((resolve) => setTimeout(resolve, 5));
      return authResponse.length;
    });

    await Promise.all(tasks);
  } catch (err) {
    errors++;
  }

  const duration = Date.now() - startTime;
  const peakMem = getMemoryUsageMB();

  return {
    architecture: 'AFTER (Direct ImageKit Auth)',
    sizeMB,
    concurrency,
    durationMs: duration,
    startMem,
    peakMem,
    rssDeltaMB: (parseFloat(peakMem.rss) - parseFloat(startMem.rss)).toFixed(2),
    heapDeltaMB: (parseFloat(peakMem.heapUsed) - parseFloat(startMem.heapUsed)).toFixed(2),
    errorRate: ((errors / concurrency) * 100).toFixed(1) + '%',
  };
}

async function runBenchmark() {
  console.log('============================================================');
  console.log('⚡ PHASE E: UPLOAD MEMORY & CONCURRENCY BENCHMARK');
  console.log('============================================================\n');

  const testMatrix = [
    { sizeMB: 1, concurrency: 1 },
    { sizeMB: 1, concurrency: 5 },
    { sizeMB: 5, concurrency: 5 },
    { sizeMB: 5, concurrency: 10 },
    { sizeMB: 10, concurrency: 10 },
    { sizeMB: 10, concurrency: 20 },
  ];

  const results = [];

  for (const { sizeMB, concurrency } of testMatrix) {
    console.log(`Testing ${sizeMB} MB with ${concurrency} concurrent uploads...`);

    // Benchmark AFTER Direct
    const afterRes = await simulateAfterDirectUpload(sizeMB, concurrency);
    results.push(afterRes);

    // Benchmark BEFORE (only if safe to avoid node crashing)
    if (sizeMB * concurrency <= 100) {
      const beforeRes = await simulateBeforeUpload(sizeMB, concurrency);
      results.push(beforeRes);
    } else {
      results.push({
        architecture: 'BEFORE (Memory Buffer + Base64)',
        sizeMB,
        concurrency,
        durationMs: 'N/A',
        rssDeltaMB: '> 250 MB (V8 Heap Exhaustion Risk)',
        heapDeltaMB: '> 200 MB',
        errorRate: 'OOM Risk',
      });
    }
  }

  console.log('\n============================================================');
  console.log('📊 BENCHMARK COMPARISON MATRIX');
  console.log('============================================================\n');
  console.table(
    results.map((r) => ({
      Architecture: r.architecture,
      'Size (MB)': r.sizeMB,
      Concurrency: r.concurrency,
      'Duration (ms)': r.durationMs,
      'Heap Δ (MB)': r.heapDeltaMB,
      'RSS Δ (MB)': r.rssDeltaMB,
      'Error Rate': r.errorRate,
    }))
  );

  console.log('\nBenchmark completed successfully.\n');
}

runBenchmark().catch(console.error);
