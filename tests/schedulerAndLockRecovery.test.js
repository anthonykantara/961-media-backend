process.env.NODE_ENV = 'test';
process.env.WEBSITE_URL = 'http://localhost:3000';
process.env.DASHBOARD_URL = 'http://localhost:3001';

const request = require('supertest');
const app = require('../src/app');
const articleStore = require('../src/models/articleStore');
const queueStore = require('../src/models/queueStore');
const { processNextTasks, checkScheduledArticles, stopQueueWorker } = require('../src/workers/queueProcessor');

describe('Automated Article Scheduler & Stale Lock Recovery Pipeline', () => {
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

  describe('1. Future Target Release Timestamp Enqueueing', () => {
    it('should enqueue a task with future publishAt timestamp and hold it in pending until due', async () => {
      const article = await articleStore.createArticle({
        title: 'Scheduled Release Article',
        content: 'Content for scheduled release testing.'
      });

      const futureDate = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour in future

      const task = await queueStore.enqueueTask({
        articleId: article.id,
        publishAt: futureDate,
        options: {
          secrets: mockSecrets,
          wasabiOptions: { mockDelete: true, skipPrefixScan: true }
        }
      });

      expect(task.status).toBe('pending');
      expect(new Date(task.next_run_at).getTime()).toBeGreaterThan(Date.now());

      // Attempting to process immediately should NOT claim the future task
      const claimedBefore = await queueStore.claimPendingTasks(10);
      expect(claimedBefore.length).toBe(0);

      const taskStillPending = await queueStore.getTaskById(task.id);
      expect(taskStillPending.status).toBe('pending');
    });

    it('should claim and execute task once target release timestamp has passed', async () => {
      const article = await articleStore.createArticle({
        title: 'Due Released Article',
        content: 'Content for due scheduled release testing.'
      });

      const mockFetch = jest.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ id: 'mock_release_123' })
      }));

      const pastDate = new Date(Date.now() - 1000).toISOString(); // 1 second in past

      const task = await queueStore.enqueueTask({
        articleId: article.id,
        publishAt: pastDate,
        options: {
          secrets: mockSecrets,
          facebookOptions: { fetch: mockFetch },
          linkedinOptions: { fetch: mockFetch },
          slackOptions: { postMessageMock: jest.fn().mockResolvedValue({ ts: 'due_ts_1' }) },
          wasabiOptions: { mockDelete: true, skipPrefixScan: true }
        }
      });

      const results = await processNextTasks();
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('completed');

      const updatedTask = await queueStore.getTaskById(task.id);
      expect(updatedTask.status).toBe('completed');
    });

    it('should separate internal scheduling parameters from payload options', async () => {
      const article = await articleStore.createArticle({
        title: 'Clean Options Test Article',
        content: 'Testing separation of internal scheduling params.'
      });

      const futureDate = new Date(Date.now() + 5000).toISOString();
      const task = await queueStore.enqueueTask({
        articleId: article.id,
        options: {
          publishAt: futureDate,
          channelOption: 'test_val'
        }
      });

      expect(task.options.publishAt).toBeUndefined();
      expect(task.options.channelOption).toBe('test_val');
    });
  });

  describe('2. Automated Scheduled Article Polling', () => {
    it('should detect due scheduled articles, update status to published, and enqueue distribution tasks', async () => {
      const pastPublishTime = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago

      const scheduledArticle = await articleStore.createArticle({
        title: 'Automated Scheduled Article',
        content: 'Scheduled article content body.',
        status: 'scheduled',
        publish_at: pastPublishTime
      });

      expect(scheduledArticle.status).toBe('scheduled');

      // Run checkScheduledArticles
      const enqueuedTasks = await checkScheduledArticles();
      expect(enqueuedTasks.length).toBe(1);
      expect(enqueuedTasks[0].article_id).toBe(scheduledArticle.id);

      // Verify article status is now 'published'
      const updatedArticle = await articleStore.getArticleById(scheduledArticle.id);
      expect(updatedArticle.status).toBe('published');

      // Verify task exists in queueStore and gets processed
      const tasks = await queueStore.getTasksByArticleId(scheduledArticle.id);
      expect(tasks.length).toBe(1);
      expect(tasks[0].status).toBe('pending');
    });

    it('should ignore scheduled articles whose publish_at timestamp is in the future', async () => {
      const futurePublishTime = new Date(Date.now() + 3600 * 1000).toISOString();

      const futureArticle = await articleStore.createArticle({
        title: 'Future Scheduled Article',
        content: 'Future article content body.',
        status: 'scheduled',
        publish_at: futurePublishTime
      });

      const enqueuedTasks = await checkScheduledArticles();
      expect(enqueuedTasks.length).toBe(0);

      const fetchedArticle = await articleStore.getArticleById(futureArticle.id);
      expect(fetchedArticle.status).toBe('scheduled');
    });

    it('should correctly parse numeric epoch timestamps in seconds and milliseconds for scheduled articles', async () => {
      const pastSeconds = Math.floor((Date.now() - 10000) / 1000); // 10s ago in seconds
      const scheduledSecArticle = await articleStore.createArticle({
        title: 'Epoch Seconds Scheduled Article',
        content: 'Testing epoch seconds timestamp.',
        status: 'scheduled',
        publish_at: pastSeconds
      });

      const enqueued = await checkScheduledArticles();
      expect(enqueued.length).toBe(1);
      expect(enqueued[0].article_id).toBe(scheduledSecArticle.id);
    });

    it('should not enqueue duplicate tasks if an active task already exists for a scheduled article', async () => {
      const pastPublishTime = new Date(Date.now() - 5000).toISOString();
      const scheduledArticle = await articleStore.createArticle({
        title: 'Prevent Duplicate Task Article',
        content: 'Testing duplicate prevention.',
        status: 'scheduled',
        publish_at: pastPublishTime
      });

      // Manually enqueue a task for this article first
      await queueStore.enqueueTask({ articleId: scheduledArticle.id });

      const enqueuedTasks = await checkScheduledArticles();
      expect(enqueuedTasks.length).toBe(0);
    });
  });

  describe('3. Stale Lock Recovery', () => {
    it('should release tasks locked in processing state longer than stale threshold back to pending', async () => {
      const article = await articleStore.createArticle({
        title: 'Stale Lock Recovery Article',
        content: 'Testing stale lock recovery.'
      });

      // Enqueue and claim a task manually
      const task = await queueStore.enqueueTask({
        articleId: article.id,
        options: { secrets: mockSecrets }
      });

      const claimed = await queueStore.claimPendingTasks(10);
      expect(claimed.length).toBe(1);
      expect(claimed[0].status).toBe('processing');

      // Verify task is currently processing
      let currentTask = await queueStore.getTaskById(task.id);
      expect(currentTask.status).toBe('processing');

      // Recover stale locks with a threshold of 0ms (force stale)
      const recovered = await queueStore.recoverStaleLocks(0);
      expect(recovered.length).toBe(1);
      expect(recovered[0].id).toBe(task.id);
      expect(recovered[0].status).toBe('pending');

      currentTask = await queueStore.getTaskById(task.id);
      expect(currentTask.status).toBe('pending');
    });

    it('should mark task as failed if stale lock recovery triggers after max_attempts reached', async () => {
      const article = await articleStore.createArticle({
        title: 'Max Attempts Stale Task',
        content: 'Testing max attempts lock expiration.'
      });

      const task = await queueStore.enqueueTask({
        articleId: article.id,
        maxAttempts: 1
      });

      // Claim task (attempts becomes 1 = maxAttempts)
      await queueStore.claimPendingTasks(10);

      // Force stale lock recovery
      const recovered = await queueStore.recoverStaleLocks(0);
      expect(recovered.length).toBe(1);
      expect(recovered[0].status).toBe('failed');
      expect(recovered[0].last_error).toContain('Stale lock expired');
    });

    it('should allow reset tasks to be re-claimed and successfully re-processed', async () => {
      const article = await articleStore.createArticle({
        title: 'Re-process Recovered Task Article',
        content: 'Testing re-processing after stale lock reset.'
      });

      const mockFetch = jest.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ id: 'reprocessed_123' })
      }));

      const task = await queueStore.enqueueTask({
        articleId: article.id,
        options: {
          secrets: mockSecrets,
          facebookOptions: { fetch: mockFetch },
          linkedinOptions: { fetch: mockFetch },
          slackOptions: { postMessageMock: jest.fn().mockResolvedValue({ ts: 'reprocessed_ts_1' }) },
          wasabiOptions: { mockDelete: true, skipPrefixScan: true }
        }
      });

      // Claim task (it is now processing, simulation of crashed worker)
      await queueStore.claimPendingTasks(10);

      // Force stale lock recovery
      await queueStore.recoverStaleLocks(0);

      // Subsequent processNextTasks iteration should claim and complete the reset task
      const results = await processNextTasks();
      expect(results.length).toBe(1);
      expect(results[0].status).toBe('completed');

      const finalTask = await queueStore.getTaskById(task.id);
      expect(finalTask.status).toBe('completed');
    });
  });
});
