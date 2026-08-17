const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, process.env.NODE_ENV === 'test' ? 'articles.test.json' : 'articles.json');

/**
 * Ensures that the data directory and the articles.json file exist.
 * If they do not exist, they are created with an empty array.
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
    // File does not exist, initialize it with empty array
    await fs.writeFile(FILE_PATH, JSON.stringify([], null, 2), 'utf8');
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
 * Saves articles list to the persistence store.
 * @param {Array} articles List of articles to save.
 */
async function saveAll(articles) {
  await ensureInitialized();
  await fs.writeFile(FILE_PATH, JSON.stringify(articles, null, 2), 'utf8');
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
  const newArticle = {
    id: crypto.randomUUID(),
    title: articleData.title,
    content: articleData.content,
    summary: articleData.summary || '',
    author: articleData.author || '',
    image: articleData.image || '',
    status: articleData.status || 'draft',
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

  // Define allowed fields to update to prevent accidental overriding of id, createdAt
  const updated = {
    ...existing,
    title: typeof updateData.title === 'string' ? updateData.title : existing.title,
    content: typeof updateData.content === 'string' ? updateData.content : existing.content,
    summary: typeof updateData.summary === 'string' ? updateData.summary : existing.summary,
    author: typeof updateData.author === 'string' ? updateData.author : existing.author,
    image: typeof updateData.image === 'string' ? updateData.image : existing.image,
    status: typeof updateData.status === 'string' ? updateData.status : existing.status,
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
