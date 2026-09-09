-- Migration: 006_create_media_library.sql
-- Description: Persistent CMS media library metadata. Files remain in Wasabi.

CREATE TABLE IF NOT EXISTS media_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type VARCHAR(30) NOT NULL,
    mime_type VARCHAR(255) DEFAULT '',
    size BIGINT NOT NULL DEFAULT 0,
    storage_key TEXT UNIQUE,
    url TEXT NOT NULL DEFAULT '',
    alt_text TEXT DEFAULT '',
    caption TEXT DEFAULT '',
    dimensions TEXT DEFAULT '',
    parent_id UUID REFERENCES media_items(id) ON DELETE SET NULL,
    folder_color VARCHAR(20) DEFAULT '#FF0000',
    linked_to JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_media_items_parent_id ON media_items(parent_id);
CREATE INDEX IF NOT EXISTS idx_media_items_type ON media_items(type);
CREATE INDEX IF NOT EXISTS idx_media_items_created_at ON media_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_items_storage_key ON media_items(storage_key);
