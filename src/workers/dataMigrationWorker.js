const fs = require('fs').promises;
const path = require('path');
const db = require('../db');

const DATA_DIR = path.join(__dirname, '../../data');

const DEFAULT_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr', isDefault: true, enabled: true },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', dir: 'rtl', isDefault: false, enabled: true },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr', isDefault: false, enabled: true }
];

const DEFAULT_LOCATIONS = [
  { id: 'lb', name: 'Lebanon', country: 'Lebanon', countryCode: 'LB', regionId: 'levant', regionName: 'Levant', timezone: 'Asia/Beirut', enabled: true },
  { id: 'sa-riyadh', name: 'Riyadh', country: 'Saudi Arabia', countryCode: 'SA', regionId: 'gcc', regionName: 'GCC', timezone: 'Asia/Riyadh', enabled: true },
  { id: 'ae-dubai', name: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE', regionId: 'gcc', regionName: 'GCC', timezone: 'Asia/Dubai', enabled: true },
  { id: 'eg-cairo', name: 'Cairo', country: 'Egypt', countryCode: 'EG', regionId: 'north-africa', regionName: 'North Africa', timezone: 'Africa/Cairo', enabled: true }
];

const DEFAULT_ARTICLES = [
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

async function readJsonFile(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

async function runDataMigration() {
  const pool = db.getPool();
  if (!pool) {
    return false;
  }

  try {
    // 1. Seed Languages
    const langCountRes = await pool.query('SELECT COUNT(*) FROM languages;');
    const langCount = parseInt(langCountRes.rows[0].count, 10);
    if (langCount === 0) {
      const fileLangs = await readJsonFile('languages.json');
      const langsToSeed = (Array.isArray(fileLangs) && fileLangs.length > 0) ? fileLangs : DEFAULT_LANGUAGES;
      for (const l of langsToSeed) {
        await pool.query(
          `INSERT INTO languages (code, name, native_name, dir, is_default, enabled)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (code) DO NOTHING;`,
          [
            l.code,
            l.name || l.code.toUpperCase(),
            l.nativeName || l.native_name || l.name || l.code.toUpperCase(),
            l.dir === 'rtl' ? 'rtl' : 'ltr',
            Boolean(l.isDefault || l.is_default),
            l.enabled !== undefined ? Boolean(l.enabled) : true
          ]
        );
      }
    }

    // 2. Seed Locations
    const locCountRes = await pool.query('SELECT COUNT(*) FROM locations;');
    const locCount = parseInt(locCountRes.rows[0].count, 10);
    if (locCount === 0) {
      const fileLocs = await readJsonFile('locations.json');
      const locsToSeed = (Array.isArray(fileLocs) && fileLocs.length > 0) ? fileLocs : DEFAULT_LOCATIONS;
      for (const loc of locsToSeed) {
        await pool.query(
          `INSERT INTO locations (id, name, country, country_code, region_id, region_name, timezone, enabled)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING;`,
          [
            loc.id,
            loc.name || loc.id,
            loc.country || '',
            loc.countryCode || loc.country_code || '',
            loc.regionId || loc.region_id || 'other',
            loc.regionName || loc.region_name || 'Other',
            loc.timezone || 'UTC',
            loc.enabled !== undefined ? Boolean(loc.enabled) : true
          ]
        );
      }
    }

    // 3. Seed Articles
    const artCountRes = await pool.query('SELECT COUNT(*) FROM articles;');
    const artCount = parseInt(artCountRes.rows[0].count, 10);
    if (artCount === 0) {
      const fileArts = await readJsonFile('articles.json');
      const artsToSeed = (Array.isArray(fileArts) && fileArts.length > 0) ? fileArts : DEFAULT_ARTICLES;
      for (const a of artsToSeed) {
        const permalinkVal = a.permalink || a.slug || '';
        const redirectsArr = Array.isArray(a.redirects) ? a.redirects : (Array.isArray(a.previousPermalinks) ? a.previousPermalinks : []);
        const imgVal = a.image || a.imageUrl || '';

        await pool.query(
          `INSERT INTO articles (
             id, title, permalink, slug, redirects, previous_permalinks, content, summary,
             author, category, image, image_url, status, location_id, language, date, time,
             views, shares, created_at, updated_at
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
           ) ON CONFLICT (id) DO NOTHING;`,
          [
            a.id,
            a.title,
            permalinkVal,
            permalinkVal,
            JSON.stringify(redirectsArr),
            JSON.stringify(redirectsArr),
            a.content || '',
            a.summary || '',
            a.author || '',
            a.category || '',
            imgVal,
            imgVal,
            a.status || 'draft',
            a.locationId || a.location_id || 'lb',
            a.language || 'en',
            a.date || '',
            a.time || '',
            String(a.views || '0'),
            String(a.shares || '0'),
            a.createdAt || a.created_at || new Date().toISOString(),
            a.updatedAt || a.updated_at || new Date().toISOString()
          ]
        );

        for (const oldP of redirectsArr) {
          if (oldP && oldP !== permalinkVal) {
            await pool.query(
              `INSERT INTO article_redirects (article_id, old_permalink, target_permalink)
               VALUES ($1, $2, $3)
               ON CONFLICT (old_permalink) DO NOTHING;`,
              [a.id, oldP, permalinkVal]
            );
          }
        }
      }
    }

    // 4. Seed Queue tasks if empty
    const queueCountRes = await pool.query('SELECT COUNT(*) FROM dispatch_queue;');
    const queueCount = parseInt(queueCountRes.rows[0].count, 10);
    if (queueCount === 0) {
      const fileQueue = (await readJsonFile('queue.json')) || (await readJsonFile('dispatch_queue.json'));
      if (Array.isArray(fileQueue) && fileQueue.length > 0) {
        for (const t of fileQueue) {
          await pool.query(
            `INSERT INTO dispatch_queue (id, article_id, task_type, options, status, attempts, max_attempts, last_error, next_run_at, created_at, updated_at, results)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO NOTHING;`,
            [
              t.id,
              String(t.article_id || t.articleId),
              t.task_type || t.taskType || 'dispatch_all',
              JSON.stringify(t.options || {}),
              t.status || 'pending',
              t.attempts || 0,
              t.max_attempts || t.maxAttempts || 5,
              t.last_error || t.lastError || null,
              t.next_run_at || t.nextRunAt || new Date().toISOString(),
              t.created_at || t.createdAt || new Date().toISOString(),
              t.updated_at || t.updatedAt || new Date().toISOString(),
              JSON.stringify(t.results || {})
            ]
          );
        }
      }
    }

    return true;
  } catch (err) {
    console.error('Data migration error:', err.message);
    return false;
  }
}

module.exports = {
  runDataMigration,
  DEFAULT_LANGUAGES,
  DEFAULT_LOCATIONS,
  DEFAULT_ARTICLES
};
