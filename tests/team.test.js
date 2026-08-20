process.env.NODE_ENV = 'test';
process.env.WEBSITE_URL = 'http://localhost:3000';
process.env.DASHBOARD_URL = 'http://localhost:3001';

const request = require('supertest');
const app = require('../src/app');
const teamStore = require('../src/models/teamStore');

describe('Team / Authors API Endpoints', () => {
  beforeEach(async () => {
    await teamStore.clearStore(true);
  });

  test('GET /api/team should return team list', async () => {
    const res = await request(app).get('/api/team');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('username');
  });

  test('GET /api/authors should return same team list', async () => {
    const res = await request(app).get('/api/authors');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('POST /api/team should create a new team member', async () => {
    const newMember = {
      username: 'test_editor',
      name: 'Test Editor',
      role: 'Editor',
      bio: 'Loves editing news.'
    };

    const res = await request(app)
      .post('/api/team')
      .send(newMember);

    expect(res.status).toBe(201);
    expect(res.body.username).toBe('test_editor');
    expect(res.body.name).toBe('Test Editor');
    expect(res.body.role).toBe('Editor');
  });

  test('PUT /api/team/:id should update existing team member', async () => {
    const update = {
      name: 'Anthony Rahayel Updated',
      role: 'Admin'
    };

    const res = await request(app)
      .put('/api/team/1')
      .send(update);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Anthony Rahayel Updated');
  });

  test('DELETE /api/team/:id should remove team member', async () => {
    const res = await request(app).delete('/api/team/3');
    expect(res.status).toBe(200);

    const getRes = await request(app).get('/api/team/3');
    expect(getRes.status).toBe(404);
  });
});
