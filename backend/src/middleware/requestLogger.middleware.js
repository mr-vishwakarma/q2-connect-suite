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

  // Normalize endpoint to prevent unbounded memory leak from raw IDs
  let endpoint = req.originalUrl.split('?')[0];
  endpoint = endpoint
    .replace(/\/[0-9a-fA-F]{24}(\/|$)/g, '/:id$1')
    .replace(/\/[0-9a-fA-F-]{36}(\/|$)/g, '/:id$1')
    .replace(/\/\d+(\/|$)/g, '/:id$1');

  // Hard cap to ensure bounded memory usage
  if (Object.keys(requestCounts.byEndpoint).length < 500 || requestCounts.byEndpoint[endpoint]) {
    requestCounts.byEndpoint[endpoint] = (requestCounts.byEndpoint[endpoint] || 0) + 1;
  } else {
    requestCounts.byEndpoint['/api/other'] = (requestCounts.byEndpoint['/api/other'] || 0) + 1;
  }

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
