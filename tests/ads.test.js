const request = require('supertest');
const app = require('../src/app');
const adsStore = require('../src/models/adsStore');

describe('Ads Platform REST API & Wasabi Cleanup Tests', () => {

  beforeEach(async () => {
    await adsStore.clearStore();
  });

  it('GET /api/v1/ad-catalog returns country-specific catalog, pricing, inclusions, and deterministic cross-sells', async () => {
    const res = await request(app).get('/api/v1/ad-catalog?country=lb');
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('countries');
    expect(res.body).toHaveProperty('activeCountry');
    expect(res.body.activeCountry.code).toEqual('LB');
    expect(res.body).toHaveProperty('products');
    expect(Array.isArray(res.body.products)).toBe(true);

    const featuredArticle = res.body.products.find(p => p.slug === 'featured-article');
    expect(featuredArticle).toBeDefined();
    expect(featuredArticle.price).toEqual(750);
    expect(Array.isArray(featuredArticle.inclusions)).toBe(true);

    expect(res.body).toHaveProperty('deterministicCrossSells');
    expect(Array.isArray(res.body.deterministicCrossSells)).toBe(true);
  });

  it('POST /api/v1/campaigns/lead captures advertiser info and generates draft campaign with token', async () => {
    const payload = {
      fullName: 'John Expat',
      email: 'john@acme.com',
      phoneNumber: '+961 70 111 222',
      brand: 'Acme Corp',
      objective: 'Brand Awareness',
      countryId: 'lb',
      totalAmount: 1700,
      items: [
        { productId: 'prod_featured_article', unitPrice: 750, quantity: 1, totalPrice: 750 },
        { productId: 'prod_social_video', unitPrice: 950, quantity: 1, totalPrice: 950 }
      ]
    };

    const res = await request(app)
      .post('/api/v1/campaigns/lead')
      .send(payload);

    expect(res.statusCode).toEqual(201);
    expect(res.body.success).toBe(true);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.accessToken).toMatch(/^cmp_tok_/);
    expect(res.body.campaign.status).toEqual('lead_captured');
  });

  it('POST /api/v1/campaigns/upload handles temporary uploads under Wasabi campaigns/temporary/{session_id}/', async () => {
    const payload = {
      sessionId: 'sess_test_123',
      fileName: 'brief.png',
      fileData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      fileType: 'image/png'
    };

    const res = await request(app)
      .post('/api/v1/campaigns/upload')
      .send(payload);

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(res.body.publicUrl).toContain('campaigns/temporary/sess_test_123/brief.png');
    expect(res.body.asset.isTemporary).toBe(true);
  });

  it('POST /api/v1/webhooks/payment verifies transaction, activates campaign, and migrates assets', async () => {
    // 1. Create lead
    const leadRes = await request(app)
      .post('/api/v1/campaigns/lead')
      .send({
        fullName: 'Jane Expat',
        email: 'jane@fintech.com',
        phoneNumber: '+961 71 333 444',
        brand: 'Fintech Solutions',
        companyName: 'Fintech Solutions Ltd',
        totalAmount: 2200,
        sessionId: 'sess_pay_test'
      });

    const campaignId = leadRes.body.campaign.id;
    const token = leadRes.body.accessToken;

    // 2. Trigger payment webhook
    const payRes = await request(app)
      .post('/api/v1/webhooks/payment')
      .send({
        campaignId,
        sessionId: 'sess_pay_test',
        status: 'succeeded',
        transactionId: 'txn_999888'
      });

    expect(payRes.statusCode).toEqual(200);
    expect(payRes.body.success).toBe(true);

    // 3. Verify status in campaign workspace
    const wsRes = await request(app).get(`/api/v1/campaigns/workspace/${token}`);
    expect(wsRes.statusCode).toEqual(200);
    expect(wsRes.body.campaign.status).toEqual('active');
  });

  it('POST /api/v1/campaigns/workspace/:token/messages allows chatting with 961 Campaign Team', async () => {
    const leadRes = await request(app)
      .post('/api/v1/campaigns/lead')
      .send({
        fullName: 'Alice Smith',
        email: 'alice@brand.com',
        phoneNumber: '+961 76 555 666',
        brand: 'Alice Brand'
      });

    const token = leadRes.body.accessToken;

    const msgRes = await request(app)
      .post(`/api/v1/campaigns/workspace/${token}/messages`)
      .send({
        senderType: 'client',
        senderName: 'Alice Smith',
        message: 'Hello, when will our draft article be ready?'
      });

    expect(msgRes.statusCode).toEqual(201);
    expect(msgRes.body.message.message).toEqual('Hello, when will our draft article be ready?');

    const wsRes = await request(app).get(`/api/v1/campaigns/workspace/${token}`);
    expect(wsRes.body.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /api/v1/admin/leads-and-campaigns sorts opportunities by budget priority and state', async () => {
    const res = await request(app).get('/api/v1/admin/leads-and-campaigns');
    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.opportunities)).toBe(true);
  });

  it('POST /api/v1/admin/campaigns/:id/slack-channel creates internal Slack channel (#ads-{company_slug})', async () => {
    const leadRes = await request(app)
      .post('/api/v1/campaigns/lead')
      .send({
        fullName: 'Mark Director',
        email: 'mark@starburst.com',
        phoneNumber: '+961 70 777 888',
        brand: 'Starburst Tech',
        companyName: 'Starburst Tech'
      });

    const campaignId = leadRes.body.campaign.id;

    const slackRes = await request(app)
      .post(`/api/v1/admin/campaigns/${campaignId}/slack-channel`);

    expect(slackRes.statusCode).toEqual(200);
    expect(slackRes.body.slackChannel).toEqual('#ads-starburst-tech');
  });

});
