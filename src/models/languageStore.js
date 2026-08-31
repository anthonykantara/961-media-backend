const db = require('../db');

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

let memoryLanguages = [];

function formatLanguageRecord(row) {
  if (!row) return null;
  return {
    code: row.code,
    name: row.name,
    nativeName: row.native_name || row.nativeName || row.name,
    dir: row.dir || 'ltr',
    isDefault: row.is_default !== undefined ? Boolean(row.is_default) : Boolean(row.isDefault),
    enabled: row.enabled !== undefined ? Boolean(row.enabled) : true
  };
}

async function ensureInitialized() {
  const pool = db.getPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT COUNT(*) FROM languages;');
      if (res && res.rows && parseInt(res.rows[0].count, 10) === 0) {
        for (const l of DEFAULT_SEED_LANGUAGES) {
          await pool.query(
            `INSERT INTO languages (code, name, native_name, dir, is_default, enabled)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (code) DO NOTHING;`,
            [l.code, l.name, l.nativeName, l.dir, l.isDefault, l.enabled]
          );
        }
      }
      return;
    } catch (err) {
      // Fallback
    }
  }

  if (memoryLanguages.length === 0) {
    memoryLanguages = DEFAULT_SEED_LANGUAGES.map(l => ({ ...l }));
  }
}

async function getAllLanguages() {
  await ensureInitialized();
  const pool = db.getPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM languages ORDER BY code ASC;');
      if (res && res.rows) {
        return res.rows.map(formatLanguageRecord);
      }
    } catch (err) {
      console.error('Database getAllLanguages error, using fallback:', err.message);
    }
  }

  return memoryLanguages.map(formatLanguageRecord);
}

async function getActiveLanguages() {
  const languages = await getAllLanguages();
  return languages.filter(l => l.enabled !== false);
}

async function getLanguageByCode(code) {
  if (!code) return null;
  const normalizedCode = String(code).trim().toLowerCase();
  const pool = db.getPool();
  if (pool) {
    try {
      const res = await pool.query('SELECT * FROM languages WHERE LOWER(code) = $1 LIMIT 1;', [normalizedCode]);
      if (res && res.rows && res.rows[0]) {
        return formatLanguageRecord(res.rows[0]);
      }
      return null;
    } catch (err) {
      console.error('Database getLanguageByCode error, using fallback:', err.message);
    }
  }

  const found = memoryLanguages.find(l => l.code && l.code.toLowerCase() === normalizedCode);
  return found ? formatLanguageRecord(found) : null;
}

