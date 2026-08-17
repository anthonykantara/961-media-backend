process.env.NODE_ENV = 'test';
process.env.WEBSITE_URL = 'http://localhost:3000';
process.env.DASHBOARD_URL = 'http://localhost:3001';

const request = require('supertest');
const app = require('../src/app');
const articleStore = require('../src/models/articleStore');
const { dispatchAll } = require('../src/workers/dispatchWorker');

describe('Dispatch Orchestrator & API Integration', () => {
  beforeEach(async () => {
    await articleStore.clearStore();
  });

  afterAll(async () => {
    await articleStore.clearStore();
  });

  const mockSecrets = {
    meta: { pageId: 'fb123', accessToken: 'fb_token' },
    linkedin: { accessToken: 'li_token', authorUrn: 'urn:li:organization:1' },
    slack: { botToken: 'xoxb-slack', channel: '#ig-staging' },
    wasabi: { accessKeyId: 'wasabi_key', secretAccessKey: 'wasabi_secret', bucket: 'test-bucket' }
  };

  it('should orchestrate all dispatch workers successfully', async () => {
    const article = await articleStore.createArticle({
      title: 'Full Pipeline Article',
      content: 'Testing orchestrator execution.',
      social_summary: 'Social summary for full pipeline.',
      ig_caption: 'IG caption for full pipeline.',
      carouselFiles: ['carousel_1.png']
    });

    const mockFetch = jest.fn().mockImplementation(async (url) => {
      if (url.includes('facebook')) {
        return { ok: true, status: 200, json: async () => ({ id: 'fb_post_100' }) };
      }
      if (url.includes('linkedin')) {
        return { ok: true, status: 201, json: async () => ({ id: 'urn:li:share:li_post_200' }) };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    });

    const mockUploadV2 = jest.fn().mockResolvedValue({ ok: true, file: { id: 'F123' } });
    const mockPostMessage = jest.fn().mockResolvedValue({ ok: true, ts: '9999.8888' });

    const result = await dispatchAll(article.id, {
      secrets: mockSecrets,
      facebookOptions: { fetch: mockFetch },
      linkedinOptions: { fetch: mockFetch },
      slackOptions: { uploadV2Mock: mockUploadV2, postMessageMock: mockPostMessage },
      wasabiOptions: { mockDelete: true, skipPrefixScan: true }
    });

    expect(result.articleId).toBe(article.id);
    expect(result.dispatches.cms.status).toBe('fulfilled');
    expect(result.dispatches.cms.value.status).toBe('published');
    expect(result.dispatches.cms.value.image).toBe('featured.jpg');

    expect(result.dispatches.facebook.status).toBe('fulfilled');
    expect(result.dispatches.facebook.value.postId).toBe('fb_post_100');

    expect(result.dispatches.linkedin.status).toBe('fulfilled');
    expect(result.dispatches.linkedin.value.postId).toBe('urn:li:share:li_post_200');

    expect(result.dispatches.slack.status).toBe('fulfilled');
    expect(result.dispatches.slack.value.messageTs).toBe('9999.8888');

    expect(result.dispatches.wasabi.status).toBe('fulfilled');
  });

  it('should trigger dispatch pipeline via POST /api/articles/:id/dispatch', async () => {
    const article = await articleStore.createArticle({
      title: 'HTTP Dispatch Article',
      content: 'Triggering via HTTP endpoint.',
      social_summary: 'HTTP dispatch summary'
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'http_post_1' })
    });

    const res = await request(app)
      .post(`/api/articles/${article.id}/dispatch`)
      .send({
        secrets: mockSecrets,
        facebookOptions: { fetch: mockFetch },
        linkedinOptions: { fetch: mockFetch },
        slackOptions: { postMessageMock: jest.fn().mockResolvedValue({ ts: '1111' }) },
        wasabiOptions: { mockDelete: true, skipPrefixScan: true }
      });

    expect(res.status).toBe(200);
    expect(res.body.articleId).toBe(article.id);
    expect(res.body.dispatches).toBeDefined();
    expect(res.body.dispatches.cms.status).toBe('fulfilled');

    // Verify article was updated to published in DB
    const updated = await articleStore.getArticleById(article.id);
    expect(updated.status).toBe('published');
  });

  it('should trigger publish pipeline via POST /api/articles/:id/publish', async () => {
    const article = await articleStore.createArticle({
      title: 'HTTP Publish Article',
      content: 'Triggering via HTTP publish endpoint.',
      status: 'draft'
    });

    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'pub_post_1' })
    });

    const res = await request(app)
      .post(`/api/articles/${article.id}/publish`)
      .send({
        secrets: mockSecrets,
        facebookOptions: { fetch: mockFetch },
        linkedinOptions: { fetch: mockFetch },
        slackOptions: { postMessageMock: jest.fn().mockResolvedValue({ ts: '2222' }) },
        wasabiOptions: { mockDelete: true, skipPrefixScan: true }
      });

    expect(res.status).toBe(200);
    expect(res.body.article.status).toBe('published');
    expect(res.body.dispatch).toBeDefined();
  });
});
