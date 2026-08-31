const crypto = require('crypto');
const db = require('../db');
const { generatePermalink } = require('../utils/permalink');

const DEFAULT_SEED_ARTICLES = [
  {
    id: 'lb-en-1',
    title: "Lebanon's Tech Scene is Booming in 2026",
    permalink: 'lebanons-tech-scene-is-booming-in-2026',
    slug: 'lebanons-tech-scene-is-booming-in-2026',
    redirects: [],
    previousPermalinks: [],
    content: "Lebanon's vibrant tech ecosystem continues to expand rapidly with new incubators and AI startups taking center stage in Beirut.",
    summary: "A deep dive into Lebanon's growing technology sector.",
    status: 'Published',
    author: 'Anthony Rahayel',
    category: 'News',
    date: 'Mar 28, 2026',
    time: '10:30 AM',
    views: '14.2k',
    shares: '420',
    image: 'https://picsum.photos/seed/lb-tech/400/250',
    imageUrl: 'https://picsum.photos/seed/lb-tech/400/250',
    locationId: 'lb',
    language: 'en',
    createdAt: '2026-03-28T10:30:00.000Z',
    updatedAt: '2026-03-28T10:30:00.000Z'
  },
  {
    id: 'lb-en-2',
    title: '10 Best Rooftop Bars in Beirut This Summer',
    permalink: '10-best-rooftop-bars-in-beirut-this-summer',
    slug: '10-best-rooftop-bars-in-beirut-this-summer',
    redirects: [],
    previousPermalinks: [],
    content: "Discover the most breathtaking rooftop lounges across Beirut featuring panoramic Mediterranean views and signature cocktails.",
    summary: "The definitive guide to Beirut nightlife and rooftop experiences.",
    status: 'Published',
    author: 'Sarah Khoury',
    category: 'Lifestyle',
    date: 'Mar 27, 2026',
    time: '02:15 PM',
    views: '18.9k',
    shares: '680',
    image: 'https://picsum.photos/seed/lb-rooftop/400/250',
    imageUrl: 'https://picsum.photos/seed/lb-rooftop/400/250',
    locationId: 'lb',
    language: 'en',
    createdAt: '2026-03-27T14:15:00.000Z',
    updatedAt: '2026-03-27T14:15:00.000Z'
  },
  {
    id: 'sa-ryd-ar-1',
    title: 'موسم الرياض يستقطب ملايين الزوار بفعاليات غير مسبوقة',
    permalink: 'موسم-الرياض-يستقطب-ملايين-الزوار-بفعاليات-غير-مسبوقة',
    slug: 'موسم-الرياض-يستقطب-ملايين-الزوار-بفعاليات-غير-مسبوقة',
    redirects: [],
    previousPermalinks: [],
    content: "تواصل العاصمة السعودية الرياض استضافة ضيوفها برعاية ترفيهية وثقافية استثنائية ضمن موسم الرياض 2026.",
    summary: "فعاليات موسم الرياض تحقق أرقاماً قياسية جديدة.",
    status: 'Published',
    author: 'سارة خوري',
    category: 'News',
    date: 'Mar 28, 2026',
    time: '01:00 PM',
    views: '28.4k',
    shares: '1.2k',
    image: 'https://picsum.photos/seed/sa-ryd-1/400/250',
    imageUrl: 'https://picsum.photos/seed/sa-ryd-1/400/250',
    locationId: 'sa-riyadh',
    language: 'ar',
    createdAt: '2026-03-28T13:00:00.000Z',
    updatedAt: '2026-03-28T13:00:00.000Z'
  },
  {
    id: 'ae-dxb-en-1',
    title: 'Dubai Unveils Next-Generation AI Infrastructure',
    permalink: 'dubai-unveils-next-generation-ai-infrastructure',
    slug: 'dubai-unveils-next-generation-ai-infrastructure',
    redirects: [],
    previousPermalinks: [],
    content: "Dubai announces a landmark investment in high-performance cloud compute and artificial intelligence hubs.",
    summary: "Dubai sets new standards for smart city and AI innovation.",
    status: 'Published',
    author: 'John Doe',
    category: 'News',
    date: 'Mar 28, 2026',
    time: '09:00 AM',
    views: '24.1k',
    shares: '890',
    image: 'https://picsum.photos/seed/ae-dxb-1/400/250',
    imageUrl: 'https://picsum.photos/seed/ae-dxb-1/400/250',
    locationId: 'ae-dubai',
    language: 'en',
    createdAt: '2026-03-28T09:00:00.000Z',
    updatedAt: '2026-03-28T09:00:00.000Z'
  }
];

