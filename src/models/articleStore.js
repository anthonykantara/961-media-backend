const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { generatePermalink } = require('../utils/permalink');

const DATA_DIR = path.join(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, process.env.NODE_ENV === 'test' ? 'articles.test.json' : 'articles.json');

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

let writeQueue = Promise.resolve();
let queue = Promise.resolve();

function enqueue(fn) {
  const res = queue.then(() => fn());
  queue = res.catch(() => {});
  return res;
}

/**
 * Ensures that the data directory and the articles.json file exist.
 * If they do not exist, they are created with initial seed data.
 */
async function ensureInitialized() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // Directory creation failed or already exists
  }

  try {
    await fs.access(FILE_PATH);
  } catch (err) {
    // File does not exist, initialize it
    const initialData = process.env.NODE_ENV === 'test' ? [] : DEFAULT_SEED_ARTICLES;
    await fs.writeFile(FILE_PATH, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

/**
 * Reads all articles from the persistence store.
 * @returns {Promise<Array>} List of articles.
 */
async function getAll() {
  await ensureInitialized();
  try {
    const data = await fs.readFile(FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // If reading or parsing fails, return empty array
    return [];
  }
}

/**
 * Saves articles list atomically to the persistence store.
 * @param {Array} articles List of articles to save.
 */
async function saveAll(articles) {
  await ensureInitialized();
  writeQueue = writeQueue.then(async () => {
    const tempPath = `${FILE_PATH}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
    await fs.writeFile(tempPath, JSON.stringify(articles, null, 2), 'utf8');
    await fs.rename(tempPath, FILE_PATH);
  }).catch(err => {
    console.error('Failed to save article store:', err);
  });
  return writeQueue;
}

/**
 * Fetches all articles, sorted by createdAt descending (newest first).
 * @returns {Promise<Array>} List of articles.
 */
async function getAllArticles() {
  const articles = await getAll();
  return articles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Fetches a single article by its unique ID or permalink/slug/redirect.
 * @param {string} id Unique article ID, permalink, slug, or old redirect permalink.
 * @returns {Promise<Object|null>} The article, or null if not found.
 */
async function getArticleById(id) {
  const articles = await getAll();
  if (!id) return null;
  const lower = id.toLowerCase();
  const article = articles.find(a =>
    a.id === id ||
    (a.permalink || '').toLowerCase() === lower ||
    (a.slug || '').toLowerCase() === lower ||
    (Array.isArray(a.redirects) && a.redirects.some(r => r.toLowerCase() === lower)) ||
    (Array.isArray(a.previousPermalinks) && a.previousPermalinks.some(r => r.toLowerCase() === lower))
  );
  return article || null;
}

/**
 * Resolves an article lookup, determining if it matched directly or via an auto-redirect.
 * @param {string} id Article ID, permalink, or old permalink/slug.
 * @returns {Promise<{ article: Object, isRedirect: boolean, targetPermalink: string }|null>}
 */
async function findArticleWithRedirect(id) {
  const articles = await getAll();
  if (!id) return null;
  const lower = id.toLowerCase();

  // 1. Direct match on id, permalink, or slug
  const directMatch = articles.find(a =>
    a.id === id ||
    (a.permalink || '').toLowerCase() === lower ||
    (a.slug || '').toLowerCase() === lower
  );
  if (directMatch) {
    return {
      article: directMatch,
      isRedirect: false,
      targetPermalink: directMatch.permalink || directMatch.slug
    };
  }

  // 2. Redirect match on redirects / previousPermalinks array
  const redirectMatch = articles.find(a =>
    (Array.isArray(a.redirects) && a.redirects.some(r => r.toLowerCase() === lower)) ||
    (Array.isArray(a.previousPermalinks) && a.previousPermalinks.some(r => r.toLowerCase() === lower))
  );
  if (redirectMatch) {
    return {
      article: redirectMatch,
      isRedirect: true,
      targetPermalink: redirectMatch.permalink || redirectMatch.slug
    };
  }

  return null;
}

/**
 * Returns a map/dictionary of all active redirects mapping old permalinks to new permalinks.
 * @returns {Promise<Object>} Object mapping oldPermalink -> newPermalink
 */
async function getAllRedirects() {
  const articles = await getAll();
  const redirectMap = {};
  articles.forEach(a => {
    const currentPermalink = a.permalink || a.slug;
    const redirects = Array.isArray(a.redirects)
      ? a.redirects
      : (Array.isArray(a.previousPermalinks) ? a.previousPermalinks : []);
    redirects.forEach(oldP => {
      if (oldP && oldP !== currentPermalink) {
        redirectMap[oldP] = currentPermalink;
      }
    });
  });
  return redirectMap;
}

/**
 * Fetches a single article by its permalink or slug.
 * @param {string} permalink Article permalink or slug.
 * @returns {Promise<Object|null>} The article, or null if not found.
 */
async function getArticleByPermalink(permalink) {
  return getArticleById(permalink);
}

/**
 * Creates a new article in the store.
 * @param {Object} articleData Input article details.
 * @returns {Promise<Object>} The newly created article.
 */
async function createArticle(articleData) {
  return enqueue(async () => {
    const articles = await getAll();

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

    const newArticle = {
      id: articleData.id || crypto.randomUUID(),
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
      locationId: articleData.locationId || 'lb',
      language: articleData.language || 'en',
      date: articleData.date || dateStr,
      time: articleData.time || timeStr,
      views: articleData.views !== undefined ? String(articleData.views) : '0',
      shares: articleData.shares !== undefined ? String(articleData.shares) : '0',
      createdAt: now,
      updatedAt: now
    };

    articles.push(newArticle);
    await saveAll(articles);
    return newArticle;
  });
}

/**
 * Updates an existing article in the store.
 * If permalink or title/slug changes, automatically records old permalink into redirects for SEO auto-redirection.
 * @param {string} id Unique article ID or permalink.
 * @param {Object} updateData Fields to update.
 * @returns {Promise<Object|null>} The updated article, or null if not found.
 */
async function updateArticle(id, updateData) {
  return enqueue(async () => {
    const articles = await getAll();
    const lowerId = id ? id.toLowerCase() : '';
    const index = articles.findIndex(a =>
      a.id === id ||
      (a.permalink || '').toLowerCase() === lowerId ||
      (a.slug || '').toLowerCase() === lowerId ||
      (Array.isArray(a.redirects) && a.redirects.some(r => r.toLowerCase() === lowerId)) ||
      (Array.isArray(a.previousPermalinks) && a.previousPermalinks.some(r => r.toLowerCase() === lowerId))
    );
    if (index === -1) {
      return null;
    }

    const existing = articles[index];
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

    // Filter out current permalinkVal to avoid infinite loop
    updatedRedirects = Array.from(new Set(updatedRedirects)).filter(r => r && r !== permalinkVal);

    const imageVal = typeof updateData.imageUrl === 'string'
      ? updateData.imageUrl
      : (typeof updateData.image === 'string' ? updateData.image : (existing.imageUrl || existing.image || ''));

    const updated = {
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
      locationId: typeof updateData.locationId === 'string' ? updateData.locationId : (existing.locationId || 'lb'),
      language: typeof updateData.language === 'string' ? updateData.language : (existing.language || 'en'),
      date: typeof updateData.date === 'string' ? updateData.date : existing.date,
      time: typeof updateData.time === 'string' ? updateData.time : existing.time,
      views: updateData.views !== undefined ? String(updateData.views) : (existing.views || '0'),
      shares: updateData.shares !== undefined ? String(updateData.shares) : (existing.shares || '0'),
      updatedAt: now
    };

    articles[index] = updated;
    await saveAll(articles);
    return updated;
  });
}

/**
 * Deletes an article from the store.
 * @param {string} id Unique article ID or permalink.
 * @returns {Promise<boolean>} True if found and deleted, false otherwise.
 */
async function deleteArticle(id) {
  return enqueue(async () => {
    const articles = await getAll();
    const lowerId = id ? id.toLowerCase() : '';
    const index = articles.findIndex(a =>
      a.id === id ||
      (a.permalink || '').toLowerCase() === lowerId ||
      (a.slug || '').toLowerCase() === lowerId ||
      (Array.isArray(a.redirects) && a.redirects.some(r => r.toLowerCase() === lowerId)) ||
      (Array.isArray(a.previousPermalinks) && a.previousPermalinks.some(r => r.toLowerCase() === lowerId))
    );
    if (index === -1) {
      return false;
    }

    articles.splice(index, 1);
    await saveAll(articles);
    return true;
  });
}

/**
 * Formats an article into a preview card structure for public web feed displays.
 * @param {Object} article 
 * @returns {Object} Preview card object
 */
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

/**
 * Resets the store with an empty array.
 */
async function clearStore() {
  return enqueue(async () => {
    await saveAll([]);
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
  clearStore
};
