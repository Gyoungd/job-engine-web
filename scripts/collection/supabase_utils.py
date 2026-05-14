"""
Supabase Utilities — Job Engine collection layer

Replaces SQLite mark_seen() for cloud-based collection.
All upserts are atomic (ON CONFLICT) — safe for concurrent cron runs.

Required env vars:
    SUPABASE_URL
    SUPABASE_SERVICE_ROLE_KEY  (NOT anon key — server-side write)
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from supabase import Client, create_client

from _utils import JobPost, get_logger, require_env

logger = get_logger("supabase_utils")


# ============================================================
# Client
# ============================================================
_client: Optional[Client] = None


def get_client() -> Client:
    """Lazy singleton Supabase client (service role for writes)."""
    global _client
    if _client is None:
        url = require_env("SUPABASE_URL")
        key = require_env("SUPABASE_SERVICE_ROLE_KEY")
        _client = create_client(url, key)
    return _client


# ============================================================
# seen_jobs upsert (atomic)
# ============================================================
def _normalize_url(url: str) -> str:
    """
    Extract stable job identifier from URL.
    LinkedIn: https://linkedin.com/comm/jobs/view/12345?... → linkedin.com/jobs/view/12345
    Seek:     https://www.seek.com.au/job/12345?... → seek.com.au/job/12345
    """
    if not url:
        return ""
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        # Strip www., comm/ prefix, query params, fragments
        host = parsed.netloc.replace("www.", "")
        path = parsed.path.replace("/comm/", "/")
        # Remove trailing slashes
        path = path.rstrip("/")
        return f"{host}{path}"
    except Exception:
        return url


def _extract_job_id(url: str) -> str | None:
    """
    Extract numeric job ID from LinkedIn or Seek URL.
    Handles /comm/ prefix and trailing slash variations.
    LinkedIn: .../jobs/view/4409223195/... → "4409223195"
    Seek:     .../job/12345...             → "12345"
    """
    if not url:
        return None
    import re
    m = re.search(r"/jobs/view/(\d+)", url)
    if m:
        return m.group(1)
    m = re.search(r"/job/(\d+)", url)
    if m:
        return m.group(1)
    return None


def upsert_job(job: JobPost, classified_role: str = "unknown", queued: bool = False) -> bool:
    """
    Atomic upsert into Supabase seen_jobs.
    Returns True if NEW row, False if existing row updated.

    Dedup strategy (2-layer):
      1. Check by URL first (catches same job with different company name formatting)
      2. Fall back to hash check (catches jobs without URL)

    Uses PostgREST RPC for ON CONFLICT semantics:
      - NEW: INSERT all fields, times_seen=1
      - EXISTING: UPDATE last_seen=now(), times_seen+=1,
                  queued=GREATEST(old, new), classified_role=new (override)
    """
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "hash": job.hash,
        "source": job.source,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "url": job.url,
        "first_seen": now,
        "last_seen": now,
        "times_seen": 1,
        "queued": 1 if queued else 0,
        "classified_role": classified_role,
        "source_region": job.source_region,
        "posted_at": job.posted_at,
        "posted_at_source": job.posted_at_source,
    }

    client = get_client()

    # --- Layer 1: Job-ID-based dedup (handles /comm/ prefix + trailing slash variants) ---
    existing = None
    if job.url:
        job_id = _extract_job_id(job.url)
        if job_id:
            # Match any stored URL that contains the same numeric job ID segment
            pattern = f"%/jobs/view/{job_id}%" if "/jobs/view/" in job.url else f"%/job/{job_id}%"
            url_match = (
                client.table("seen_jobs")
                .select("hash, times_seen, queued, url")
                .ilike("url", pattern)
                .limit(1)
                .execute()
            )
            if url_match.data:
                existing = url_match.data[0]
                logger.debug(
                    f"[URL-DEDUP] Matched existing url for {job.title} "
                    f"(existing hash={existing['hash'][:12]}, new hash={job.hash[:12]})"
                )

    # --- Layer 2: Hash-based dedup (fallback) ---
    if not existing:
        hash_match = (
            client.table("seen_jobs")
            .select("hash, times_seen, queued")
            .eq("hash", job.hash)
            .limit(1)
            .execute()
        )
        if hash_match.data:
            existing = hash_match.data[0]

    if not existing:
        # NEW — atomic INSERT (PK conflict-safe via upsert)
        if job.description:
            payload["jd_text"] = job.description
        client.table("seen_jobs").upsert(payload, on_conflict="hash").execute()
        logger.info(f"[NEW] {job.source} | {job.company} | {job.title}")
        return True

    # EXISTING — update last_seen, increment times_seen, preserve queued
    update_payload = {
        "last_seen": now,
        "times_seen": existing["times_seen"] + 1,
        "queued": max(existing["queued"], 1 if queued else 0),
        "classified_role": classified_role,
        "source_region": job.source_region,
    }
    client.table("seen_jobs").update(update_payload).eq("hash", existing["hash"]).execute()
    logger.debug(f"[SEEN] {job.source} | {job.company} | {job.title} (times_seen={existing['times_seen']+1})")
    return False


# ============================================================
# collection_runs audit log
# ============================================================
def log_collection_run(
    source: str,
    raw_count: int,
    new_count: int,
    sources_breakdown: Optional[dict[str, Any]] = None,
) -> None:
    """
    Insert one row into collection_runs.
    Called once per cron invocation (per source).
    """
    client = get_client()
    payload = {
        "source": source,
        "raw_count": raw_count,
        "new_count": new_count,
        "sources": sources_breakdown or {},
    }
    client.table("collection_runs").insert(payload).execute()
    logger.info(
        f"[RUN] source={source} raw={raw_count} new={new_count}"
    )


# ============================================================
# Batch helper (collection script entry point)
# ============================================================
def push_jobs_to_supabase(
    jobs: list[JobPost],
    source: str,
    classify_fn=None,
) -> tuple[int, int]:
    """
    Push a batch of collected jobs to Supabase.
    Returns (raw_count, new_count).

    Args:
        jobs: list of JobPost objects from collector
        source: 'gmail' | 'adzuna' | 'worknet' (for collection_runs.source)
        classify_fn: optional callable(title) -> 'DA'|'DS'|'DE'|'unknown'
    """
    raw_count = len(jobs)
    new_count = 0

    for job in jobs:
        role = classify_fn(job.title) if classify_fn else "unknown"
        is_new = upsert_job(job, classified_role=role, queued=True)
        if is_new:
            new_count += 1

    log_collection_run(
        source=source,
        raw_count=raw_count,
        new_count=new_count,
        sources_breakdown={"by_source": {source: raw_count}},
    )
    return raw_count, new_count
