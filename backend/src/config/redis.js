/**
 * Redis Connection & Lifecycle Manager
 * 
 * Supports:
 * - REDIS_URL or discrete REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_TLS
 * - TLS for hosted Redis providers (rediss:// or REDIS_TLS=true)
 * - Safe reconnect backoff
 * - Bounded timeouts
 * - BullMQ-compliant maxRetriesPerRequest: null
 * - Non-fatal degraded mode when Redis is unconfigured or unreachable
 * - Zero credential leakage in logs
 */

const Redis = require('ioredis');

let client = null;
let subscriberClient = null;
let redisStatus = 'UNCONFIGURED';
let lastError = null;

/**
 * Parses and sanitizes Redis configuration options.
 */
function getRedisOptions() {
  let redisUrl = (process.env.REDIS_URL || '').trim();

  // If using Upstash, force TLS protocol rediss://
  if (redisUrl && redisUrl.includes('upstash.io') && redisUrl.startsWith('redis://')) {
    redisUrl = redisUrl.replace(/^redis:\/\//, 'rediss://');
  }

  const isTls = process.env.REDIS_TLS === 'true' || (redisUrl && (redisUrl.startsWith('rediss://') || redisUrl.includes('upstash.io')));

  const baseOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: true,
    connectTimeout: 8000,
    keepAlive: 10000, // Send TCP keepalive probes every 10s to keep Upstash connection alive
    family: 4, // Force IPv4 to prevent hanging on cloud container IPv6 blackholes
    retryStrategy(times) {
      // Reconnect with bounded backoff (min 200ms, max 3000ms).
      // Never return null so serverless Redis proxy disconnects (Upstash idle resets) auto-heal seamlessly.
      return Math.min(times * 300, 3000);
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET', 'closed'];
      return targetErrors.some(target => (err.message || '').toLowerCase().includes(target.toLowerCase()));
    },
  };

  if (isTls) {
    baseOptions.tls = {
      rejectUnauthorized: process.env.REDIS_TLS_REJECT_UNAUTHORIZED === 'true',
    };
  }

  return { redisUrl, baseOptions };
}

/**
 * Creates an instrumented Redis connection instance.
 * @param {string} role - Descriptive name for logging ('client' or 'subscriber')
 */
function createRedisInstance(role = 'client') {
  const { redisUrl, baseOptions } = getRedisOptions();

  if (!redisUrl && !process.env.REDIS_HOST) {
    redisStatus = 'UNCONFIGURED';
    return null;
  }

  try {
    let instance;
    if (redisUrl) {
      instance = new Redis(redisUrl, baseOptions);
    } else {
      instance = new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        ...baseOptions,
      });
    }

    instance.on('connect', () => {
      // Mark ready as soon as socket connects
      if (redisStatus !== 'READY') {
        redisStatus = 'READY';
      }
      lastError = null;
    });

    instance.on('ready', () => {
      redisStatus = 'READY';
      lastError = null;
      console.log(`[Redis] ${role.toUpperCase()} connection established and ready.`);
    });

    let lastErrorLogTime = 0;
    instance.on('error', (err) => {
      lastError = err.message;
      const msg = String(err?.message || err?.code || '');
      const isQuotaError = msg.includes('limit exceeded') || msg.includes('max requests');
      if (isQuotaError) {
        redisStatus = 'DEGRADED';
        const now = Date.now();
        if (now - lastErrorLogTime > 60000) {
          lastErrorLogTime = now;
          console.warn(`[Redis] ${role.toUpperCase()} provider monthly request quota exhausted (${err.message}). Running in safe DEGRADED mode.`);
        }
        return;
      }
      const isIdleReset = msg.includes('ECONNRESET') || msg.includes('closed');
      if (isIdleReset) {
        const now = Date.now();
        if (now - lastErrorLogTime > 60000) {
          lastErrorLogTime = now;
          console.log(`[Redis] ${role.toUpperCase()} proxy socket idle reset — auto-reconnecting in background.`);
        }
        return;
      }
      redisStatus = 'DEGRADED';
      console.warn(`[Redis] ${role.toUpperCase()} connection warning (${err.code || 'ERR'}): ${err.message}`);
    });

    instance.on('close', () => {
      if (redisStatus !== 'READY') {
        redisStatus = 'DEGRADED';
      }
    });

    instance.on('reconnecting', () => {
      redisStatus = 'RECONNECTING';
    });

    return instance;
  } catch (err) {
    redisStatus = 'DEGRADED';
    lastError = err.message;
    console.warn(`[Redis] Failed to initialize ${role} connection: ${err.message}`);
    return null;
  }
}

