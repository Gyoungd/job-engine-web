-- Migration: Add posted_at and posted_at_source columns to seen_jobs
-- Purpose: Track JD posted date (not collection date) for accurate "New 24h" filtering
-- Compatibility: Supabase PostgreSQL

BEGIN;

-- Add posted_at column (nullable — old rows won't have this)
ALTER TABLE IF EXISTS seen_jobs
ADD COLUMN IF NOT EXISTS posted_at TIMESTAMPTZ DEFAULT NULL;

-- Add posted_at_source column (tracks source of posted_at: 'api', 'estimated_from_alert', 'unknown')
ALTER TABLE IF EXISTS seen_jobs
ADD COLUMN IF NOT EXISTS posted_at_source TEXT DEFAULT 'unknown';

-- Create index for efficient "posted_at >= X" queries (used for "New 24h" card)
CREATE INDEX IF NOT EXISTS idx_posted_at ON seen_jobs(posted_at DESC NULLS LAST);

-- Optional: backfill posted_at with first_seen for rows without posted_at
-- (only if you want old rows to count in "New 24h" — comment out if not desired)
-- UPDATE seen_jobs SET posted_at = first_seen WHERE posted_at IS NULL;

COMMIT;
