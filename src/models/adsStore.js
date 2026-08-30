const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '../../data');
const FILE_PATH = path.join(DATA_DIR, process.env.NODE_ENV === 'test' ? 'ads.test.json' : 'ads.json');

const DEFAULT_COUNTRIES = [
  { id: 'lb', code: 'LB', name: 'Lebanon', currency: 'USD', isActive: true },
  { id: 'sa', code: 'SA', name: 'Saudi Arabia', currency: 'USD', isActive: true },
  { id: 'ae', code: 'AE', name: 'United Arab Emirates', currency: 'USD', isActive: true }
];

const DEFAULT_PRODUCTS = [
  {
    id: 'prod_featured_article',
    slug: 'featured-article',
    name: 'Featured Article & Editorial Story',
    description: 'In-depth storytelling written by 961 editorial staff and published across web & news feed.',
    category: 'Editorial',
    basePrice: 750,
    unit: 'per article',
    inclusions: [
      'Full editorial article written by 961 staff',
      'Permanent publication on 961.co',
      'Social media broadcast on Facebook & X',
      'Dofollow SEO backlinks'
    ],
    crossSellIds: ['prod_social_video', 'prod_newsletter_feature'],
    crossSellReasons: {
      prod_social_video: 'Amplify editorial reach by 3x with a dedicated TikTok & Instagram Reel video.',
      prod_newsletter_feature: 'Get instant day-one exposure by featuring in The961 Morning Brief.'
    }
  },
  {
    id: 'prod_social_video',
    slug: 'social-video',
    name: 'Dedicated Social Video Reel / TikTok',
    description: 'High-impact short-form video produced or formatted for 961 Instagram Reel & TikTok channels.',
    category: 'Social',
    basePrice: 950,
    unit: 'per video',
    inclusions: [
      '1080x1920 HD vertical video reel',
      'Published on 961 Instagram & TikTok',
      'Interactive story highlight placement',
      'Targeted audience engagement report'
    ],
    crossSellIds: ['prod_featured_article', 'addon_express_delivery'],
    crossSellReasons: {
      prod_featured_article: 'Pair your video with a long-form article for permanent Google SEO ranking.',
      addon_express_delivery: 'Publish within 24 hours of brief approval with express queue processing.'
    }
  },
  {
    id: 'prod_display_banner',
    slug: 'display-banner',
    name: 'Responsive Display Banner Network',
    description: 'High-visibility Leaderboard (728x90) and MPU (300x250) banner impressions across key article pages.',
    category: 'Display',
    basePrice: 300,
    unit: 'per 10,000 impressions',
    inclusions: [
      'Leaderboard & MPU banner ad slots',
      'Geo-targeted audience delivery',
      'Real-time CTR and impression analytics',
      'Desktop & Mobile optimization'
    ],
    crossSellIds: ['prod_featured_article', 'prod_newsletter_feature'],
    crossSellReasons: {
      prod_featured_article: 'Drive targeted traffic directly from display banners to your featured article.',
      prod_newsletter_feature: 'Extend banner exposure to high-intent email subscribers.'
    }
  },
  {
    id: 'prod_newsletter_feature',
    slug: 'newsletter-feature',
    name: 'Daily Morning Brief Newsletter Sponsor',
    description: 'Top header takeover or dedicated sponsored story segment in 961 daily morning newsletter.',
    category: 'Newsletter',
    basePrice: 450,
    unit: 'per edition',
    inclusions: [
      'Top header logo takeover & headline blurb',
      'Direct URL tracking link',
      'Delivered to 45,000+ active subscribers',
      '50%+ average open rate'
    ],
    crossSellIds: ['prod_featured_article', 'addon_translation'],
    crossSellReasons: {
      prod_featured_article: 'Link newsletter readers to a comprehensive editorial feature story.',
      addon_translation: 'Reach Arabic & French readers with localized newsletter editions.'
    }
  },
  {
    id: 'prod_dedicated_social_post',
    slug: 'dedicated-social-post',
    name: 'Dedicated Social Feed Post',
    description: 'Single image or carousel post on 961 social media channels with brand tag & link.',
    category: 'Social',
    basePrice: 500,
    unit: 'per post',
    inclusions: [
      'Single/Carousel post on Instagram & Facebook',
      'Tag brand account & link in bio',
      'Custom creative styling'
    ],
    crossSellIds: ['prod_social_video', 'addon_express_delivery'],
    crossSellReasons: {
      prod_social_video: 'Upgrade to a dynamic vertical video for 4x higher viral potential.',
      addon_express_delivery: 'Fast-track your post for 24-hour publish timeline.'
    }
  }
];

