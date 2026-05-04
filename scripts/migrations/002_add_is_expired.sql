-- Run this in Supabase SQL editor before deploying the expire feature
ALTER TABLE seen_jobs ADD COLUMN IF NOT EXISTS is_expired BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE seen_jobs ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_is_expired ON seen_jobs(is_expired) WHERE is_expired = FALSE;
