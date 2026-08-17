const express = require('express');
const router = express.Router();
const imageEngine = require('../services/imageEngine');

/**
 * POST /api/express-creation
 * Triggers Express Creation image processing workflow:
 * 1. Enhancement pass (+18% contrast, +15% saturation)
 * 2. Website featured image (1200x630 JPG with bracketed red highlights)
 * 3. Instagram carousel deck (1080x1350 PNGs x 4 with 40% dark overlay & nav arrows)
 * 4. Wasabi upload & Cloudflare CDN URL generation
 */
router.post('/', async (req, res, next) => {
  try {
    const { headline, title, carousel_slides, image, imageUrl, image_path, job_id, article_id } = req.body || {};

    const payload = {
      headline: headline || title || 'Discover [961] Media Highlights',
      carousel_slides: carousel_slides || [],
      image: image || imageUrl || image_path || '',
      job_id: job_id || article_id
    };

    const result = await imageEngine.processExpressCreation(payload);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/express-creation/render
 * Alias endpoint for rendering media assets
 */
router.post('/render', async (req, res, next) => {
  try {
    const result = await imageEngine.processExpressCreation(req.body || {});
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
