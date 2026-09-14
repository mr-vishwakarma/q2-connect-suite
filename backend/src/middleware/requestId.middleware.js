/**
 * Request Correlation ID & Structured Observability Middleware (Phase G)
 * 
 * Provides:
 * - Correlation ID injection (X-Request-ID) propagating across HTTP, services, and logs
 * - Structured request execution timing
 * - Safe payload logging (zero secret, password, or card data leakage)
 */

const { v4: uuidv4 } = require('uuid');

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'refreshtoken',
  'secret',
  'adminsecret',
  'keysecret',
  'webhooksecret',
  'authorization',
  'cookie',
  'creditcard',
  'cardnumber',
  'cvv',
  'cvc',
]);

/**
 * Sanitizes object keys to prevent accidental logging of sensitive credentials.
 */
function sanitizeLogData(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 3) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map((item) => sanitizeLogData(item, depth + 1));
  }

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitizeLogData(value, depth + 1);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

const requestIdMiddleware = (req, res, next) => {
  // 1. Resolve or generate unique correlation ID
  const incomingId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  const requestId = incomingId && typeof incomingId === 'string' && incomingId.length < 100
    ? incomingId
    : `req_${Date.now().toString(36)}_${uuidv4().slice(0, 8)}`;

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  const startHrTime = process.hrtime();
  const startTime = Date.now();

  // 2. Log structured record upon response finish
  res.on('finish', () => {
    const elapsedHr = process.hrtime(startHrTime);
    const durationMs = (elapsedHr[0] * 1000 + elapsedHr[1] / 1e6).toFixed(2);

    // Only log API routes in non-test environments or on errors
    if (req.originalUrl?.startsWith('/api') && (process.env.NODE_ENV !== 'test' || res.statusCode >= 400)) {
      const logRecord = {
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        path: req.originalUrl?.split('?')[0],
        statusCode: res.statusCode,
        durationMs: Number(durationMs),
        ip: req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress,
        organizationId: req.tenant?.organizationId ? String(req.tenant.organizationId) : undefined,
        userId: req.user?._id ? String(req.user._id) : undefined,
        role: req.user?.role || undefined,
      };

      if (res.statusCode >= 500) {
        console.error(JSON.stringify({ level: 'ERROR', ...logRecord }));
      } else if (res.statusCode >= 400) {
        console.warn(JSON.stringify({ level: 'WARN', ...logRecord }));
      } else if (process.env.NODE_ENV === 'development' || process.env.ENABLE_ACCESS_LOGS === 'true') {
        console.log(JSON.stringify({ level: 'INFO', ...logRecord }));
      }
    }
  });

  next();
};

module.exports = {
  requestIdMiddleware,
  sanitizeLogData,
};
