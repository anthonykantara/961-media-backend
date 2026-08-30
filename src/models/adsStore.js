const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const db = require('../db');

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

// --- Normalizers ---
function parseJsonField(val, fallback = []) {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch (err) {
    return fallback;
  }
}

function normalizeCountry(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    currency: row.currency || 'USD',
    isActive: row.is_active !== undefined ? row.is_active : true
  };
}

function normalizeProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    category: row.category,
    basePrice: parseFloat(row.base_price || row.basePrice || 0),
    unit: row.unit || 'per item',
    inclusions: parseJsonField(row.inclusions, []),
    crossSellIds: parseJsonField(row.cross_sell_ids || row.crossSellIds, []),
    crossSellReasons: parseJsonField(row.cross_sell_reasons || row.crossSellReasons, {})
  };
}

function normalizeProductCountry(row) {
  if (!row) return null;
  return {
    id: row.id,
    productId: row.product_id || row.productId,
    countryId: row.country_id || row.countryId,
    price: parseFloat(row.price || 0),
    currency: row.currency || 'USD',
    isAvailable: row.is_available !== undefined ? row.is_available : true,
    customInclusions: parseJsonField(row.custom_inclusions || row.customInclusions, [])
  };
}

function normalizeAddOn(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    price: parseFloat(row.price || 0),
    unit: row.unit || 'one-time',
    compatibleProductIds: parseJsonField(row.compatible_product_ids || row.compatibleProductIds, [])
  };
}