/**
 * Retrieves or initializes the singleton Redis command client.
 */
function getRedisClient() {
  if (!client) {
    client = createRedisInstance('client');
  }
  return client;
}

/**
 * Retrieves or initializes a dedicated subscriber connection (for BullMQ events/workers).
 */
function getRedisSubscriber() {
  if (!subscriberClient) {
    subscriberClient = createRedisInstance('subscriber');
  }
  return subscriberClient;
}

/**
 * Creates an isolated Redis connection for BullMQ Workers/Queues.
 */
function createIsolatedRedisConnection(label = 'worker') {
  return createRedisInstance(label);
}

/**
 * Returns current health and diagnostic status of Redis.
 */
function getRedisStatus() {
  const isConfigured = Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
  return {
    status: isConfigured ? redisStatus : 'UNCONFIGURED',
    configured: isConfigured,
    ready: redisStatus === 'READY',
    degraded: redisStatus === 'DEGRADED' || !isConfigured,
    lastError,
  };
}

/**
 * Gracefully terminates all Redis connections.
 */
async function closeRedisConnections() {
  const promises = [];
  if (client) {
    promises.push(
      client.quit().catch(() => {
        client.disconnect();
      })
    );
    client = null;
  }
  if (subscriberClient) {
    promises.push(
      subscriberClient.quit().catch(() => {
        subscriberClient.disconnect();
      })
    );
    subscriberClient = null;
  }
  await Promise.allSettled(promises);
  redisStatus = 'CLOSED';
}

/**
 * Proactively verifies if Redis is functional and can read/write data within 3 seconds.
 * Tests both PING and SET to ensure cloud quotas (e.g. Upstash request limits) are not exhausted.
 * Returns true if operational, false if unreachable or quota-exhausted (triggering safe degraded mode).
 */
async function verifyRedisConnection() {
  const { redisUrl, baseOptions } = getRedisOptions();
  if (!redisUrl && !process.env.REDIS_HOST) {
    return false;
  }

  const probe = redisUrl
    ? new Redis(redisUrl, { ...baseOptions, connectTimeout: 3000, lazyConnect: true })
    : new Redis({
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        ...baseOptions,
        connectTimeout: 3000,
        lazyConnect: true,
      });

  probe.on('error', () => {}); // Silence unhandled error on temporary probe

  try {
    await probe.connect();
    const res = await Promise.race([
      (async () => {
        const pingRes = await probe.ping();
        if (pingRes !== 'PONG') return false;
        // Verify write permission (catches Upstash request limit exceeded / read-only states)
        const healthKey = `__probe_health_${Date.now()}__`;
        await probe.set(healthKey, '1', 'EX', 3);
        await probe.del(healthKey).catch(() => {});
        return true;
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500)),
    ]);
    await probe.quit().catch(() => probe.disconnect());
    return Boolean(res);
  } catch (err) {
    probe.disconnect();
    console.warn(`[Redis] Health probe failed (${err.message}). Safe degraded mode will be activated.`);
    return false;
  }
}

module.exports = {
  getRedisClient,
  getRedisSubscriber,
  createIsolatedRedisConnection,
  getRedisStatus,
  closeRedisConnections,
  getRedisOptions,
  verifyRedisConnection,
};
