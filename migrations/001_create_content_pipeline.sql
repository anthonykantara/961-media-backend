-- Migration: 001_create_content_pipeline.sql
-- Description: Create content_pipeline table for Express Creation workflow

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS content_pipeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    chosen_headline TEXT,
    article_body TEXT,
    social_summary TEXT,
    ig_caption TEXT,
    carousel_slides JSONB DEFAULT '[]'::jsonb,
    main_image_path TEXT,
    slide_image_paths JSONB DEFAULT '[]'::jsonb,
    rendered_assets JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'headlines_generated', 'content_ready', 'published')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_pipeline_status ON content_pipeline(status);
CREATE INDEX IF NOT EXISTS idx_content_pipeline_created_at ON content_pipeline(created_at DESC);
