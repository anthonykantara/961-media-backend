const express = require('express');
const router = express.Router();
const languageStore = require('../models/languageStore');
const LanguageContext = require('../utils/languageContext');

/**
 * Validation helper for language data
 */
function validateLanguageData(data, isUpdate = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Request body must be a valid JSON object.'];
  }

  const errors = [];

  if (!isUpdate || data.hasOwnProperty('code')) {
    if (typeof data.code !== 'string' || data.code.trim() === '') {
      errors.push('Language code is required and must be a non-empty string.');
    }
  }

  if (!isUpdate || data.hasOwnProperty('name')) {
    if (typeof data.name !== 'string' || data.name.trim() === '') {
      errors.push('Language name is required and must be a non-empty string.');
    }
  }

  if (data.hasOwnProperty('dir') && data.dir !== undefined) {
    if (data.dir !== 'ltr' && data.dir !== 'rtl') {
      errors.push("Direction 'dir' must be either 'ltr' or 'rtl'.");
    }
  }

  return errors;
}

/**
 * GET /api/languages
 * Returns languages list. Filter by ?enabled=true or ?active=true for frontend selectors.
 */
router.get('/', async (req, res, next) => {
  try {
    const { enabled, active } = req.query;
    if (enabled === 'true' || active === 'true') {
      const activeLangs = await LanguageContext.getNavigationLanguages();
      return res.status(200).json(activeLangs);
    }

    const allLangs = await languageStore.getAllLanguages();
    return res.status(200).json(allLangs);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/languages/resolve/:locale
 * Resolves a locale string to an active language object using fallback rules.
 */
router.get('/resolve/:locale', async (req, res, next) => {
  try {
    const { locale } = req.params;
    const resolved = await languageStore.resolveLocale(locale);
    const fallbackChain = await LanguageContext.getFallbackChain(locale);
    return res.status(200).json({
      requestedLocale: locale,
      resolvedLanguage: resolved,
      fallbackChain
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/languages/:code
 * Returns language details by code.
 */
router.get('/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const lang = await languageStore.getLanguageByCode(code);
    if (!lang) {
      return res.status(404).json({ error: `Language with code '${code}' not found.` });
    }
    return res.status(200).json(lang);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/languages
 * Creates/Registers a new language.
 */
router.post('/', async (req, res, next) => {
  try {
    const errors = validateLanguageData(req.body, false);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: errors });
    }

    const newLang = await languageStore.createLanguage(req.body);
    return res.status(201).json(newLang);
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * PUT /api/languages/:code
 * Updates an existing language.
 */
router.put('/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const existing = await languageStore.getLanguageByCode(code);
    if (!existing) {
      return res.status(404).json({ error: `Language with code '${code}' not found.` });
    }

    const errors = validateLanguageData(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: errors });
    }

    const updated = await languageStore.updateLanguage(code, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/languages/:code
 * Partial update for a language.
 */
router.patch('/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const existing = await languageStore.getLanguageByCode(code);
    if (!existing) {
      return res.status(404).json({ error: `Language with code '${code}' not found.` });
    }

    const errors = validateLanguageData(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: errors });
    }

    const updated = await languageStore.updateLanguage(code, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/languages/:code
 * Deletes a language.
 */
router.delete('/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const deleted = await languageStore.deleteLanguage(code);
    if (!deleted) {
      return res.status(404).json({ error: `Language with code '${code}' not found.` });
    }
    return res.status(200).json({ message: 'Language successfully deleted.', code });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
