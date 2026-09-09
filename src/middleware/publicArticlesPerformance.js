const db = require('../db');
const articleStore = require('../models/articleStore');

const DEFAULT_FEED_CACHE_SECONDS = 60;
const DEFAULT_ARTICLE_CACHE_SECONDS = 300;
const DEFAULT_STALE_WHILE_REVALIDATE_SECONDS = 30;

function setPublicCache(res, maxAgeSeconds, staleWhileRevalidateSeconds = DEFAULT_STALE_WHILE_REVALIDATE_SECONDS) {
  res.set(
    'Cache-Control',
    `public, max-age=0, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`
  );
  res.set('CDN-Cache-Control', `public, s-maxage=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidateSeconds}`);
  res.vary('Origin');
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
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
    add(`(
      LOWER(a.title) LIKE '%' || ? || '%'
      OR LOWER(a.content) LIKE '%' || $${params.length + 1} || '%'
      OR LOWER(a.summary) LIKE '%' || $${params.length + 2} || '%'
      OR LOWER(a.author) LIKE '%' || $${params.length + 3} || '%'
      OR LOWER(a.category) LIKE '%' || $${params.length + 4} || '%'
    )`, search.toLowerCase());
    params.push(search.toLowerCase(), search.toLowerCase(), search.toLowerCase(), search.toLowerCase());
  }

  if (permalink) {
    add(`(
      LOWER(a.permalink) = ?
      OR LOWER(a.slug) = $${params.length + 1}
      OR a.redirects @> jsonb_build_array($${params.length + 2}::text)
      OR a.previous_permalinks @> jsonb_build_array($${params.length + 3}::text)
      OR EXISTS (
        SELECT 1 FROM article_redirects ar
        WHERE ar.article_id = a.id AND LOWER(ar.old_permalink) = $${params.length + 4}
      )
    )`, permalink);
    params.push(permalink, permalink, permalink, permalink);
  }

  if (slug) {
    add(`(
      LOWER(a.slug) = ?
      OR LOWER(a.permalink) = $${params.length + 1}
      OR a.redirects @> jsonb_build_array($${params.length + 2}::text)
      OR a.previous_permalinks @> jsonb_build_array($${params.length + 3}::text)
      OR EXISTS (
        SELECT 1 FROM article_redirects ar
        WHERE ar.article_id = a.id AND LOWER(ar.old_permalink) = $${params.length + 4}
      )
    )`, slug);
    params.push(slug, slug, slug, slug);
  }

  return { conditions, params };
}

function buildFeedQuery(query) {
  const { conditions, params } = buildArticleFilters(query);
  let nextParam = params.length + 1;
  const limitProvided = query.limit !== undefined && query.limit !== null && String(query.limit) !== '';
  const parsedLimit = limitProvided ? parsePositiveInt(query.limit, null) : null;
  const parsedPage = parsePositiveInt(query.page, 1);

  const pagination = [];
  if (parsedLimit) {
    pagination.push(`LIMIT $${nextParam}`);
    params.push(parsedLimit);
    nextParam += 1;
    pagination.push(`OFFSET $${nextParam}`);
    params.push((parsedPage - 1) * parsedLimit);
    nextParam += 1;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `
    SELECT
      a.id,
      a.title,
      a.permalink,
      a.slug,
      a.redirects,
      a.previous_permalinks,
      a.summary,
      a.image,
      a.image_url,
      a.author,
      a.date,
      a.time,
      a.category,
      a.location_id,
      a.language,
      a.status,
      a.views,
      a.shares,
      a.created_at,
      a.updated_at
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
    const { sql, params } = buildFeedQuery(req.query);
    const result = await pool.query(sql, params);
    const preview = req.path === '/feed';
    const rows = result.rows.map(articleStore.formatPreviewCard);
    setPublicCache(res, DEFAULT_FEED_CACHE_SECONDS);
    return res.status(200).json(preview ? rows : rows.map((article) => ({ ...article })));
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

  // Public single-article reads and preview cards are safe to cache, while redirect maps stay uncached.
  if (routePath !== '/redirects' && !routePath.startsWith('/redirects/')) {
    setPublicCache(res, DEFAULT_ARTICLE_CACHE_SECONDS);
  }

  return next();
}

module.exports = {
  publicArticlesPerformance,
  setPublicCache
};
