const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const articlesRouter = require('./routes/articles');
const expressCreationRouter = require('./routes/expressCreation');

// Load environment variables
dotenv.config();

const app = express();

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

// Register routes
app.use('/api/articles/express-creation', expressCreationRouter);
app.use('/api/articles', articlesRouter);
app.use('/api/express-creation', expressCreationRouter);

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
