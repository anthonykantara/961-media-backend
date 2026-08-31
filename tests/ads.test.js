const request = require('supertest');
const app = require('../src/app');
const adsStore = require('../src/models/adsStore');
const { startWasabiAdCleanupScheduler, stopWasabiAdCleanupScheduler } = require('../src/workers/wasabiAdCleanup');
const { getAuthHeader } = require('./testUtils');
const adminHeaders = getAuthHeader({ role: 'Admin' });

describe('Ads Platform REST API, Wasabi Cleanup & Persistence Tests', () => {

  beforeEach(async () => {
    await adsStore.clearStore();
  });

  afterEach(() => {
    stopWasabiAdCleanupScheduler();
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

    // Test Saudi Arabia catalog pricing
    const saRes = await request(app).get('/api/v1/ad-catalog?country=sa');
    expect(saRes.statusCode).toEqual(200);
    expect(saRes.body.activeCountry.code).toEqual('SA');
    const saFeaturedArticle = saRes.body.products.find(p => p.slug === 'featured-article');
    expect(saFeaturedArticle.price).toEqual(1200);
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
    expect(res.body.campaign.totalAmount).toEqual(1700);
  });

  it('POST /api/v1/campaigns/lead auto-calculates totalAmount if omitted from payload', async () => {
    const payload = {
      fullName: 'Sam Merchant',
      email: 'sam@shop.com',
      brand: 'Sam Shop',
      items: [
        { productId: 'prod_featured_article', unitPrice: 750, quantity: 2 },
        { productId: 'prod_display_banner', unitPrice: 300, quantity: 1 }
      ]
    };

    const res = await request(app)
      .post('/api/v1/campaigns/lead')
      .send(payload);

    expect(res.statusCode).toEqual(201);
    expect(res.body.campaign.totalAmount).toEqual(1800);
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

  it('POST /api/v1/webhooks/payment verifies transaction, activates campaign, records transactionId and migrates assets', async () => {
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

    // 2. Upload temporary asset
    await request(app)
      .post('/api/v1/campaigns/upload')
      .send({
        sessionId: 'sess_pay_test',
        fileName: 'logo.png',
        fileData: 'test'
      });

    // 3. Trigger payment webhook
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

    // 4. Verify status and asset migration in campaign workspace
    const wsRes = await request(app).get(`/api/v1/campaigns/workspace/${token}`);
    expect(wsRes.statusCode).toEqual(200);
    expect(wsRes.body.campaign.status).toEqual('active');
    expect(wsRes.body.campaign.transactionId).toEqual('txn_999888');

    const asset = wsRes.body.assets[0];
    expect(asset).toBeDefined();
    expect(asset.isTemporary).toBe(false);
    expect(asset.wasabiPath).toContain('campaigns/permanent/');
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

  it('GET /api/v1/admin/leads-and-campaigns supports filtering by status, country, and search query', async () => {
    await request(app).post('/api/v1/campaigns/lead').send({
      fullName: 'Lead One',
      email: 'lead1@test.com',
      brand: 'Brand One',
      countryId: 'lb',
      totalAmount: 1000
    });

    await request(app).post('/api/v1/campaigns/lead').send({
      fullName: 'Lead Two',
      email: 'lead2@test.com',
      brand: 'Brand Two',
      countryId: 'sa',
      totalAmount: 5000
    });

    const allRes = await request(app).get('/api/v1/admin/leads-and-campaigns').set(adminHeaders);
    expect(allRes.statusCode).toEqual(200);
    expect(allRes.body.totalCount).toEqual(2);

    // Priority tier check: $5000 should be priority tier 3 (>= 3000), $1000 tier 2
    expect(allRes.body.opportunities[0].totalAmount).toEqual(5000);

    // Filter by country=sa
    const saFilter = await request(app).get('/api/v1/admin/leads-and-campaigns?country=sa').set(adminHeaders);
    expect(saFilter.body.totalCount).toEqual(1);
    expect(saFilter.body.opportunities[0].advertiser.brandName).toEqual('Brand Two');

    // Filter by search=Brand One
    const searchFilter = await request(app).get('/api/v1/admin/leads-and-campaigns?search=Brand%20One').set(adminHeaders);
    expect(searchFilter.body.totalCount).toEqual(1);
    expect(searchFilter.body.opportunities[0].advertiser.brandName).toEqual('Brand One');
  });

  it('POST /api/v1/admin/campaigns/:id/slack-channel creates channel and updates campaign slackChannel field', async () => {
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
    const token = leadRes.body.accessToken;

    const slackRes = await request(app)
      .post(`/api/v1/admin/campaigns/${campaignId}/slack-channel`)
      .set(adminHeaders);

    expect(slackRes.statusCode).toEqual(200);
    expect(slackRes.body.slackChannel).toEqual('#ads-starburst-tech');

    const wsRes = await request(app).get(`/api/v1/campaigns/workspace/${token}`);
    expect(wsRes.body.campaign.slackChannel).toEqual('#ads-starburst-tech');
  });

  it('POST /api/v1/admin/cleanup-temp-assets triggers temporary asset cleanup', async () => {
    const res = await request(app)
      .post('/api/v1/admin/cleanup-temp-assets')
      .set(adminHeaders)
      .send({ maxAgeHours: 12 });

    expect(res.statusCode).toEqual(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.deletedKeys)).toBe(true);
  });

  it('Wasabi background cleanup scheduler starts and stops cleanly', () => {
    const timer = startWasabiAdCleanupScheduler(10000, 24);
    expect(timer).toBeDefined();
    stopWasabiAdCleanupScheduler();
  });

});