function normalizeAdvertiser(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyName: row.company_name || row.companyName,
    companySlug: row.company_slug || row.companySlug,
    brandName: row.brand_name || row.brandName,
    website: row.website || '',
    industry: row.industry || '',
    countryId: row.country_id || row.countryId || 'lb',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function normalizeContact(row) {
  if (!row) return null;
  return {
    id: row.id,
    advertiserId: row.advertiser_id || row.advertiserId,
    fullName: row.full_name || row.fullName,
    email: row.email,
    phoneNumber: row.phone_number || row.phoneNumber || '',
    role: row.role || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function normalizeCampaign(row) {
  if (!row) return null;
  return {
    id: row.id,
    advertiserId: row.advertiser_id || row.advertiserId,
    contactId: row.contact_id || row.contactId,
    name: row.name,
    objective: row.objective || 'Brand Awareness',
    countryId: row.country_id || row.countryId || 'lb',
    status: row.status || 'draft',
    totalAmount: parseFloat(row.total_amount !== undefined ? row.total_amount : (row.totalAmount || 0)),
    currency: row.currency || 'USD',
    accessToken: row.access_token || row.accessToken,
    slackChannel: row.slack_channel || row.slackChannel || null,
    sessionId: row.session_id || row.sessionId || null,
    transactionId: row.transaction_id || row.transactionId || null,
    notes: row.notes || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
  };
}

function normalizeCampaignItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    campaignId: row.campaign_id || row.campaignId,
    productId: row.product_id || row.productId,
    quantity: parseInt(row.quantity || 1, 10),
    unitPrice: parseFloat(row.unit_price !== undefined ? row.unit_price : (row.unitPrice || 0)),
    totalPrice: parseFloat(row.total_price !== undefined ? row.total_price : (row.totalPrice || 0)),
    addOns: parseJsonField(row.add_ons || row.addOns, []),
    details: parseJsonField(row.details, {}),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function normalizeAsset(row) {
  if (!row) return null;
  return {
    id: row.id,
    campaignId: row.campaign_id || row.campaignId || null,
    sessionId: row.session_id || row.sessionId || null,
    fileName: row.file_name || row.fileName,
    fileType: row.file_type || row.fileType || 'application/octet-stream',
    fileSize: parseInt(row.file_size !== undefined ? row.file_size : (row.fileSize || 0), 10),
    wasabiPath: row.wasabi_path || row.wasabiPath,
    isTemporary: row.is_temporary !== undefined ? Boolean(row.is_temporary) : (row.isTemporary !== undefined ? Boolean(row.isTemporary) : true),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function normalizeConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    campaignId: row.campaign_id || row.campaignId,
    senderType: row.sender_type || row.senderType || 'client',
    senderName: row.sender_name || row.senderName || 'Client',
    message: row.message || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

// --- Memory/File Store Helpers ---
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

// --- Public Store Operations (Dual Postgres / JSON Memory Fallback) ---

async function getAdCatalog(countryCodeOrId = 'lb') {
  const pool = db.getPool();
  const cLower = (countryCodeOrId || 'lb').toLowerCase();

  if (pool) {
    try {
      const cRes = await pool.query('SELECT * FROM countries WHERE is_active = true ORDER BY name ASC');
      const pRes = await pool.query('SELECT * FROM products ORDER BY name ASC');
      const pcRes = await pool.query('SELECT * FROM product_countries');
      const addRes = await pool.query('SELECT * FROM add_ons ORDER BY name ASC');

      const countries = (cRes.rows || []).map(normalizeCountry);
      const products = (pRes.rows || []).map(normalizeProduct);
      const productCountries = (pcRes.rows || []).map(normalizeProductCountry);
      const addOns = (addRes.rows || []).map(normalizeAddOn);

      if (countries.length > 0 && products.length > 0) {
        const selectedCountry = countries.find(
          c => c.id.toLowerCase() === cLower || c.code.toLowerCase() === cLower
        ) || countries[0];

        const countryProducts = products.map(product => {
          const pc = productCountries.find(
            p => p.productId === product.id && p.countryId === selectedCountry.id
          );
          return {
            ...product,
            price: pc ? pc.price : product.basePrice,
            currency: selectedCountry.currency,
            isAvailable: pc ? pc.isAvailable : true
          };
        });

        const deterministicCrossSells = products.map(p => ({
          productId: p.id,
          recommended: (p.crossSellIds || []).map(csId => {
            const foundProd = products.find(item => item.id === csId);
            const foundAddOn = addOns.find(item => item.id === csId);
            const itemObj = foundProd || foundAddOn;
            return {
              id: csId,
              name: itemObj ? itemObj.name : csId,
              type: foundProd ? 'product' : 'addon',
              reason: p.crossSellReasons ? p.crossSellReasons[csId] : 'Complements your selection.'
            };
          })
        }));

        return {
          countries,
          activeCountry: selectedCountry,
          products: countryProducts,
          addOns,
          deterministicCrossSells
        };
      }
    } catch (err) {
      console.warn('Postgres getAdCatalog failed, falling back to memory store:', err.message);
    }
  }

  // Memory/file fallback
  const store = await getStore();
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
      recommended: (p.crossSellIds || []).map(csId => {
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
  const pool = db.getPool();

  if (pool) {
    try {
      const companyName = (leadData.companyName || leadData.brand || 'Unnamed Advertiser').trim();
      const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company';
      const brandName = leadData.brand || companyName;

      // Find or insert advertiser
      let advRes = await pool.query(
        'SELECT * FROM advertisers WHERE company_slug = $1 OR LOWER(company_name) = LOWER($2)',
        [companySlug, companyName]
      );
      let advertiser;

      if (advRes.rows && advRes.rows[0]) {
        advertiser = normalizeAdvertiser(advRes.rows[0]);
      } else {
        const advId = `adv_${crypto.randomBytes(6).toString('hex')}`;
        const now = new Date();
        const insRes = await pool.query(
          `INSERT INTO advertisers (id, company_name, company_slug, brand_name, website, industry, country_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [advId, companyName, companySlug, brandName, leadData.website || '', leadData.industry || '', leadData.countryId || 'lb', now]
        );
        advertiser = normalizeAdvertiser(insRes.rows[0]);
      }

      // Find or insert contact
      let contact = null;
      if (leadData.email) {
        let cntRes = await pool.query('SELECT * FROM contacts WHERE LOWER(email) = LOWER($1)', [leadData.email]);
        if (cntRes.rows && cntRes.rows[0]) {
          contact = normalizeContact(cntRes.rows[0]);
        } else {
          const cntId = `cnt_${crypto.randomBytes(6).toString('hex')}`;
          const now = new Date();
          const insCnt = await pool.query(
            `INSERT INTO contacts (id, advertiser_id, full_name, email, phone_number, role, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [cntId, advertiser.id, leadData.fullName || 'Lead Contact', leadData.email, leadData.phoneNumber || leadData.phone || '', leadData.role || 'Marketing Contact', now]
          );
          contact = normalizeContact(insCnt.rows[0]);
        }
      }

      return { advertiser, contact };
    } catch (err) {
      console.warn('Postgres createOrUpdateAdvertiser failed, falling back to memory store:', err.message);
    }
  }

  const store = await getStore();
  const res = createOrUpdateAdvertiserInStore(store, leadData);
  await saveStore(store);
  return res;
}

async function createLeadCampaign(campaignData) {
  let computedTotal = parseFloat(campaignData.totalAmount || 0);
  if ((isNaN(computedTotal) || computedTotal <= 0) && Array.isArray(campaignData.items)) {
    computedTotal = campaignData.items.reduce((sum, item) => {
      const uPrice = parseFloat(item.unitPrice || item.price || 0);
      const qty = parseInt(item.quantity || 1, 10);
      return sum + (item.totalPrice ? parseFloat(item.totalPrice) : uPrice * qty);
    }, 0);
  }

  const pool = db.getPool();

  if (pool) {
    try {
      const { advertiser, contact } = await createOrUpdateAdvertiser(campaignData);
      const sessionId = campaignData.sessionId || `sess_${crypto.randomBytes(8).toString('hex')}`;
      const accessToken = campaignData.accessToken || `cmp_tok_${crypto.randomBytes(16).toString('hex')}`;
      const campaignId = campaignData.id || `cmp_${crypto.randomBytes(6).toString('hex')}`;
      const companySlug = advertiser.companySlug;
      const slackChannel = `#ads-${companySlug}`;
      const now = new Date();

      const insCmp = await pool.query(
        `INSERT INTO campaigns (id, advertiser_id, contact_id, name, objective, country_id, status, total_amount, currency, access_token, slack_channel, session_id, notes, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14) RETURNING *`,
        [
          campaignId,
          advertiser.id,
          contact ? contact.id : null,
          campaignData.name || `${advertiser.brandName} Campaign`,
          campaignData.objective || 'Brand Awareness',
          campaignData.countryId || 'lb',
          campaignData.status || 'lead_captured',
          computedTotal,
          campaignData.currency || 'USD',
          accessToken,
          slackChannel,
          sessionId,
          campaignData.notes || '',
          now
        ]
      );

      const campaign = normalizeCampaign(insCmp.rows[0]);

      // Items
      if (Array.isArray(campaignData.items)) {
        for (const item of campaignData.items) {
          const itemId = `citem_${crypto.randomBytes(6).toString('hex')}`;
          const qty = parseInt(item.quantity || 1, 10);
          const uPrice = parseFloat(item.unitPrice || item.price || 0);
          const tPrice = parseFloat(item.totalPrice || qty * uPrice);
          await pool.query(
            `INSERT INTO campaign_items (id, campaign_id, product_id, quantity, unit_price, total_price, add_ons, details, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [itemId, campaign.id, item.productId, qty, uPrice, tPrice, JSON.stringify(item.addOns || []), JSON.stringify(item.details || {}), now]
          );
        }
      }

      // Conversation message
      const msgId = `msg_${crypto.randomBytes(6).toString('hex')}`;
      const initMsg = `Welcome to your 961 Campaign Workspace! We have received your brief for ${advertiser.brandName}. Our team will review your creative specifications shortly.`;
      await pool.query(
        `INSERT INTO conversations (id, campaign_id, sender_type, sender_name, message, created_at)
         VALUES ($1, $2, 'team', '961 Campaign Team', $3, $4)`,
        [msgId, campaign.id, initMsg, now]
      );

      return { campaign, advertiser, contact, accessToken, sessionId };
    } catch (err) {
      console.warn('Postgres createLeadCampaign failed, falling back to memory store:', err.message);
    }
  }

  // Memory/file fallback
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
    status: campaignData.status || 'lead_captured',
    totalAmount: computedTotal,
    currency: campaignData.currency || 'USD',
    accessToken,
    slackChannel,
    sessionId,
    transactionId: campaignData.transactionId || null,
    notes: campaignData.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  store.campaigns.push(newCampaign);

  if (Array.isArray(campaignData.items)) {
    campaignData.items.forEach(item => {
      store.campaignItems.push({
        id: `citem_${crypto.randomBytes(6).toString('hex')}`,
        campaignId: newCampaign.id,
        productId: item.productId,
        quantity: parseInt(item.quantity || 1, 10),
        unitPrice: parseFloat(item.unitPrice || item.price || 0),
        totalPrice: parseFloat(item.totalPrice || (item.quantity || 1) * (item.unitPrice || item.price || 0)),
        addOns: item.addOns || [],
        details: item.details || {},
        createdAt: new Date().toISOString()
      });
    });
  }

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
  const pool = db.getPool();

  if (pool) {
    try {
      const cmpRes = await pool.query(
        'SELECT * FROM campaigns WHERE access_token = $1 OR id = $1',
        [token]
      );
      if (cmpRes.rows && cmpRes.rows[0]) {
        const campaign = normalizeCampaign(cmpRes.rows[0]);

        const advRes = await pool.query('SELECT * FROM advertisers WHERE id = $1', [campaign.advertiserId]);
        const advertiser = advRes.rows[0] ? normalizeAdvertiser(advRes.rows[0]) : null;

        const cntRes = campaign.contactId ? await pool.query('SELECT * FROM contacts WHERE id = $1', [campaign.contactId]) : { rows: [] };
        const contact = cntRes.rows[0] ? normalizeContact(cntRes.rows[0]) : null;

        const itemsRes = await pool.query('SELECT * FROM campaign_items WHERE campaign_id = $1', [campaign.id]);
        const items = (itemsRes.rows || []).map(normalizeCampaignItem);

        const assetsRes = await pool.query(
          'SELECT * FROM assets WHERE campaign_id = $1 OR ($2::text IS NOT NULL AND session_id = $2)',
          [campaign.id, campaign.sessionId]
        );
        const assets = (assetsRes.rows || []).map(normalizeAsset);

        const msgsRes = await pool.query(
          'SELECT * FROM conversations WHERE campaign_id = $1 ORDER BY created_at ASC',
          [campaign.id]
        );
        const messages = (msgsRes.rows || []).map(normalizeConversation);

        return { campaign, advertiser, contact, items, assets, messages };
      }
    } catch (err) {
      console.warn('Postgres getCampaignByToken failed, falling back to memory store:', err.message);
    }
  }

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
  const pool = db.getPool();

  if (pool) {
    try {
      const cmpRes = await pool.query(
        'SELECT * FROM campaigns WHERE access_token = $1 OR id = $1',
        [tokenOrCampaignId]
      );
      if (cmpRes.rows && cmpRes.rows[0]) {
        const campaign = normalizeCampaign(cmpRes.rows[0]);
        const msgId = `msg_${crypto.randomBytes(6).toString('hex')}`;
        const sType = senderType || 'client';
        const sName = senderName || (sType === 'client' ? 'Client' : '961 Campaign Team');
        const now = new Date();

        const insRes = await pool.query(
          `INSERT INTO conversations (id, campaign_id, sender_type, sender_name, message, created_at)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
          [msgId, campaign.id, sType, sName, message.trim(), now]
        );
        return normalizeConversation(insRes.rows[0]);
      }
    } catch (err) {
      console.warn('Postgres addConversationMessage failed, falling back to memory store:', err.message);
    }
  }

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
  const pool = db.getPool();

  if (pool) {
    try {
      const astId = `ast_${crypto.randomBytes(6).toString('hex')}`;
      const now = new Date();
      const insRes = await pool.query(
        `INSERT INTO assets (id, campaign_id, session_id, file_name, file_type, file_size, wasabi_path, is_temporary, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [
          astId,
          assetData.campaignId || null,
          assetData.sessionId || null,
          assetData.fileName,
          assetData.fileType || 'application/octet-stream',
          assetData.fileSize || 0,
          assetData.wasabiPath,
          assetData.isTemporary !== undefined ? Boolean(assetData.isTemporary) : true,
          now
        ]
      );
      return normalizeAsset(insRes.rows[0]);
    } catch (err) {
      console.warn('Postgres recordAsset failed, falling back to memory store:', err.message);
    }
  }

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

async function getAllLeadsAndCampaigns(filters = {}) {
  const pool = db.getPool();

  if (pool) {
    try {
      const cmpRes = await pool.query('SELECT * FROM campaigns ORDER BY created_at DESC');
      const advRes = await pool.query('SELECT * FROM advertisers');
      const cntRes = await pool.query('SELECT * FROM contacts');
      const itemRes = await pool.query('SELECT * FROM campaign_items');
      const astRes = await pool.query('SELECT * FROM assets');

      const campaigns = (cmpRes.rows || []).map(normalizeCampaign);
      const advertisers = (advRes.rows || []).map(normalizeAdvertiser);
      const contacts = (cntRes.rows || []).map(normalizeContact);
      const items = (itemRes.rows || []).map(normalizeCampaignItem);
      const assets = (astRes.rows || []).map(normalizeAsset);

      let results = campaigns.map(cmp => {
        const advertiser = advertisers.find(a => a.id === cmp.advertiserId);
        const contact = contacts.find(c => c.id === cmp.contactId);
        const cmpItems = items.filter(i => i.campaignId === cmp.id);
        const cmpAssets = assets.filter(a => a.campaignId === cmp.id || (cmp.sessionId && a.sessionId === cmp.sessionId));

        let priorityTier = 1;
        if (cmp.totalAmount >= 15000) priorityTier = 5;
        else if (cmp.totalAmount >= 7500) priorityTier = 4;
        else if (cmp.totalAmount >= 3000) priorityTier = 3;
        else if (cmp.totalAmount >= 1000) priorityTier = 2;

        return { ...cmp, advertiser, contact, items: cmpItems, assets: cmpAssets, priorityTier };
      });

      // Filter
      if (filters.status) {
        results = results.filter(r => r.status.toLowerCase() === filters.status.toLowerCase());
      }
      if (filters.country) {
        results = results.filter(r => r.countryId.toLowerCase() === filters.country.toLowerCase());
      }
      if (filters.search) {
        const q = filters.search.toLowerCase();
        results = results.filter(r =>
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.advertiser && r.advertiser.brandName && r.advertiser.brandName.toLowerCase().includes(q)) ||
          (r.advertiser && r.advertiser.companyName && r.advertiser.companyName.toLowerCase().includes(q)) ||
          (r.contact && r.contact.email && r.contact.email.toLowerCase().includes(q))
        );
      }

      return results.sort((a, b) => {
        if (b.priorityTier !== a.priorityTier) return b.priorityTier - a.priorityTier;
        if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    } catch (err) {
      console.warn('Postgres getAllLeadsAndCampaigns failed, falling back to memory store:', err.message);
    }
  }

  const store = await getStore();
  let results = store.campaigns.map(cmp => {
    const advertiser = store.advertisers.find(a => a.id === cmp.advertiserId);
    const contact = store.contacts.find(c => c.id === cmp.contactId);
    const items = store.campaignItems.filter(i => i.campaignId === cmp.id);
    const assets = store.assets.filter(a => a.campaignId === cmp.id || (cmp.sessionId && a.sessionId === cmp.sessionId));

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

  if (filters.status) {
    results = results.filter(r => r.status.toLowerCase() === filters.status.toLowerCase());
  }
  if (filters.country) {
    results = results.filter(r => r.countryId.toLowerCase() === filters.country.toLowerCase());
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(r =>
      (r.name && r.name.toLowerCase().includes(q)) ||
      (r.advertiser && r.advertiser.brandName && r.advertiser.brandName.toLowerCase().includes(q)) ||
      (r.advertiser && r.advertiser.companyName && r.advertiser.companyName.toLowerCase().includes(q)) ||
      (r.contact && r.contact.email && r.contact.email.toLowerCase().includes(q))
    );
  }

  return results.sort((a, b) => {
    if (b.priorityTier !== a.priorityTier) return b.priorityTier - a.priorityTier;
    if (b.totalAmount !== a.totalAmount) return b.totalAmount - a.totalAmount;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });
}

async function updateCampaignStatus(campaignId, status, extraFields = {}) {
  const pool = db.getPool();

  if (pool) {
    try {
      const now = new Date();
      let sql = 'UPDATE campaigns SET status = $1, updated_at = $2';
      const params = [status, now];
      let pIdx = 3;

      if (extraFields.slackChannel) {
        sql += `, slack_channel = $${pIdx++}`;
        params.push(extraFields.slackChannel);
      }
      if (extraFields.transactionId) {
        sql += `, transaction_id = $${pIdx++}`;
        params.push(extraFields.transactionId);
      }

      sql += ` WHERE id = $${pIdx} OR access_token = $${pIdx} RETURNING *`;
      params.push(campaignId);

      const updRes = await pool.query(sql, params);
      if (updRes.rows && updRes.rows[0]) {
        return normalizeCampaign(updRes.rows[0]);
      }
    } catch (err) {
      console.warn('Postgres updateCampaignStatus failed, falling back to memory store:', err.message);
    }
  }

  const store = await getStore();
  const campaign = store.campaigns.find(c => c.id === campaignId || c.accessToken === campaignId);
  if (!campaign) return null;

  campaign.status = status;
  if (extraFields.slackChannel) campaign.slackChannel = extraFields.slackChannel;
  if (extraFields.transactionId) campaign.transactionId = extraFields.transactionId;
  campaign.updatedAt = new Date().toISOString();
  await saveStore(store);
  return campaign;
}

async function processPaymentAndActivateCampaign(payload) {
  const store = await getStore();
  const campaignId = payload.campaignId || payload.campaign_id;
  const sessionId = payload.sessionId || payload.session_id;
  const transactionId = payload.transactionId || payload.transaction_id || payload.txnId || null;

  let campaign = store.campaigns.find(
    c => (campaignId && (c.id === campaignId || c.accessToken === campaignId)) ||
         (sessionId && c.sessionId === sessionId)
  );

  if (!campaign) {
    const created = await createLeadCampaign({
      ...payload,
      status: 'active',
      transactionId
    });
    campaign = created.campaign;
  } else {
    campaign.status = 'active';
    if (transactionId) campaign.transactionId = transactionId;
    campaign.updatedAt = new Date().toISOString();
  }

  // Migrate assets in memory store
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

  // Also update DB if pool available
  const pool = db.getPool();
  if (pool) {
    try {
      const now = new Date();
      await pool.query(
        `UPDATE campaigns SET status = 'active', transaction_id = COALESCE($1, transaction_id), updated_at = $2 WHERE id = $3`,
        [transactionId, now, campaign.id]
      );
      if (targetSessionId) {
        await pool.query(
          `UPDATE assets SET is_temporary = false, campaign_id = $1, wasabi_path = REPLACE(wasabi_path, 'campaigns/temporary/', 'campaigns/permanent/')
           WHERE session_id = $2 OR campaign_id = $1`,
          [campaign.id, targetSessionId]
        );
      }
    } catch (err) {
      console.warn('Postgres processPaymentAndActivateCampaign sync warning:', err.message);
    }
  }

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

  const pool = db.getPool();
  if (pool) {
    try {
      await pool.query('DELETE FROM conversations');
      await pool.query('DELETE FROM assets');
      await pool.query('DELETE FROM campaign_items');
      await pool.query('DELETE FROM campaigns');
      await pool.query('DELETE FROM contacts');
      await pool.query('DELETE FROM advertisers');
    } catch (err) {}
  }
}

module.exports = {
  getStore,
  saveStore,
  clearStore,
  getAdCatalog,
  createOrUpdateAdvertiser,
  createLeadCampaign,
  getCampaignByToken,
  addConversationMessage,
  recordAsset,
  getAllLeadsAndCampaigns,
  updateCampaignStatus,
  processPaymentAndActivateCampaign
};
