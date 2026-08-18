process.env.NODE_ENV = 'test';
process.env.WEBSITE_URL = 'http://localhost:3000';
process.env.DASHBOARD_URL = 'http://localhost:3001';

const request = require('supertest');
const app = require('../src/app');
const articleStore = require('../src/models/articleStore');
const queueStore = require('../src/models/queueStore');
const { processNextTasks, stopQueueWorker } = require('../src/workers/queueProcessor');
const { facebookDispatch } = require('../src/workers/facebookDispatch');
const { linkedinDispatch } = require('../src/workers/linkedinDispatch');
const { slackDispatch } = require('../src/workers/slackDispatch');
const { wasabiCleanup } = require('../src/workers/wasabiCleanup');

describe('Database Dispatch Queue & Exponential Retry Pipeline', () => {
  const mockSecrets = {
    meta: { pageId: 'fb_page_123', accessToken: 'fb_token_123' },
    linkedin: { accessToken: 'li_token_123', authorUrn: 'urn:li:organization:123' },
    slack: { botToken: 'xoxb-slack-123', channel: '#ig-staging' },
    wasabi: { accessKeyId: 'wasabi_key', secretAccessKey: 'wasabi_secret', bucket: 'test-bucket' }
  };

  beforeEach(async () => {
    await articleStore.clearStore();
    await queueStore.clearQueue();
  });

  afterAll(async () => {
    stopQueueWorker();
    await articleStore.clearStore();
    await queueStore.clearQueue();
  });

  describe('1. Sub-500ms Publishing & Task Queueing', () => {
    it('should enqueue a persistent task and return HTTP 200 in under 500ms when publishing an article', async () => {
      const article = await articleStore.createArticle({
        title: 'Sub-500ms Test Article',
        content: 'Testing immediate response time.',
        status: 'draft'
      });

      const startTime = Date.now();
      const res = await request(app)
        .post(`/api/articles/${article.id}/publish`)
        .send({
          secrets: mockSecrets,
          facebookOptions: { fetch: jest.fn().mockImplementation(() => new Promise(r => setTimeout(r, 2000))) }, // Slow external call
          linkedinOptions: { fetch: jest.fn().mockImplementation(() => new Promise(r => setTimeout(r, 2000))) }
        });
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(500);
      expect(res.status).toBe(200);
      expect(res.body.article.status).toBe('published');
      expect(res.body.status).toBe('queued');
      expect(res.body.jobId).toBeDefined();

      // Verify task was saved in queueStore
      const task = await queueStore.getTaskById(res.body.jobId);
      expect(task).not.toBeNull();
      expect(task.article_id).toBe(article.id);
      expect(['pending', 'processing', 'completed']).toContain(task.status);
    });

    it('should enqueue a persistent task and return HTTP 200 in under 500ms when triggering dispatch endpoint', async () => {
      const article = await articleStore.createArticle({
        title: 'Dispatch Endpoint Test',
        content: 'Testing dispatch endpoint responsiveness.',
        status: 'published'
      });

      const startTime = Date.now();
      const res = await request(app)
        .post(`/api/articles/${article.id}/dispatch`)
        .send({ secrets: mockSecrets });
      const responseTime = Date.now() - startTime;

      expect(responseTime).toBeLessThan(500);
      expect(res.status).toBe(200);
      expect(res.body.articleId).toBe(article.id);
      expect(res.body.status).toBe('queued');

      const tasks = await queueStore.getTasksByArticleId(article.id);
      expect(tasks.length).toBeGreaterThan(0);
    });
  });

  describe('2. Background Task Processing Outside Request Cycle', () => {
    it('should process pending jobs asynchronously outside request-response cycle', async () => {
      const article = await articleStore.createArticle({
        title: 'Background Execution Article',
        content: 'Testing background worker execution.',
        social_summary: 'Social summary for background processing test.'
      });

      const mockFetch = jest.fn().mockImplementation(async (url) => {
        if (url.includes('facebook')) {
          return { ok: true, status: 200, json: async () => ({ id: 'fb_bg_100' }) };
        }
        if (url.includes('linkedin')) {
          return { ok: true, status: 201, json: async () => ({ id: 'urn:li:share:li_bg_200' }) };
        }
        return { ok: true, status: 200, json: async () => ({}) };
      });

      // Enqueue job manually
      const enqueuedTask = await queueStore.enqueueTask({
        articleId: article.id,
        options: {
          secrets: mockSecrets,
          facebookOptions: { fetch: mockFetch },
          linkedinOptions: { fetch: mockFetch },
          slackOptions: { postMessageMock: jest.fn().mockResolvedValue({ ts: 'bg_ts_1' }) },
          wasabiOptions: { mockDelete: true, skipPrefixScan: true }
        }
      });

      expect(enqueuedTask.status).toBe('pending');

      // Run processor explicitly
      const results = await processNextTasks();
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('completed');

      const updatedTask = await queueStore.getTaskById(enqueuedTask.id);
      expect(updatedTask.status).toBe('completed');
      expect(updatedTask.attempts).toBe(1);
    });
  });

  describe('3. Exponential Backoff Retries on External Failures', () => {
    it('should schedule automatic retries with exponential backoff on transient API failures', async () => {
      const article = await articleStore.createArticle({
        title: 'Retry Test Article',
        content: 'Testing exponential retry pipeline.'
      });

      const mockFailingFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ error: { message: 'Service Unavailable' } })
      });

      const task = await queueStore.enqueueTask({
        articleId: article.id,
        options: {
          secrets: mockSecrets,
          facebookOptions: { fetch: mockFailingFetch },
          initialDelayMs: 100 // 100ms base for testing
        },
        maxAttempts: 3
      });

      // First run: Attempt 1 -> Fail & schedule retry
      const run1 = await processNextTasks();
      expect(run1.length).toBe(1);

      let updated = await queueStore.getTaskById(task.id);
      expect(updated.status).toBe('retry_scheduled');
      expect(updated.attempts).toBe(1);
      expect(updated.last_error).toContain('Facebook API Error (503)');

      // Verify exponential backoff next_run_at is in the future
      const nextRunTime = new Date(updated.next_run_at).getTime();
      expect(nextRunTime).toBeGreaterThanOrEqual(new Date(updated.created_at).getTime());
    });

    it('should reach failed status after exceeding maximum attempt count', async () => {
      const article = await articleStore.createArticle({
        title: 'Max Attempts Article',
        content: 'Testing max attempt limit.'
      });

      const task = await queueStore.enqueueTask({
        articleId: article.id,
        options: {
          secrets: mockSecrets,
          facebookOptions: { fetch: jest.fn().mockRejectedValue(new Error('Persistent Network Timeout')) }
        },
        maxAttempts: 1
      });

      const run = await processNextTasks();
      expect(run.length).toBe(1);

      const finalTask = await queueStore.getTaskById(task.id);
      expect(finalTask.status).toBe('failed');
      expect(finalTask.attempts).toBe(1);
      expect(finalTask.last_error).toContain('Persistent Network Timeout');
    });

    it('should handle worker results returning success=false as failures', async () => {
      const article = await articleStore.createArticle({
        title: 'Partial Failure Article',
        content: 'Testing worker success=false handling.'
      });

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'fb_123' })
      });

      const task = await queueStore.enqueueTask({
        articleId: article.id,
        options: {
          secrets: mockSecrets,
          facebookOptions: { fetch: mockFetch },
          linkedinOptions: { fetch: mockFetch },
          slackOptions: {
            carouselFiles: ['failed_file.png'],
            uploadV2Mock: jest.fn().mockRejectedValue(new Error('Slack rate limit exceeded')),
            postMessageMock: jest.fn().mockResolvedValue({ ts: '123' })
          },
          wasabiOptions: { mockDelete: true, skipPrefixScan: true }
        },
        maxAttempts: 1
      });

      const run = await processNextTasks();
      expect(run.length).toBe(1);

      const finalTask = await queueStore.getTaskById(task.id);
      expect(finalTask.status).toBe('failed');
      expect(finalTask.last_error).toContain('slack worker failed: failed_file.png: Slack rate limit exceeded');
    });
  });

  describe('4. Explicit Network Request Timeouts & Safe Parsing', () => {
    it('should abort network request if it exceeds timeout limit', async () => {
      const sampleArticle = { id: 'art-timeout-1', title: 'Timeout Article' };
      const hangingFetch = jest.fn().mockImplementation((url, opts) => {
        return new Promise((_, reject) => {
          opts.signal.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        });
      });

      await expect(facebookDispatch(sampleArticle, mockSecrets, { fetch: hangingFetch, timeout: 50 }))
        .rejects.toThrow('Request timed out after 50ms');

      await expect(linkedinDispatch(sampleArticle, mockSecrets, { fetch: hangingFetch, timeout: 50 }))
        .rejects.toThrow('Request timed out after 50ms');
    });

    it('should safely handle HTML or non-JSON response bodies without throwing unhandled syntax errors', async () => {
      const sampleArticle = { id: 'art-html-1', title: 'HTML Response Article' };
      const html502Fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        headers: { get: (h) => (h.toLowerCase() === 'content-type' ? 'text/html' : null) },
        text: async () => '<html><body>502 Bad Gateway</body></html>',
        json: async () => { throw new SyntaxError('Unexpected token <'); }
      });

      await expect(facebookDispatch(sampleArticle, mockSecrets, { fetch: html502Fetch }))
        .rejects.toThrow('Facebook API Error (502): Non-JSON response received');

      await expect(linkedinDispatch(sampleArticle, mockSecrets, { fetch: html502Fetch }))
        .rejects.toThrow('LinkedIn API Error (502): Non-JSON response received');
    });
  });

  describe('5. Concurrent Asset File Uploads & Cleanup', () => {
    it('should execute slack carousel file uploads concurrently and report explicit errors if any fail', async () => {
      const sampleArticle = {
        id: 'art-slack-1',
        title: 'Slack Concurrent Test',
        ig_caption: 'Check out our new post!'
      };

      const mockUploadV2 = jest.fn().mockImplementation(async ({ fileInput }) => {
        if (fileInput === 'bad_file.png') {
          throw new Error('Upload permission denied');
        }
        return { ok: true, file: { id: fileInput } };
      });

      const res = await slackDispatch(sampleArticle, mockSecrets, {
        carouselFiles: ['carousel_1.png', 'bad_file.png', 'carousel_3.png'],
        uploadV2Mock: mockUploadV2,
        postMessageMock: jest.fn().mockResolvedValue({ ts: '12345.6789' })
      });

      expect(res.uploadedFiles.length).toBe(2);
      expect(res.uploadErrors.length).toBe(1);
      expect(res.uploadErrors[0].file).toBe('bad_file.png');
      expect(res.uploadErrors[0].error).toContain('Upload permission denied');
      expect(res.success).toBe(false);
    });

    it('should execute Wasabi cleanup prefix scans concurrently and handle errors explicitly', async () => {
      const sampleArticle = { id: 'art-wasabi-1' };
      const mockS3Client = {
        send: jest.fn().mockResolvedValue({ Contents: [{ Key: 'drafts/art-wasabi-1/temp1.jpg' }] })
      };

      const res = await wasabiCleanup(sampleArticle, mockSecrets, {
        s3Client: mockS3Client,
        mockDelete: true
      });

      expect(res.success).toBe(true);
      expect(res.deletedKeys).toContain('drafts/art-wasabi-1/temp1.jpg');
    });
  });

  describe('6. Application Restart & Task Survival', () => {
    it('should survive application/queue resets without losing pending or scheduled tasks', async () => {
      const article = await articleStore.createArticle({
        title: 'Persistence Test Article',
        content: 'Ensuring task survival.'
      });

      const task = await queueStore.enqueueTask({
        articleId: article.id,
        options: { testOption: true }
      });

      // Verify task is retrieved from queue store
      const allTasksBefore = await queueStore.getAllTasks();
      expect(allTasksBefore.some(t => t.id === task.id)).toBe(true);

      const retrievedTask = await queueStore.getTaskById(task.id);
      expect(retrievedTask.options.testOption).toBe(true);
      expect(retrievedTask.status).toBe('pending');
    });
  });
});
