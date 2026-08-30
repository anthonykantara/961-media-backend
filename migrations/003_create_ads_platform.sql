-- Migration 003: Create Ads Platform Tables

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
