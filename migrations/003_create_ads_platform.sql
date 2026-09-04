-- Migration 003: Create Ads Platform Tables & Seed Data

CREATE TABLE IF NOT EXISTS countries (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    slug VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    base_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(100) NOT NULL DEFAULT 'per item',
    max_quantity INTEGER,
    inclusions JSONB DEFAULT '[]'::jsonb,
    cross_sell_ids JSONB DEFAULT '[]'::jsonb,
    cross_sell_reasons JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_countries (
    id VARCHAR(50) PRIMARY KEY,
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
    country_id VARCHAR(50) REFERENCES countries(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    is_available BOOLEAN NOT NULL DEFAULT true,
    custom_inclusions JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_product_country UNIQUE (product_id, country_id)
);

CREATE TABLE IF NOT EXISTS add_ons (
    id VARCHAR(50) PRIMARY KEY,
    slug VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    unit VARCHAR(100) NOT NULL DEFAULT 'one-time',
    allow_multiple BOOLEAN NOT NULL DEFAULT false,
    compatible_product_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS advertisers (
    id VARCHAR(50) PRIMARY KEY,
    company_name VARCHAR(255) NOT NULL,
    company_slug VARCHAR(255) NOT NULL,
    brand_name VARCHAR(255) NOT NULL,
    website VARCHAR(255),
    industry VARCHAR(100),
    account_type VARCHAR(100),
    country_id VARCHAR(50) REFERENCES countries(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
    id VARCHAR(50) PRIMARY KEY,
    advertiser_id VARCHAR(50) REFERENCES advertisers(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(100) NOT NULL,
    role VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
    id VARCHAR(50) PRIMARY KEY,
    advertiser_id VARCHAR(50) REFERENCES advertisers(id) ON DELETE CASCADE,
    contact_id VARCHAR(50) REFERENCES contacts(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    objective VARCHAR(255) NOT NULL,
    country_id VARCHAR(50) REFERENCES countries(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft',
    total_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    access_token VARCHAR(255) NOT NULL UNIQUE,
    slack_channel VARCHAR(255),
    session_id VARCHAR(255),
    transaction_id VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaign_items (
    id VARCHAR(50) PRIMARY KEY,
    campaign_id VARCHAR(50) REFERENCES campaigns(id) ON DELETE CASCADE,
    product_id VARCHAR(50) REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price NUMERIC(10, 2) NOT NULL,
    total_price NUMERIC(10, 2) NOT NULL,
    add_ons JSONB DEFAULT '[]'::jsonb,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
    id VARCHAR(50) PRIMARY KEY,
    campaign_id VARCHAR(50) REFERENCES campaigns(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size INTEGER,
    wasabi_path TEXT NOT NULL,
    is_temporary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(50) PRIMARY KEY,
    campaign_id VARCHAR(50) REFERENCES campaigns(id) ON DELETE CASCADE,
    sender_type VARCHAR(50) NOT NULL DEFAULT 'client',
    sender_name VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Default Countries
INSERT INTO countries (id, code, name, currency, is_active) VALUES
('lb', 'LB', 'Lebanon', 'USD', true),
('sa', 'SA', 'Saudi Arabia', 'USD', true),
('ae', 'AE', 'United Arab Emirates', 'USD', true)
ON CONFLICT (id) DO NOTHING;

-- Seed Default Products
INSERT INTO products (id, slug, name, description, category, base_price, unit, max_quantity, inclusions, cross_sell_ids, cross_sell_reasons) VALUES
('prod_featured_article', 'featured-article', 'Featured Article Package', 'Custom engaging article in 3 languages, Instagram Carousel, IG post shared to Stories, Facebook post, LinkedIn post, WhatsApp channel update', 'Editorial', 2000.00, 'per package', NULL, '["Custom engaging article in 3 languages", "Instagram Carousel", "IG post shared to Stories", "Facebook post", "LinkedIn post", "WhatsApp channel update"]'::jsonb, '["prod_in_carousel_ig", "addon_plus_2_articles"]'::jsonb, '{"prod_in_carousel_ig": "In-Carousel Instagram Placement", "addon_plus_2_articles": "Add 2 additional Featured Article Packages"}'::jsonb),
('prod_in_carousel_ig', 'in-carousel-ig', 'In-Carousel Instagram Placement', 'Dedicated slide placement in 961 Instagram carousel post (100k impressions guaranteed)', 'Social', 500.00, 'per 100k impressions guaranteed', NULL, '["100k impressions guaranteed", "Dedicated slide placement before final carousel slide", "Published on @961app Instagram page"]'::jsonb, '["prod_featured_article", "addon_express_delivery"]'::jsonb, '{"prod_featured_article": "Featured Article Package", "addon_express_delivery": "Express Delivery"}'::jsonb),
('prod_event_package', 'event-package', 'Event Coverage Package', 'On-site 961 media team coverage for event launches or openings', 'Event', 1000.00, 'per event', 1, '["3 IG stories filmed on site of an event (e.g. launch or opening)", "Clear & subtle brand tag included in the first and last story", "On-site 961 media team coverage"]'::jsonb, '["prod_featured_article", "prod_in_carousel_ig"]'::jsonb, '{"prod_featured_article": "Featured Article Package", "prod_in_carousel_ig": "In-Carousel Instagram Placement"}'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  base_price = EXCLUDED.base_price,
  unit = EXCLUDED.unit,
  max_quantity = EXCLUDED.max_quantity,
  inclusions = EXCLUDED.inclusions,
  cross_sell_ids = EXCLUDED.cross_sell_ids,
  cross_sell_reasons = EXCLUDED.cross_sell_reasons;

-- Seed Default Product Countries
INSERT INTO product_countries (id, product_id, country_id, price, currency, is_available) VALUES
('pc_fa_lb', 'prod_featured_article', 'lb', 2000.00, 'USD', true),
('pc_ic_lb', 'prod_in_carousel_ig', 'lb', 500.00, 'USD', true),
('pc_ev_lb', 'prod_event_package', 'lb', 1000.00, 'USD', true),
('pc_fa_sa', 'prod_featured_article', 'sa', 2000.00, 'USD', true),
('pc_ic_sa', 'prod_in_carousel_ig', 'sa', 500.00, 'USD', true),
('pc_ev_sa', 'prod_event_package', 'sa', 1000.00, 'USD', true),
('pc_fa_ae', 'prod_featured_article', 'ae', 2000.00, 'USD', true),
('pc_ic_ae', 'prod_in_carousel_ig', 'ae', 500.00, 'USD', true),
('pc_ev_ae', 'prod_event_package', 'ae', 1000.00, 'USD', true)
ON CONFLICT (id) DO UPDATE SET
  price = EXCLUDED.price,
  currency = EXCLUDED.currency,
  is_available = EXCLUDED.is_available;

-- Seed Default Add-Ons
INSERT INTO add_ons (id, slug, name, description, price, unit, allow_multiple, compatible_product_ids) VALUES
('addon_plus_2_articles', 'plus-2-article-packages', '+2 Article Packages', 'Add 2 additional Featured Article Packages.', 2000.00, 'package', false, '["prod_featured_article"]'::jsonb),
('addon_additional_100k_impressions', 'additional-100k-impressions', 'Additional 100k Impressions', 'Add an additional 100k guaranteed impressions to your carousel placement.', 350.00, 'per 100k impressions', true, '["prod_in_carousel_ig"]'::jsonb),
('addon_event_additional_3_stories', 'event-additional-3-stories', 'Additional 3 Event Stories', 'Add 3 extra IG stories filmed on site during event coverage.', 350.00, 'per 3 stories', true, '["prod_event_package"]'::jsonb),
('addon_event_recap_reel', 'event-recap-reel', 'Event Recap Reel', 'Dedicated Instagram & TikTok recap reel produced from event coverage.', 750.00, 'per reel', false, '["prod_event_package"]'::jsonb),
('addon_event_extra_day', 'event-extra-day', 'Extra Coverage Day', 'Additional day of on-site 961 media team event coverage.', 500.00, 'per day', true, '["prod_event_package"]'::jsonb),
('addon_event_highlight_7d', 'event-highlight-7d', '7-Day Event Highlight', 'Keep event stories pinned in Instagram story highlights for 7 days.', 250.00, 'per 7-day period', true, '["prod_event_package"]'::jsonb),
('addon_express_delivery', 'express-delivery', 'Express 24-Hour Production & Delivery', 'Fast-track content creation and publish within 24 hours of brief approval.', 250.00, 'one-time', false, '["prod_featured_article", "prod_in_carousel_ig", "prod_event_package"]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  unit = EXCLUDED.unit,
  allow_multiple = EXCLUDED.allow_multiple,
  compatible_product_ids = EXCLUDED.compatible_product_ids;
