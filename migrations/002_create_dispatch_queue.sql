-- Migration: 002_create_dispatch_queue.sql
-- Description: Create dispatch_queue table for background dispatch and exponential retry pipeline

CREATE TABLE IF NOT EXISTS dispatch_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id TEXT NOT NULL,
    task_type VARCHAR(50) NOT NULL DEFAULT 'dispatch_all',
    options JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'retry_scheduled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_error TEXT,
    next_run_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    results JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_dispatch_queue_status_next_run ON dispatch_queue(status, next_run_at);
CREATE INDEX IF NOT EXISTS idx_dispatch_queue_article_id ON dispatch_queue(article_id);
