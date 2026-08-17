process.env.NODE_ENV = 'test';
process.env.WEBSITE_URL = 'http://localhost:3000';
process.env.DASHBOARD_URL = 'http://localhost:3001';

const request = require('supertest');
const app = require('../src/app');
const articleStore = require('../src/models/articleStore');
const locationStore = require('../src/models/locationStore');

describe('CMS Dashboard & Web Frontend Full Synchronization', () => {
  beforeEach(async () => {
    await articleStore.clearStore();
    await locationStore.clearStore(true);
  });

  afterAll(async () => {
    await articleStore.clearStore();
    await locationStore.clearStore(true);
  });

  describe('Article Sync & Public Web Feed', () => {
    it('should immediately reflect status changes (draft -> published) in web feeds and preview cards', async () => {
      // 1. Create article as draft in dashboard
      const draft = await articleStore.createArticle({
        title: 'Breaking Tech News',
        content: 'Draft content for tech news.',
        summary: 'Tech news summary',
        status: 'draft',
        locationId: 'lb',
        language: 'en'
      });

      // Public web feed should NOT include draft article
      const initialFeed = await request(app).get('/api/articles/feed');
      expect(initialFeed.status).toBe(200);
      expect(initialFeed.body.some(item => item.id === draft.id)).toBe(false);

      // 2. Publish article via PATCH in dashboard
      const patchRes = await request(app)
        .patch(`/api/articles/${draft.id}`)
        .send({ status: 'published', title: 'Breaking Tech News (Updated)' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.status).toBe('published');

      // 3. Web feed immediately contains the updated preview card
      const updatedFeed = await request(app).get('/api/articles/feed');
      expect(updatedFeed.status).toBe(200);
      const card = updatedFeed.body.find(item => item.id === draft.id);
      expect(card).toBeDefined();
      expect(card.title).toBe('Breaking Tech News (Updated)');
      expect(card.summary).toBe('Tech news summary');

      // 4. Preview card endpoint returns formatted object
      const previewRes = await request(app).get(`/api/articles/${draft.id}/preview`);
      expect(previewRes.status).toBe(200);
      expect(previewRes.body.id).toBe(draft.id);
      expect(previewRes.body.title).toBe('Breaking Tech News (Updated)');
    });

    it('should support regional filtering on articles feed using regionId', async () => {
      // Create article in Lebanon (regionId: levant)
      await articleStore.createArticle({
        title: 'Lebanon Article',
        content: 'Lebanon content',
        status: 'published',
        locationId: 'lb'
      });

      // Create article in Dubai (regionId: gcc)
      await articleStore.createArticle({
        title: 'Dubai Tech Hub',
        content: 'Dubai content',
        status: 'published',
        locationId: 'ae-dubai'
      });

      // Create article in Riyadh (regionId: gcc)
      await articleStore.createArticle({
        title: 'Riyadh Season',
        content: 'Riyadh content',
        status: 'published',
        locationId: 'sa-riyadh'
      });

      // Request articles filtered by GCC region
      const gccRes = await request(app).get('/api/articles?regionId=gcc');
      expect(gccRes.status).toBe(200);
      expect(gccRes.body.length).toBe(2);
      const titles = gccRes.body.map(a => a.title);
      expect(titles).toContain('Dubai Tech Hub');
      expect(titles).toContain('Riyadh Season');
      expect(titles).not.toContain('Lebanon Article');

      // Request feed filtered by Levant region
      const levantRes = await request(app).get('/api/articles/feed?regionId=levant');
      expect(levantRes.status).toBe(200);
      expect(levantRes.body.length).toBe(1);
      expect(levantRes.body[0].title).toBe('Lebanon Article');
    });
  });
});