let memoryArticles = [];

function parseArrayField(field) {
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }
  return [];
}

function formatArticleRecord(row) {
  if (!row) return null;
  const redirects = parseArrayField(row.redirects);
  const previousPermalinks = parseArrayField(row.previous_permalinks || row.previousPermalinks || row.redirects);
  const imgVal = row.image || row.image_url || row.imageUrl || '';
  const permalinkVal = row.permalink || row.slug || '';
  const publishAtVal = row.publish_at || row.publishAt || row.scheduledAt || null;
  let optionsVal = row.options || row.dispatchOptions || {};
  if (typeof optionsVal === 'string') {
    try {
      optionsVal = JSON.parse(optionsVal);
    } catch (e) {
      optionsVal = {};
    }
  }

  return {
    id: row.id,
    title: row.title || '',
    permalink: permalinkVal,
    slug: permalinkVal,
    redirects,
    previousPermalinks: redirects,
    content: row.content || '',
    summary: row.summary || '',
    author: row.author || '',
    category: row.category || '',
    image: imgVal,
    imageUrl: imgVal,
    status: row.status || 'draft',
    publish_at: publishAtVal,
    publishAt: publishAtVal,
    options: optionsVal,
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

async function ensureInitialized() {
  const pool = db.getPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT COUNT(*) FROM articles;');
      if (res && res.rows && parseInt(res.rows[0].count, 10) === 0 && process.env.NODE_ENV !== 'test') {
        for (const a of DEFAULT_SEED_ARTICLES) {
          await pool.query(
            `INSERT INTO articles (
               id, title, permalink, slug, redirects, previous_permalinks, content, summary,
               author, category, image, image_url, status, location_id, language, date, time,
               views, shares, created_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
             ON CONFLICT (id) DO NOTHING;`,
            [
              a.id, a.title, a.permalink, a.slug, JSON.stringify(a.redirects), JSON.stringify(a.previousPermalinks),
              a.content, a.summary, a.author, a.category, a.image, a.imageUrl, a.status,
              a.locationId, a.language, a.date, a.time, String(a.views), String(a.shares),
              a.createdAt, a.updatedAt
            ]
          );
        }
      }
      return;
    } catch (err) {
      // Fallback
    }
  }

  if (memoryArticles.length === 0 && process.env.NODE_ENV !== 'test') {
    memoryArticles = DEFAULT_SEED_ARTICLES.map(a => formatArticleRecord(a));
  }
}

async function getAllArticles() {
  await ensureInitialized();
  const pool = db.getPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM articles ORDER BY created_at DESC;');
      if (res && res.rows) {
        return res.rows.map(formatArticleRecord);
      }
    } catch (err) {
      console.error('Database getAllArticles error, using fallback:', err.message);
    }
  }

  return memoryArticles.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(formatArticleRecord);
}

async function getArticleById(id) {
  if (!id) return null;
  const lower = String(id).toLowerCase();
  const pool = db.getPool();

  if (pool) {
    try {
      const sql = `
        SELECT * FROM articles
        WHERE id = $1
           OR LOWER(permalink) = $2
           OR LOWER(slug) = $2
           OR redirects @> jsonb_build_array($2::text)
           OR previous_permalinks @> jsonb_build_array($2::text)
           OR id IN (SELECT article_id FROM article_redirects WHERE LOWER(old_permalink) = $2)
        LIMIT 1;
      `;
      const res = await pool.query(sql, [id, lower]);
      if (res && res.rows && res.rows[0]) {
        return formatArticleRecord(res.rows[0]);
      }
      return null;
    } catch (err) {
      console.error('Database getArticleById error, using fallback:', err.message);
    }
  }

  const article = memoryArticles.find(a =>
    a.id === id ||
    (a.permalink || '').toLowerCase() === lower ||
    (a.slug || '').toLowerCase() === lower ||
    (Array.isArray(a.redirects) && a.redirects.some(r => r.toLowerCase() === lower)) ||
    (Array.isArray(a.previousPermalinks) && a.previousPermalinks.some(r => r.toLowerCase() === lower))
  );
  return article ? formatArticleRecord(article) : null;
}

