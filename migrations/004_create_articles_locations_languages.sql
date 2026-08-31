-- Migration: 004_create_articles_locations_languages.sql
-- Description: Create tables for languages, locations, articles, and article permalink redirects

CREATE TABLE IF NOT EXISTS languages (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    native_name VARCHAR(255),
    dir VARCHAR(10) NOT NULL DEFAULT 'ltr',
    is_default BOOLEAN NOT NULL DEFAULT false,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(255),
    country_code VARCHAR(10),
    region_id VARCHAR(100),
    region_name VARCHAR(255),
    timezone VARCHAR(100),
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS articles (
    id VARCHAR(255) PRIMARY KEY,
    title TEXT NOT NULL,
    permalink TEXT NOT NULL,
    slug TEXT NOT NULL,
    redirects JSONB DEFAULT '[]'::jsonb,
    previous_permalinks JSONB DEFAULT '[]'::jsonb,
    content TEXT DEFAULT '',
    summary TEXT DEFAULT '',
    author VARCHAR(255) DEFAULT '',
    category VARCHAR(255) DEFAULT '',
    image TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    status VARCHAR(50) DEFAULT 'draft',
    location_id VARCHAR(100) DEFAULT 'lb',
    language VARCHAR(10) DEFAULT 'en',
    date VARCHAR(100) DEFAULT '',
    time VARCHAR(100) DEFAULT '',
    views VARCHAR(50) DEFAULT '0',
    shares VARCHAR(50) DEFAULT '0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_redirects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id VARCHAR(255) NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    old_permalink TEXT NOT NULL UNIQUE,
    target_permalink TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_articles_permalink ON articles(permalink);
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_location_id ON articles(location_id);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_redirects_old ON article_redirects(old_permalink);
CREATE INDEX IF NOT EXISTS idx_article_redirects_article_id ON article_redirects(article_id);
