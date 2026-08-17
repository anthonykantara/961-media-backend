process.env.NODE_ENV = 'test';
process.env.WEBSITE_URL = 'http://localhost:3000';
process.env.DASHBOARD_URL = 'http://localhost:3001';

const request = require('supertest');
const app = require('../src/app');
const languageStore = require('../src/models/languageStore');

describe('Language Registry & Localization Sync API', () => {
  beforeEach(async () => {
    await languageStore.clearStore(true);
  });

  afterAll(async () => {
    await languageStore.clearStore(true);
  });

  describe('GET /api/languages', () => {
    it('should return all seed languages by default', async () => {
      const res = await request(app).get('/api/languages');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
      const codes = res.body.map(l => l.code);
      expect(codes).toContain('en');
      expect(codes).toContain('ar');
      expect(codes).toContain('fr');
    });

    it('should return active navigation languages when ?enabled=true', async () => {
      const res = await request(app).get('/api/languages?enabled=true');
      expect(res.status).toBe(200);
      expect(res.body.every(l => l.hasOwnProperty('code') && l.hasOwnProperty('name'))).toBe(true);
    });
  });

  describe('POST /api/languages & Dashboard Sync', () => {
    it('should allow adding a new language in dashboard and immediately reflect in active selectors', async () => {
      const newLang = {
        code: 'es',
        name: 'Spanish',
        nativeName: 'Español',
        dir: 'ltr',
        enabled: true
      };

      const postRes = await request(app)
        .post('/api/languages')
        .send(newLang);

      expect(postRes.status).toBe(201);
      expect(postRes.body.code).toBe('es');
      expect(postRes.body.name).toBe('Spanish');

      // Check active navigation languages immediately reflects 'es'
      const activeRes = await request(app).get('/api/languages?enabled=true');
      expect(activeRes.status).toBe(200);
      const activeCodes = activeRes.body.map(l => l.code);
      expect(activeCodes).toContain('es');
    });

    it('should fail validation if code or name is missing', async () => {
      const res = await request(app)
        .post('/api/languages')
        .send({ dir: 'ltr' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });

    it('should reject duplicate language codes with 409', async () => {
      const res = await request(app)
        .post('/api/languages')
        .send({ code: 'en', name: 'English Duplicate' });

      expect(res.status).toBe(409);
    });
  });

  describe('PUT / PATCH /api/languages/:code', () => {
    it('should update language properties and enable/disable languages', async () => {
      const patchRes = await request(app)
        .patch('/api/languages/fr')
        .send({ enabled: false });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.enabled).toBe(false);

      // Verify disabled language is excluded from active selectors
      const activeRes = await request(app).get('/api/languages?enabled=true');
      const activeCodes = activeRes.body.map(l => l.code);
      expect(activeCodes).not.toContain('fr');
    });

    it('should return 404 for non-existent language code', async () => {
      const res = await request(app)
        .put('/api/languages/xx')
        .send({ name: 'Unknown' });

      expect(res.status).toBe(404);
    });
  });

  describe('Locale Fallback Resolution (GET /api/languages/resolve/:locale)', () => {
    it('should resolve exact match for active language', async () => {
      const res = await request(app).get('/api/languages/resolve/ar');
      expect(res.status).toBe(200);
      expect(res.body.resolvedLanguage.code).toBe('ar');
    });

    it('should resolve primary subtag match (e.g. ar-LB -> ar)', async () => {
      const res = await request(app).get('/api/languages/resolve/ar-LB');
      expect(res.status).toBe(200);
      expect(res.body.resolvedLanguage.code).toBe('ar');
    });

    it('should fallback to default language for unsupported locale (e.g. ja -> en)', async () => {
      const res = await request(app).get('/api/languages/resolve/ja');
      expect(res.status).toBe(200);
      expect(res.body.resolvedLanguage.code).toBe('en');
    });
  });

  describe('DELETE /api/languages/:code', () => {
    it('should delete a language', async () => {
      const res = await request(app).delete('/api/languages/fr');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Language successfully deleted.');

      const getRes = await request(app).get('/api/languages/fr');
      expect(getRes.status).toBe(404);
    });
  });
});
