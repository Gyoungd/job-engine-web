"""
Dedup-only MVP — reads collected raw_*_<today>.json files,
dedupes against seen_jobs.db, writes only NEW JDs to data/queue/.

This is the Phase 3 MVP. Full Phase 3 (with role/visa/seniority filters)
comes later. This script handles ONLY dedup.

Workflow:
    1. Glob data/raw_*_<today>.json  (output of Phase 2 collectors with --save-raw)
    2. Combine all jobs into a single list
    3. For each job:
         - Check seen_jobs.db by hash
         - If NEW: write to data/queue/<hash>.json, mark_seen(queued=True)
         - If SEEN: just update last_seen, skip queue write
    4. Print summary

Usage:
    python scripts/2_dedup_only.py
    python scripts/2_dedup_only.py --dry-run     # don't write anything
    python scripts/2_dedup_only.py --date 2026-04-29
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _utils import (  # noqa: E402
    JobPost, get_logger, init_db, is_seen, mark_seen,
    load_config, DATA_DIR, QUEUE_DIR, SEEN_DB_PATH,
)

logger = get_logger("dedup_only")


# ============================================================
# Role classification (DA / DS / DE) based on title
# ============================================================
def classify_role(title: str, roles_config: dict) -> str:
    """
    Match JD title against role keywords from search-profiles.yaml.
    Returns 'DA', 'DS', 'DE', or 'unknown'.
    Longer keywords are checked first for accuracy (e.g. 'data engineer'
    beats 'data analyst' when both could substring-match).
    """
    title_lower = title.lower()
    candidates: list[tuple[int, str]] = []
    for role, cfg in roles_config.items():
        for keyword in cfg.get("must_include", []):
            if keyword in title_lower:
                candidates.append((len(keyword), role))
    if candidates:
        candidates.sort(key=lambda x: x[0], reverse=True)
        return candidates[0][1]
    return "unknown"


def load_raw_files(date_str: str) -> list[dict]:
    """Read all raw_*_<date>.json files in data/ and return combined job dicts."""
    pattern = f"raw_*_{date_str}.json"
    files = sorted(DATA_DIR.glob(pattern))
    if not files:
        logger.warning(f"No raw files matching {pattern} in {DATA_DIR}")
        return []

    jobs: list[dict] = []
    for f in files:
        logger.info(f"Loading {f.name}")
        try:
            with open(f, encoding="utf-8") as fh:
                payload = json.load(fh)
            jobs.extend(payload.get("jobs", []))
        except Exception as e:
            logger.error(f"Failed to load {f}: {e}")
    return jobs


def write_to_queue(job_dict: dict, roles_config: dict, queue_dir: Path = QUEUE_DIR) -> Path:
    """Write a single new JD to the queue directory with role classification."""
    queue_dir.mkdir(parents=True, exist_ok=True)

    job_dict = dict(job_dict)  # shallow copy
    job_dict["discovered_at"] = datetime.now(timezone.utc).isoformat()
    job_dict["classified_role"] = classify_role(job_dict.get("title", ""), roles_config)

    # File name: <date>_<source>_<short_hash>.json
    short_hash = job_dict.get("hash", "unknown")[:12]
    source = job_dict.get("source", "unknown")
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    filename = f"{date}_{source}_{short_hash}.json"
    out_path = queue_dir / filename

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(job_dict, f, ensure_ascii=False, indent=2)
    return out_path


def main() -> int:
    p = argparse.ArgumentParser(description="Dedup raw collector outputs and build queue.")
    p.add_argument(
        "--date", default=None,
        help="Date to process (YYYY-MM-DD). Default: today (UTC).",
    )
    p.add_argument(
        "--dry-run", action="store_true",
        help="Don't write to seen_jobs.db or queue/ — just report.",
    )
    p.add_argument(
        "--supabase", action="store_true",
        help="Run dedup against Supabase instead of local SQLite.",
    )
    args = p.parse_args()

    date_str = args.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    logger.info(f"Processing raw files for date: {date_str}")
    logger.info(f"Dry run: {args.dry_run}")

    raw_jobs = load_raw_files(date_str)
    if not raw_jobs:
        logger.info("Nothing to process. Exiting.")
        return 0

    logger.info(f"Loaded {len(raw_jobs)} raw jobs across all collectors.")

    # Supabase mode: push directly using supabase_utils (no SQLite)
    if args.supabase:
        from supabase_utils import push_jobs_to_supabase
        roles_config = load_config("search-profiles.yaml").get("roles", {})

        job_posts = []
        for j in raw_jobs:
            try:
                jp = JobPost(
                    source=j.get("source", ""),
                    source_region=j.get("source_region", ""),
                    title=j.get("title", ""),
                    company=j.get("company", ""),
                    location=j.get("location", ""),
                    url=j.get("url", ""),
                    description=j.get("description", ""),
                    posted_at=j.get("posted_at"),
                    posted_at_source=j.get("posted_at_source", "unknown"),
                    collected_at=j.get("collected_at", ""),
                    raw=j.get("raw", {}),
                    hash=j.get("hash", ""),
                )
                job_posts.append(jp)
            except Exception as e:
                logger.warning(f"Skipping malformed job: {e}")

        def classify_fn(title):
            return classify_role(title, roles_config)

        raw_count, new_count = push_jobs_to_supabase(
            job_posts, source="dedup", classify_fn=classify_fn
        )
        logger.info(f"Supabase dedup: raw={raw_count}, new={new_count}")
        return 0

    # SQLite mode (original behavior)
    conn = init_db(SEEN_DB_PATH)
    roles_config = load_config("search-profiles.yaml").get("roles", {})

    # First-pass dedup within this batch
    by_hash: dict[str, dict] = {}
    duplicates_within_batch = 0
    for j in raw_jobs:
        h = j.get("hash")
        if not h:
            logger.debug(f"Skipping job without hash: {j.get('title', '?')}")
            continue
        if h in by_hash:
            duplicates_within_batch += 1
            existing = by_hash[h]
            existing_score = (
                len(existing.get("description") or "")
                + (10 if existing.get("posted_at_source") == "api" else 0)
            )
            new_score = (
                len(j.get("description") or "")
                + (10 if j.get("posted_at_source") == "api" else 0)
            )
            if new_score > existing_score:
                by_hash[h] = j
        else:
            by_hash[h] = j

    logger.info(
        f"Dedup within batch: {len(raw_jobs)} → {len(by_hash)} unique "
        f"({duplicates_within_batch} cross-source duplicates merged)"
    )

    # Second-pass: check against historical seen_jobs.db
    new_count = 0
    repeat_count = 0
    queue_paths: list[Path] = []

    for h, j in by_hash.items():
        try:
            jp = JobPost(
                source=j.get("source", ""),
                source_region=j.get("source_region", ""),
                title=j.get("title", ""),
                company=j.get("company", ""),
                location=j.get("location", ""),
                url=j.get("url", ""),
                description=j.get("description", ""),
                posted_at=j.get("posted_at"),
                posted_at_source=j.get("posted_at_source", "unknown"),
                collected_at=j.get("collected_at", ""),
                raw=j.get("raw", {}),
                hash=h,
            )
        except Exception as e:
            logger.warning(f"Skipping malformed job: {e}")
            continue

        already = is_seen(conn, h)
        role = classify_role(j.get("title", ""), roles_config)
        if already:
            repeat_count += 1
            if not args.dry_run:
                mark_seen(conn, jp, queued=False, classified_role=role)
        else:
            new_count += 1
            if not args.dry_run:
                path = write_to_queue(j, roles_config)
                queue_paths.append(path)
                mark_seen(conn, jp, queued=True, classified_role=role)

    conn.close()

    # ============================================================
    # Summary
    # ============================================================
    from collections import Counter
    role_counts = Counter(
        classify_role(j.get("title", ""), roles_config) for j in by_hash.values()
    )

    logger.info("=" * 60)
    logger.info("DEDUP SUMMARY")
    logger.info("=" * 60)
    logger.info(f"  Raw jobs loaded:         {len(raw_jobs)}")
    logger.info(f"  Unique within batch:     {len(by_hash)}")
    logger.info(f"  Already seen (skipped):  {repeat_count}")
    logger.info(f"  NEW → queued:            {new_count}")
    logger.info(f"  Role breakdown:          DA={role_counts.get('DA',0)} DS={role_counts.get('DS',0)} DE={role_counts.get('DE',0)} unknown={role_counts.get('unknown',0)}")
    if args.dry_run:
        logger.info("  (DRY RUN — nothing written)")
    else:
        logger.info(f"  Queue dir:               {QUEUE_DIR}")
    logger.info("=" * 60)

    if new_count > 0 and not args.dry_run:
        logger.info(f"\nSample queued files (first 3):")
        for p in queue_paths[:3]:
            logger.info(f"  - {p.name}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
