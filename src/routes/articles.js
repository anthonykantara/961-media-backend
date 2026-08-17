const express = require('express');
const router = express.Router();
const articleStore = require('../models/articleStore');
const { dispatchAll } = require('../workers/dispatchWorker');
const locationStore = require('../models/locationStore');

// Helper function to validate validation parameters
function validateArticleData(data, isUpdate = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Request body must be a valid JSON object.'];
  }

  const errors = [];

  // For POST, title is required. For PUT/PATCH, if title is provided, it must be valid.
  if (!isUpdate || data.hasOwnProperty('title')) {
    if (typeof data.title !== 'string' || data.title.trim() === '') {
      errors.push('Title is required and must be a non-empty string.');
    }
  }

  // For POST, content is required. For PUT/PATCH, if content is provided, it must be valid.
  if (!isUpdate || data.hasOwnProperty('content')) {
    if (typeof data.content !== 'string' || data.content.trim() === '') {
      errors.push('Content is required and must be a non-empty string.');
    }
  }

  // Optional string validation if provided
  const optionalFields = ['summary', 'author', 'category', 'image', 'imageUrl', 'status', 'locationId', 'language', 'date', 'time'];
  optionalFields.forEach(field => {
    if (data.hasOwnProperty(field) && data[field] !== null && data[field] !== undefined) {
      if (typeof data[field] !== 'string') {
        const fieldName = field === 'imageUrl' ? 'ImageUrl' : (field.charAt(0).toUpperCase() + field.slice(1));
        errors.push(`${fieldName} must be a string.`);
      }
    }
  });

  const numericOrStringFields = ['views', 'shares'];
  numericOrStringFields.forEach(field => {
    if (data.hasOwnProperty(field) && data[field] !== null && data[field] !== undefined) {
      if (typeof data[field] !== 'string' && typeof data[field] !== 'number') {
        const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
        errors.push(`${fieldName} must be a string or number.`);
      }
    }
  });

  return errors;
}

/**
 * GET /api/articles/feed
 * Returns public web feed containing published articles with preview card formatting.
 */
router.get('/feed', async (req, res, next) => {
  try {
    let articles = await articleStore.getAllArticles();
    // Default to published status for web feed unless specifically overridden
    const status = req.query.status || 'published';
    if (status.toLowerCase() !== 'all') {
      articles = articles.filter(a => (a.status || '').toLowerCase() === status.toLowerCase());
    }

    const { category, locationId, regionId, language, search, limit, page } = req.query;

    if (category) {
      articles = articles.filter(a => (a.category || '').toLowerCase() === category.toLowerCase());
    }
    if (locationId) {
      articles = articles.filter(a => (a.locationId || '').toLowerCase() === locationId.toLowerCase());
    }
    if (regionId) {
      articles = await locationStore.getArticlesByRegion(articles, regionId);
    }
    if (language) {
      articles = articles.filter(a => (a.language || '').toLowerCase() === language.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      articles = articles.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.content || '').toLowerCase().includes(q) ||
        (a.summary || '').toLowerCase().includes(q) ||
        (a.author || '').toLowerCase().includes(q) ||
        (a.category || '').toLowerCase().includes(q)
      );
    }

    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      const parsedPage = parseInt(page, 10) || 1;
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        const start = (parsedPage - 1) * parsedLimit;
        articles = articles.slice(start, start + parsedLimit);
      }
    }

    const previewCards = articles.map(a => articleStore.formatPreviewCard(a));
    return res.status(200).json(previewCards);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/articles
 * Returns all articles (sorted newest first), with optional filtering/search parameters:
 * ?category=...&status=...&locationId=...&regionId=...&language=...&search=...&limit=...&page=...
 */
router.get('/', async (req, res, next) => {
  try {
    let articles = await articleStore.getAllArticles();
    const { category, status, locationId, regionId, language, search, limit, page } = req.query;

    if (category) {
      articles = articles.filter(a => (a.category || '').toLowerCase() === category.toLowerCase());
    }
    if (status && status.toLowerCase() !== 'all') {
      articles = articles.filter(a => (a.status || '').toLowerCase() === status.toLowerCase());
    }
    if (locationId) {
      articles = articles.filter(a => (a.locationId || '').toLowerCase() === locationId.toLowerCase());
    }
    if (regionId) {
      articles = await locationStore.getArticlesByRegion(articles, regionId);
    }
    if (language) {
      articles = articles.filter(a => (a.language || '').toLowerCase() === language.toLowerCase());
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      articles = articles.filter(a =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.content || '').toLowerCase().includes(q) ||
        (a.summary || '').toLowerCase().includes(q) ||
        (a.author || '').toLowerCase().includes(q) ||
        (a.category || '').toLowerCase().includes(q)
      );
    }

    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      const parsedPage = parseInt(page, 10) || 1;
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        const start = (parsedPage - 1) * parsedLimit;
        articles = articles.slice(start, start + parsedLimit);
      }
    }

    return res.status(200).json(articles);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/articles/:id/preview
 * Returns single article formatted for preview card
 */
router.get('/:id/preview', async (req, res, next) => {
  try {
    const { id } = req.params;
    const article = await articleStore.getArticleById(id);
    if (!article) {
      return res.status(404).json({ error: `Article with ID ${id} not found.` });
    }
    return res.status(200).json(articleStore.formatPreviewCard(article));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/articles/:id
 * Returns a single article by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const article = await articleStore.getArticleById(id);
    if (!article) {
      return res.status(404).json({ error: `Article with ID ${id} not found.` });
    }
    return res.status(200).json(article);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/articles
 * Creates a new article
 */
router.post('/', async (req, res, next) => {
  try {
    const errors = validateArticleData(req.body, false);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: errors });
    }

    const newArticle = await articleStore.createArticle(req.body);
    return res.status(201).json(newArticle);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/articles/:id
 * Updates an existing article
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check if the article exists first
    const existing = await articleStore.getArticleById(id);
    if (!existing) {
      return res.status(404).json({ error: `Article with ID ${id} not found.` });
    }

    // Validate inputs if provided
    const errors = validateArticleData(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: errors });
    }

    const updated = await articleStore.updateArticle(id, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/articles/:id
 * Partial update for an article (e.g., dashboard publishing status changes)
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const existing = await articleStore.getArticleById(id);
    if (!existing) {
      return res.status(404).json({ error: `Article with ID ${id} not found.` });
    }

    const errors = validateArticleData(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: errors });
    }

    const updated = await articleStore.updateArticle(id, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/articles/:id
 * Deletes an article
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await articleStore.deleteArticle(id);
    if (!deleted) {
      return res.status(404).json({ error: `Article with ID ${id} not found.` });
    }
    return res.status(200).json({ message: 'Article successfully deleted.', id });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/articles/:id/dispatch
 * Triggers background social distribution and CMS publishing dispatch workers.
 */
router.post('/:id/dispatch', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await articleStore.getArticleById(id);
    if (!existing) {
      return res.status(404).json({ error: `Article with ID ${id} not found.` });
    }

    const dispatchResults = await dispatchAll(id, req.body || {});
    return res.status(200).json(dispatchResults);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/articles/:id/publish
 * Publishes an article and triggers full background dispatch pipeline.
 */
router.post('/:id/publish', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await articleStore.getArticleById(id);
    if (!existing) {
      return res.status(404).json({ error: `Article with ID ${id} not found.` });
    }

    const dispatchResults = await dispatchAll(id, req.body || {});
    const updatedArticle = await articleStore.getArticleById(id);

    return res.status(200).json({
      article: updatedArticle,
      dispatch: dispatchResults
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