async function findArticleWithRedirect(id) {
  if (!id) return null;
  const lower = String(id).toLowerCase();
  const pool = db.getPool();

  if (pool) {
    try {
      // 1. Direct match
      const directSql = `
        SELECT * FROM articles
        WHERE id = $1 OR LOWER(permalink) = $2 OR LOWER(slug) = $2
        LIMIT 1;
      `;
      const directRes = await pool.query(directSql, [id, lower]);
      if (directRes && directRes.rows && directRes.rows[0]) {
        const art = formatArticleRecord(directRes.rows[0]);
        return {
          article: art,
          isRedirect: false,
          targetPermalink: art.permalink || art.slug
        };
      }

      // 2. Redirect match
      const redirectSql = `
        SELECT * FROM articles
        WHERE redirects @> jsonb_build_array($1::text)
           OR previous_permalinks @> jsonb_build_array($1::text)
           OR id IN (SELECT article_id FROM article_redirects WHERE LOWER(old_permalink) = $1)
        LIMIT 1;
      `;
      const redirectRes = await pool.query(redirectSql, [lower]);
      if (redirectRes && redirectRes.rows && redirectRes.rows[0]) {
        const art = formatArticleRecord(redirectRes.rows[0]);
        return {
          article: art,
          isRedirect: true,
          targetPermalink: art.permalink || art.slug
        };
      }

      return null;
    } catch (err) {
      console.error('Database findArticleWithRedirect error, using fallback:', err.message);
    }
  }

  // Fallback in-memory logic
  const directMatch = memoryArticles.find(a =>
    a.id === id ||
    (a.permalink || '').toLowerCase() === lower ||
    (a.slug || '').toLowerCase() === lower
  );
  if (directMatch) {
    const art = formatArticleRecord(directMatch);
    return {
      article: art,
      isRedirect: false,
      targetPermalink: art.permalink || art.slug
    };
  }

  const redirectMatch = memoryArticles.find(a =>
    (Array.isArray(a.redirects) && a.redirects.some(r => r.toLowerCase() === lower)) ||
    (Array.isArray(a.previousPermalinks) && a.previousPermalinks.some(r => r.toLowerCase() === lower))
  );
  if (redirectMatch) {
    const art = formatArticleRecord(redirectMatch);
    return {
      article: art,
      isRedirect: true,
      targetPermalink: art.permalink || art.slug
    };
  }

  return null;
}

async function getAllRedirects() {
  const pool = db.getPool();
  const redirectMap = {};

  if (pool) {
    try {
      const sql = 'SELECT old_permalink, target_permalink FROM article_redirects;';
      const res = await pool.query(sql);
      if (res && res.rows) {
        res.rows.forEach(r => {
          redirectMap[r.old_permalink] = r.target_permalink;
        });
      }
      const allArtsRes = await pool.query('SELECT permalink, slug, redirects, previous_permalinks FROM articles;');
      if (allArtsRes && allArtsRes.rows) {
        allArtsRes.rows.forEach(a => {
          const target = a.permalink || a.slug;
          const redirectsArr = parseArrayField(a.redirects).concat(parseArrayField(a.previous_permalinks));
          redirectsArr.forEach(oldP => {
            if (oldP && oldP !== target) {
              redirectMap[oldP] = target;
            }
          });
        });
      }
      return redirectMap;
    } catch (err) {
      console.error('Database getAllRedirects error, using fallback:', err.message);
    }
  }

  memoryArticles.forEach(a => {
    const target = a.permalink || a.slug;
    const redirectsArr = Array.isArray(a.redirects)
      ? a.redirects
      : (Array.isArray(a.previousPermalinks) ? a.previousPermalinks : []);
    redirectsArr.forEach(oldP => {
      if (oldP && oldP !== target) {
        redirectMap[oldP] = target;
      }
    });
  });

  return redirectMap;
}

