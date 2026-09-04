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
    name: 'Featured Article Package',
    description: 'Custom engaging article in 3 languages, Instagram Carousel, IG post shared to Stories, Facebook post, LinkedIn post, WhatsApp channel update',
    category: 'Editorial',
    basePrice: 2000,
    unit: 'per package',
    inclusions: [
      'Custom engaging article in 3 languages',
      'Instagram Carousel',
      'IG post shared to Stories',
      'Facebook post',
      'LinkedIn post',
      'WhatsApp channel update'
    ],
    crossSellIds: ['prod_in_carousel_ig', 'addon_plus_2_articles'],
    crossSellReasons: {
      prod_in_carousel_ig: 'Pair your featured article with a dedicated slide placement in our Instagram carousel.',
      addon_plus_2_articles: 'Scale your campaign reach with 2 additional article packages.'
    }
  },
  {
    id: 'prod_in_carousel_ig',
    slug: 'in-carousel-ig',
    name: 'In-Carousel Instagram Placement',
    description: 'Dedicated slide placement in 961 Instagram carousel post (100k impressions guaranteed)',
    category: 'Social',
    basePrice: 500,
    unit: 'per 100k impressions guaranteed',
    inclusions: [
      '100k impressions guaranteed',
      'Dedicated slide placement before final carousel slide',
      'Published on @961app Instagram page'
    ],
    crossSellIds: ['prod_featured_article', 'addon_express_delivery'],
    crossSellReasons: {
      prod_featured_article: 'Featured Article Package',
      addon_express_delivery: 'Express Delivery'
    }
  },
  {
    id: 'prod_event_package',
    slug: 'event-package',
    name: 'Event Coverage Package',
    description: 'On-site 961 media team coverage for event launches or openings',
    category: 'Event',
    basePrice: 1000,
    unit: 'per event',
    maxQuantity: 1,
    inclusions: [
      '3 IG stories filmed on site of an event (e.g. launch or opening)',
      'Clear & subtle brand tag included in the first and last story',
      'On-site 961 media team coverage'
    ],
    crossSellIds: ['prod_featured_article', 'prod_in_carousel_ig'],
    crossSellReasons: {
      prod_featured_article: 'Featured Article Package',
      prod_in_carousel_ig: 'In-Carousel Instagram Placement'
    }
  }
];

const DEFAULT_PRODUCT_COUNTRIES = [
  // Lebanon
  { id: 'pc_fa_lb', productId: 'prod_featured_article', countryId: 'lb', price: 2000, currency: 'USD', isAvailable: true },
  { id: 'pc_ic_lb', productId: 'prod_in_carousel_ig', countryId: 'lb', price: 500, currency: 'USD', isAvailable: true },
  { id: 'pc_ev_lb', productId: 'prod_event_package', countryId: 'lb', price: 1000, currency: 'USD', isAvailable: true },

  // Saudi Arabia
  { id: 'pc_fa_sa', productId: 'prod_featured_article', countryId: 'sa', price: 2000, currency: 'USD', isAvailable: true },
  { id: 'pc_ic_sa', productId: 'prod_in_carousel_ig', countryId: 'sa', price: 500, currency: 'USD', isAvailable: true },
  { id: 'pc_ev_sa', productId: 'prod_event_package', countryId: 'sa', price: 1000, currency: 'USD', isAvailable: true },

  // UAE
  { id: 'pc_fa_ae', productId: 'prod_featured_article', countryId: 'ae', price: 2000, currency: 'USD', isAvailable: true },
  { id: 'pc_ic_ae', productId: 'prod_in_carousel_ig', countryId: 'ae', price: 500, currency: 'USD', isAvailable: true },
  { id: 'pc_ev_ae', productId: 'prod_event_package', countryId: 'ae', price: 1000, currency: 'USD', isAvailable: true }
];