const DEFAULT_PRODUCT_COUNTRIES = [
  // Lebanon
  { id: 'pc_fa_lb', productId: 'prod_featured_article', countryId: 'lb', price: 750, currency: 'USD', isAvailable: true },
  { id: 'pc_sv_lb', productId: 'prod_social_video', countryId: 'lb', price: 950, currency: 'USD', isAvailable: true },
  { id: 'pc_db_lb', productId: 'prod_display_banner', countryId: 'lb', price: 300, currency: 'USD', isAvailable: true },
  { id: 'pc_nf_lb', productId: 'prod_newsletter_feature', countryId: 'lb', price: 450, currency: 'USD', isAvailable: true },
  { id: 'pc_sp_lb', productId: 'prod_dedicated_social_post', countryId: 'lb', price: 500, currency: 'USD', isAvailable: true },

  // Saudi Arabia
  { id: 'pc_fa_sa', productId: 'prod_featured_article', countryId: 'sa', price: 1200, currency: 'USD', isAvailable: true },
  { id: 'pc_sv_sa', productId: 'prod_social_video', countryId: 'sa', price: 1500, currency: 'USD', isAvailable: true },
  { id: 'pc_db_sa', productId: 'prod_display_banner', countryId: 'sa', price: 500, currency: 'USD', isAvailable: true },
  { id: 'pc_nf_sa', productId: 'prod_newsletter_feature', countryId: 'sa', price: 750, currency: 'USD', isAvailable: true },
  { id: 'pc_sp_sa', productId: 'prod_dedicated_social_post', countryId: 'sa', price: 800, currency: 'USD', isAvailable: true },

  // UAE
  { id: 'pc_fa_ae', productId: 'prod_featured_article', countryId: 'ae', price: 1200, currency: 'USD', isAvailable: true },
  { id: 'pc_sv_ae', productId: 'prod_social_video', countryId: 'ae', price: 1500, currency: 'USD', isAvailable: true },
  { id: 'pc_db_ae', productId: 'prod_display_banner', countryId: 'ae', price: 500, currency: 'USD', isAvailable: true },
  { id: 'pc_nf_ae', productId: 'prod_newsletter_feature', countryId: 'ae', price: 750, currency: 'USD', isAvailable: true },
  { id: 'pc_sp_ae', productId: 'prod_dedicated_social_post', countryId: 'ae', price: 800, currency: 'USD', isAvailable: true }
];

const DEFAULT_ADDONS = [
  {
    id: 'addon_express_delivery',
    slug: 'express-delivery',
    name: 'Express 24-Hour Production & Delivery',
    description: 'Fast-track content creation and publish within 24 hours of brief approval.',
    price: 250,
    unit: 'one-time',
    compatibleProductIds: ['prod_featured_article', 'prod_social_video', 'prod_dedicated_social_post']
  },
  {
    id: 'addon_translation',
    slug: 'multilingual-translation',
    name: 'Multilingual Translation (Arabic / French)',
    description: 'Professional translation and localized content adaptation into Arabic and French.',
    price: 150,
    unit: 'per language',
    compatibleProductIds: ['prod_featured_article', 'prod_newsletter_feature']
  },
  {
    id: 'addon_creative_design',
    slug: 'creative-design',
    name: 'Custom Graphics & Creative Design',
    description: '961 in-house design team creates custom graphic banners and story visual assets.',
    price: 200,
    unit: 'one-time',
    compatibleProductIds: ['prod_display_banner', 'prod_social_video', 'prod_dedicated_social_post']
  },
  {
    id: 'addon_analytics_report',
    slug: 'analytics-audit',
    name: 'Detailed Performance Audit Report',
    description: 'Comprehensive post-campaign report detailing impressions, clicks, demographics, and engagement.',
    price: 100,
    unit: 'one-time',
    compatibleProductIds: ['prod_featured_article', 'prod_social_video', 'prod_display_banner', 'prod_newsletter_feature', 'prod_dedicated_social_post']
  }
];

let writeQueue = Promise.resolve();

let memoryStore = null;

