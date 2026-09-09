const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const router = express.Router();
const mediaStore = require('../models/mediaStore');
const wasabiService = require('../services/wasabiService');
const { authenticateJwt, requireRole, auditLogger } = require('../middleware/auth');

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg',
  'application/pdf'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error(`Unsupported media type: ${file.mimetype}`));
    }
    cb(null, true);
  }
});

const MEDIA_CDN_BASE = (process.env.MEDIA_CDN_URL || 'https://media.the961.com').replace(/\/+$/, '');

function sanitizeFilename(name) {
  const ext = path.extname(name || '').toLowerCase();
  const stem = path.basename(name || 'upload', ext)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'upload';
  return `${stem}${ext}`;
}

function mediaTypeForMime(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
}

router.get('/', authenticateJwt, requireRole('Contributor'), async (req, res, next) => {
  try {
    return res.status(200).json(await mediaStore.listMedia());
  } catch (err) {
    next(err);
  }
});

router.post('/folders', authenticateJwt, auditLogger, requireRole('Contributor'), async (req, res, next) => {
  try {
    const { name, parentId, folderColor } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Folder name is required.' });
    }
    const folder = await mediaStore.createFolder({
      name: name.trim(),
      parentId: parentId || null,
      folderColor: folderColor || '#FF0000'
    });
    return res.status(201).json(folder);
  } catch (err) {
    next(err);
  }
});

router.post('/upload', authenticateJwt, auditLogger, requireRole('Contributor'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A media file is required.' });

    const originalName = req.file.originalname || 'upload';
    const safeName = sanitizeFilename(originalName);
    const uniquePrefix = crypto.randomUUID();
    const storageKey = `media/${new Date().getUTCFullYear()}/${String(new Date().getUTCMonth() + 1).padStart(2, '0')}/${uniquePrefix}-${safeName}`;

    await wasabiService.uploadToWasabi(req.file.buffer, storageKey, req.file.mimetype);

    const media = await mediaStore.createMedia({
      name: originalName,
      type: mediaTypeForMime(req.file.mimetype),
      mimeType: req.file.mimetype,
      size: req.file.size,
      storageKey,
      url: `${MEDIA_CDN_BASE}/${storageKey}`,
      parentId: req.body.parentId || null,
      altText: req.body.altText || '',
      caption: req.body.caption || '',
      linkedTo: []
    });

    res.set('Cache-Control', 'no-store');
    return res.status(201).json(media);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', authenticateJwt, auditLogger, requireRole('Contributor'), async (req, res, next) => {
  try {
    const updated = await mediaStore.updateMedia(req.params.id, req.body || {});
    if (!updated) return res.status(404).json({ error: 'Media item not found.' });
    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticateJwt, auditLogger, requireRole('Editor'), async (req, res, next) => {
  try {
    const deleted = await mediaStore.deleteMedia(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Media item not found.' });

    // Deleting the DB record intentionally does not delete the Wasabi object yet.
    // This prevents accidental permanent data loss; orphan cleanup can be handled separately.
    return res.status(200).json({ message: 'Media item deleted.', item: deleted });
  } catch (err) {
    next(err);
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: `File exceeds the ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB upload limit.` });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err && err.message && err.message.startsWith('Unsupported media type:')) {
    return res.status(415).json({ error: err.message });
  }
  return next(err);
});

module.exports = router;
