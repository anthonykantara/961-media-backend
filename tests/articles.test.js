// Set the environment to test so that we write to articles.test.json
process.env.NODE_ENV = 'test';
process.env.WEBSITE_URL = 'http://localhost:3000';
process.env.DASHBOARD_URL = 'http://localhost:3001';

const request = require('supertest');
const app = require('../src/app');
const articleStore = require('../src/models/articleStore');

describe('Articles API Endpoints', () => {
  beforeEach(async () => {
    // Empty the test data store before each test run
    await articleStore.clearStore();
  });

  afterAll(async () => {
    // Reset/clear the store at the end of the test suite
    await articleStore.clearStore();
  });

  describe('GET /api/articles', () => {
    it('should return an empty list when no articles exist', async () => {
      const res = await request(app).get('/api/articles');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return articles sorted by createdAt descending (newest first)', async () => {
      // Create two articles
      const article1 = await articleStore.createArticle({
        title: 'First Article',
        content: 'This is the first article'
      });
      // Pause slightly to ensure timestamps are different
      await new Promise(resolve => setTimeout(resolve, 50));

      const article2 = await articleStore.createArticle({
        title: 'Second Article',
        content: 'This is the second article'
      });

      const res = await request(app).get('/api/articles');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body[0].id).toBe(article2.id); // Newest first
      expect(res.body[1].id).toBe(article1.id);
    });
  });

  describe('POST /api/articles', () => {
    it('should create a new article with required and default fields', async () => {
      const payload = {
        title: 'My Test Article',
        content: 'This is some wonderful test content.',
        author: 'John Doe',
        status: 'published'
      };

      const res = await request(app)
        .post('/api/articles')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe(payload.title);
      expect(res.body.content).toBe(payload.content);
      expect(res.body.author).toBe(payload.author);
      expect(res.body.status).toBe(payload.status);
      expect(res.body).toHaveProperty('createdAt');
      expect(res.body).toHaveProperty('updatedAt');
      expect(res.body.summary).toBe(''); // default empty string
      expect(res.body.image).toBe(''); // default empty string

      // Verify it was persisted in store
      const saved = await articleStore.getArticleById(res.body.id);
      expect(saved).not.toBeNull();
      expect(saved.title).toBe(payload.title);
    });

    it('should fail with 400 validation error if title is missing or empty', async () => {
      const payload = {
        content: 'Content but no title.'
      };

      const res = await request(app)
        .post('/api/articles')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.messages).toContain('Title is required and must be a non-empty string.');
    });

    it('should fail with 400 validation error if content is missing or empty', async () => {
      const payload = {
        title: 'Title but no content.'
      };

      const res = await request(app)
        .post('/api/articles')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.messages).toContain('Content is required and must be a non-empty string.');
    });

    it('should fail with 400 validation error if optional fields are not strings', async () => {
      const payload = {
        title: 'Valid title',
        content: 'Valid content',
        author: 12345 // number instead of string
      };

      const res = await request(app)
        .post('/api/articles')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.messages).toContain('Author must be a string.');
    });
  });

  describe('GET /api/articles/:id', () => {
    it('should return the article with the matching ID', async () => {
      const created = await articleStore.createArticle({
        title: 'Single article search',
        content: 'Searching for this article.'
      });

      const res = await request(app).get(`/api/articles/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.id);
      expect(res.body.title).toBe(created.title);
    });

    it('should return 404 if the article ID does not exist', async () => {
      const res = await request(app).get('/api/articles/some-fake-uuid');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Article with ID some-fake-uuid not found.');
    });
  });

  describe('PUT /api/articles/:id', () => {
    it('should update provided fields and update the updatedAt timestamp', async () => {
      const created = await articleStore.createArticle({
        title: 'Original Title',
        content: 'Original Content',
        author: 'Original Author',
        status: 'draft'
      });

      // Pause briefly
      await new Promise(resolve => setTimeout(resolve, 50));

      const updatePayload = {
        title: 'Updated Title',
        status: 'published'
      };

      const res = await request(app)
        .put(`/api/articles/${created.id}`)
        .send(updatePayload);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(created.id);
      expect(res.body.title).toBe('Updated Title');
      expect(res.body.content).toBe('Original Content'); // kept
      expect(res.body.author).toBe('Original Author'); // kept
      expect(res.body.status).toBe('published'); // updated
      expect(res.body.createdAt).toBe(created.createdAt); // unchanged
      expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(new Date(created.updatedAt).getTime()); // changed!

      // Verify store
      const saved = await articleStore.getArticleById(created.id);
      expect(saved.title).toBe('Updated Title');
    });

    it('should return 404 if the article ID does not exist', async () => {
      const res = await request(app)
        .put('/api/articles/non-existent-id')
        .send({ title: 'New title' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Article with ID non-existent-id not found.');
    });

    it('should return 400 validation error if updated title or content are invalid types', async () => {
      const created = await articleStore.createArticle({
        title: 'Valid Article',
        content: 'Valid Content'
      });

      const res = await request(app)
        .put(`/api/articles/${created.id}`)
        .send({ title: '', content: 12345 });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.messages).toContain('Title is required and must be a non-empty string.');
      expect(res.body.messages).toContain('Content is required and must be a non-empty string.');
    });
  });

  describe('DELETE /api/articles/:id', () => {
    it('should delete the article successfully', async () => {
      const created = await articleStore.createArticle({
        title: 'To Be Deleted',
        content: 'Delete me.'
      });

      const res = await request(app).delete(`/api/articles/${created.id}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Article successfully deleted.');
      expect(res.body.id).toBe(created.id);

      // Verify not in store
      const saved = await articleStore.getArticleById(created.id);
      expect(saved).toBeNull();
    });

    it('should return 404 if the article to delete does not exist', async () => {
      const res = await request(app).delete('/api/articles/another-fake-id');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Article with ID another-fake-id not found.');
    });
  });

  describe('CORS Restrictions', () => {
    it('should allow requests from the website origin', async () => {
      const res = await request(app)
        .get('/api/articles')
        .set('Origin', 'http://localhost:3000');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should allow requests from the dashboard origin', async () => {
      const res = await request(app)
        .get('/api/articles')
        .set('Origin', 'http://localhost:3001');

      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3001');
    });

    it('should allow requests with no Origin header (e.g. server-to-server or cURL)', async () => {
      const res = await request(app).get('/api/articles');
      expect(res.status).toBe(200);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should block requests from unauthorized origins', async () => {
      const res = await request(app)
        .get('/api/articles')
        .set('Origin', 'http://malicioussite.com');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('CORS Error');
      expect(res.body.message).toBe('Not allowed by CORS');
    });
  });

  describe('Filtering, Search, and Enhanced Features', () => {
    it('should filter articles by category, status, locationId, and language', async () => {
      await articleStore.createArticle({
        title: 'Tech Article',
        content: 'Content 1',
        category: 'Tech',
        status: 'published',
        locationId: 'lb',
        language: 'en'
      });

      await articleStore.createArticle({
        title: 'Food Article',
        content: 'Content 2',
        category: 'Food',
        status: 'draft',
        locationId: 'sa-riyadh',
        language: 'ar'
      });

      const catRes = await request(app).get('/api/articles?category=tech');
      expect(catRes.status).toBe(200);
      expect(catRes.body.length).toBe(1);
      expect(catRes.body[0].title).toBe('Tech Article');

      const locRes = await request(app).get('/api/articles?locationId=sa-riyadh');
      expect(locRes.status).toBe(200);
      expect(locRes.body.length).toBe(1);
      expect(locRes.body[0].title).toBe('Food Article');
    });

    it('should search articles by term across title and content', async () => {
      await articleStore.createArticle({
        title: 'Beirut Rooftops',
        content: 'Amazing views'
      });
      await articleStore.createArticle({
        title: 'Dubai AI Hub',
        content: 'Tech expansion'
      });

      const searchRes = await request(app).get('/api/articles?search=rooftops');
      expect(searchRes.status).toBe(200);
      expect(searchRes.body.length).toBe(1);
      expect(searchRes.body[0].title).toBe('Beirut Rooftops');
    });

    it('should support pagination with limit and page parameters', async () => {
      for (let i = 1; i <= 5; i++) {
        await articleStore.createArticle({
          title: `Article ${i}`,
          content: `Content ${i}`
        });
      }

      const page1Res = await request(app).get('/api/articles?limit=2&page=1');
      expect(page1Res.status).toBe(200);
      expect(page1Res.body.length).toBe(2);

      const page3Res = await request(app).get('/api/articles?limit=2&page=3');
      expect(page3Res.status).toBe(200);
      expect(page3Res.body.length).toBe(1);
    });

    it('should accept imageUrl and synchronize it with image property', async () => {
      const res = await request(app)
        .post('/api/articles')
        .send({
          title: 'Image Test Article',
          content: 'Test content with imageUrl',
          imageUrl: 'https://example.com/image.jpg'
        });

      expect(res.status).toBe(201);
      expect(res.body.image).toBe('https://example.com/image.jpg');
      expect(res.body.imageUrl).toBe('https://example.com/image.jpg');
    });

    it('should return health status on GET /api/health', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OK');
    });
  });

  describe('SEO Article Permalink Generation & Lookup', () => {
    const { generatePermalink } = require('../src/utils/permalink');

    it('should correctly format permalink utility function outputs', () => {
      expect(generatePermalink("Lebanon's Tech Scene is Booming in 2026")).toBe('lebanons-tech-scene-is-booming-in-2026');
      expect(generatePermalink("Café & Brasserie @ Beirut — 100% Top-Rated!")).toBe('cafe-brasserie-beirut-100-top-rated');
      expect(generatePermalink("   --  Special @#$ Characters  --  ")).toBe('special-characters');
      expect(generatePermalink("موسم الرياض يستقطب ملايين الزوار")).toBe('موسم-الرياض-يستقطب-ملايين-الزوار');
      expect(generatePermalink("")).toBe('untitled');
      expect(generatePermalink(null)).toBe('untitled');
    });

    it('should generate permalink and slug automatically on article creation', async () => {
      const res = await request(app)
        .post('/api/articles')
        .send({
          title: 'Top 10 Hidden Gems in Beirut!',
          content: 'Full article body content.'
        });

      expect(res.status).toBe(201);
      expect(res.body.permalink).toBe('top-10-hidden-gems-in-beirut');
      expect(res.body.slug).toBe('top-10-hidden-gems-in-beirut');

      const stored = await articleStore.getArticleById(res.body.id);
      expect(stored.permalink).toBe('top-10-hidden-gems-in-beirut');
      expect(stored.slug).toBe('top-10-hidden-gems-in-beirut');
    });

    it('should allow custom permalink or slug overrides on creation', async () => {
      const res = await request(app)
        .post('/api/articles')
        .send({
          title: 'Unrelated Title',
          content: 'Content here...',
          permalink: 'custom-seo-permalink-override'
        });

      expect(res.status).toBe(201);
      expect(res.body.permalink).toBe('custom-seo-permalink-override');
      expect(res.body.slug).toBe('custom-seo-permalink-override');
    });

    it('should update permalink when article title is updated', async () => {
      const created = await articleStore.createArticle({
        title: 'Initial Article Title',
        content: 'Article content'
      });
      expect(created.permalink).toBe('initial-article-title');

      const res = await request(app)
        .put(`/api/articles/${created.id}`)
        .send({
          title: 'Updated Article Title for 2026'
        });

      expect(res.status).toBe(200);
      expect(res.body.permalink).toBe('updated-article-title-for-2026');
      expect(res.body.slug).toBe('updated-article-title-for-2026');
    });

    it('should update permalink when permalink is explicitly updated', async () => {
      const created = await articleStore.createArticle({
        title: 'Another Article',
        content: 'Article content'
      });

      const res = await request(app)
        .patch(`/api/articles/${created.id}`)
        .send({
          permalink: 'explicit-new-permalink-slug'
        });

      expect(res.status).toBe(200);
      expect(res.body.permalink).toBe('explicit-new-permalink-slug');
      expect(res.body.slug).toBe('explicit-new-permalink-slug');
    });

    it('should fetch an article by permalink/slug using GET /api/articles/:id', async () => {
      const created = await articleStore.createArticle({
        title: 'Unique Article Title for Lookup',
        content: 'Lookup content.'
      });

      const permalinkRes = await request(app).get(`/api/articles/${created.permalink}`);
      expect(permalinkRes.status).toBe(200);
      expect(permalinkRes.body.id).toBe(created.id);
      expect(permalinkRes.body.title).toBe(created.title);
    });

    it('should filter articles by permalink parameter on GET /api/articles', async () => {
      await articleStore.createArticle({
        title: 'First Search Title',
        content: 'Content 1'
      });
      await articleStore.createArticle({
        title: 'Second Search Title',
        content: 'Content 2'
      });

      const res = await request(app).get('/api/articles?permalink=second-search-title');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].title).toBe('Second Search Title');
    });

    it('should include permalink and slug in preview card output', async () => {
      const article = await articleStore.createArticle({
        title: 'Preview Card Article Test',
        content: 'Preview body'
      });

      const res = await request(app).get(`/api/articles/${article.id}/preview`);
      expect(res.status).toBe(200);
      expect(res.body.permalink).toBe('preview-card-article-test');
      expect(res.body.slug).toBe('preview-card-article-test');
    });

    it('should reject non-string permalink values with validation error', async () => {
      const res = await request(app)
        .post('/api/articles')
        .send({
          title: 'Test Title',
          content: 'Test content',
          permalink: 12345
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.messages).toContain('Permalink must be a string.');
    });
  });
});