async function ensureInitialized() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {}

  try {
    await fs.access(FILE_PATH);
  } catch (err) {
    const initialStore = {
      countries: DEFAULT_COUNTRIES,
      products: DEFAULT_PRODUCTS,
      productCountries: DEFAULT_PRODUCT_COUNTRIES,
      addOns: DEFAULT_ADDONS,
      advertisers: [],
      contacts: [],
      campaigns: [],
      campaignItems: [],
      assets: [],
      conversations: []
    };
    await fs.writeFile(FILE_PATH, JSON.stringify(initialStore, null, 2), 'utf8');
  }
}

async function getStore() {
  if (memoryStore) {
    return memoryStore;
  }

  await ensureInitialized();
  try {
    const raw = await fs.readFile(FILE_PATH, 'utf8');
    const store = JSON.parse(raw);
    memoryStore = {
      countries: store.countries || DEFAULT_COUNTRIES,
      products: store.products || DEFAULT_PRODUCTS,
      productCountries: store.productCountries || DEFAULT_PRODUCT_COUNTRIES,
      addOns: store.addOns || DEFAULT_ADDONS,
      advertisers: store.advertisers || [],
      contacts: store.contacts || [],
      campaigns: store.campaigns || [],
      campaignItems: store.campaignItems || [],
      assets: store.assets || [],
      conversations: store.conversations || []
    };
  } catch (err) {
    memoryStore = {
      countries: DEFAULT_COUNTRIES,
      products: DEFAULT_PRODUCTS,
      productCountries: DEFAULT_PRODUCT_COUNTRIES,
      addOns: DEFAULT_ADDONS,
      advertisers: [],
      contacts: [],
      campaigns: [],
      campaignItems: [],
      assets: [],
      conversations: []
    };
  }
  return memoryStore;
}

async function saveStore(store) {
  memoryStore = store;
  await ensureInitialized();
  writeQueue = writeQueue.then(async () => {
    const tempPath = `${FILE_PATH}.tmp.${Date.now()}.${crypto.randomBytes(4).toString('hex')}`;
    await fs.writeFile(tempPath, JSON.stringify(store, null, 2), 'utf8');
    await fs.rename(tempPath, FILE_PATH);
  }).catch(err => {
    console.error('Failed to save ads store:', err);
  });
  return writeQueue;
}

// --- Catalog Helper ---
async function getAdCatalog(countryCodeOrId = 'lb') {
  const store = await getStore();
  const cLower = (countryCodeOrId || 'lb').toLowerCase();
  
  const selectedCountry = store.countries.find(
    c => c.id.toLowerCase() === cLower || c.code.toLowerCase() === cLower
  ) || store.countries[0];

  const countryProducts = store.products.map(product => {
    const pc = store.productCountries.find(
      p => p.productId === product.id && p.countryId === selectedCountry.id
    );
    const price = pc ? pc.price : product.basePrice;
    const isAvailable = pc ? pc.isAvailable : true;

    return {
      ...product,
      price,
      currency: selectedCountry.currency,
      isAvailable
    };
  });

  return {
    countries: store.countries,
    activeCountry: selectedCountry,
    products: countryProducts,
    addOns: store.addOns,
    deterministicCrossSells: store.products.map(p => ({
      productId: p.id,
      recommended: p.crossSellIds.map(csId => {
        const foundProd = store.products.find(item => item.id === csId);
        const foundAddOn = store.addOns.find(item => item.id === csId);
        const itemObj = foundProd || foundAddOn;
        return {
          id: csId,
          name: itemObj ? itemObj.name : csId,
          type: foundProd ? 'product' : 'addon',
          reason: p.crossSellReasons ? p.crossSellReasons[csId] : 'Complements your selection.'
        };
      })
    }))
  };
}

// --- Advertiser & Contact Helpers ---
function createOrUpdateAdvertiserInStore(store, leadData) {
  const companyName = (leadData.companyName || leadData.brand || 'Unnamed Advertiser').trim();
  const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company';
  
  let advertiser = store.advertisers.find(
    a => a.companySlug === companySlug || a.companyName.toLowerCase() === companyName.toLowerCase()
  );

  if (!advertiser) {
    advertiser = {
      id: `adv_${crypto.randomBytes(6).toString('hex')}`,
      companyName,
      companySlug,
      brandName: leadData.brand || companyName,
      website: leadData.website || '',
      industry: leadData.industry || '',
      countryId: leadData.countryId || 'lb',
      createdAt: new Date().toISOString()
    };
    store.advertisers.push(advertiser);
  }

  let contact = store.contacts.find(
    c => c.email.toLowerCase() === (leadData.email || '').toLowerCase()
  );

  if (!contact && leadData.email) {
    contact = {
      id: `cnt_${crypto.randomBytes(6).toString('hex')}`,
      advertiserId: advertiser.id,
      fullName: leadData.fullName || 'Lead Contact',
      email: leadData.email,
      phoneNumber: leadData.phoneNumber || leadData.phone || '',
      role: leadData.role || 'Marketing Contact',
      createdAt: new Date().toISOString()
    };
    store.contacts.push(contact);
  }

  return { advertiser, contact };
}

