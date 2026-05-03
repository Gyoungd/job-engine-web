"""
Collector 2 — Adzuna REST API (Australia + Singapore)

Adzuna API docs: https://developer.adzuna.com/overview
Free tier: register App ID + App Key.

Endpoints used:
    GET https://api.adzuna.com/v1/api/jobs/{country}/search/{page}

Usage:
    python scripts/1_collect_adzuna.py
    python scripts/1_collect_adzuna.py --country au
    python scripts/1_collect_adzuna.py --save-raw
"""
from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path
from typing import Any

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _utils import (  # noqa: E402
    JobPost, get_logger, load_config, load_env, require_env, save_raw_jobs
)

logger = get_logger("collect_adzuna")

ADZUNA_BASE = "https://api.adzuna.com/v1/api/jobs/{country}/search/1"


# ============================================================
# Country code → region key mapping
# ============================================================
COUNTRY_TO_REGION = {
    "au": "melbourne",   # we only query Melbourne for AU
    "sg": "singapore",
}


# ============================================================
# Single API call
# ============================================================
def search_adzuna(
    country: str,
    app_id: str,
    app_key: str,
    what: str,
    where: str,
    results_per_page: int = 50,
    max_days_old: int = 1,
) -> list[dict[str, Any]]:
    """
    One Adzuna search call.
    Returns list of raw 'results' dicts.
    """
    url = ADZUNA_BASE.format(country=country)
    params = {
        "app_id": app_id,
        "app_key": app_key,
        "what": what,
        "where": where,
        "results_per_page": results_per_page,
        "max_days_old": max_days_old,
        "sort_by": "date",
        "content-type": "application/json",
    }
    logger.info(f"Adzuna call: country={country} what={what!r} where={where!r}")

    try:
        resp = requests.get(url, params=params, timeout=30)
    except requests.RequestException as e:
        logger.error(f"Adzuna request failed: {e}")
        return []

    if resp.status_code != 200:
        logger.error(f"Adzuna HTTP {resp.status_code}: {resp.text[:300]}")
        return []

    data = resp.json()
    results = data.get("results", []) or []
    logger.info(f"  → {len(results)} results (total available: {data.get('count', '?')})")
    return results


# ============================================================
# Parse Adzuna result → JobPost
# ============================================================
def parse_adzuna_result(raw: dict[str, Any], country: str, role_hint: str) -> JobPost:
    """
    Adzuna result schema (relevant fields):
        title, description, redirect_url, company.display_name,
        location.display_name, salary_min, salary_max, salary_is_predicted,
        contract_type, contract_time, created
    """
    company = (raw.get("company") or {}).get("display_name", "")
    location = (raw.get("location") or {}).get("display_name", "")

    return JobPost(
        source="adzuna",
        source_region=COUNTRY_TO_REGION.get(country, "unknown"),
        title=raw.get("title", "").strip(),
        company=company.strip(),
        location=location.strip(),
        url=raw.get("redirect_url", ""),
        description=raw.get("description", "").strip(),
        posted_at=raw.get("created"),
        posted_at_source="api" if raw.get("created") else "unknown",
        raw={
            "country": country,
            "role_hint": role_hint,
            "salary_min": raw.get("salary_min"),
            "salary_max": raw.get("salary_max"),
            "salary_is_predicted": raw.get("salary_is_predicted"),
            "contract_type": raw.get("contract_type"),
            "contract_time": raw.get("contract_time"),
            "category": (raw.get("category") or {}).get("label"),
        },
    )


# ============================================================
# Main collector
# ============================================================
def collect_country(
    country: str, queries: list[dict], app_id: str, app_key: str,
    results_per_page: int = 50, max_days_old: int = 1,
) -> list[JobPost]:
    """Run all queries for a country, return JobPost list."""
    jobs: list[JobPost] = []
    seen_urls: set[str] = set()

    for q in queries:
        results = search_adzuna(
            country=country,
            app_id=app_id, app_key=app_key,
            what=q["what"], where=q["where"],
            results_per_page=results_per_page,
            max_days_old=max_days_old,
        )
        for raw in results:
            job = parse_adzuna_result(raw, country=country, role_hint=q["role"])
            if not job.title or not job.company:
                continue
            if job.url in seen_urls:
                continue
            jobs.append(job)
            seen_urls.add(job.url)

        # Light pacing between calls
        time.sleep(0.5)

    return jobs


def main() -> int:
    p = argparse.ArgumentParser(description="Collect jobs from Adzuna API.")
    p.add_argument("--country", choices=["au", "sg", "all"], default="all")
    p.add_argument("--save-raw", action="store_true")
    p.add_argument(
        "--push-supabase", action="store_true",
        help="Push collected jobs to Supabase (cloud collection)",
    )
    args = p.parse_args()

    load_env()
    app_id = require_env("ADZUNA_APP_ID")
    app_key = require_env("ADZUNA_APP_KEY")

    sources_cfg = load_config("sources.yaml")["sources"]
    profiles = load_config("search-profiles.yaml")

    if not sources_cfg["adzuna"]["enabled"]:
        logger.info("Adzuna disabled in sources.yaml. Skipping.")
        return 0

    countries_cfg = {c["code"]: c for c in sources_cfg["adzuna"]["countries"]}
    queries_by_country = profiles["adzuna_queries"]

    all_jobs: list[JobPost] = []
    targets = ["au", "sg"] if args.country == "all" else [args.country]

    for country in targets:
        if country not in countries_cfg:
            logger.warning(f"No country config for {country}; skipping.")
            continue
        country_cfg = countries_cfg[country]
        queries = queries_by_country.get(country, [])
        if not queries:
            logger.warning(f"No queries defined for country {country}.")
            continue

        jobs = collect_country(
            country=country,
            queries=queries,
            app_id=app_id, app_key=app_key,
            results_per_page=country_cfg["results_per_page"],
            max_days_old=country_cfg["max_days_old"],
        )
        logger.info(f"Adzuna {country.upper()}: {len(jobs)} jobs")
        all_jobs.extend(jobs)

    logger.info(f"Adzuna total: {len(all_jobs)} jobs")

    if args.save_raw:
        path = save_raw_jobs(all_jobs, source="adzuna")
        logger.info(f"Saved raw output to {path}")

    # Push to Supabase (cloud collection)
    if args.push_supabase and all_jobs:
        from supabase_utils import push_jobs_to_supabase
        roles_config = load_config("search-profiles.yaml").get("roles", {})
        def classify_fn(title):
            title_lower = title.lower()
            for role, cfg in roles_config.items():
                for keyword in cfg.get("must_include", []):
                    if keyword in title_lower:
                        return role
            return "unknown"
        raw, new = push_jobs_to_supabase(all_jobs, source="adzuna", classify_fn=classify_fn)
        logger.info(f"Supabase push: raw={raw}, new={new}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