async function getArticleByPermalink(permalink) {
  return getArticleById(permalink);
}

async function createArticle(articleData) {
  const now = new Date().toISOString();
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const imageVal = articleData.image || articleData.imageUrl || '';
  const rawPermalink = articleData.permalink || articleData.slug || articleData.title || '';
  const permalinkVal = generatePermalink(rawPermalink);

  const initialRedirects = Array.isArray(articleData.redirects)
    ? articleData.redirects
    : (Array.isArray(articleData.previousPermalinks) ? articleData.previousPermalinks : []);

  const cleanRedirects = Array.from(new Set(initialRedirects)).filter(r => r && r !== permalinkVal);

  const id = articleData.id || crypto.randomUUID();

  const publishAtVal = articleData.publish_at || articleData.publishAt || articleData.scheduledAt || null;

  const newArticle = {
    id,
    title: articleData.title,
    permalink: permalinkVal,
    slug: permalinkVal,
    redirects: cleanRedirects,
    previousPermalinks: cleanRedirects,
    content: articleData.content || '',
    summary: articleData.summary || '',
    author: articleData.author || '',
    category: articleData.category || '',
    image: imageVal,
    imageUrl: imageVal,
    status: articleData.status || 'draft',
    publish_at: publishAtVal,
    publishAt: publishAtVal,
    options: articleData.options || articleData.dispatchOptions || {},
    locationId: articleData.locationId || 'lb',
    language: articleData.language || 'en',
    date: articleData.date || dateStr,
    time: articleData.time || timeStr,
    views: articleData.views !== undefined ? String(articleData.views) : '0',
    shares: articleData.shares !== undefined ? String(articleData.shares) : '0',
    createdAt: now,
    updatedAt: now
  };

  const pool = db.getPool();
  if (pool) {
    try {
      const sql = `
        INSERT INTO articles (
          id, title, permalink, slug, redirects, previous_permalinks, content, summary,
          author, category, image, image_url, status, location_id, language, date, time,
          views, shares, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        ) RETURNING *;
      `;
      const res = await pool.query(sql, [
        newArticle.id,
        newArticle.title,
        newArticle.permalink,
        newArticle.slug,
        JSON.stringify(newArticle.redirects),
        JSON.stringify(newArticle.previousPermalinks),
        newArticle.content,
        newArticle.summary,
        newArticle.author,
        newArticle.category,
        newArticle.image,
        newArticle.imageUrl,
        newArticle.status,
        newArticle.locationId,
        newArticle.language,
        newArticle.date,
        newArticle.time,
        newArticle.views,
        newArticle.shares,
        now,
        now
      ]);

      for (const oldP of cleanRedirects) {
        await pool.query(
          `INSERT INTO article_redirects (article_id, old_permalink, target_permalink)
           VALUES ($1, $2, $3)
           ON CONFLICT (old_permalink) DO UPDATE SET target_permalink = EXCLUDED.target_permalink;`,
          [id, oldP, permalinkVal]
        );
      }

      if (res && res.rows && res.rows[0]) {
        return formatArticleRecord(res.rows[0]);
      }
    } catch (err) {
      console.error('Database createArticle error, using fallback:', err.message);
    }
  }

  memoryArticles.push(newArticle);
  return formatArticleRecord(newArticle);
}

