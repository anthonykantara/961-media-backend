process.env.NODE_ENV = 'test';
process.env.WEBSITE_URL = 'http://localhost:3000';
process.env.DASHBOARD_URL = 'http://localhost:3001';

const request = require('supertest');
const app = require('../src/app');
const locationStore = require('../src/models/locationStore');

describe('Locations & Regional Models API', () => {
  beforeEach(async () => {
    await locationStore.clearStore(true);
  });

  afterAll(async () => {
    await locationStore.clearStore(true);
  });

  describe('GET /api/locations', () => {
    it('should return default seed locations', async () => {
      const res = await request(app).get('/api/locations');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(4);
    });

    it('should filter locations by regionId', async () => {
      const res = await request(app).get('/api/locations?regionId=gcc');
      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      const ids = res.body.map(l => l.id);
      expect(ids).toContain('sa-riyadh');
      expect(ids).toContain('ae-dubai');
    });

    it('should filter enabled vs disabled locations', async () => {
      await locationStore.updateLocation('lb', { enabled: false });

      const enabledRes = await request(app).get('/api/locations?enabled=true');
      expect(enabledRes.status).toBe(200);
      expect(enabledRes.body.some(l => l.id === 'lb')).toBe(false);

      const disabledRes = await request(app).get('/api/locations?enabled=false');
      expect(disabledRes.status).toBe(200);
      expect(disabledRes.body.length).toBe(1);
      expect(disabledRes.body[0].id).toBe('lb');
    });
  });

  describe('GET /api/regions', () => {
    it('should group locations by regional model', async () => {
      const res = await request(app).get('/api/regions');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const regionIds = res.body.map(r => r.id);
      expect(regionIds).toContain('levant');
      expect(regionIds).toContain('gcc');
      expect(regionIds).toContain('north-africa');

      const gccRegion = res.body.find(r => r.id === 'gcc');
      expect(gccRegion.locations.length).toBe(2);
    });

    it('should return a specific region by regionId', async () => {
      const res = await request(app).get('/api/regions/levant');
      expect(res.status).toBe(200);
      expect(res.body.id).toBe('levant');
      expect(res.body.locations.length).toBe(1);
      expect(res.body.locations[0].id).toBe('lb');
    });
  });

  describe('POST / PUT / DELETE /api/locations', () => {
    it('should create, update, and delete location records', async () => {
      // Create location
      const createRes = await request(app)
        .post('/api/locations')
        .send({
          id: 'qa-doha',
          name: 'Doha',
          country: 'Qatar',
          countryCode: 'QA',
          regionId: 'gcc',
          regionName: 'GCC'
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.id).toBe('qa-doha');

      // Update location
      const updateRes = await request(app)
        .put('/api/locations/qa-doha')
        .send({ name: 'Doha City' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe('Doha City');

      // Delete location
      const deleteRes = await request(app).delete('/api/locations/qa-doha');
      expect(deleteRes.status).toBe(200);

      const getRes = await request(app).get('/api/locations/qa-doha');
      expect(getRes.status).toBe(404);
    });
  });
});
