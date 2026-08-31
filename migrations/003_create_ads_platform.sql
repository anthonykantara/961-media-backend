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
INSERT INTO products (id, slug, name, description, category, base_price, unit, inclusions, cross_sell_ids, cross_sell_reasons) VALUES
('prod_featured_article', 'featured-article', 'Featured Article Package', 'Custom engaging article in 3 languages, Instagram Carousel, IG post shared to Stories, Facebook post, LinkedIn post, WhatsApp channel update', 'Editorial', 2000.00, 'per package', '["Custom engaging article in 3 languages", "Instagram Carousel", "IG post shared to Stories", "Facebook post", "LinkedIn post", "WhatsApp channel update"]'::jsonb, '["prod_social_video", "addon_plus_2_articles"]'::jsonb, '{"prod_social_video": "Amplify editorial reach by 3x with a dedicated TikTok & Instagram Reel video.", "addon_plus_2_articles": "Scale your campaign reach with 2 additional article packages."}'::jsonb),
('prod_social_video', 'social-video', 'Dedicated Social Video Reel / TikTok', 'High-impact short-form video produced or formatted for 961 Instagram Reel & TikTok channels.', 'Social', 950.00, 'per video', '["1080x1920 HD vertical video reel", "Published on 961 Instagram & TikTok", "Interactive story highlight placement", "Targeted audience engagement report"]'::jsonb, '["prod_featured_article", "addon_express_delivery"]'::jsonb, '{"prod_featured_article": "Pair your video with a long-form article for permanent Google SEO ranking.", "addon_express_delivery": "Publish within 24 hours of brief approval with express queue processing."}'::jsonb),
('prod_display_banner', 'display-banner', 'Responsive Display Banner Network', 'High-visibility Leaderboard (728x90) and MPU (300x250) banner impressions across key article pages.', 'Display', 300.00, 'per 10,000 impressions', '["Leaderboard & MPU banner ad slots", "Geo-targeted audience delivery", "Real-time CTR and impression analytics", "Desktop & Mobile optimization"]'::jsonb, '["prod_featured_article", "prod_newsletter_feature"]'::jsonb, '{"prod_featured_article": "Drive targeted traffic directly from display banners to your featured article.", "prod_newsletter_feature": "Extend banner exposure to high-intent email subscribers."}'::jsonb),
('prod_newsletter_feature', 'newsletter-feature', 'Daily Morning Brief Newsletter Sponsor', 'Top header takeover or dedicated sponsored story segment in 961 daily morning newsletter.', 'Newsletter', 450.00, 'per edition', '["Top header logo takeover & headline blurb", "Direct URL tracking link", "Delivered to 45,000+ active subscribers", "50%+ average open rate"]'::jsonb, '["prod_featured_article", "addon_translation"]'::jsonb, '{"prod_featured_article": "Link newsletter readers to a comprehensive editorial feature story.", "addon_translation": "Reach Arabic & French readers with localized newsletter editions."}'::jsonb),
('prod_dedicated_social_post', 'dedicated-social-post', 'Dedicated Social Feed Post', 'Single image or carousel post on 961 social media channels with brand tag & link.', 'Social', 500.00, 'per post', '["Single/Carousel post on Instagram & Facebook", "Tag brand account & link in bio", "Custom creative styling"]'::jsonb, '["prod_social_video", "addon_express_delivery"]'::jsonb, '{"prod_social_video": "Upgrade to a dynamic vertical video for 4x higher viral potential.", "addon_express_delivery": "Fast-track your post for 24-hour publish timeline."}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Seed Default Product Countries
INSERT INTO product_countries (id, product_id, country_id, price, currency, is_available) VALUES
('pc_fa_lb', 'prod_featured_article', 'lb', 2000.00, 'USD', true),
('pc_sv_lb', 'prod_social_video', 'lb', 950.00, 'USD', true),
('pc_db_lb', 'prod_display_banner', 'lb', 300.00, 'USD', true),
('pc_nf_lb', 'prod_newsletter_feature', 'lb', 450.00, 'USD', true),
('pc_sp_lb', 'prod_dedicated_social_post', 'lb', 500.00, 'USD', true),
('pc_fa_sa', 'prod_featured_article', 'sa', 2000.00, 'USD', true),
('pc_sv_sa', 'prod_social_video', 'sa', 1500.00, 'USD', true),
('pc_db_sa', 'prod_display_banner', 'sa', 500.00, 'USD', true),
('pc_nf_sa', 'prod_newsletter_feature', 'sa', 750.00, 'USD', true),
('pc_sp_sa', 'prod_dedicated_social_post', 'sa', 800.00, 'USD', true),
('pc_fa_ae', 'prod_featured_article', 'ae', 2000.00, 'USD', true),
('pc_sv_ae', 'prod_social_video', 'ae', 1500.00, 'USD', true),
('pc_db_ae', 'prod_display_banner', 'ae', 500.00, 'USD', true),
('pc_nf_ae', 'prod_newsletter_feature', 'ae', 750.00, 'USD', true),
('pc_sp_ae', 'prod_dedicated_social_post', 'ae', 800.00, 'USD', true)
ON CONFLICT (id) DO NOTHING;

-- Seed Default Add-Ons
INSERT INTO add_ons (id, slug, name, description, price, unit, compatible_product_ids) VALUES
('addon_plus_2_articles', 'plus-2-article-packages', '+2 Article Packages', 'Add 2 additional Featured Article Packages.', 2000.00, 'package', '["prod_featured_article"]'::jsonb),
('addon_express_delivery', 'express-delivery', 'Express 24-Hour Production & Delivery', 'Fast-track content creation and publish within 24 hours of brief approval.', 250.00, 'one-time', '["prod_featured_article", "prod_social_video", "prod_dedicated_social_post"]'::jsonb),
('addon_translation', 'multilingual-translation', 'Multilingual Translation (Arabic / French)', 'Professional translation and localized content adaptation into Arabic and French.', 150.00, 'per language', '["prod_featured_article", "prod_newsletter_feature"]'::jsonb),
('addon_creative_design', 'creative-design', 'Custom Graphics & Creative Design', '961 in-house design team creates custom graphic banners and story visual assets.', 200.00, 'one-time', '["prod_display_banner", "prod_social_video", "prod_dedicated_social_post"]'::jsonb),
('addon_analytics_report', 'analytics-audit', 'Detailed Performance Audit Report', 'Comprehensive post-campaign report detailing impressions, clicks, demographics, and engagement.', 100.00, 'one-time', '["prod_featured_article", "prod_social_video", "prod_display_banner", "prod_newsletter_feature", "prod_dedicated_social_post"]'::jsonb)
ON CONFLICT (id) DO NOTHING;
