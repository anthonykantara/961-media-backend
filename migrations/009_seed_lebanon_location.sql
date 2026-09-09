-- Migration: 009_seed_lebanon_location.sql
-- Description: Seed the production default location for the Lebanon edition.
-- No demo, Gulf, European, or other foreign locations are inserted.

INSERT INTO locations (
    id,
    name,
    country,
    country_code,
    region_id,
    region_name,
    timezone,
    enabled
)
VALUES (
    'lb',
    'Lebanon',
    'Lebanon',
    'LB',
    'middle-east',
    'Middle East',
    'Asia/Beirut',
    true
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    country = EXCLUDED.country,
    country_code = EXCLUDED.country_code,
    region_id = EXCLUDED.region_id,
    region_name = EXCLUDED.region_name,
    timezone = EXCLUDED.timezone,
    enabled = EXCLUDED.enabled,
    updated_at = CURRENT_TIMESTAMP;
