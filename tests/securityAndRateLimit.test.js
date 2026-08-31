const request = require('supertest');
const app = require('../src/app');

describe('Security Headers and Rate Limiting Middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Helmet Security Headers', () => {
    it('should include standard security headers on public endpoints', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['strict-transport-security']).toBeDefined();
    });

    it('should configure Cross-Origin-Resource-Policy as cross-origin for media graphics access', async () => {
      const res = await request(app).get('/api/health');

      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it('should include security headers on administrative / pipeline routes', async () => {
      const res = await request(app).get('/api/pipeline');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it('should attach security headers to 404 responses', async () => {
      const res = await request(app).get('/api/nonexistent-endpoint-xyz');

      expect(res.status).toBe(404);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });
  });

  describe('Trust Proxy Configuration', () => {
    it('should have trust proxy configured on the Express app', () => {
      expect(app.get('trust proxy')).toBeTruthy();
    });
  });

  describe('Request Rate Limiting Throttling', () => {
    it('should return exact RateLimit-Limit header per tier without collisions', async () => {
      process.env.ENABLE_TEST_RATE_LIMIT = 'true';
      const pipelineRes = await request(app)
        .get('/api/pipeline')
        .set('X-Forwarded-For', '203.0.113.10');
      
      const publicRes = await request(app)
        .get('/api/health')
        .set('X-Forwarded-For', '203.0.113.10');

      expect(pipelineRes.headers['ratelimit-limit']).toBe('20');
      expect(publicRes.headers['ratelimit-limit']).toBe('100');
    });

    it('should bypass rate limits when DISABLE_RATE_LIMITING is set to true', async () => {
      process.env.ENABLE_TEST_RATE_LIMIT = 'true';
      process.env.DISABLE_RATE_LIMITING = 'true';
      process.env.RATE_LIMIT_PUBLIC_MAX = '1';

      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .get('/api/health')
          .set('X-Forwarded-For', '203.0.113.20');
        expect(res.status).toBe(200);
      }
    });

    it('should bypass rate limits in default test mode when ENABLE_TEST_RATE_LIMIT is not true', async () => {
      delete process.env.ENABLE_TEST_RATE_LIMIT;
      delete process.env.DISABLE_RATE_LIMITING;
      process.env.RATE_LIMIT_PUBLIC_MAX = '2';

      // Send 5 requests (exceeds max of 2 if enforced)
      for (let i = 0; i < 5; i++) {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
      }
    });

    it('should enforce rate limits on public endpoints when ENABLE_TEST_RATE_LIMIT is true', async () => {
      process.env.ENABLE_TEST_RATE_LIMIT = 'true';
      delete process.env.DISABLE_RATE_LIMITING;
      process.env.RATE_LIMIT_PUBLIC_MAX = '3';
      const testIp = '203.0.113.195';

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const res = await request(app)
          .get('/api/health')
          .set('X-Forwarded-For', testIp);
        expect(res.status).toBe(200);
      }

      // 4th request should receive HTTP 429
      const throttledRes = await request(app)
        .get('/api/health')
        .set('X-Forwarded-For', testIp);

      expect(throttledRes.status).toBe(429);
      expect(throttledRes.body).toEqual({
        error: 'Too Many Requests',
        message: 'Too many requests, please try again later.'
      });
    });

    it('should enforce stricter differential rate limits on high-cost AI pipeline endpoints', async () => {
      process.env.ENABLE_TEST_RATE_LIMIT = 'true';
      delete process.env.DISABLE_RATE_LIMITING;
      process.env.RATE_LIMIT_PIPELINE_MAX = '2';
      process.env.RATE_LIMIT_PUBLIC_MAX = '100';
      const testIp = '203.0.113.196';

      // First 2 requests to pipeline endpoint should pass through (or return normal API status, e.g. 200)
      for (let i = 0; i < 2; i++) {
        const res = await request(app)
          .get('/api/pipeline')
          .set('X-Forwarded-For', testIp);
        expect(res.status).toBe(200);
      }

      // 3rd request to pipeline should be throttled with HTTP 429
      const throttledRes = await request(app)
        .get('/api/pipeline')
        .set('X-Forwarded-For', testIp);

      expect(throttledRes.status).toBe(429);
      expect(throttledRes.body).toEqual({
        error: 'Too Many Requests',
        message: 'Too many requests for high-cost AI pipeline endpoints, please try again later.'
      });

      // Meanwhile, public endpoint for same IP still works since general limit is 100
      const publicRes = await request(app)
        .get('/api/health')
        .set('X-Forwarded-For', testIp);
      expect(publicRes.status).toBe(200);
    });

    it('should enforce pipeline rate limit on express creation endpoints', async () => {
      process.env.ENABLE_TEST_RATE_LIMIT = 'true';
      delete process.env.DISABLE_RATE_LIMITING;
      process.env.RATE_LIMIT_PIPELINE_MAX = '1';
      const testIp = '203.0.113.197';

      // 1st request to /api/express-creation (rate limit middleware increments count)
      await request(app)
        .get('/api/express-creation')
        .set('X-Forwarded-For', testIp);

      // 2nd request to /api/express-creation should hit 429 rate limit
      const res2 = await request(app)
        .get('/api/express-creation')
        .set('X-Forwarded-For', testIp);

      expect(res2.status).toBe(429);
      expect(res2.body).toEqual({
        error: 'Too Many Requests',
        message: 'Too many requests for high-cost AI pipeline endpoints, please try again later.'
      });
    });
  });
});
