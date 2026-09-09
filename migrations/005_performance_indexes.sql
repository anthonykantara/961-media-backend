-- Performance indexes for public article feeds and common CMS filters.
-- These are additive and safe to run repeatedly.

CREATE INDEX IF NOT EXISTS idx_articles_status_created_at
    ON articles (LOWER(status), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_language_created_at
    ON articles (LOWER(language), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_category_created_at
    ON articles (LOWER(category), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_location_created_at
    ON articles (LOWER(location_id), created_at DESC);

CREATE INDEX IF NOT EXISTS idx_articles_permalink_lower
    ON articles (LOWER(permalink));

CREATE INDEX IF NOT EXISTS idx_articles_slug_lower
    ON articles (LOWER(slug));

CREATE INDEX IF NOT EXISTS idx_locations_region_lower
    ON locations (LOWER(region_id));

CREATE INDEX IF NOT EXISTS idx_article_redirects_old_lower
    ON article_redirects (LOWER(old_permalink));