async function updateArticle(id, updateData) {
  const existing = await getArticleById(id);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();

  let permalinkVal;
  if (typeof updateData.permalink === 'string' && updateData.permalink.trim() !== '') {
    permalinkVal = generatePermalink(updateData.permalink);
  } else if (typeof updateData.slug === 'string' && updateData.slug.trim() !== '') {
    permalinkVal = generatePermalink(updateData.slug);
  } else if (typeof updateData.title === 'string' && updateData.title.trim() !== '') {
    permalinkVal = generatePermalink(updateData.title);
  } else {
    permalinkVal = existing.permalink || existing.slug || generatePermalink(existing.title || '');
  }

  const existingRedirects = Array.isArray(existing.redirects)
    ? existing.redirects
    : (Array.isArray(existing.previousPermalinks) ? existing.previousPermalinks : []);

  let updatedRedirects = [...existingRedirects];

  if (Array.isArray(updateData.redirects)) {
    updatedRedirects.push(...updateData.redirects);
  }
  if (Array.isArray(updateData.previousPermalinks)) {
    updatedRedirects.push(...updateData.previousPermalinks);
  }

  const oldPermalink = existing.permalink || existing.slug;
  if (oldPermalink && oldPermalink !== permalinkVal) {
    if (!updatedRedirects.includes(oldPermalink)) {
      updatedRedirects.push(oldPermalink);
    }
    if (existing.slug && existing.slug !== permalinkVal && !updatedRedirects.includes(existing.slug)) {
      updatedRedirects.push(existing.slug);
    }
  }

  updatedRedirects = Array.from(new Set(updatedRedirects)).filter(r => r && r !== permalinkVal);

  const imageVal = typeof updateData.imageUrl === 'string'
    ? updateData.imageUrl
    : (typeof updateData.image === 'string' ? updateData.image : (existing.imageUrl || existing.image || ''));

  const publishAtUpdated = updateData.publish_at !== undefined ? updateData.publish_at :
    (updateData.publishAt !== undefined ? updateData.publishAt :
    (updateData.scheduledAt !== undefined ? updateData.scheduledAt : (existing.publish_at || existing.publishAt || existing.scheduledAt || null)));

  const updatedArticle = {
    ...existing,
    title: typeof updateData.title === 'string' ? updateData.title : existing.title,
    permalink: permalinkVal,
    slug: permalinkVal,
    redirects: updatedRedirects,
    previousPermalinks: updatedRedirects,
    content: typeof updateData.content === 'string' ? updateData.content : existing.content,
    summary: typeof updateData.summary === 'string' ? updateData.summary : existing.summary,
    author: typeof updateData.author === 'string' ? updateData.author : existing.author,
    category: typeof updateData.category === 'string' ? updateData.category : (existing.category || ''),
    image: imageVal,
    imageUrl: imageVal,
    status: typeof updateData.status === 'string' ? updateData.status : existing.status,
    publish_at: publishAtUpdated,
    publishAt: publishAtUpdated,
    options: updateData.options || updateData.dispatchOptions || existing.options || existing.dispatchOptions || {},
    locationId: typeof updateData.locationId === 'string' ? updateData.locationId : (existing.locationId || 'lb'),
    language: typeof updateData.language === 'string' ? updateData.language : (existing.language || 'en'),
    date: typeof updateData.date === 'string' ? updateData.date : existing.date,
    time: typeof updateData.time === 'string' ? updateData.time : existing.time,
    views: updateData.views !== undefined ? String(updateData.views) : (existing.views || '0'),
    shares: updateData.shares !== undefined ? String(updateData.shares) : (existing.shares || '0'),
    updatedAt: now
  };

  const pool = db.getPool();
  if (pool) {
    try {
      const sql = `
        UPDATE articles
        SET title = $1, permalink = $2, slug = $3, redirects = $4, previous_permalinks = $5,
            content = $6, summary = $7, author = $8, category = $9, image = $10, image_url = $11,
            status = $12, location_id = $13, language = $14, date = $15, time = $16,
            views = $17, shares = $18, updated_at = $19
        WHERE id = $20
        RETURNING *;
      `;
      const res = await pool.query(sql, [
        updatedArticle.title,
        updatedArticle.permalink,
        updatedArticle.slug,
        JSON.stringify(updatedArticle.redirects),
        JSON.stringify(updatedArticle.previousPermalinks),
        updatedArticle.content,
        updatedArticle.summary,
        updatedArticle.author,
        updatedArticle.category,
        updatedArticle.image,
        updatedArticle.imageUrl,
        updatedArticle.status,
        updatedArticle.locationId,
        updatedArticle.language,
        updatedArticle.date,
        updatedArticle.time,
        updatedArticle.views,
        updatedArticle.shares,
        now,
        existing.id
      ]);

      for (const r of updatedRedirects) {
        if (r && r !== permalinkVal) {
          await pool.query(
            `INSERT INTO article_redirects (article_id, old_permalink, target_permalink)
             VALUES ($1, $2, $3)
             ON CONFLICT (old_permalink) DO UPDATE SET target_permalink = EXCLUDED.target_permalink;`,
            [existing.id, r, permalinkVal]
          );
        }
      }

      if (oldPermalink && oldPermalink !== permalinkVal) {
        await pool.query(
          `UPDATE article_redirects
           SET target_permalink = $1
           WHERE article_id = $2;`,
          [permalinkVal, existing.id]
        );
      }

      if (res && res.rows && res.rows[0]) {
        return formatArticleRecord(res.rows[0]);
      }
    } catch (err) {
      console.error('Database updateArticle error, using fallback:', err.message);
    }
  }

  const index = memoryArticles.findIndex(a =>
    a.id === existing.id ||
    (a.permalink || '').toLowerCase() === existing.id.toLowerCase() ||
    (a.slug || '').toLowerCase() === existing.id.toLowerCase()
  );
  if (index !== -1) {
    memoryArticles[index] = updatedArticle;
    return formatArticleRecord(updatedArticle);
  }
  return null;
}

