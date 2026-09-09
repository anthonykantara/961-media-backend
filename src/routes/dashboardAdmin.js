const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { authenticateJwt, requireRole, auditLogger } = require('../middleware/auth');

router.use(authenticateJwt);

router.get('/users', async (req, res, next) => {
  try {
    const search = String(req.query.search || '').trim();
    const result = await query(
      `SELECT id, email, role, display_name, identity_provider, identity_subject, is_active, last_login_at, created_at, updated_at
       FROM users
       WHERE ($1 = '' OR email ILIKE '%' || $1 || '%' OR COALESCE(display_name, '') ILIKE '%' || $1 || '%')
       ORDER BY created_at DESC`,
      [search]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.post('/users', auditLogger, requireRole('Admin'), async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || 'contributor').trim().toLowerCase();
    const displayName = req.body?.displayName ? String(req.body.displayName).trim() : null;
    if (!/^\\S+@\\S+\\.\\S+$/.test(email)) return res.status(400).json({ error: 'Valid email is required.' });
    if (!['contributor', 'editor', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    const result = await query(
      `INSERT INTO users (email, role, display_name, identity_provider)
       VALUES ($1, $2, $3, 'otp')
       RETURNING id, email, role, display_name, identity_provider, is_active, last_login_at, created_at, updated_at`,
      [email, role, displayName]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A user with this email already exists.' });
    next(err);
  }
});

router.patch('/users/:id', auditLogger, requireRole('Admin'), async (req, res, next) => {
  try {
    const fields = [];
    const values = [];
    let index = 1;
    if (req.body?.displayName !== undefined) { fields.push(`display_name = $${index++}`); values.push(req.body.displayName || null); }
    if (req.body?.role !== undefined) {
      const role = String(req.body.role).toLowerCase();
      if (!['contributor', 'editor', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
      fields.push(`role = $${index++}`); values.push(role);
    }
    if (req.body?.isActive !== undefined) { fields.push(`is_active = $${index++}`); values.push(Boolean(req.body.isActive)); }
    if (!fields.length) return res.status(400).json({ error: 'No supported fields supplied.' });
    fields.push('updated_at = NOW()');
    values.push(req.params.id);
    const result = await query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${index} RETURNING id, email, role, display_name, identity_provider, identity_subject, is_active, last_login_at, created_at, updated_at`, values);
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.get('/messages', async (req, res, next) => {
  try {
    const filter = String(req.query.filter || 'all');
    const search = String(req.query.search || '').trim();
    const result = await query(
      `SELECT id, sender_name AS sender, sender_email AS email, subject, body,
              LEFT(body, 180) AS snippet, category, unread, starred, created_at AS date
       FROM cms_messages
       WHERE ($1 = 'all' OR ($1 = 'unread' AND unread) OR ($1 = 'starred' AND starred))
         AND ($2 = '' OR sender_name ILIKE '%' || $2 || '%' OR sender_email ILIKE '%' || $2 || '%' OR subject ILIKE '%' || $2 || '%' OR body ILIKE '%' || $2 || '%')
       ORDER BY created_at DESC`,
      [filter, search]
    );
    res.json(result.rows);
  } catch (err) { next(err); }
});

router.patch('/messages/:id', auditLogger, requireRole('Contributor'), async (req, res, next) => {
  try {
    const fields = [];
    const values = [];
    let index = 1;
    if (req.body?.unread !== undefined) { fields.push(`unread = $${index++}`); values.push(Boolean(req.body.unread)); }
    if (req.body?.starred !== undefined) { fields.push(`starred = $${index++}`); values.push(Boolean(req.body.starred)); }
    if (!fields.length) return res.status(400).json({ error: 'No supported fields supplied.' });
    fields.push('updated_at = NOW()');
    values.push(req.params.id);
    const result = await query(`UPDATE cms_messages SET ${fields.join(', ')} WHERE id = $${index} RETURNING *`, values);
    if (!result.rows[0]) return res.status(404).json({ error: 'Message not found.' });
    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

router.delete('/messages/:id', auditLogger, requireRole('Contributor'), async (req, res, next) => {
  try {
    const result = await query('DELETE FROM cms_messages WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Message not found.' });
    res.json({ success: true, id: req.params.id });
  } catch (err) { next(err); }
});

router.get('/analytics', async (req, res, next) => {
  try {
    const period = String(req.query.period || '30d');
    const days = period === '7d' ? 7 : period === '90d' ? 90 : period === '365d' ? 365 : 30;
    const summary = await query(
      `WITH current_period AS (
         SELECT * FROM articles WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
       )
       SELECT COUNT(*)::int AS posts,
         COALESCE(SUM(CASE
           WHEN LOWER(views) ~ 'm$' THEN REPLACE(LOWER(views), 'm', '')::numeric * 1000000
           WHEN LOWER(views) ~ 'k$' THEN REPLACE(LOWER(views), 'k', '')::numeric * 1000
           ELSE NULLIF(REGEXP_REPLACE(views, '[^0-9.]', '', 'g'), '')::numeric
         END), 0)::numeric AS views
       FROM current_period`, [days]
    );
    const traffic = await query(
      `SELECT DATE(created_at) AS day,
              COALESCE(SUM(CASE
                WHEN LOWER(views) ~ 'm$' THEN REPLACE(LOWER(views), 'm', '')::numeric * 1000000
                WHEN LOWER(views) ~ 'k$' THEN REPLACE(LOWER(views), 'k', '')::numeric * 1000
                ELSE NULLIF(REGEXP_REPLACE(views, '[^0-9.]', '', 'g'), '')::numeric
              END), 0)::numeric AS views
       FROM articles
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY DATE(created_at) ORDER BY day`, [days]
    );
    const authors = await query(
      `SELECT COALESCE(author, 'Unknown') AS name, COUNT(*)::int AS posts,
              COALESCE(SUM(CASE
                WHEN LOWER(views) ~ 'm$' THEN REPLACE(LOWER(views), 'm', '')::numeric * 1000000
                WHEN LOWER(views) ~ 'k$' THEN REPLACE(LOWER(views), 'k', '')::numeric * 1000
                ELSE NULLIF(REGEXP_REPLACE(views, '[^0-9.]', '', 'g'), '')::numeric
              END), 0)::numeric AS views
       FROM articles
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY COALESCE(author, 'Unknown') ORDER BY views DESC LIMIT 20`, [days]
    );
    res.json({ period, posts: summary.rows[0]?.posts || 0, views: Number(summary.rows[0]?.views || 0), traffic: traffic.rows, authors: authors.rows });
  } catch (err) { next(err); }
});

module.exports = router;
