const db = require('../db');
const articleStore = require('../models/articleStore');

const DEFAULT_FEED_CACHE_SECONDS = 60;
const DEFAULT_ARTICLE_CACHE_SECONDS = 120;
const DEFAULT_STALE_WHILE_REVALIDATE_SECONDS = 30;

function setPublicCache(res, maxAgeSeconds, staleWhileRevalidateSeconds = DEFAULT_STALE_WHILE_REVALIDATE_SECONDS) {
  res.set(
    'Cache-Control',
    `public, max-age=0, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
  );
  res.set('CDN-Cache-Control', `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`);
  res.vary('Origin');
}

function parseArrayField(field) {
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function formatArticleRecord(row) {
  if (!row) return null;
  const redirects = parseArrayField(row.redirects);
  const image = row.image || row.image_url || row.imageUrl || '';
  const permalink = row.permalink || row.slug || '';
  let options = row.options || row.dispatchOptions || {};
  if (typeof options === 'string') {
    try {
      options = JSON.parse(options);
    } catch {
      options = {};
    }
  }

  return {
    id: row.id,
    title: row.title || '',
    permalink,
    slug: permalink,
    redirects,
    previousPermalinks: parseArrayField(row.previous_permalinks || row.previousPermalinks || row.redirects),
    content: row.content || '',
    summary: row.summary || '',
    author: row.author || '',
    category: row.category || '',
    image,
    imageUrl: image,
    status: row.status || 'draft',
    publish_at: row.publish_at || row.publishAt || row.scheduledAt || null,
    publishAt: row.publish_at || row.publishAt || row.scheduledAt || null,
    options,
    locationId: row.location_id || row.locationId || 'lb',
    language: row.language || 'en',
    date: row.date || '',
    time: row.time || '',
    views: String(row.views !== undefined ? row.views : '0'),
    shares: String(row.shares !== undefined ? row.shares : '0'),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : (row.createdAt || new Date().toISOString()),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : (row.updatedAt || new Date().toISOString())
  };
}

function buildArticleFilters(query) {
  const conditions = [];
  const params = [];
  const add = (sql, value) => {
    params.push(value);
    conditions.push(sql.replace('?', `$${params.length}`));
  };

  const status = typeof query.status === 'string' ? query.status.trim() : '';
  const category = typeof query.category === 'string' ? query.category.trim() : '';
  const locationId = typeof query.locationId === 'string' ? query.locationId.trim() : '';
  const regionId = typeof query.regionId === 'string' ? query.regionId.trim() : '';
  const language = typeof query.language === 'string' ? query.language.trim() : '';
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const permalink = typeof query.permalink === 'string' ? query.permalink.trim().toLowerCase() : '';
  const slug = typeof query.slug === 'string' ? query.slug.trim().toLowerCase() : '';

  if (status && status.toLowerCase() !== 'all') {
    add('LOWER(a.status) = ?', status.toLowerCase());
  }
  if (category) {
    add('LOWER(a.category) = ?', category.toLowerCase());
  }
  if (locationId) {
    add('LOWER(a.location_id) = ?', locationId.toLowerCase());
  }
  if (regionId) {
    add('LOWER(l.region_id) = ?', regionId.toLowerCase());
  }
  if (language) {
    add('LOWER(a.language) = ?', language.toLowerCase());
  }
  if (search) {
    const searchParam = params.length + 1;
    params.push(search.toLowerCase());
    conditions.push(`(
      LOWER(a.title) LIKE '%' || $${searchParam} || '%'
      OR LOWER(a.content) LIKE '%' || $${searchParam} || '%'
      OR LOWER(a.summary) LIKE '%' || $${searchParam} || '%'
      OR LOWER(a.author) LIKE '%' || $${searchParam} || '%'
      OR LOWER(a.category) LIKE '%' || $${searchParam} || '%'
    )`);
  }

  if (permalink) {
    const valueParam = params.length + 1;
    params.push(permalink);
    conditions.push(`(
      LOWER(a.permalink) = $${valueParam}
      OR LOWER(a.slug) = $${valueParam}
      OR a.redirects @> jsonb_build_array($${valueParam}::text)
      OR a.previous_permalinks @> jsonb_build_array($${valueParam}::text)
      OR EXISTS (
        SELECT 1 FROM article_redirects ar
        WHERE ar.article_id = a.id AND LOWER(ar.old_permalink) = $${valueParam}
      )
    )`);
  }

  if (slug) {
    const valueParam = params.length + 1;
    params.push(slug);
    conditions.push(`(
      LOWER(a.slug) = $${valueParam}
      OR LOWER(a.permalink) = $${valueParam}
      OR a.redirects @> jsonb_build_array($${valueParam}::text)
      OR a.previous_permalinks @> jsonb_build_array($${valueParam}::text)
      OR EXISTS (
        SELECT 1 FROM article_redirects ar
        WHERE ar.article_id = a.id AND LOWER(ar.old_permalink) = $${valueParam}
      )
    )`);
  }

  return { conditions, params };
}

function buildArticleQuery(query, defaultStatus = null) {
  const normalizedQuery = { ...query };
  if (defaultStatus && !normalizedQuery.status) {
    normalizedQuery.status = defaultStatus;
  }

  const { conditions, params } = buildArticleFilters(normalizedQuery);
  let nextParam = params.length + 1;
  const limitProvided = normalizedQuery.limit !== undefined && normalizedQuery.limit !== null && String(normalizedQuery.limit) !== '';
  const parsedLimit = limitProvided ? Number.parseInt(String(normalizedQuery.limit), 10) : null;
  const validLimit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;
  const parsedPage = Number.parseInt(String(normalizedQuery.page ?? '1'), 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const pagination = [];
  if (validLimit) {
    pagination.push(`LIMIT $${nextParam}`);
    params.push(validLimit);
    nextParam += 1;
    pagination.push(`OFFSET $${nextParam}`);
    params.push((page - 1) * validLimit);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT a.*
    FROM articles a
    LEFT JOIN locations l ON l.id = a.location_id
    ${whereClause}
    ORDER BY a.created_at DESC
    ${pagination.join('\n')}
  `;

  return { sql, params };
}

async function handlePublicArticleList(req, res, next) {
  const pool = db.getPool();
  if (!pool) return next();

  try {
    const isFeed = req.path === '/feed';
    const { sql, params } = buildArticleQuery(req.query, isFeed ? 'published' : null);
    const result = await pool.query(sql, params);
    const articles = result.rows.map(formatArticleRecord);

    setPublicCache(res, DEFAULT_FEED_CACHE_SECONDS);
    if (isFeed) {
      return res.status(200).json(articles.map(articleStore.formatPreviewCard));
    }

    return res.status(200).json(articles);
  } catch (err) {
    return next(err);
  }
}

function publicArticlesPerformance(req, res, next) {
  if (req.method !== 'GET') {
    return next();
  }

  const routePath = req.path || '/';
  if (routePath === '/' || routePath === '/feed') {
    return handlePublicArticleList(req, res, next);
  }

  // Public single-article reads and preview cards are cacheable. Redirect maps remain uncached.
  if (routePath !== '/redirects' && !routePath.startsWith('/redirects/')) {
    setPublicCache(res, DEFAULT_ARTICLE_CACHE_SECONDS);
  }

  return next();
}

module.exports = {
  publicArticlesPerformance,
  setPublicCache
};