const DEFAULT_ADDONS = [
  {
    id: 'addon_plus_2_articles',
    slug: 'plus-2-article-packages',
    name: '+2 Article Packages',
    description: 'Add 2 additional Featured Article Packages.',
    price: 2000,
    unit: 'package',
    allowMultiple: false,
    compatibleProductIds: ['prod_featured_article']
  },
  {
    id: 'addon_additional_100k_impressions',
    slug: 'additional-100k-impressions',
    name: 'Additional 100k Impressions',
    description: 'Add an additional 100k guaranteed impressions to your carousel placement.',
    price: 350,
    unit: 'per 100k impressions',
    allowMultiple: true,
    compatibleProductIds: ['prod_in_carousel_ig']
  },
  {
    id: 'addon_event_additional_3_stories',
    slug: 'event-additional-3-stories',
    name: 'Additional 3 Event Stories',
    description: 'Add 3 extra IG stories filmed on site during event coverage.',
    price: 350,
    unit: 'per 3 stories',
    allowMultiple: true,
    compatibleProductIds: ['prod_event_package']
  },
  {
    id: 'addon_event_recap_reel',
    slug: 'event-recap-reel',
    name: 'Event Recap Reel',
    description: 'Dedicated Instagram & TikTok recap reel produced from event coverage.',
    price: 750,
    unit: 'per reel',
    allowMultiple: false,
    compatibleProductIds: ['prod_event_package']
  },
  {
    id: 'addon_event_extra_day',
    slug: 'event-extra-day',
    name: 'Extra Coverage Day',
    description: 'Additional day of on-site 961 media team event coverage.',
    price: 500,
    unit: 'per day',
    allowMultiple: true,
    compatibleProductIds: ['prod_event_package']
  },
  {
    id: 'addon_event_highlight_7d',
    slug: 'event-highlight-7d',
    name: '7-Day Event Highlight',
    description: 'Keep event stories pinned in Instagram story highlights for 7 days.',
    price: 250,
    unit: 'per 7-day period',
    allowMultiple: true,
    compatibleProductIds: ['prod_event_package']
  },
  {
    id: 'addon_express_delivery',
    slug: 'express-delivery',
    name: 'Express 24-Hour Production & Delivery',
    description: 'Fast-track content creation and publish within 24 hours of brief approval.',
    price: 250,
    unit: 'one-time',
    allowMultiple: false,
    compatibleProductIds: ['prod_featured_article', 'prod_in_carousel_ig', 'prod_event_package']
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
  const maxQty = row.max_quantity !== undefined ? row.max_quantity : (row.maxQuantity !== undefined ? row.maxQuantity : null);
  const result = {
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
  if (maxQty !== null && maxQty !== undefined) {
    result.maxQuantity = parseInt(maxQty, 10);
  }
  return result;
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
  const allowMult = row.allow_multiple !== undefined ? row.allow_multiple : (row.allowMultiple !== undefined ? row.allowMultiple : false);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description || '',
    price: parseFloat(row.price || 0),
    unit: row.unit || 'one-time',
    allowMultiple: Boolean(allowMult),
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

function extractLeadAdvertiserInfo(leadData) {
  const adv = leadData.advertiser || {};
  const brandName = (adv.brandName || adv.brand || leadData.brandName || leadData.brand || adv.companyName || leadData.companyName || 'Unnamed Advertiser').trim();
  const companyName = (adv.companyName || leadData.companyName || brandName).trim();
  const companySlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company';
  const fullName = (adv.contactName || adv.fullName || leadData.fullName || leadData.contactName || '').trim();
  const email = (adv.email || leadData.email || '').trim();
  const phoneNumber = (adv.phone || adv.phoneNumber || leadData.phoneNumber || leadData.phone || '').trim();
  const website = (adv.website || leadData.website || '').trim();
  const industry = (adv.industry || leadData.industry || '').trim();
  const accountType = (adv.accountType || leadData.accountType || '').trim();
  const countryId = (leadData.country || leadData.countryId || adv.countryId || 'lb').toLowerCase();

  return {
    brandName,
    companyName,
    companySlug,
    fullName,
    email,
    phoneNumber,
    website,
    industry,
    accountType,
    countryId
  };
}

function createOrUpdateAdvertiserInStore(store, leadData) {
  const info = extractLeadAdvertiserInfo(leadData);

  let advertiser = store.advertisers.find(
    a => a.companySlug === info.companySlug || a.companyName.toLowerCase() === info.companyName.toLowerCase()
  );

  if (!advertiser) {
    advertiser = {
      id: `adv_${crypto.randomBytes(6).toString('hex')}`,
      companyName: info.companyName,
      companySlug: info.companySlug,
      brandName: info.brandName,
      website: info.website,
      industry: info.industry,
      accountType: info.accountType,
      countryId: info.countryId,
      createdAt: new Date().toISOString()
    };
    store.advertisers.push(advertiser);
  } else {
    if (info.website) advertiser.website = info.website;
    if (info.industry) advertiser.industry = info.industry;
    if (info.accountType) advertiser.accountType = info.accountType;
  }

  let contact = store.contacts.find(
    c => info.email && c.email.toLowerCase() === info.email.toLowerCase()
  );

  if (!contact && info.email) {
    contact = {
      id: `cnt_${crypto.randomBytes(6).toString('hex')}`,
      advertiserId: advertiser.id,
      fullName: info.fullName || 'Lead Contact',
      email: info.email,
      phoneNumber: info.phoneNumber,
      role: leadData.role || 'Marketing Contact',
      createdAt: new Date().toISOString()
    };
    store.contacts.push(contact);
  }

  return { advertiser, contact };
}

async function createOrUpdateAdvertiser(leadData) {
  const info = extractLeadAdvertiserInfo(leadData);
  const pool = db.getPool();

  if (pool) {
    try {
      let advRes = await pool.query(
        'SELECT * FROM advertisers WHERE company_slug = $1 OR LOWER(company_name) = LOWER($2)',
        [info.companySlug, info.companyName]
      );
      let advertiser;

      if (advRes.rows && advRes.rows[0]) {
        advertiser = normalizeAdvertiser(advRes.rows[0]);
      } else {
        const advId = `adv_${crypto.randomBytes(6).toString('hex')}`;
        const now = new Date();
        const insRes = await pool.query(
          `INSERT INTO advertisers (id, company_name, company_slug, brand_name, website, industry, account_type, country_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [advId, info.companyName, info.companySlug, info.brandName, info.website, info.industry, info.accountType, info.countryId, now]
        );
        advertiser = normalizeAdvertiser(insRes.rows[0]);
      }

      let contact = null;
      if (info.email) {
        let cntRes = await pool.query('SELECT * FROM contacts WHERE LOWER(email) = LOWER($1)', [info.email]);
        if (cntRes.rows && cntRes.rows[0]) {
          contact = normalizeContact(cntRes.rows[0]);
        } else {
          const cntId = `cnt_${crypto.randomBytes(6).toString('hex')}`;
          const now = new Date();
          const insCnt = await pool.query(
            `INSERT INTO contacts (id, advertiser_id, full_name, email, phone_number, role, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [cntId, advertiser.id, info.fullName || 'Lead Contact', info.email, info.phoneNumber, leadData.role || 'Marketing Contact', now]
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

function calculateHaversineDistanceKm(lat1, lon1, lat2 = 33.8969, lon2 = 35.5017) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function createLeadCampaign(campaignData) {
  const info = extractLeadAdvertiserInfo(campaignData);

  if (!info.email || !info.fullName) {
    const err = new Error('Full name and email are required.');
    err.statusCode = 400;
    throw err;
  }

  // Fetch catalog for country
  const catalog = await getAdCatalog(info.countryId);
  const catalogProducts = catalog.products || [];
  const catalogAddOns = catalog.addOns || [];

  // Extract products from cart / items
  const rawCart = Array.isArray(campaignData.cart) ? campaignData.cart : (Array.isArray(campaignData.items) ? campaignData.items : []);
  const cartItems = rawCart.map(item => ({
    productId: item.productId || item.id,
    quantity: parseInt(item.quantity || 1, 10),
    unitPrice: item.unitPrice !== undefined ? parseFloat(item.unitPrice) : (item.price !== undefined ? parseFloat(item.price) : null),
    details: item.details || {}
  }));

  // Extract add-ons
  const rawAddOns = Array.isArray(campaignData.addOns) ? campaignData.addOns : [];
  const addOnsItems = rawAddOns.map(a => ({
    addOnId: a.addOnId || a.id,
    parentProductId: a.parentProductId,
    quantity: parseInt(a.quantity || 1, 10),
    unitPrice: a.unitPrice !== undefined ? parseFloat(a.unitPrice) : (a.price !== undefined ? parseFloat(a.price) : null)
  }));

  // 1. Sum base product prices & validate maxQuantity
  let productSum = 0;
  const validatedCart = [];
  const cartProductIds = cartItems.map(i => i.productId);

  for (const item of cartItems) {
    const catProd = catalogProducts.find(p => p.id === item.productId);

    if (catProd && catProd.maxQuantity && item.quantity > catProd.maxQuantity) {
      const err = new Error(`Quantity ${item.quantity} exceeds maximum allowed quantity (${catProd.maxQuantity}) for product ${catProd.name || item.productId}.`);
      err.statusCode = 400;
      throw err;
    }

    const price = catProd ? catProd.price : (item.unitPrice !== null ? item.unitPrice : 0);
    const itemTotal = price * item.quantity;
    productSum += itemTotal;

    validatedCart.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: price,
      totalPrice: itemTotal,
      details: item.details
    });
  }

  // 2. Validate product-bound add-ons & sum add-on prices
  let addOnSum = 0;
  const validatedAddOns = [];

  for (const addOn of addOnsItems) {
    const catAddOn = catalogAddOns.find(a => a.id === addOn.addOnId);

    // Validate parent product presence
    if (catAddOn && Array.isArray(catAddOn.compatibleProductIds) && catAddOn.compatibleProductIds.length > 0) {
      const isCompatible = cartProductIds.some(pId => catAddOn.compatibleProductIds.includes(pId));
      if (!isCompatible) {
        const err = new Error(`Add-on ${catAddOn.name || addOn.addOnId} requires a compatible parent product in cart.`);
        err.statusCode = 400;
        throw err;
      }
    }

    // Validate allowMultiple
    if (catAddOn && !catAddOn.allowMultiple && addOn.quantity > 1) {
      const err = new Error(`Add-on ${catAddOn.name || addOn.addOnId} does not allow multiple quantities.`);
      err.statusCode = 400;
      throw err;
    }

    const price = catAddOn ? catAddOn.price : (addOn.unitPrice !== null ? addOn.unitPrice : 0);
    const addOnTotal = price * addOn.quantity;
    addOnSum += addOnTotal;

    const parentProductId = addOn.parentProductId || (catAddOn && catAddOn.compatibleProductIds ? catAddOn.compatibleProductIds.find(pId => cartProductIds.includes(pId)) : null);

    validatedAddOns.push({
      addOnId: addOn.addOnId,
      name: catAddOn ? catAddOn.name : addOn.addOnId,
      parentProductId,
      quantity: addOn.quantity,
      unitPrice: price,
      totalPrice: addOnTotal
    });
  }

  // 3. Distance Surcharge Calculation
  let distanceSurcharge = 0;
  let distanceSurchargeDetails = { amount: 0, applied: false, distanceKm: null, reason: 'No venue location provided' };
  const campaignDetails = campaignData.campaignDetails || {};
  const eventDetails = campaignDetails.eventDetails || campaignData.eventDetails || null;

  if (eventDetails) {
    let distanceKm = null;
    if (eventDetails.lat != null && eventDetails.lng != null && !isNaN(parseFloat(eventDetails.lat)) && !isNaN(parseFloat(eventDetails.lng))) {
      distanceKm = calculateHaversineDistanceKm(parseFloat(eventDetails.lat), parseFloat(eventDetails.lng));
      eventDetails.distanceKm = Math.round(distanceKm * 10) / 10;
    } else if (eventDetails.distanceKm !== undefined && eventDetails.distanceKm !== null && !isNaN(parseFloat(eventDetails.distanceKm))) {
      distanceKm = parseFloat(eventDetails.distanceKm);
    }

    if (distanceKm !== null && distanceKm > 25) {
      distanceSurcharge = 150;
      distanceSurchargeDetails = {
        amount: 150,
        applied: true,
        distanceKm: Math.round(distanceKm * 10) / 10,
        reason: 'Venue location exceeds 25 km from Beirut Downtown'
      };
    } else if (distanceKm !== null) {
      distanceSurchargeDetails = {
        amount: 0,
        applied: false,
        distanceKm: Math.round(distanceKm * 10) / 10,
        reason: 'Venue location within 25 km from Beirut Downtown'
      };
    }
  }

  let totalAmount = productSum + addOnSum + distanceSurcharge;
  if (totalAmount === 0 && campaignData.totalAmount) {
    totalAmount = parseFloat(campaignData.totalAmount);
  }

  const completeCampaignDetails = {
    ...campaignDetails,
    eventDetails,
    distanceSurcharge: distanceSurchargeDetails,
    addOns: validatedAddOns,
    assets: campaignData.assets || (campaignDetails && campaignDetails.assets) || []
  };

  const notesContent = JSON.stringify(completeCampaignDetails);

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
          campaignData.objective || (campaignDetails.objectiveNotes || 'Brand Awareness'),
          info.countryId,
          campaignData.status || 'lead_captured',
          totalAmount,
          campaignData.currency || 'USD',
          accessToken,
          slackChannel,
          sessionId,
          notesContent,
          now
        ]
      );

      const campaign = normalizeCampaign(insCmp.rows[0]);

      // Items
      for (const item of validatedCart) {
        const itemId = `citem_${crypto.randomBytes(6).toString('hex')}`;
        await pool.query(
          `INSERT INTO campaign_items (id, campaign_id, product_id, quantity, unit_price, total_price, add_ons, details, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [itemId, campaign.id, item.productId, item.quantity, item.unitPrice, item.totalPrice, JSON.stringify(validatedAddOns), JSON.stringify(item.details || {}), now]
        );
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
      if (err.statusCode) throw err;
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
    objective: campaignData.objective || (campaignDetails.objectiveNotes || 'Brand Awareness'),
    countryId: info.countryId,
    status: campaignData.status || 'lead_captured',
    totalAmount,
    currency: campaignData.currency || 'USD',
    accessToken,
    slackChannel,
    sessionId,
    transactionId: campaignData.transactionId || null,
    notes: notesContent,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  store.campaigns.push(newCampaign);

  validatedCart.forEach(item => {
    store.campaignItems.push({
      id: `citem_${crypto.randomBytes(6).toString('hex')}`,
      campaignId: newCampaign.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      addOns: validatedAddOns,
      details: item.details || {},
      createdAt: new Date().toISOString()
    });
  });

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

async function formatWorkspaceSummary(campaign, advertiser, contact, items, assets, messages) {
  let campaignDetails = {};
  if (campaign && campaign.notes) {
    if (typeof campaign.notes === 'object') {
      campaignDetails = campaign.notes;
    } else {
      try {
        campaignDetails = JSON.parse(campaign.notes);
      } catch (e) {
        campaignDetails = {};
      }
    }
  }

  const countryId = campaign ? (campaign.countryId || 'lb') : 'lb';
  const catalog = await getAdCatalog(countryId);
  const catalogProducts = catalog.products || [];
  const catalogAddOns = catalog.addOns || [];

  const products = (items || []).map(item => {
    const catP = catalogProducts.find(p => p.id === item.productId);
    return {
      productId: item.productId,
      name: catP ? catP.name : item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      inclusions: catP ? catP.inclusions : [],
      details: item.details || {}
    };
  });

  const eventDetails = campaignDetails ? campaignDetails.eventDetails : null;
  const eventSchedule = eventDetails && Array.isArray(eventDetails.schedule) ? eventDetails.schedule : [];

  const distanceSurcharge = (campaignDetails && campaignDetails.distanceSurcharge) || { amount: 0, applied: false, distanceKm: null };

  const rawAddOns = (campaignDetails && Array.isArray(campaignDetails.addOns)) ? campaignDetails.addOns : [];

  const matchedAddOnKeys = new Set();
  const parentGroupedAddOns = (items || []).map(item => {
    const catP = catalogProducts.find(p => p.id === item.productId);
    const matched = rawAddOns.filter(a => {
      const aKey = a.addOnId || a.id;
      if (a.parentProductId) {
        if (a.parentProductId === item.productId) {
          matchedAddOnKeys.add(aKey);
          return true;
        }
        return false;
      }
      const catA = catalogAddOns.find(x => x.id === aKey);
      if (catA && catA.compatibleProductIds && catA.compatibleProductIds.includes(item.productId)) {
        matchedAddOnKeys.add(aKey);
        return true;
      }
      return false;
    });
    return {
      parentProductId: item.productId,
      parentProductName: catP ? catP.name : item.productId,
      addOns: matched
    };
  }).filter(group => group.addOns.length > 0);

  const unmatchedAddOns = rawAddOns.filter(a => !matchedAddOnKeys.has(a.addOnId || a.id));
  if (unmatchedAddOns.length > 0 && parentGroupedAddOns.length > 0) {
    parentGroupedAddOns.push({
      parentProductId: null,
      parentProductName: 'General Add-ons',
      addOns: unmatchedAddOns
    });
  }

  const formattedAddOns = parentGroupedAddOns.length > 0 ? parentGroupedAddOns : rawAddOns;

  return {
    campaign,
    workspaceUrl: campaign ? `/workspace/${campaign.accessToken}` : null,
    advertiser,
    contact,
    items,
    products,
    addOns: formattedAddOns,
    eventSchedule,
    distanceSurcharge,
    assets: assets || [],
    messages: messages || []
  };
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

        return await formatWorkspaceSummary(campaign, advertiser, contact, items, assets, messages);
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

  return await formatWorkspaceSummary(campaign, advertiser, contact, items, campaignAssets, messages);
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
