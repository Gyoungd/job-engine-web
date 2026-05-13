-- Migration 003: Add JD metadata fields
-- Run in Supabase dashboard → SQL Editor

-- Raw JD text storage (seen_jobs)
ALTER TABLE seen_jobs
  ADD COLUMN IF NOT EXISTS jd_text TEXT;

-- Job metadata extracted by Claude during generate-resume (applications)
ALTER TABLE applications
  ADD COLUMN IF NOT EXISTS job_type TEXT,        -- e.g. "Full-time", "Contract", "Internship"
  ADD COLUMN IF NOT EXISTS due_date TEXT;        -- DD/MM/YYYY format or null

COMMENT ON COLUMN seen_jobs.jd_text IS 'Raw JD text captured at generate-resume time for archival';
COMMENT ON COLUMN applications.job_type IS 'Extracted by Claude from JD — maps to Overview H column';
COMMENT ON COLUMN applications.due_date IS 'Application due date extracted by Claude — maps to Overview G column';
