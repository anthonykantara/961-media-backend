process.env.NODE_ENV = 'test';
process.env.WEBSITE_URL = 'http://localhost:3000';
process.env.DASHBOARD_URL = 'http://localhost:3001';
process.env.CLOUDFLARE_CDN_URL = 'https://cdn.961.co';

const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/app');
const imageEngine = require('../src/services/imageEngine');

describe('Express Creation Image Manipulation Engine & API', () => {
  jest.setTimeout(25000); // Allow sufficient time for Pillow engine processing

  describe('Direct Image Engine Service', () => {
    it('should process headline and carousel slides into featured.jpg and 4 carousel PNGs', async () => {
      const payload = {
        headline: 'Discover [Beirut Rooftops] This Summer',
        carousel_slides: [
          'Slide 1: Experience [panoramic views] of Beirut',
          'Slide 2: Signature cocktails & [vibrant music]',
          'Slide 3: Best spots in [Mar Mikhael & Gemmayzeh]',
          'Slide 4: Book your sunset table [now]'
        ]
      };

      const result = await imageEngine.processExpressCreation(payload);

      expect(result.status).toBe('success');
      expect(result).toHaveProperty('job_id');

      // Featured Image assertions
      expect(result.featured_image).toBeDefined();
      expect(result.featured_image.dimensions).toEqual({ width: 1200, height: 630 });
      expect(result.featured_image.format).toBe('JPG');
      expect(result.featured_image.url).toContain('https://cdn.961.co/express-creation/');
      expect(result.featured_image.url).toContain('/featured.jpg');
      expect(fs.existsSync(result.featured_image.local_path)).toBe(true);

      // Carousel Slides assertions
      expect(result.carousel_slides).toHaveLength(4);
      result.carousel_slides.forEach((slide, idx) => {
        expect(slide.slide).toBe(idx + 1);
        expect(slide.dimensions).toEqual({ width: 1080, height: 1350 });
        expect(slide.format).toBe('PNG');
        expect(slide.url).toContain(`carousel_${idx + 1}.png`);
        expect(fs.existsSync(slide.local_path)).toBe(true);
      });

      // CDN URLs map
      expect(result.cdn_urls.featured).toBe(result.featured_image.url);
      expect(result.cdn_urls.carousel).toHaveLength(4);
    });
  });

  describe('POST /api/express-creation', () => {
    it('should generate featured image and 4 carousel slides via Express API endpoint', async () => {
      const payload = {
        headline: 'Lebanon Tech Sector [Booms in 2026]',
        carousel_slides: [
          'AI startups expanding in [Beirut Digital District]',
          'Venture capital investments [surge by 40%]',
          'Local talent driving [global innovation]',
          'Read full report on [961 Media]'
        ]
      };

      const res = await request(app)
        .post('/api/express-creation')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.featured_image.dimensions).toEqual({ width: 1200, height: 630 });
      expect(res.body.carousel_slides).toHaveLength(4);

      res.body.carousel_slides.forEach((slide, idx) => {
        expect(slide.dimensions).toEqual({ width: 1080, height: 1350 });
        expect(slide.url).toContain(`carousel_${idx + 1}.png`);
      });
    });

    it('should handle payload with missing carousel slides by padding to 4 slides', async () => {
      const payload = {
        headline: 'Quick Update on [Beirut Season]',
        carousel_slides: [
          'Only one slide provided with [bracketed highlight]'
        ]
      };

      const res = await request(app)
        .post('/api/express-creation')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.carousel_slides).toHaveLength(4);
    });

    it('should also respond on alias endpoint POST /api/articles/express-creation', async () => {
      const payload = {
        headline: 'Headline on [Articles Endpoint]',
        carousel_slides: ['Slide A', 'Slide B', 'Slide C', 'Slide D']
      };

      const res = await request(app)
        .post('/api/articles/express-creation')
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.cdn_urls.featured).toContain('featured.jpg');
      expect(res.body.cdn_urls.carousel).toHaveLength(4);
    });
  });
});
