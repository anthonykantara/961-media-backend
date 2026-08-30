const express = require('express');
const router = express.Router();
const adsStore = require('../models/adsStore');
const { uploadToWasabi } = require('../services/wasabiService');
const { migrateAdAssetsToPermanent } = require('../workers/wasabiAdCleanup');
const { createAdsSlackChannel } = require('../services/slackAdService');

/**
 * GET /api/v1/ad-catalog
 * Country-specific catalog pricing, inclusions, add-ons, and deterministic cross-sells
 */
router.get('/ad-catalog', async (req, res, next) => {
  try {
    const country = req.query.country || 'lb';
    const catalog = await adsStore.getAdCatalog(country);
    res.status(200).json(catalog);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/campaigns/lead
 * Lead capture & campaign draft creation
 */
router.post('/campaigns/lead', async (req, res, next) => {
  try {
    const leadData = req.body || {};
    if (!leadData.email || !leadData.fullName) {
      return res.status(400).json({ error: 'Bad Request', message: 'Full name and email are required.' });
    }

    const result = await adsStore.createLeadCampaign(leadData);
    
    // Optionally trigger Slack channel prep
    if (result.advertiser && result.advertiser.companySlug) {
      createAdsSlackChannel(result.advertiser.companySlug, {
        brandName: result.advertiser.brandName,
        totalAmount: result.campaign.totalAmount,
        objective: result.campaign.objective,
        status: result.campaign.status,
        email: leadData.email
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      campaign: result.campaign,
      accessToken: result.accessToken,
      sessionId: result.sessionId,
      workspaceUrl: `/campaign/${result.accessToken}`
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/campaigns/upload
 * Upload temporary creative assets to Wasabi S3
 */
router.post('/campaigns/upload', async (req, res, next) => {
  try {
    const { sessionId, campaignId, fileName, fileData, fileType } = req.body || {};
    const effectiveSessionId = sessionId || `sess_${Date.now()}`;
    const cleanFileName = fileName || `asset_${Date.now()}.png`;

    const wasabiKey = campaignId 
      ? `campaigns/permanent/${campaignId}/${cleanFileName}`
      : `campaigns/temporary/${effectiveSessionId}/${cleanFileName}`;

    let buffer = Buffer.from('');
    if (fileData) {
      if (typeof fileData === 'string' && fileData.startsWith('data:')) {
        const base64Str = fileData.split(',')[1] || fileData;
        buffer = Buffer.from(base64Str, 'base64');
      } else if (typeof fileData === 'string') {
        buffer = Buffer.from(fileData, 'utf8');
      } else if (Buffer.isBuffer(fileData)) {
        buffer = fileData;
      }
    }

    const publicUrl = await uploadToWasabi(buffer, wasabiKey, fileType || 'image/png');

    const assetRecord = await adsStore.recordAsset({
      campaignId: campaignId || null,
      sessionId: effectiveSessionId,
      fileName: cleanFileName,
      fileType: fileType || 'image/png',
      fileSize: buffer.length,
      wasabiPath: publicUrl,
      isTemporary: !campaignId
    });

    res.status(200).json({
      success: true,
      asset: assetRecord,
      publicUrl,
      sessionId: effectiveSessionId
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/webhooks/payment
 * Payment transaction webhook, initializing permanent campaign & migrating assets
 */
router.post('/webhooks/payment', async (req, res, next) => {
  try {
    const payload = req.body || {};
    const { campaignId, sessionId, transactionId, status } = payload;

    if (status && status !== 'succeeded' && status !== 'paid' && status !== 'completed') {
      return res.status(400).json({ error: 'Bad Request', message: 'Transaction status not successful.' });
    }

    const campaign = await adsStore.processPaymentAndActivateCampaign(payload);

    // Migrate Wasabi assets from temporary to permanent
    if (campaign && campaign.sessionId) {
      await migrateAdAssetsToPermanent(campaign.sessionId, campaign.id);
    }

    // Trigger Slack channel creation
    if (campaign) {
      const store = await adsStore.getStore();
      const advertiser = store.advertisers.find(a => a.id === campaign.advertiserId);
      if (advertiser && advertiser.companySlug) {
        await createAdsSlackChannel(advertiser.companySlug, {
          brandName: advertiser.brandName,
          totalAmount: campaign.totalAmount,
          objective: campaign.objective,
          status: campaign.status,
          email: payload.email
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Payment verified and campaign activated.',
      campaign,
      accessToken: campaign ? campaign.accessToken : null,
      workspaceUrl: campaign ? `/campaign/${campaign.accessToken}` : null
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/campaigns/workspace/:token
 * Client Campaign Workspace details
 */
router.get('/campaigns/workspace/:token', async (req, res, next) => {
  try {
    const token = req.params.token;
    const workspace = await adsStore.getCampaignByToken(token);

    if (!workspace) {
      return res.status(404).json({ error: 'Not Found', message: 'Campaign workspace not found.' });
    }

    res.status(200).json(workspace);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/campaigns/workspace/:token/messages
 * Post chat message in campaign workspace
 */
router.post('/campaigns/workspace/:token/messages', async (req, res, next) => {
  try {
    const token = req.params.token;
    const { senderType, senderName, message } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Bad Request', message: 'Message text is required.' });
    }

    const msg = await adsStore.addConversationMessage(token, senderType, senderName, message);

    if (!msg) {
      return res.status(404).json({ error: 'Not Found', message: 'Campaign not found.' });
    }

    res.status(201).json({ success: true, message: msg });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/admin/leads-and-campaigns
 * Admin view sorting opportunities by budget priority and state
 */
router.get('/admin/leads-and-campaigns', async (req, res, next) => {
  try {
    const data = await adsStore.getAllLeadsAndCampaigns();
    res.status(200).json({
      success: true,
      totalCount: data.length,
      opportunities: data
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/admin/campaigns/:id/slack-channel
 * Trigger Slack channel creation (#ads-{company_slug})
 */
router.post('/admin/campaigns/:id/slack-channel', async (req, res, next) => {
  try {
    const campaignId = req.params.id;
    const store = await adsStore.getStore();
    const campaign = store.campaigns.find(c => c.id === campaignId || c.accessToken === campaignId);

    if (!campaign) {
      return res.status(404).json({ error: 'Not Found', message: 'Campaign not found.' });
    }

    const advertiser = store.advertisers.find(a => a.id === campaign.advertiserId);
    const companySlug = advertiser ? advertiser.companySlug : 'company';

    const slackResult = await createAdsSlackChannel(companySlug, {
      brandName: advertiser ? advertiser.brandName : campaign.name,
      totalAmount: campaign.totalAmount,
      objective: campaign.objective,
      status: campaign.status
    });

    res.status(200).json({
      success: true,
      slackChannel: slackResult.channelName,
      details: slackResult
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
