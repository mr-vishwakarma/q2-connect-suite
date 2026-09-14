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
  const redisUrl = process.env.REDIS_URL;
  const isTls = process.env.REDIS_TLS === 'true' || (redisUrl && redisUrl.startsWith('rediss://'));

  const baseOptions = {
    maxRetriesPerRequest: null, // Required by BullMQ
    enableReadyCheck: false,
    connectTimeout: 10000,
    retryStrategy(times) {
      if (times > 10) {
        console.warn('[Redis] Maximum connection retries reached. Background jobs operating in DEGRADED mode.');
        redisStatus = 'DEGRADED';
        return null; // Stop retrying after 10 attempts
      }
      const delay = Math.min(times * 200, 3000);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ETIMEDOUT', 'ECONNRESET'];
      return targetErrors.some(target => err.message.includes(target));
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
      redisStatus = 'CONNECTING';
    });

    instance.on('ready', () => {
      redisStatus = 'READY';
      lastError = null;
      console.log(`[Redis] ${role.toUpperCase()} connection established and ready.`);
    });

    instance.on('error', (err) => {
      lastError = err.message;
      redisStatus = 'DEGRADED';
      // Log sanitized error message without credentials
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

module.exports = {
  getRedisClient,
  getRedisSubscriber,
  createIsolatedRedisConnection,
  getRedisStatus,
  closeRedisConnections,
  getRedisOptions,
};
