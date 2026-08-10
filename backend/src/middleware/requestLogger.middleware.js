const requestCounts = {
  total: 0,
  byMethod: {},
  byEndpoint: {},
  errors: 0
};

let startTime = Date.now();

const requestLogger = (req, res, next) => {
  // Count only api requests
  if (!req.originalUrl.startsWith('/api')) {
    return next();
  }

  // Increment total
  requestCounts.total++;

  // Increment method
  const method = req.method;
  requestCounts.byMethod[method] = (requestCounts.byMethod[method] || 0) + 1;

  // Increment endpoint (basic grouping)
  const endpoint = req.originalUrl.split('?')[0]; // strip query params
  requestCounts.byEndpoint[endpoint] = (requestCounts.byEndpoint[endpoint] || 0) + 1;

  // Hook into response finish to track errors
  res.on('finish', () => {
    if (res.statusCode >= 400) {
      requestCounts.errors++;
    }
  });

  next();
};

const getStats = () => {
  return {
    ...requestCounts,
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000)
  };
};

module.exports = { requestLogger, getStats };
