process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../src/app');
const articleStore = require('../src/models/articleStore');
const locationStore = require('../src/models/locationStore');
const pipelineStore = require('../src/models/pipelineStore');
const { generateTestToken, getAuthHeader } = require('./testUtils');

describe('JWT Authorization & RBAC Guards', () => {
  let contributorHeaders;
  let editorHeaders;
  let adminHeaders;

  beforeAll(() => {
    contributorHeaders = getAuthHeader({ id: 'usr_contrib_1', role: 'Contributor' });
    editorHeaders = getAuthHeader({ id: 'usr_editor_1', role: 'Editor' });
    adminHeaders = getAuthHeader({ id: 'usr_admin_1', role: 'Admin' });
  });

  beforeEach(async () => {
    await articleStore.clearStore();
    await locationStore.clearStore();
    await pipelineStore.clearStore();
  });

  describe('Requirement 1 & AC 1: Unauthenticated Mutations Blocked (401 Unauthorized)', () => {
    it('should reject unauthenticated POST /api/articles', async () => {
      const res = await request(app)
        .post('/api/articles')
        .send({ title: 'No Auth Title', content: 'No auth content' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
    });

    it('should reject unauthenticated PUT /api/articles/:id', async () => {
      const res = await request(app)
        .put('/api/articles/some-id')
        .send({ title: 'Updated' });
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated DELETE /api/articles/:id', async () => {
      const res = await request(app).delete('/api/articles/some-id');
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated POST /api/locations', async () => {
      const res = await request(app)
        .post('/api/locations')
        .send({ id: 'loc1', name: 'Beirut' });
      expect(res.status).toBe(401);
    });

    it('should reject unauthenticated POST /api/pipeline/headlines', async () => {
      const res = await request(app)
        .post('/api/pipeline/headlines')
        .send({ topic: 'Tech', category: 'Tech' });
      expect(res.status).toBe(401);
    });

    it('should allow public GET requests without authentication token', async () => {
      const artRes = await request(app).get('/api/articles');
      expect(artRes.status).toBe(200);

      const locRes = await request(app).get('/api/locations');
      expect(locRes.status).toBe(200);

      const pipeRes = await request(app).get('/api/pipeline');
      expect(pipeRes.status).toBe(200);
    });
  });

  describe('Requirement 3 & AC 2: Contributor Role Permissions', () => {
    it('should allow Contributor to create draft articles', async () => {
      const res = await request(app)
        .post('/api/articles')
        .set(contributorHeaders)
        .send({
          title: 'Contributor Draft',
          content: 'Draft content body',
          status: 'draft'
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Contributor Draft');
    });

    it('should allow Contributor to update draft articles', async () => {
      const created = await articleStore.createArticle({
        title: 'Initial Title',
        content: 'Initial Content',
        status: 'draft'
      });

      const res = await request(app)
        .put(`/api/articles/${created.id}`)
        .set(contributorHeaders)
        .send({
          title: 'Updated Draft Title'
        });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Updated Draft Title');
    });

    it('should reject Contributor trying to create article with status published (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/articles')
        .set(contributorHeaders)
        .send({
          title: 'Direct Publish Attempt',
          content: 'Content body',
          status: 'published'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should reject Contributor trying to publish article via POST /api/articles/:id/publish (403 Forbidden)', async () => {
      const created = await articleStore.createArticle({
        title: 'Draft Article',
        content: 'Draft Content'
      });

      const res = await request(app)
        .post(`/api/articles/${created.id}/publish`)
        .set(contributorHeaders)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should reject Contributor trying to trigger dispatch via POST /api/articles/:id/dispatch (403 Forbidden)', async () => {
      const created = await articleStore.createArticle({
        title: 'Draft Article',
        content: 'Draft Content'
      });

      const res = await request(app)
        .post(`/api/articles/${created.id}/dispatch`)
        .set(contributorHeaders)
        .send({});

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should reject Contributor trying to modify locations (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/locations')
        .set(contributorHeaders)
        .send({ id: 'loc1', name: 'Beirut' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('should reject Contributor trying to run AI pipeline (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/pipeline/headlines')
        .set(contributorHeaders)
        .send({ topic: 'Lebanon Economy', category: 'Business' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });
  });

  describe('Requirement 4 & AC 3: Editor Role Permissions', () => {
    it('should allow Editor to publish articles via /publish endpoint', async () => {
      const created = await articleStore.createArticle({
        title: 'Ready for Review',
        content: 'Article content'
      });

      const res = await request(app)
        .post(`/api/articles/${created.id}/publish`)
        .set(editorHeaders)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.article.status).toBe('published');
    });

    it('should allow Editor to update article status to published', async () => {
      const created = await articleStore.createArticle({
        title: 'Draft Article',
        content: 'Content',
        status: 'draft'
      });

      const res = await request(app)
        .patch(`/api/articles/${created.id}`)
        .set(editorHeaders)
        .send({ status: 'published' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('published');
    });

    it('should allow Editor to manage location taxonomy', async () => {
      const createRes = await request(app)
        .post('/api/locations')
        .set(editorHeaders)
        .send({ id: 'beirut-central', name: 'Central Beirut', country: 'Lebanon' });

      expect(createRes.status).toBe(201);
      expect(createRes.body.id).toBe('beirut-central');

      const updateRes = await request(app)
        .put('/api/locations/beirut-central')
        .set(editorHeaders)
        .send({ id: 'beirut-central', name: 'Downtown Beirut', country: 'Lebanon' });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.name).toBe('Downtown Beirut');
    });

    it('should reject Editor trying to invoke pipeline dispatches (403 Forbidden)', async () => {
      const created = await articleStore.createArticle({
        title: 'Article for Dispatch',
        content: 'Content'
      });

      const dispatchRes = await request(app)
        .post(`/api/articles/${created.id}/dispatch`)
        .set(editorHeaders)
        .send({});

      expect(dispatchRes.status).toBe(403);
      expect(dispatchRes.body.error).toBe('Forbidden');

      const pipelineRes = await request(app)
        .post('/api/pipeline/headlines')
        .set(editorHeaders)
        .send({ topic: 'Tech Trends', category: 'Tech' });

      expect(pipelineRes.status).toBe(403);
      expect(pipelineRes.body.error).toBe('Forbidden');
    });
  });

  describe('Requirement 5 & AC 4: Admin Role Permissions', () => {
    it('should allow Admin to execute AI headline generation pipeline', async () => {
      const res = await request(app)
        .post('/api/pipeline/headlines')
        .set(adminHeaders)
        .send({ topic: 'Artificial Intelligence in 2026', category: 'Technology' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('pipeline_id');
      expect(res.body.headlines.length).toBeGreaterThan(0);
    });

    it('should allow Admin to invoke social dispatches', async () => {
      const created = await articleStore.createArticle({
        title: 'Admin Article for Social Dispatch',
        content: 'Content to be dispatched'
      });

      const res = await request(app)
        .post(`/api/articles/${created.id}/dispatch`)
        .set(adminHeaders)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('jobId');
    });

    it('should allow Admin to invoke Express Creation rendering pipeline', async () => {
      const res = await request(app)
        .post('/api/express-creation')
        .set(adminHeaders)
        .send({ headline: 'Express Title' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('featured_image');
    }, 30000);
  });

  describe('Requirement 6 & AC 5: Mutation Audit Logging', () => {
    it('should record user ID and role in action log entries on executed mutations', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await request(app)
        .post('/api/articles')
        .set(adminHeaders)
        .send({ title: 'Audit Test Article', content: 'Testing action logs' });

      expect(consoleSpy).toHaveBeenCalled();
      const logCalls = consoleSpy.mock.calls.map(call => call.join(' '));
      const auditLog = logCalls.find(msg => msg.includes('[MUTATION AUDIT]'));

      expect(auditLog).toBeDefined();
      expect(auditLog).toContain('User ID: usr_admin_1');
      expect(auditLog).toContain('Role: Admin');
      expect(auditLog).toContain('POST /api/articles');

      consoleSpy.mockRestore();
    });
  });
});