async function createOrUpdateAdvertiser(leadData) {
  const store = await getStore();
  const res = createOrUpdateAdvertiserInStore(store, leadData);
  await saveStore(store);
  return res;
}

// --- Campaign Creation & Management ---
async function createLeadCampaign(campaignData) {
  const store = await getStore();
  const { advertiser, contact } = createOrUpdateAdvertiserInStore(store, campaignData);

  const sessionId = campaignData.sessionId || `sess_${crypto.randomBytes(8).toString('hex')}`;
  const accessToken = campaignData.accessToken || `cmp_tok_${crypto.randomBytes(16).toString('hex')}`;
  const campaignId = campaignData.id || `cmp_${crypto.randomBytes(6).toString('hex')}`;

  const companySlug = advertiser.companySlug;
  const slackChannel = `#ads-${companySlug}`;

  const newCampaign = {
    id: campaignId,
    advertiserId: advertiser.id,
    contactId: contact ? contact.id : null,
    name: campaignData.name || `${advertiser.brandName} Campaign`,
    objective: campaignData.objective || 'Brand Awareness',
    countryId: campaignData.countryId || 'lb',
    status: campaignData.status || 'lead_captured', // lead_captured, draft, pending_payment, active, completed, cancelled
    totalAmount: parseFloat(campaignData.totalAmount || 0),
    currency: campaignData.currency || 'USD',
    accessToken,
    slackChannel,
    sessionId,
    notes: campaignData.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  store.campaigns.push(newCampaign);

  // Store campaign items
  if (Array.isArray(campaignData.items)) {
    campaignData.items.forEach(item => {
      store.campaignItems.push({
        id: `citem_${crypto.randomBytes(6).toString('hex')}`,
        campaignId: newCampaign.id,
        productId: item.productId,
        quantity: item.quantity || 1,
        unitPrice: parseFloat(item.unitPrice || item.price || 0),
        totalPrice: parseFloat(item.totalPrice || (item.quantity || 1) * (item.unitPrice || item.price || 0)),
        addOns: item.addOns || [],
        details: item.details || {},
        createdAt: new Date().toISOString()
      });
    });
  }

  // Add initial message in conversation thread
  store.conversations.push({
    id: `msg_${crypto.randomBytes(6).toString('hex')}`,
    campaignId: newCampaign.id,
    senderType: 'team',
    senderName: '961 Campaign Team',
    message: `Welcome to your 961 Campaign Workspace! We have received your brief for ${advertiser.brandName}. Our team will review your creative specifications shortly.`,
    createdAt: new Date().toISOString()
  });

  await saveStore(store);
  return { campaign: newCampaign, advertiser, contact, accessToken, sessionId };
}

async function getCampaignByToken(token) {
  const store = await getStore();
  const campaign = store.campaigns.find(c => c.accessToken === token || c.id === token);
  if (!campaign) return null;

  const advertiser = store.advertisers.find(a => a.id === campaign.advertiserId) || null;
  const contact = store.contacts.find(c => c.id === campaign.contactId) || null;
  const items = store.campaignItems.filter(i => i.campaignId === campaign.id);
  const campaignAssets = store.assets.filter(a => a.campaignId === campaign.id || (campaign.sessionId && a.sessionId === campaign.sessionId));
  const messages = store.conversations.filter(m => m.campaignId === campaign.id).sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));

  return {
    campaign,
    advertiser,
    contact,
    items,
    assets: campaignAssets,
    messages
  };
}

async function addConversationMessage(tokenOrCampaignId, senderType, senderName, message) {
  const store = await getStore();
  const campaign = store.campaigns.find(c => c.accessToken === tokenOrCampaignId || c.id === tokenOrCampaignId);
  if (!campaign) return null;

  const newMsg = {
    id: `msg_${crypto.randomBytes(6).toString('hex')}`,
    campaignId: campaign.id,
    senderType: senderType || 'client',
    senderName: senderName || (senderType === 'client' ? 'Client' : '961 Campaign Team'),
    message: message.trim(),
    createdAt: new Date().toISOString()
  };

  store.conversations.push(newMsg);
  await saveStore(store);
  return newMsg;
}

