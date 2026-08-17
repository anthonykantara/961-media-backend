const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/app');
const pipelineStore = require('../src/models/pipelineStore');
const secretsManager = require('../src/services/secretsManager');

jest.setTimeout(30000);

describe('Content Pipeline API Endpoints & DB Migration', () => {
  beforeEach(async () => {
    await pipelineStore.clearStore();
    secretsManager.clearCache();
  });

  describe('1. Database Migration Schema', () => {
    it('should contain valid SQL migration for content_pipeline table', () => {
      const migrationPath = path.join(__dirname, '../migrations/001_create_content_pipeline.sql');
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf8');
      expect(sqlContent).toContain('CREATE TABLE IF NOT EXISTS content_pipeline');
      expect(sqlContent).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
      expect(sqlContent).toContain('topic');
      expect(sqlContent).toContain('category');
      expect(sqlContent).toContain('chosen_headline');
      expect(sqlContent).toContain('article_body');
      expect(sqlContent).toContain('social_summary');
      expect(sqlContent).toContain('ig_caption');
      expect(sqlContent).toContain('carousel_slides JSONB');
      expect(sqlContent).toContain('main_image_path');
      expect(sqlContent).toContain('slide_image_paths JSONB');
      expect(sqlContent).toContain('rendered_assets JSONB');
      expect(sqlContent).toContain("status VARCHAR(50) NOT NULL DEFAULT 'draft'");
      expect(sqlContent).toContain("'headlines_generated'");
      expect(sqlContent).toContain("'content_ready'");
      expect(sqlContent).toContain("'published'");
    });
  });

  describe('2. POST /api/pipeline/headlines', () => {
    it('should fail with 400 if topic or category are missing or empty', async () => {
      const res1 = await request(app)
        .post('/api/pipeline/headlines')
        .send({ topic: '' });
      expect(res1.statusCode).toBe(400);

      const res2 = await request(app)
        .post('/api/pipeline/headlines')
        .send({ topic: 'Lebanon Tech', category: '' });
      expect(res2.statusCode).toBe(400);
    });

    it('should generate 5 headline angles and create pipeline record with status headlines_generated', async () => {
      const res = await request(app)
        .post('/api/pipeline/headlines')
        .send({
          topic: 'Artificial Intelligence in Beirut',
          category: 'Technology'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('pipeline_id');
      expect(res.body.topic).toBe('Artificial Intelligence in Beirut');
      expect(res.body.category).toBe('Technology');
      expect(res.body.status).toBe('headlines_generated');
      expect(Array.isArray(res.body.headlines)).toBe(true);
      expect(res.body.headlines.length).toBe(5);

      // Verify stored record
      const stored = await pipelineStore.getPipelineById(res.body.pipeline_id);
      expect(stored).not.toBeNull();
      expect(stored.status).toBe('headlines_generated');
    });
  });

  describe('3. POST /api/pipeline/draft', () => {
    it('should fail with 400 if pipeline_id or chosen_headline are missing', async () => {
      const res = await request(app)
        .post('/api/pipeline/draft')
        .send({ chosen_headline: 'Some Headline' });
      expect(res.statusCode).toBe(400);
    });

    it('should fail with 404 if pipeline_id does not exist', async () => {
      const res = await request(app)
        .post('/api/pipeline/draft')
        .send({
          pipeline_id: '00000000-0000-0000-0000-000000000000',
          chosen_headline: 'Some Headline'
        });
      expect(res.statusCode).toBe(404);
    });

    it('should generate draft article body, social summary, IG caption, and slides using structured output', async () => {
      // First generate headlines
      const headlineRes = await request(app)
        .post('/api/pipeline/headlines')
        .send({
          topic: 'Lebanese Cuisine Global Expansion',
          category: 'Lifestyle'
        });
      const pipelineId = headlineRes.body.pipeline_id;
      const chosenHeadline = headlineRes.body.headlines[0];

      // Draft generation
      const draftRes = await request(app)
        .post('/api/pipeline/draft')
        .send({
          pipeline_id: pipelineId,
          chosen_headline: chosenHeadline
        });

      expect(draftRes.statusCode).toBe(200);
      expect(draftRes.body.id).toBe(pipelineId);
      expect(draftRes.body.chosen_headline).toBe(chosenHeadline);
      expect(draftRes.body.status).toBe('content_ready');
      expect(typeof draftRes.body.article_body).toBe('string');
      expect(draftRes.body.article_body.length).toBeGreaterThan(10);
      expect(typeof draftRes.body.social_summary).toBe('string');
      expect(typeof draftRes.body.ig_caption).toBe('string');
      expect(Array.isArray(draftRes.body.carousel_slides)).toBe(true);
      expect(draftRes.body.carousel_slides.length).toBeGreaterThan(0);
    });
  });

  describe('4. POST /api/pipeline/media', () => {
    it('should fail with 400 if pipeline_id is missing', async () => {
      const res = await request(app)
        .post('/api/pipeline/media');
      expect(res.statusCode).toBe(400);
    });

    it('should losslessly optimize uploaded images and upload to Wasabi Cloud Storage', async () => {
      // Create pipeline first
      const headlineRes = await request(app)
        .post('/api/pipeline/headlines')
        .send({ topic: 'Beirut Summer Events', category: 'Culture' });
      const pipelineId = headlineRes.body.pipeline_id;

      // Dummy 1x1 transparent PNG buffer
      const samplePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

      const mediaRes = await request(app)
        .post('/api/pipeline/media')
        .field('pipeline_id', pipelineId)
        .attach('mainImage', samplePng, 'main.png')
        .attach('slideImages', samplePng, 'slide1.png')
        .attach('slideImages', samplePng, 'slide2.png');

      expect(mediaRes.statusCode).toBe(200);
      expect(mediaRes.body.id).toBe(pipelineId);
      expect(mediaRes.body.main_image_path).toContain('wasabisys.com');
      expect(Array.isArray(mediaRes.body.slide_image_paths)).toBe(true);
      expect(mediaRes.body.slide_image_paths.length).toBe(2);
      expect(mediaRes.body.slide_image_paths[0]).toContain('wasabisys.com');
    });
  });

  describe('5. POST /api/pipeline/publish', () => {
    it('should fail with 400 if pipeline_id is missing', async () => {
      const res = await request(app)
        .post('/api/pipeline/publish')
        .send({});
      expect(res.statusCode).toBe(400);
    });

    it('should publish pipeline, update rendered assets and status to published', async () => {
      const headlineRes = await request(app)
        .post('/api/pipeline/headlines')
        .send({ topic: 'Fintech Innovations', category: 'Finance' });
      const pipelineId = headlineRes.body.pipeline_id;

      const pubRes = await request(app)
        .post('/api/pipeline/publish')
        .send({ pipeline_id: pipelineId });

      expect(pubRes.statusCode).toBe(200);
      expect(pubRes.body.status).toBe('published');
      expect(pubRes.body.pipeline.id).toBe(pipelineId);
      expect(pubRes.body.pipeline.status).toBe('published');
      expect(pubRes.body.pipeline.rendered_assets).toHaveProperty('instagram_story');
      expect(pubRes.body.pipeline.rendered_assets).toHaveProperty('rendered_at');
    });
  });
});
