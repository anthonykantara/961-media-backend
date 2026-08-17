const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, process.env.NODE_ENV === 'test' ? 'articles.test.json' : 'articles.json');

const DEFAULT_SEED_ARTICLES = [
  {
    id: 'lb-en-1',
    title: "Lebanon's Tech Scene is Booming in 2026",
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
    const tempPath = `${FILE_PATH}.tmp.${Date.now()}`;
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
 * Fetches a single article by its unique ID.
 * @param {string} id Unique article ID.
 * @returns {Promise<Object|null>} The article, or null if not found.
 */
async function getArticleById(id) {
  const articles = await getAll();
  const article = articles.find(a => a.id === id);
  return article || null;
}

/**
 * Creates a new article in the store.
 * @param {Object} articleData Input article details.
 * @returns {Promise<Object>} The newly created article.
 */
async function createArticle(articleData) {
  const articles = await getAll();

  const now = new Date().toISOString();
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const imageVal = articleData.image || articleData.imageUrl || '';

  const newArticle = {
    id: articleData.id || crypto.randomUUID(),
    title: articleData.title,
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
}

/**
 * Updates an existing article in the store.
 * @param {string} id Unique article ID.
 * @param {Object} updateData Fields to update.
 * @returns {Promise<Object|null>} The updated article, or null if not found.
 */
async function updateArticle(id, updateData) {
  const articles = await getAll();
  const index = articles.findIndex(a => a.id === id);
  if (index === -1) {
    return null;
  }

  const existing = articles[index];
  const now = new Date().toISOString();

  const imageVal = typeof updateData.image === 'string'
    ? updateData.image
    : (typeof updateData.imageUrl === 'string' ? updateData.imageUrl : (existing.image || existing.imageUrl || ''));

  const updated = {
    ...existing,
    title: typeof updateData.title === 'string' ? updateData.title : existing.title,
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
}

/**
 * Deletes an article from the store.
 * @param {string} id Unique article ID.
 * @returns {Promise<boolean>} True if found and deleted, false otherwise.
 */
async function deleteArticle(id) {
  const articles = await getAll();
  const index = articles.findIndex(a => a.id === id);
  if (index === -1) {
    return false;
  }

  articles.splice(index, 1);
  await saveAll(articles);
  return true;
}

/**
 * Resets the store with an empty array.
 */
async function clearStore() {
  await saveAll([]);
}

module.exports = {
  ensureInitialized,
  getAllArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  clearStore
};
