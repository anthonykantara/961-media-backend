const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const articlesRouter = require('./routes/articles');

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

// Register routes
app.use('/api/articles', articlesRouter);

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
  if (err.message !== 'Not allowed by CORS') {
    console.error('Unhandled error:', err);
  }
  
  // Custom status code if defined, otherwise 500
  const statusCode = err.status || (err.message === 'Not allowed by CORS' ? 400 : 500);
  const responseMessage = err.message || 'An internal server error occurred';

  res.status(statusCode).json({
    error: err.message === 'Not allowed by CORS' ? 'CORS Error' : 'Internal Server Error',
    message: responseMessage
  });
});

module.exports = app;
