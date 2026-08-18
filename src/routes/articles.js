const express = require('express');
const router = express.Router();
const articleStore = require('../models/articleStore');
const { dispatchAll } = require('../workers/dispatchWorker');
const { cmsDispatch } = require('../workers/cmsDispatch');
const locationStore = require('../models/locationStore');
const queueStore = require('../models/queueStore');
const { triggerImmediateProcessing } = require('../workers/queueProcessor');

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
  const optionalFields = ['summary', 'author', 'category', 'image', 'imageUrl', 'status', 'locationId', 'language', 'date', 'time', 'permalink', 'slug'];
  optionalFields.forEach(field => {
    if (data.hasOwnProperty(field) && data[field] !== null && data[field] !== undefined) {
      if (typeof data[field] !== 'string') {
        const fieldName = field === 'imageUrl' ? 'ImageUrl' : (field.charAt(0).toUpperCase() + field.slice(1));
        errors.push(`${fieldName} must be a string.`);
      }
    }
  });

  const arrayOrStringFields = ['redirects', 'previousPermalinks'];
  arrayOrStringFields.forEach(field => {
    if (data.hasOwnProperty(field) && data[field] !== null && data[field] !== undefined) {
      if (!Array.isArray(data[field]) && typeof data[field] !== 'string') {
        const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
        errors.push(`${fieldName} must be an array or a string.`);
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

    const { category, locationId, regionId, language, search, permalink, slug, limit, page } = req.query;

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
    if (permalink) {
      const pLower = permalink.toLowerCase();
      articles = articles.filter(a =>
        (a.permalink || '').toLowerCase() === pLower ||
        (a.slug || '').toLowerCase() === pLower ||
        (Array.isArray(a.redirects) && a.redirects.some(r => r.toLowerCase() === pLower)) ||
        (Array.isArray(a.previousPermalinks) && a.previousPermalinks.some(r => r.toLowerCase() === pLower))
      );
    }
    if (slug) {
      const sLower = slug.toLowerCase();
      articles = articles.filter(a =>
        (a.slug || '').toLowerCase() === sLower ||
        (a.permalink || '').toLowerCase() === sLower ||
        (Array.isArray(a.redirects) && a.redirects.some(r => r.toLowerCase() === sLower)) ||
        (Array.isArray(a.previousPermalinks) && a.previousPermalinks.some(r => r.toLowerCase() === sLower))
      );
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
 * GET /api/articles/redirects
 * Returns all active article permalink auto-redirects map.
 */
router.get('/redirects', async (req, res, next) => {
  try {
    const redirects = await articleStore.getAllRedirects();
    return res.status(200).json(redirects);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/articles/redirects/:slug
 * Resolves redirect target for a given old slug or permalink.
 */
router.get('/redirects/:slug', async (req, res, next) => {
  try {
    const { slug } = req.params;
    const result = await articleStore.findArticleWithRedirect(slug);
    if (!result || !result.isRedirect) {
      return res.status(404).json({ error: `No redirect found for permalink '${slug}'.` });
    }
    return res.status(200).json({
      oldPermalink: slug,
      targetPermalink: result.targetPermalink,
      statusCode: 301,
      articleId: result.article.id
    });
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
    const { category, status, locationId, regionId, language, search, permalink, slug, limit, page } = req.query;

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
    if (permalink) {
      const pLower = permalink.toLowerCase();
      articles = articles.filter(a =>
        (a.permalink || '').toLowerCase() === pLower ||
        (a.slug || '').toLowerCase() === pLower ||
        (Array.isArray(a.redirects) && a.redirects.some(r => r.toLowerCase() === pLower)) ||
        (Array.isArray(a.previousPermalinks) && a.previousPermalinks.some(r => r.toLowerCase() === pLower))
      );
    }
    if (slug) {
      const sLower = slug.toLowerCase();
      articles = articles.filter(a =>
        (a.slug || '').toLowerCase() === sLower ||
        (a.permalink || '').toLowerCase() === sLower ||
        (Array.isArray(a.redirects) && a.redirects.some(r => r.toLowerCase() === sLower)) ||
        (Array.isArray(a.previousPermalinks) && a.previousPermalinks.some(r => r.toLowerCase() === sLower))
      );
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
 * Returns single article formatted for preview card.
 * Performs SEO 301 Moved Permanently redirect if accessed via an old/changed permalink.
 */
router.get('/:id/preview', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await articleStore.findArticleWithRedirect(id);
    if (!result) {
      return res.status(404).json({ error: `Article with ID ${id} not found.` });
    }

    if (result.isRedirect) {
      if (req.query.noRedirect === 'true') {
        return res.status(200).json({
          redirect: true,
          statusCode: 301,
          targetPermalink: result.targetPermalink,
          card: articleStore.formatPreviewCard(result.article)
        });
      }
      res.set('X-Redirect-Reason', 'Permalink changed - SEO 301 Auto-Redirect');
      return res.redirect(301, `/api/articles/${result.targetPermalink}/preview`);
    }

    return res.status(200).json(articleStore.formatPreviewCard(result.article));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/articles/:id
 * Returns a single article by ID or permalink.
 * Performs SEO 301 Moved Permanently redirect if accessed via an old/changed permalink.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await articleStore.findArticleWithRedirect(id);
    if (!result) {
      return res.status(404).json({ error: `Article with ID ${id} not found.` });
    }

    if (result.isRedirect) {
      if (req.query.noRedirect === 'true') {
        return res.status(200).json({
          redirect: true,
          statusCode: 301,
          targetPermalink: result.targetPermalink,
          article: result.article
        });
      }
      res.set('X-Redirect-Reason', 'Permalink changed - SEO 301 Auto-Redirect');
      return res.redirect(301, `/api/articles/${result.targetPermalink}`);
    }

    return res.status(200).json(result.article);
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
 * Triggers background social distribution and CMS publishing dispatch workers asynchronously via durable database queue.
 */
router.post('/:id/dispatch', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await articleStore.getArticleById(id);
    if (!existing) {
      return res.status(404).json({ error: `Article with ID ${id} not found.` });
    }

    if (req.body && req.body.synchronous === true) {
      const dispatchResults = await dispatchAll(id, req.body || {});
      return res.status(200).json(dispatchResults);
    }

    let cmsUpdatedArticle = existing;
    try {
      cmsUpdatedArticle = await cmsDispatch(existing, (req.body && req.body.cmsOptions) || {});
    } catch (cmsErr) {
      // Keep existing if cmsDispatch throws
    }

    const task = await queueStore.enqueueTask({ articleId: id, options: req.body || {} });
    triggerImmediateProcessing();

    return res.status(200).json({
      articleId: id,
      jobId: task.id,
      status: 'queued',
      dispatches: {
        cms: { status: 'fulfilled', value: cmsUpdatedArticle },
        facebook: { status: 'queued' },
        linkedin: { status: 'queued' },
        slack: { status: 'queued' },
        wasabi: { status: 'queued' }
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/articles/:id/publish
 * Publishes an article and triggers full background dispatch pipeline asynchronously via durable database queue.
 */
router.post('/:id/publish', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await articleStore.getArticleById(id);
    if (!existing) {
      return res.status(404).json({ error: `Article with ID ${id} not found.` });
    }

    if (req.body && req.body.synchronous === true) {
      const dispatchResults = await dispatchAll(id, req.body || {});
      const updatedArticle = await articleStore.getArticleById(id);
      return res.status(200).json({
        article: updatedArticle,
        dispatch: dispatchResults
      });
    }

    let cmsUpdatedArticle = existing;
    try {
      cmsUpdatedArticle = await cmsDispatch(existing, (req.body && req.body.cmsOptions) || {});
    } catch (cmsErr) {
      cmsUpdatedArticle = await articleStore.updateArticle(id, { status: 'published' }) || existing;
    }

    const task = await queueStore.enqueueTask({ articleId: id, options: req.body || {} });
    triggerImmediateProcessing();

    return res.status(200).json({
      article: cmsUpdatedArticle,
      jobId: task.id,
      status: 'queued',
      dispatch: {
        cms: { status: 'fulfilled', value: cmsUpdatedArticle },
        facebook: { status: 'queued' },
        linkedin: { status: 'queued' },
        slack: { status: 'queued' },
        wasabi: { status: 'queued' }
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