async function recordAsset(assetData) {
  const store = await getStore();
  const newAsset = {
    id: `ast_${crypto.randomBytes(6).toString('hex')}`,
    campaignId: assetData.campaignId || null,
    sessionId: assetData.sessionId || null,
    fileName: assetData.fileName,
    fileType: assetData.fileType || 'application/octet-stream',
    fileSize: assetData.fileSize || 0,
    wasabiPath: assetData.wasabiPath,
    isTemporary: assetData.isTemporary !== undefined ? assetData.isTemporary : true,
    createdAt: new Date().toISOString()
  };

  store.assets.push(newAsset);
  await saveStore(store);
  return newAsset;
}

async function getAllLeadsAndCampaigns() {
  const store = await getStore();

  const results = store.campaigns.map(cmp => {
    const advertiser = store.advertisers.find(a => a.id === cmp.advertiserId);
    const contact = store.contacts.find(c => c.id === cmp.contactId);
    const items = store.campaignItems.filter(i => i.campaignId === cmp.id);
    const assets = store.assets.filter(a => a.campaignId === cmp.id || (cmp.sessionId && a.sessionId === cmp.sessionId));

    // Calculate budget priority tier
    let priorityTier = 1;
    if (cmp.totalAmount >= 15000) priorityTier = 5;
    else if (cmp.totalAmount >= 7500) priorityTier = 4;
    else if (cmp.totalAmount >= 3000) priorityTier = 3;
    else if (cmp.totalAmount >= 1000) priorityTier = 2;

    return {
      ...cmp,
      advertiser,
      contact,
      items,
      assets,
      priorityTier
    };
  });

  // Sort by budget priority descending, then by creation date descending
  return results.sort((a, b) => {
    if (b.priorityTier !== a.priorityTier) return b.priorityTier - a.priorityTier;
    if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

async function updateCampaignStatus(campaignId, status) {
  const store = await getStore();
  const campaign = store.campaigns.find(c => c.id === campaignId || c.accessToken === campaignId);
  if (!campaign) return null;

  campaign.status = status;
  campaign.updatedAt = new Date().toISOString();
  await saveStore(store);
  return campaign;
}

async function processPaymentAndActivateCampaign(payload) {
  const store = await getStore();
  const campaignId = payload.campaignId || payload.campaign_id;
  const sessionId = payload.sessionId || payload.session_id;

  let campaign = store.campaigns.find(
    c => (campaignId && (c.id === campaignId || c.accessToken === campaignId)) ||
         (sessionId && c.sessionId === sessionId)
  );

  if (!campaign) {
    // If campaign was not created beforehand, create from payload
    const created = await createLeadCampaign({
      ...payload,
      status: 'active'
    });
    campaign = created.campaign;
  } else {
    campaign.status = 'active';
    campaign.updatedAt = new Date().toISOString();
  }

  // Migrate temporary assets to permanent
  const targetSessionId = campaign.sessionId || sessionId;
  store.assets.forEach(ast => {
    if ((ast.sessionId === targetSessionId || ast.campaignId === campaign.id) && ast.isTemporary) {
      ast.isTemporary = false;
      ast.campaignId = campaign.id;
      if (ast.wasabiPath && ast.wasabiPath.includes('campaigns/temporary/')) {
        ast.wasabiPath = ast.wasabiPath.replace('campaigns/temporary/', 'campaigns/permanent/');
      }
    }
  });

  await saveStore(store);
  return campaign;
}

async function clearStore() {
  memoryStore = {
    countries: DEFAULT_COUNTRIES,
    products: DEFAULT_PRODUCTS,
    productCountries: DEFAULT_PRODUCT_COUNTRIES,
    addOns: DEFAULT_ADDONS,
    advertisers: [],
    contacts: [],
    campaigns: [],
    campaignItems: [],
    assets: [],
    conversations: []
  };
  await saveStore(memoryStore);
}

module.exports = {
  getStore,
  saveStore,
  clearStore,
  getAdCatalog,
  createLeadCampaign,
  getCampaignByToken,
  addConversationMessage,
  recordAsset,
  getAllLeadsAndCampaigns,
  updateCampaignStatus,
  processPaymentAndActivateCampaign
};
