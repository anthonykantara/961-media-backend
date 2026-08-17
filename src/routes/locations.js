const express = require('express');
const router = express.Router();
const locationStore = require('../models/locationStore');

function validateLocationData(data, isUpdate = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Request body must be a valid JSON object.'];
  }

  const errors = [];

  if (!isUpdate || data.hasOwnProperty('id')) {
    if (typeof data.id !== 'string' || data.id.trim() === '') {
      errors.push('Location ID is required and must be a non-empty string.');
    }
  }

  if (!isUpdate || data.hasOwnProperty('name')) {
    if (typeof data.name !== 'string' || data.name.trim() === '') {
      errors.push('Location name is required and must be a non-empty string.');
    }
  }

  const optionalFields = ['country', 'countryCode', 'regionId', 'regionName', 'timezone'];
  optionalFields.forEach(field => {
    if (data.hasOwnProperty(field) && data[field] !== null && data[field] !== undefined) {
      if (typeof data[field] !== 'string') {
        const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
        errors.push(`${fieldName} must be a string.`);
      }
    }
  });

  return errors;
}

/**
 * GET /api/locations
 * Returns list of locations. Filter by ?regionId=...
 */
router.get('/', async (req, res, next) => {
  try {
    const { regionId, enabled } = req.query;
    let locations = await locationStore.getAllLocations();

    if (regionId) {
      locations = locations.filter(l => (l.regionId || '').toLowerCase() === regionId.toLowerCase());
    }

    if (enabled === 'true') {
      locations = locations.filter(l => l.enabled !== false);
    } else if (enabled === 'false') {
      locations = locations.filter(l => l.enabled === false);
    }

    return res.status(200).json(locations);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/locations/:id
 * Returns location by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const location = await locationStore.getLocationById(id);
    if (!location) {
      return res.status(404).json({ error: `Location with ID '${id}' not found.` });
    }
    return res.status(200).json(location);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/locations
 * Creates a new location.
 */
router.post('/', async (req, res, next) => {
  try {
    const errors = validateLocationData(req.body, false);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: errors });
    }

    const newLocation = await locationStore.createLocation(req.body);
    return res.status(201).json(newLocation);
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      return res.status(409).json({ error: err.message });
    }
    next(err);
  }
});

/**
 * PUT /api/locations/:id
 * Updates an existing location.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await locationStore.getLocationById(id);
    if (!existing) {
      return res.status(404).json({ error: `Location with ID '${id}' not found.` });
    }

    const errors = validateLocationData(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: errors });
    }

    const updated = await locationStore.updateLocation(id, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/locations/:id
 * Partial update location.
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await locationStore.getLocationById(id);
    if (!existing) {
      return res.status(404).json({ error: `Location with ID '${id}' not found.` });
    }

    const errors = validateLocationData(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: errors });
    }

    const updated = await locationStore.updateLocation(id, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/locations/:id
 * Deletes a location.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await locationStore.deleteLocation(id);
    if (!deleted) {
      return res.status(404).json({ error: `Location with ID '${id}' not found.` });
    }
    return res.status(200).json({ message: 'Location successfully deleted.', id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