async function deleteArticle(id) {
  const existing = await getArticleById(id);
  if (!existing) {
    return false;
  }

  const pool = db.getPool();
  if (pool) {
    try {
      const res = await pool.query('DELETE FROM articles WHERE id = $1 RETURNING id;', [existing.id]);
      if (res && res.rows && res.rows.length > 0) {
        return true;
      }
      return false;
    } catch (err) {
      console.error('Database deleteArticle error, using fallback:', err.message);
    }
  }

  const index = memoryArticles.findIndex(a => a.id === existing.id);
  if (index === -1) {
    return false;
  }
  memoryArticles.splice(index, 1);
  return true;
}

function formatPreviewCard(article) {
  if (!article) return null;
  const img = article.imageUrl || article.image || '';
  const permalinkVal = article.permalink || article.slug || (article.title ? generatePermalink(article.title) : '');
  const redirectsVal = Array.isArray(article.redirects) ? article.redirects : (Array.isArray(article.previousPermalinks) ? article.previousPermalinks : []);
  return {
    id: article.id,
    title: article.title || '',
    permalink: permalinkVal,
    slug: permalinkVal,
    redirects: redirectsVal,
    summary: article.summary || '',
    image: img,
    imageUrl: img,
    author: article.author || '',
    date: article.date || '',
    time: article.time || '',
    category: article.category || '',
    locationId: article.locationId || '',
    language: article.language || '',
    status: article.status || 'draft',
    views: article.views || '0',
    shares: article.shares || '0'
  };
}

async function clearStore() {
  const pool = db.getPool();
  if (pool) {
    try {
      await pool.query('TRUNCATE TABLE articles CASCADE;');
      await pool.query('TRUNCATE TABLE article_redirects;');
    } catch (err) {
      console.error('Database clearStore error, using fallback:', err.message);
    }
  }

  memoryArticles = [];
}

/**
 * Fetches all scheduled articles whose release time (publish_at / publishAt / scheduledAt) is due (<= now).
 * @returns {Promise<Array<Object>>} List of due scheduled articles.
 */
async function getScheduledArticlesDueToPublish() {
  const articles = await getAllArticles();
  const nowTs = Date.now();
  return articles.filter(a => {
    if (!a || !a.status) return false;
    if (a.status.toLowerCase() !== 'scheduled') return false;
    const releaseTime = a.publish_at || a.publishAt || a.scheduledAt;
    if (!releaseTime) return false;
    let releaseTs = typeof releaseTime === 'number' ? releaseTime : new Date(releaseTime).getTime();
    if (typeof releaseTime === 'number' && releaseTime < 1e11) {
      releaseTs = releaseTime * 1000;
    } else if (typeof releaseTime === 'string' && /^\d+$/.test(releaseTime)) {
      const num = Number(releaseTime);
      releaseTs = num < 1e11 ? num * 1000 : num;
    }
    return !isNaN(releaseTs) && releaseTs <= nowTs;
  });
}

module.exports = {
  ensureInitialized,
  getAllArticles,
  getArticleById,
  getArticleByPermalink,
  findArticleWithRedirect,
  getAllRedirects,
  createArticle,
  updateArticle,
  deleteArticle,
  formatPreviewCard,
  clearStore,
  getScheduledArticlesDueToPublish
};
