-- 004_enable_rls.sql
-- Purpose: Close the public REST API exposure flagged by Supabase Security Advisor.
--
-- Context: All app + collector access uses the service_role key
--   (lib/supabase/server.ts, scripts/collection/supabase_utils.py), which
--   BYPASSES RLS. The anon key ships in the browser bundle (login page) and had
--   full read/write grants on these tables via PostgREST — anyone could read or
--   delete the data. The browser/anon client is only used for auth.signInWithOAuth,
--   never to query these tables, so locking anon/authenticated out is safe.

-- 1. Enable RLS. No policies => deny-all for anon/authenticated.
--    service_role bypasses RLS, so API routes and the GitHub Actions collector keep working.
alter table public.seen_jobs       enable row level security;
alter table public.collection_runs enable row level security;
alter table public.applications    enable row level security;

-- 2. Make stats views respect the caller's permissions (clears "Security Definer View").
alter view public.queue_stats    set (security_invoker = on);
alter view public.pipeline_stats set (security_invoker = on);

-- 3. Defense in depth: revoke direct grants so PostgREST returns "permission denied"
--    for the public API regardless of RLS state.
revoke all on public.seen_jobs, public.collection_runs, public.applications,
              public.queue_stats, public.pipeline_stats
  from anon, authenticated;
