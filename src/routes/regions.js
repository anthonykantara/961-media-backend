const express = require('express');
const router = express.Router();
const locationStore = require('../models/locationStore');

/**
 * GET /api/regions
 * Returns regional groups with locations for consolidated regional navigation/grouping.
 */
router.get('/', async (req, res, next) => {
  try {
    const groups = await locationStore.getRegionalGroups();
    return res.status(200).json(groups);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/regions/:regionId
 * Returns a specific regional group by ID.
 */
router.get('/:regionId', async (req, res, next) => {
  try {
    const { regionId } = req.params;
    const groups = await locationStore.getRegionalGroups();
    const group = groups.find(g => g.id.toLowerCase() === String(regionId).toLowerCase());

    if (!group) {
      return res.status(404).json({ error: `Region with ID '${regionId}' not found.` });
    }

    return res.status(200).json(group);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
