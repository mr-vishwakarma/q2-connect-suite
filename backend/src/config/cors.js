/**
 * Q2 Connect Suite — Production CORS Configuration
 * 
 * Supports:
 * - Production custom domain: https://mrvishwakarma.in (and www)
 * - Render backend origin: https://q2-connect-api.onrender.com
 * - Environment-configured origins: FRONTEND_URL, CLIENT_URL, CORS_ORIGIN, SITE_URL (including comma-separated lists)
 * - Local development: http://localhost:*, http://127.0.0.1:*
 * - Staging & Preview: *.vercel.app, *.lovable.app, *.lovableproject.com
 * - Strict credentialed CORS with standard preflight options
 */

function isAllowedOrigin(origin) {
  if (!origin) return true;
  const cleanOrigin = origin.trim().replace(/\/$/, '').toLowerCase();

  // 1. Explicit canonical production domain
  if (
    cleanOrigin === 'https://mrvishwakarma.in' ||
    cleanOrigin === 'https://www.mrvishwakarma.in'
  ) {
    return true;
  }

  // 2. Environment configured origins (supports comma-separated values)
  const envOrigins = [
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    process.env.CORS_ORIGIN,
    process.env.SITE_URL,
  ]
    .filter(Boolean)
    .flatMap((val) => val.split(',').map((v) => v.trim().replace(/\/$/, '').toLowerCase()));

  if (envOrigins.includes(cleanOrigin)) {
    return true;
  }

  // 3. Localhost and loopback development
  if (
    cleanOrigin.startsWith('http://localhost') ||
    cleanOrigin.startsWith('http://127.0.0.1')
  ) {
    return true;
  }

  // 4. Vercel deployments (production legacy & previews)
  if (cleanOrigin.endsWith('.vercel.app')) {
    return true;
  }

  // 5. Render service hostings
  if (cleanOrigin.endsWith('.onrender.com')) {
    return true;
  }

  // 6. Lovable development environments
  if (
    cleanOrigin.endsWith('.lovable.app') ||
    cleanOrigin.endsWith('.lovableproject.com')
  ) {
    return true;
  }

  return false;
}

const corsOptions = {
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, origin || true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-hostel-id',
    'x-organization-id',
    'x-request-id',
    'x-client-version',
  ],
  exposedHeaders: ['x-request-id'],
};

module.exports = {
  isAllowedOrigin,
  corsOptions,
};
