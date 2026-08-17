const express = require('express');
const router = express.Router();
const articleStore = require('../models/articleStore');

// Helper function to validate validation parameters
function validateArticleData(data, isUpdate = false) {
  const errors = [];

  // For POST, title is required. For PUT, if title is provided, it must be valid.
  if (!isUpdate || data.hasOwnProperty('title')) {
    if (typeof data.title !== 'string' || data.title.trim() === '') {
      errors.push('Title is required and must be a non-empty string.');
    }
  }

  // For POST, content is required. For PUT, if content is provided, it must be valid.
  if (!isUpdate || data.hasOwnProperty('content')) {
    if (typeof data.content !== 'string' || data.content.trim() === '') {
      errors.push('Content is required and must be a non-empty string.');
    }
  }

  // Optional string validation if provided
  const optionalFields = ['summary', 'author', 'image', 'status'];
  optionalFields.forEach(field => {
    if (data.hasOwnProperty(field)) {
      if (typeof data[field] !== 'string') {
        errors.push(`${field.charAt(0).toUpperCase() + field.slice(1)} must be a string.`);
      }
    }
  });

  return errors;
}

/**
 * GET /api/articles
 * Returns all articles (sorted newest first)
 */
router.get('/', async (req, res, next) => {
  try {
    const articles = await articleStore.getAllArticles();
    return res.status(200).json(articles);
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

module.exports = router;
