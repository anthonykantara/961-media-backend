const db = require('../db');

function parseJson(value, fallback = []) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (typeof value !== 'string') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function formatMedia(row) {
  return {
    id: String(row.id),
    name: row.name,
    type: row.type,
    size: Number(row.size || 0),
    url: row.url || '',
    altText: row.alt_text || '',
    caption: row.caption || '',
    dimensions: row.dimensions || '',
    parentId: row.parent_id ? String(row.parent_id) : null,
    folderColor: row.folder_color || '#FF0000',
    linkedTo: parseJson(row.linked_to, []),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    mimeType: row.mime_type || '',
    storageKey: row.storage_key || ''
  };
}

async function listMedia() {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not available.');
  const result = await pool.query(`
    SELECT * FROM media_items
    ORDER BY created_at DESC;
  `);
  return result.rows.map(formatMedia);
}

async function createMedia(data) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not available.');
  const result = await pool.query(`
    INSERT INTO media_items
      (name, type, mime_type, size, storage_key, url, alt_text, caption, dimensions, parent_id, folder_color, linked_to)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    RETURNING *;
  `, [
    data.name,
    data.type,
    data.mimeType || '',
    data.size || 0,
    data.storageKey || null,
    data.url || '',
    data.altText || '',
    data.caption || '',
    data.dimensions || '',
    data.parentId || null,
    data.folderColor || '#FF0000',
    JSON.stringify(data.linkedTo || [])
  ]);
  return formatMedia(result.rows[0]);
}

async function createFolder(data) {
  return createMedia({
    ...data,
    type: 'folder',
    size: 0,
    url: '',
    mimeType: '',
    storageKey: null
  });
}

async function updateMedia(id, updates) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not available.');
  const allowed = {
    name: 'name', altText: 'alt_text', caption: 'caption', dimensions: 'dimensions',
    parentId: 'parent_id', folderColor: 'folder_color', linkedTo: 'linked_to'
  };
  const entries = Object.entries(updates || {}).filter(([key]) => allowed[key]);
  if (!entries.length) return getMediaById(id);

  const values = [];
  const setters = entries.map(([key, column], index) => {
    let value = updates[key];
    if (key === 'linkedTo') value = JSON.stringify(value || []);
    values.push(value);
    return `${column} = $${index + 1}`;
  });
  values.push(id);
  const result = await pool.query(
    `UPDATE media_items SET ${setters.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length} RETURNING *`,
    values
  );
  return result.rows[0] ? formatMedia(result.rows[0]) : null;
}

async function getMediaById(id) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not available.');
  const result = await pool.query('SELECT * FROM media_items WHERE id = $1 LIMIT 1', [id]);
  return result.rows[0] ? formatMedia(result.rows[0]) : null;
}

async function deleteMedia(id) {
  const pool = db.getPool();
  if (!pool) throw new Error('Database is not available.');
  const result = await pool.query('DELETE FROM media_items WHERE id = $1 RETURNING *', [id]);
  return result.rows[0] ? formatMedia(result.rows[0]) : null;
}

module.exports = {
  listMedia,
  createMedia,
  createFolder,
  updateMedia,
  getMediaById,
  deleteMedia,
  formatMedia
};
