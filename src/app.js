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
const mediaRouter = require('./routes/media');
const dashboardAdminRouter = require('./routes/dashboardAdmin');
const { publicArticlesPerformance } = require('./middleware/publicArticlesPerformance');

dotenv.config();
const app = express();

if (process.env.TRUST_PROXY !== undefined && process.env.TRUST_PROXY !== '') {
  const trustProxy = process.env.TRUST_PROXY;
  if (trustProxy === 'true') app.set('trust proxy', true);
  else if (trustProxy === 'false') app.set('trust proxy', false);
  else if (!isNaN(Number(trustProxy)) && trustProxy.trim() !== '') app.set('trust proxy', Number(trustProxy));
  else app.set('trust proxy', trustProxy);
} else {
  app.set('trust proxy', 1);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(express.json());

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const allowedOrigins = [process.env.WEBSITE_URL, process.env.DASHBOARD_URL].filter(Boolean);
    if (process.env.ALLOWED_ORIGINS) {
      allowedOrigins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
    }
    const isDevelopment = process.env.NODE_ENV === 'development';
    const isAllowed = allowedOrigins.includes(origin) ||
      (isDevelopment && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')));
    return isAllowed ? callback(null, true) : callback(new Error('Not allowed by CORS'));
  },
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

const isPipelineRoute = (req) => {
  const url = req.originalUrl || req.url || req.path || '';
  return url.startsWith('/api/pipeline') ||
    url.startsWith('/api/express-creation') ||
    url.startsWith('/api/articles/express-creation');
};

const shouldSkipRateLimit = (req) => {
  if (process.env.DISABLE_RATE_LIMITING === 'true') return true;
  if (process.env.NODE_ENV === 'test' && process.env.ENABLE_TEST_RATE_LIMIT !== 'true') return true;
  return false;
};
const shouldSkipPublicRateLimit = (req) => shouldSkipRateLimit(req) || isPipelineRoute(req);

const pipelineWindowMs = parseInt(process.env.RATE_LIMIT_PIPELINE_WINDOW_MS, 10);
const pipelineRateLimiter = rateLimit({
  windowMs: !isNaN(pipelineWindowMs) && pipelineWindowMs > 0 ? pipelineWindowMs : 15 * 60 * 1000,
  max: () => {
    const val = parseInt(process.env.RATE_LIMIT_PIPELINE_MAX, 10);
    return !isNaN(val) ? val : 20;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipRateLimit,
  handler: (req, res) => res.status(429).json({ error: 'Too Many Requests', message: 'Too many requests for high-cost AI pipeline endpoints, please try again later.' })
});

const publicWindowMs = parseInt(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS, 10);
const publicRateLimiter = rateLimit({
  windowMs: !isNaN(publicWindowMs) && publicWindowMs > 0 ? publicWindowMs : 15 * 60 * 1000,
  max: () => {
    const val = parseInt(process.env.RATE_LIMIT_PUBLIC_MAX, 10);
    return !isNaN(val) ? val : 100;
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipPublicRateLimit,
  handler: (req, res) => res.status(429).json({ error: 'Too Many Requests', message: 'Too many requests, please try again later.' })
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/pipeline', pipelineRateLimiter);
app.use('/api/express-creation', pipelineRateLimiter);
app.use('/api/articles/express-creation', pipelineRateLimiter);
app.use('/api', publicRateLimiter);
app.use('/api/articles', publicArticlesPerformance);
app.use('/api/articles/express-creation', expressCreationRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/media', mediaRouter);
app.use('/api/pipeline', pipelineRouter);
app.use('/api/languages', languagesRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/regions', regionsRouter);
app.use('/api/express-creation', expressCreationRouter);
app.use('/api/v1', adsRouter);
app.use('/api', adsRouter);
app.use('/api/admin', dashboardAdminRouter);

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', env: process.env.NODE_ENV || 'production' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res) => {
  const isCorsError = err.message === 'Not allowed by CORS';
  const isBadRequest = err.status === 400 || err.statusCode === 400 || err instanceof SyntaxError;
  if (!isCorsError && !isBadRequest) console.error('Unhandled error:', err);
  const statusCode = err.status || err.statusCode || (isCorsError ? 400 : 500);
  res.status(statusCode).json({ error: isBadRequest ? 'Bad Request' : (isCorsError ? 'CORS Error' : 'Internal Server Error'), message: err.message || 'An unexpected error occurred.' });
});

module.exports = app;