async function createLanguage(langData) {
  const code = String(langData.code || '').trim().toLowerCase();
  if (!code) {
    throw new Error('Language code is required.');
  }

  const existing = await getLanguageByCode(code);
  if (existing) {
    throw new Error(`Language with code '${code}' already exists.`);
  }

  const isDefault = Boolean(langData.isDefault);
  const newLang = {
    code,
    name: langData.name || code.toUpperCase(),
    nativeName: langData.nativeName || langData.name || code.toUpperCase(),
    dir: langData.dir === 'rtl' ? 'rtl' : 'ltr',
    isDefault,
    enabled: langData.enabled !== undefined ? Boolean(langData.enabled) : true
  };

  const pool = db.getPool();
  if (pool) {
    try {
      if (isDefault) {
        await pool.query('UPDATE languages SET is_default = false;');
      }
      const sql = `
        INSERT INTO languages (code, name, native_name, dir, is_default, enabled)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const res = await pool.query(sql, [
        newLang.code,
        newLang.name,
        newLang.nativeName,
        newLang.dir,
        newLang.isDefault,
        newLang.enabled
      ]);
      if (res && res.rows && res.rows[0]) {
        return formatLanguageRecord(res.rows[0]);
      }
    } catch (err) {
      console.error('Database createLanguage error, using fallback:', err.message);
    }
  }

  if (isDefault) {
    memoryLanguages.forEach(l => { l.isDefault = false; });
  }
  memoryLanguages.push(newLang);
  return formatLanguageRecord(newLang);
}

async function updateLanguage(code, updateData) {
  const normalizedCode = String(code).trim().toLowerCase();
  const existing = await getLanguageByCode(normalizedCode);
  if (!existing) {
    return null;
  }

  const isDefault = updateData.isDefault !== undefined ? Boolean(updateData.isDefault) : existing.isDefault;
  const updatedName = typeof updateData.name === 'string' ? updateData.name : existing.name;
  const updatedNativeName = typeof updateData.nativeName === 'string' ? updateData.nativeName : existing.nativeName;
  const updatedDir = updateData.dir ? (updateData.dir === 'rtl' ? 'rtl' : 'ltr') : existing.dir;
  const updatedEnabled = updateData.enabled !== undefined ? Boolean(updateData.enabled) : existing.enabled;

  const pool = db.getPool();
  if (pool) {
    try {
      if (isDefault) {
        await pool.query('UPDATE languages SET is_default = false;');
      }
      const sql = `
        UPDATE languages
        SET name = $1, native_name = $2, dir = $3, is_default = $4, enabled = $5, updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(code) = $6
        RETURNING *;
      `;
      const res = await pool.query(sql, [
        updatedName,
        updatedNativeName,
        updatedDir,
        isDefault,
        updatedEnabled,
        normalizedCode
      ]);
      if (res && res.rows && res.rows[0]) {
        return formatLanguageRecord(res.rows[0]);
      }
    } catch (err) {
      console.error('Database updateLanguage error, using fallback:', err.message);
    }
  }

  if (isDefault) {
    memoryLanguages.forEach(l => { l.isDefault = false; });
  }

  const index = memoryLanguages.findIndex(l => l.code && l.code.toLowerCase() === normalizedCode);
  if (index !== -1) {
    memoryLanguages[index] = {
      ...memoryLanguages[index],
      name: updatedName,
      nativeName: updatedNativeName,
      dir: updatedDir,
      isDefault,
      enabled: updatedEnabled
    };
    return formatLanguageRecord(memoryLanguages[index]);
  }
  return null;
}

async function deleteLanguage(code) {
  const normalizedCode = String(code).trim().toLowerCase();
  const pool = db.getPool();
  if (pool) {
    try {
      const res = await pool.query('DELETE FROM languages WHERE LOWER(code) = $1 RETURNING code;', [normalizedCode]);
      if (res && res.rows && res.rows.length > 0) {
        return true;
      }
      return false;
    } catch (err) {
      console.error('Database deleteLanguage error, using fallback:', err.message);
    }
  }

  const index = memoryLanguages.findIndex(l => l.code && l.code.toLowerCase() === normalizedCode);
  if (index === -1) {
    return false;
  }
  memoryLanguages.splice(index, 1);
  return true;
}

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
  const exact = activeLanguages.find(l => l.code && l.code.toLowerCase() === cleanReq);
  if (exact) return exact;

  // 2. Primary subtag match
  const primarySubtag = cleanReq.split('-')[0].split('_')[0];
  const subtagMatch = activeLanguages.find(l => l.code && l.code.toLowerCase() === primarySubtag);
  if (subtagMatch) return subtagMatch;

  // 3. Default language fallback
  const defaultLang = activeLanguages.find(l => l.isDefault) || activeLanguages[0];
  return defaultLang;
}

async function clearStore(useSeed = false) {
  const pool = db.getPool();
  if (pool) {
    try {
      await pool.query('TRUNCATE TABLE languages;');
      if (useSeed) {
        for (const l of DEFAULT_SEED_LANGUAGES) {
          await pool.query(
            `INSERT INTO languages (code, name, native_name, dir, is_default, enabled)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (code) DO NOTHING;`,
            [l.code, l.name, l.nativeName, l.dir, l.isDefault, l.enabled]
          );
        }
      }
    } catch (err) {
      console.error('Database clearStore error, using fallback:', err.message);
    }
  }

  memoryLanguages = useSeed ? DEFAULT_SEED_LANGUAGES.map(l => ({ ...l })) : [];
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
