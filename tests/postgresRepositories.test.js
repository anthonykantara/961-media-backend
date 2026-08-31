process.env.NODE_ENV = 'test';

const db = require('../src/db');
const articleStore = require('../src/models/articleStore');
const locationStore = require('../src/models/locationStore');
const languageStore = require('../src/models/languageStore');
const { runDataMigration } = require('../src/workers/dataMigrationWorker');

describe('PostgreSQL Repositories & Data Migration Pipeline', () => {
  let mockPool;
  let originalGetPool;

  beforeEach(() => {
    originalGetPool = db.getPool;
  });

  afterEach(() => {
    db.getPool = originalGetPool;
  });

  describe('Database Schema Migration Runner (db.runMigrations)', () => {
    it('should create schema_migrations table and execute unapplied migration files', async () => {
      const executedQueries = [];
      mockPool = {
        query: jest.fn().mockImplementation((sql, params) => {
          executedQueries.push({ sql: sql.trim(), params });
          if (sql.includes('SELECT filename FROM schema_migrations')) {
            return Promise.resolve({ rows: [] }); // No migrations applied yet
          }
          return Promise.resolve({ rows: [], rowCount: 1 });
        })
      };
      db.getPool = () => mockPool;

      const success = await db.runMigrations();
      expect(success).toBe(true);
      expect(executedQueries.some(q => q.sql.includes('CREATE TABLE IF NOT EXISTS schema_migrations'))).toBe(true);
      expect(executedQueries.some(q => q.sql.includes('INSERT INTO schema_migrations'))).toBe(true);
    });

    it('should skip already applied migrations', async () => {
      const executedQueries = [];
      mockPool = {
        query: jest.fn().mockImplementation((sql, params) => {
          executedQueries.push({ sql: sql.trim(), params });
          if (sql.includes('SELECT filename FROM schema_migrations')) {
            return Promise.resolve({ rows: [{ filename: params[0] }] }); // Already applied
          }
          return Promise.resolve({ rows: [], rowCount: 1 });
        })
      };
      db.getPool = () => mockPool;

      const success = await db.runMigrations();
      expect(success).toBe(true);
      // Ensure no INSERT INTO schema_migrations was executed because all were skipped
      expect(executedQueries.some(q => q.sql.includes('INSERT INTO schema_migrations'))).toBe(false);
    });
  });

  describe('Startup Data Migration Worker (runDataMigration)', () => {
    it('should seed database tables when counts are zero', async () => {
      const queries = [];
      mockPool = {
        query: jest.fn().mockImplementation((sql, params) => {
          queries.push({ sql: sql.trim(), params });
          if (sql.includes('SELECT COUNT(*) FROM')) {
            return Promise.resolve({ rows: [{ count: '0' }] });
          }
          return Promise.resolve({ rows: [], rowCount: 1 });
        })
      };
      db.getPool = () => mockPool;

      const result = await runDataMigration();
      expect(result).toBe(true);
      expect(queries.some(q => q.sql.includes('INSERT INTO languages'))).toBe(true);
      expect(queries.some(q => q.sql.includes('INSERT INTO locations'))).toBe(true);
      expect(queries.some(q => q.sql.includes('INSERT INTO articles'))).toBe(true);
    });
  });

  describe('Article PostgreSQL Repository Store', () => {
    it('should query articles ordered by created_at DESC in getAllArticles', async () => {
      mockPool = {
        query: jest.fn().mockResolvedValue({
          rows: [
            {
              id: 'art-1',
              title: 'Postgres Article 1',
              permalink: 'postgres-article-1',
              slug: 'postgres-article-1',
              redirects: '[]',
              previous_permalinks: '[]',
              content: 'Content 1',
              summary: 'Summary 1',
              author: 'Author 1',
              category: 'Tech',
              image: 'img1.jpg',
              image_url: 'img1.jpg',
              status: 'published',
              location_id: 'lb',
              language: 'en',
              date: 'Mar 28, 2026',
              time: '10:00 AM',
              views: '100',
              shares: '10',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ]
        })
      };
      db.getPool = () => mockPool;

      const articles = await articleStore.getAllArticles();
      expect(mockPool.query).toHaveBeenCalledWith('SELECT * FROM articles ORDER BY created_at DESC;');
      expect(articles.length).toBe(1);
      expect(articles[0].id).toBe('art-1');
      expect(articles[0].title).toBe('Postgres Article 1');
    });

    it('should query article by ID or permalink in getArticleById', async () => {
      mockPool = {
        query: jest.fn().mockResolvedValue({
          rows: [
            {
              id: 'art-1',
              title: 'Postgres Article 1',
              permalink: 'postgres-article-1',
              slug: 'postgres-article-1',
              redirects: '[]',
              previous_permalinks: '[]',
              content: 'Content',
              status: 'published',
              created_at: new Date().toISOString()
            }
          ]
        })
      };
      db.getPool = () => mockPool;

      const article = await articleStore.getArticleById('art-1');
      expect(article).not.toBeNull();
      expect(article.id).toBe('art-1');
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should execute findArticleWithRedirect with direct and redirect SQL checks', async () => {
      mockPool = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] }) // Direct match returns empty
          .mockResolvedValueOnce({ // Redirect match returns article
            rows: [
              {
                id: 'art-1',
                title: 'Target Article',
                permalink: 'new-target-permalink',
                slug: 'new-target-permalink',
                redirects: '["old-permalink"]',
                previous_permalinks: '["old-permalink"]',
                status: 'published',
                created_at: new Date().toISOString()
              }
            ]
          })
      };
      db.getPool = () => mockPool;

      const res = await articleStore.findArticleWithRedirect('old-permalink');
      expect(res).not.toBeNull();
      expect(res.isRedirect).toBe(true);
      expect(res.targetPermalink).toBe('new-target-permalink');
    });

    it('should execute INSERT into articles and article_redirects in createArticle', async () => {
      mockPool = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('INSERT INTO articles')) {
            return Promise.resolve({
              rows: [
                {
                  id: params[0],
                  title: params[1],
                  permalink: params[2],
                  slug: params[3],
                  redirects: params[4],
                  previous_permalinks: params[5],
                  content: params[6],
                  summary: params[7],
                  author: params[8],
                  category: params[9],
                  image: params[10],
                  image_url: params[11],
                  status: params[12],
                  location_id: params[13],
                  language: params[14],
                  date: params[15],
                  time: params[16],
                  views: params[17],
                  shares: params[18],
                  created_at: params[19],
                  updated_at: params[20]
                }
              ]
            });
          }
          return Promise.resolve({ rows: [], rowCount: 1 });
        })
      };
      db.getPool = () => mockPool;

      const created = await articleStore.createArticle({
        title: 'New PG Article',
        content: 'PG Body',
        redirects: ['old-pg-slug']
      });

      expect(created).not.toBeNull();
      expect(created.title).toBe('New PG Article');
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO articles'),
        expect.any(Array)
      );
    });

    it('should execute UPDATE articles and sync article_redirects in updateArticle', async () => {
      mockPool = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('SELECT * FROM articles')) {
            return Promise.resolve({
              rows: [{
                id: 'art-1',
                title: 'Old Title',
                permalink: 'old-title',
                slug: 'old-title',
                redirects: '[]',
                previous_permalinks: '[]',
                content: 'Body',
                status: 'published',
                created_at: new Date().toISOString()
              }]
            });
          }
          if (sql.includes('UPDATE articles')) {
            return Promise.resolve({
              rows: [{
                id: 'art-1',
                title: 'New Title',
                permalink: 'new-title',
                slug: 'new-title',
                redirects: '["old-title"]',
                previous_permalinks: '["old-title"]',
                content: 'Body',
                status: 'published',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }]
            });
          }
          return Promise.resolve({ rows: [], rowCount: 1 });
        })
      };
      db.getPool = () => mockPool;

      const updated = await articleStore.updateArticle('art-1', { title: 'New Title' });
      expect(updated).not.toBeNull();
      expect(updated.title).toBe('New Title');
      expect(updated.permalink).toBe('new-title');
    });

    it('should execute DELETE FROM articles in deleteArticle', async () => {
      mockPool = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('SELECT * FROM articles')) {
            return Promise.resolve({
              rows: [{ id: 'art-1', title: 'To Delete', permalink: 'to-delete' }]
            });
          }
          if (sql.includes('DELETE FROM articles')) {
            return Promise.resolve({ rows: [{ id: 'art-1' }], rowCount: 1 });
          }
          return Promise.resolve({ rows: [] });
        })
      };
      db.getPool = () => mockPool;

      const deleted = await articleStore.deleteArticle('art-1');
      expect(deleted).toBe(true);
    });
  });

  describe('Location PostgreSQL Repository Store', () => {
    it('should query locations in getAllLocations and getLocationById', async () => {
      mockPool = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('SELECT * FROM locations WHERE LOWER(id)')) {
            return Promise.resolve({
              rows: [{ id: 'lb', name: 'Lebanon', country: 'Lebanon', country_code: 'LB', region_id: 'levant', region_name: 'Levant', timezone: 'Asia/Beirut', enabled: true }]
            });
          }
          return Promise.resolve({
            rows: [{ id: 'lb', name: 'Lebanon', country: 'Lebanon', country_code: 'LB', region_id: 'levant', region_name: 'Levant', timezone: 'Asia/Beirut', enabled: true }]
          });
        })
      };
      db.getPool = () => mockPool;

      const all = await locationStore.getAllLocations();
      expect(all.length).toBe(1);
      expect(all[0].id).toBe('lb');

      const loc = await locationStore.getLocationById('lb');
      expect(loc.name).toBe('Lebanon');
    });

    it('should execute INSERT into locations in createLocation', async () => {
      mockPool = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('SELECT * FROM locations WHERE LOWER(id)')) {
            return Promise.resolve({ rows: [] }); // Not existing
          }
          if (sql.includes('INSERT INTO locations')) {
            return Promise.resolve({
              rows: [{ id: 'qa-doha', name: 'Doha', country: 'Qatar', country_code: 'QA', region_id: 'gcc', region_name: 'GCC', timezone: 'Asia/Qatar', enabled: true }]
            });
          }
          return Promise.resolve({ rows: [] });
        })
      };
      db.getPool = () => mockPool;

      const created = await locationStore.createLocation({
        id: 'qa-doha',
        name: 'Doha',
        country: 'Qatar',
        countryCode: 'QA',
        regionId: 'gcc'
      });
      expect(created.id).toBe('qa-doha');
    });
  });

  describe('Language PostgreSQL Repository Store', () => {
    it('should query languages in getAllLanguages and getLanguageByCode', async () => {
      mockPool = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('SELECT * FROM languages WHERE LOWER(code)')) {
            return Promise.resolve({
              rows: [{ code: 'en', name: 'English', native_name: 'English', dir: 'ltr', is_default: true, enabled: true }]
            });
          }
          return Promise.resolve({
            rows: [{ code: 'en', name: 'English', native_name: 'English', dir: 'ltr', is_default: true, enabled: true }]
          });
        })
      };
      db.getPool = () => mockPool;

      const langs = await languageStore.getAllLanguages();
      expect(langs.length).toBe(1);
      expect(langs[0].code).toBe('en');

      const lang = await languageStore.getLanguageByCode('en');
      expect(lang.name).toBe('English');
    });

    it('should execute INSERT into languages in createLanguage', async () => {
      mockPool = {
        query: jest.fn().mockImplementation((sql, params) => {
          if (sql.includes('SELECT * FROM languages WHERE LOWER(code)')) {
            return Promise.resolve({ rows: [] });
          }
          if (sql.includes('INSERT INTO languages')) {
            return Promise.resolve({
              rows: [{ code: 'es', name: 'Spanish', native_name: 'Español', dir: 'ltr', is_default: false, enabled: true }]
            });
          }
          return Promise.resolve({ rows: [] });
        })
      };
      db.getPool = () => mockPool;

      const created = await languageStore.createLanguage({ code: 'es', name: 'Spanish' });
      expect(created.code).toBe('es');
    });
  });
});
