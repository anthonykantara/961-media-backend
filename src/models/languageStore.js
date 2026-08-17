const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, process.env.NODE_ENV === 'test' ? 'languages.test.json' : 'languages.json');

const DEFAULT_SEED_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    dir: 'ltr',
    isDefault: true,
    enabled: true
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    dir: 'rtl',
    isDefault: false,
    enabled: true
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    dir: 'ltr',
    isDefault: false,
    enabled: true
  }
];

let writeQueue = Promise.resolve();

/**
 * Ensures data directory and persistence file exist.
 */
async function ensureInitialized() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // Directory already exists or creation failed
  }

  try {
    await fs.access(FILE_PATH);
  } catch (err) {
    const initialData = process.env.NODE_ENV === 'test' ? DEFAULT_SEED_LANGUAGES : DEFAULT_SEED_LANGUAGES;
    await fs.writeFile(FILE_PATH, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

/**
 * Reads all languages from store.
 */
async function getAllLanguages() {
  await ensureInitialized();
  try {
    const data = await fs.readFile(FILE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
}

/**
 * Saves language array atomically.
 */
async function saveAll(languages) {
  await ensureInitialized();
  writeQueue = writeQueue.then(async () => {
    const tempPath = `${FILE_PATH}.tmp.${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(languages, null, 2), 'utf8');
    await fs.rename(tempPath, FILE_PATH);
  }).catch(err => {
    console.error('Failed to save language store:', err);
  });
  return writeQueue;
}

/**
 * Gets active/enabled languages for frontend navigation & selectors.
 */
async function getActiveLanguages() {
  const languages = await getAllLanguages();
  return languages.filter(l => l.enabled !== false);
}

/**
 * Gets a language by its ISO code.
 */
async function getLanguageByCode(code) {
  if (!code) return null;
  const languages = await getAllLanguages();
  const normalizedCode = String(code).trim().toLowerCase();
  return languages.find(l => l.code.toLowerCase() === normalizedCode) || null;
}

/**
 * Creates/Registers a new language.
 */
async function createLanguage(langData) {
  const languages = await getAllLanguages();
  const code = String(langData.code || '').trim().toLowerCase();

  if (!code) {
    throw new Error('Language code is required.');
  }

  const existingIndex = languages.findIndex(l => l.code.toLowerCase() === code);
  if (existingIndex !== -1) {
    throw new Error(`Language with code '${code}' already exists.`);
  }

  // If new language is marked as default, unmark previous default
  if (langData.isDefault) {
    languages.forEach(l => { l.isDefault = false; });
  }

  const newLanguage = {
    code,
    name: langData.name || code.toUpperCase(),
    nativeName: langData.nativeName || langData.name || code.toUpperCase(),
    dir: langData.dir === 'rtl' ? 'rtl' : 'ltr',
    isDefault: Boolean(langData.isDefault),
    enabled: langData.enabled !== undefined ? Boolean(langData.enabled) : true
  };

  languages.push(newLanguage);
  await saveAll(languages);
  return newLanguage;
}

/**
 * Updates an existing language.
 */
async function updateLanguage(code, updateData) {
  const languages = await getAllLanguages();
  const normalizedCode = String(code).trim().toLowerCase();
  const index = languages.findIndex(l => l.code.toLowerCase() === normalizedCode);

  if (index === -1) {
    return null;
  }

  if (updateData.isDefault) {
    languages.forEach(l => { l.isDefault = false; });
  }

  const existing = languages[index];
  const updated = {
    ...existing,
    name: typeof updateData.name === 'string' ? updateData.name : existing.name,
    nativeName: typeof updateData.nativeName === 'string' ? updateData.nativeName : existing.nativeName,
    dir: updateData.dir ? (updateData.dir === 'rtl' ? 'rtl' : 'ltr') : existing.dir,
    isDefault: updateData.isDefault !== undefined ? Boolean(updateData.isDefault) : existing.isDefault,
    enabled: updateData.enabled !== undefined ? Boolean(updateData.enabled) : existing.enabled
  };

  languages[index] = updated;
  await saveAll(languages);
  return updated;
}

/**
 * Deletes a language by code.
 */
async function deleteLanguage(code) {
  const languages = await getAllLanguages();
  const normalizedCode = String(code).trim().toLowerCase();
  const index = languages.findIndex(l => l.code.toLowerCase() === normalizedCode);

  if (index === -1) {
    return false;
  }

  languages.splice(index, 1);
  await saveAll(languages);
  return true;
}

/**
 * Resolves requested locale with intelligent fallbacks.
 * Matches exact code -> primary subtag (e.g. en-US -> en) -> default language -> first enabled language.
 */
async function resolveLocale(requestedLocale) {
  const activeLanguages = await getActiveLanguages();
  if (!activeLanguages.length) {
    return DEFAULT_SEED_LANGUAGES[0];
  }

  if (!requestedLocale) {
    const defaultLang = activeLanguages.find(l => l.isDefault) || activeLanguages[0];
    return defaultLang;
  }

  const cleanReq = String(requestedLocale).trim().toLowerCase();

  // 1. Exact match
  const exact = activeLanguages.find(l => l.code.toLowerCase() === cleanReq);
  if (exact) return exact;

  // 2. Primary subtag match (e.g. 'en-US' -> 'en', 'ar-LB' -> 'ar')
  const primarySubtag = cleanReq.split('-')[0].split('_')[0];
  const subtagMatch = activeLanguages.find(l => l.code.toLowerCase() === primarySubtag);
  if (subtagMatch) return subtagMatch;

  // 3. Default language fallback
  const defaultLang = activeLanguages.find(l => l.isDefault) || activeLanguages[0];
  return defaultLang;
}

/**
 * Resets store to default seed languages (or empty for tests if cleared).
 */
async function clearStore(useSeed = false) {
  if (useSeed) {
    await saveAll(DEFAULT_SEED_LANGUAGES);
  } else {
    await saveAll([]);
  }
}

module.exports = {
  ensureInitialized,
  getAllLanguages,
  getActiveLanguages,
  getLanguageByCode,
  createLanguage,
  updateLanguage,
  deleteLanguage,
  resolveLocale,
  clearStore
};
