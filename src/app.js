const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const articlesRouter = require('./routes/articles');
const pipelineRouter = require('./routes/pipeline');
const languagesRouter = require('./routes/languages');
const locationsRouter = require('./routes/locations');
const regionsRouter = require('./routes/regions');
const expressCreationRouter = require('./routes/expressCreation');
const adsRouter = require('./routes/ads');
const { publicArticlesPerformance } = require('./middleware/publicArticlesPerformance');

// Load environment variables
dotenv.config();

const app = express();

// Configure trust proxy for reverse proxy deployments (e.g. Nginx, Cloudflare)
if (process.env.TRUST_PROXY !== undefined && process.env.TRUST_PROXY !== '') {
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy === 'true') {
    app.set('trust proxy', true);
  } else if (trustProxy === 'false') {
    app.set('trust proxy', false);
  } else if (!isNaN(Number(trustProxy)) && trustProxy.trim() !== '') {
    app.set('trust proxy', Number(trustProxy));
  } else {
    app.set('trust proxy', trustProxy);
  }
} else {
  app.set('trust proxy', 1);
}

// Attach Helmet HTTP security headers across all routes.
// Configure crossOriginResourcePolicy to 'cross-origin' so public clients can fetch and display media assets.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Safe JSON body parsing
app.use(express.json());

// Dynamic CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow server-to-server, cURL, or local tools requests (no origin header)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = [
      process.env.WEBSITE_URL,
      process.env.DASHBOARD_URL
    ].filter(Boolean);

    if (process.env.ALLOWED_ORIGINS) {
      const extraOrigins = process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
      allowedOrigins.push(...extraOrigins);
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    
    // Check if the request origin matches allowed origins or local development wildcards
    const isAllowed = allowedOrigins.includes(origin) || 
                      (isDevelopment && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')));

    if (isAllowed) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Check if a request targets high-cost AI pipeline or rendering endpoints
const isPipelineRoute = (req) => {
  const url = req.originalUrl || req.url || req.path || '';
  return url.startsWith('/api/pipeline') ||
         url.startsWith('/api/express-creation') ||
         url.startsWith('/api/articles/express-creation');
};

// Rate limit skip condition (allows disabling rate limiting in tests unless explicitly enabled)
const shouldSkipRateLimit = (req) => {
  if (process.env.DISABLE_RATE_LIMITING === 'true') {
    return true;
  }
  if (process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_RATE_LIMIT !== 'true') {
    return true;
  }
  return false;
};

// Public rate limit skip condition (also skips pipeline routes to avoid tier header collisions)
const shouldSkipPublicRateLimit = (req) => {
  if (shouldSkipRateLimit(req)) {
    return true;
  }
  return isPipelineRoute(req);
};

// High-cost AI pipeline rate limiter
const pipelineWindowMs = parseInt(process.env.RATE_LIMIT_PIPELINE_WINDOW_MS, 10);
const pipelineRateLimiter = rateLimit({
  windowMs: !isNaN(pipelineWindowMs) && pipelineWindowMs > 0 ? pipelineWindowMs : 15 * 60 * 1000,
  max: (req, res) => {
    const val = parseInt(process.env.RATE_LIMIT_PIPELINE_MAX, 10);
    return !isNaN(val) ? val : 20;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipRateLimit,
  handler: (req, res, next, options) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many requests for high-cost AI pipeline endpoints, please try again later.'
    });
  }
});

// General public API rate limiter
const publicWindowMs = parseInt(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS, 10);
const publicRateLimiter = rateLimit({
  windowMs: !isNaN(publicWindowMs) && publicWindowMs > 0 ? publicWindowMs : 15 * 60 * 1000,
  max: (req, res) => {
    const val = parseInt(process.env.RATE_LIMIT_PUBLIC_MAX, 10);
    return !isNaN(val) ? val : 100;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipPublicRateLimit,
  handler: (req, res, next, options) => {
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many requests, please try again later.'
    });
  }
});

// Apply rate limiting middleware
app.use('/api/pipeline', pipelineRateLimiter);
app.use('/api/express-creation', pipelineRateLimiter);
app.use('/api/articles/express-creation', pipelineRateLimiter);
app.use('/api', publicRateLimiter);

// Optimize public article reads before the general article router.
// The optimizer preserves the existing API response shapes while pushing filtering,
// search, ordering, and pagination into PostgreSQL and adding CDN-friendly caching headers.
app.use('/api/articles', publicArticlesPerformance);

// Register routes
app.use('/api/articles/express-creation', expressCreationRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/languages', languagesRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/regions', regionsRouter);
app.use('/api/express-creation', expressCreationRouter);
app.use('/api/v1', adsRouter);
app.use('/api', adsRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', env: process.env.NODE_ENV || 'production' });
});

// Catch-all route for unmatched endpoints (404 Not Found)
app.use((req, res, next) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Centralized JSON error handling middleware
app.use((err, req, res, next) => {
  const isCorsError = err.message === 'Not allowed by CORS';
  const isBadRequest = err.status === 400 || err.statusCode === 400 || err instanceof SyntaxError;

  if (!isCorsError && !isBadRequest) {
    console.error('Unhandled error:', err);
  }

  const statusCode = err.status || err.statusCode || (isCorsError ? 400 : 500);

  let errorType = 'Internal Server Error';
  if (isCorsError) {
    errorType = 'CORS Error';
  } else if (isBadRequest) {
    errorType = 'Bad Request';
  }

  const responseMessage = err.message || 'An internal server error occurred';

  res.status(statusCode).json({
    error: errorType,
    message: responseMessage
  });
});

module.exports = app;
