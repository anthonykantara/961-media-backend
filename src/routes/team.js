const express = require('express');
const router = express.Router();
const teamStore = require('../models/teamStore');

function validateTeamData(data, isUpdate = false) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return ['Request body must be a valid JSON object.'];
  }

  const errors = [];

  if (!isUpdate || data.hasOwnProperty('name') || data.hasOwnProperty('username')) {
    if ((!data.name || typeof data.name !== 'string') && (!data.username || typeof data.username !== 'string')) {
      errors.push('Name or username is required and must be a non-empty string.');
    }
  }

  const stringFields = ['username', 'name', 'role', 'joinedDate', 'avatar', 'bio', 'socialLink'];
  stringFields.forEach(field => {
    if (data.hasOwnProperty(field) && data[field] !== null && data[field] !== undefined) {
      if (typeof data[field] !== 'string') {
        errors.push(`${field} must be a string.`);
      }
    }
  });

  return errors;
}

/**
 * GET /api/team or /api/authors
 * Returns list of team members.
 */
router.get('/', async (req, res, next) => {
  try {
    const { role, search } = req.query;
    let team = await teamStore.getAllTeam();

    if (role) {
      team = team.filter(m => (m.role || '').toLowerCase() === role.toLowerCase());
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      team = team.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.username || '').toLowerCase().includes(q) ||
        (m.bio || '').toLowerCase().includes(q)
      );
    }

    return res.status(200).json(team);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/team/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const member = await teamStore.getTeamMemberById(id);
    if (!member) {
      return res.status(404).json({ error: `Team member with ID '${id}' not found.` });
    }
    return res.status(200).json(member);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/team
 */
router.post('/', async (req, res, next) => {
  try {
    const errors = validateTeamData(req.body, false);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: errors });
    }

    const newMember = await teamStore.createTeamMember(req.body);
    return res.status(201).json(newMember);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/team/:id
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await teamStore.getTeamMemberById(id);
    if (!existing) {
      return res.status(404).json({ error: `Team member with ID '${id}' not found.` });
    }

    const errors = validateTeamData(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: errors });
    }

    const updated = await teamStore.updateTeamMember(id, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/team/:id
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await teamStore.getTeamMemberById(id);
    if (!existing) {
      return res.status(404).json({ error: `Team member with ID '${id}' not found.` });
    }

    const errors = validateTeamData(req.body, true);
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', messages: errors });
    }

    const updated = await teamStore.updateTeamMember(id, req.body);
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/team/:id
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await teamStore.deleteTeamMember(id);
    if (!deleted) {
      return res.status(404).json({ error: `Team member with ID '${id}' not found.` });
    }
    return res.status(200).json({ message: 'Team member successfully deleted.', id });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
