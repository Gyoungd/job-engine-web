"""
Collector 1 — Gmail Job Alerts (LinkedIn + Seek)

Reads emails labeled 'JobAlerts/LinkedIn' and 'JobAlerts/Seek',
extracts individual job postings via HTML parsing, returns JobPost list.

Authentication:
    - First run (local): opens browser for OAuth → saves token.json
    - GitHub Actions: reads GMAIL_OAUTH_JSON + GMAIL_TOKEN_JSON from env

Usage:
    python scripts/1_collect_alerts.py
    python scripts/1_collect_alerts.py --source linkedin   # only LinkedIn
    python scripts/1_collect_alerts.py --lookback 3        # 3 days
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
from pathlib import Path
from typing import Iterable, Optional
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

from bs4 import BeautifulSoup

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _utils import (  # noqa: E402
    JobPost, get_logger, load_config, load_env, save_raw_jobs,
    parse_relative_time, detect_region, JOB_SEARCH_DIR
)

logger = get_logger("collect_alerts")

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


# ============================================================
# Gmail authentication (handles local OAuth + GitHub Actions secrets)
# ============================================================
def get_gmail_service():
    """
    Build Gmail API client.

    Two auth paths:
      1) Local: reads .credentials/gmail-credentials.json (OAuth client),
         opens browser if no token, saves token to .credentials/gmail-token.json
      2) CI: reads GMAIL_OAUTH_JSON + GMAIL_TOKEN_JSON env vars (raw JSON contents)
    """
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build

    creds_dir = JOB_SEARCH_DIR.parent / ".credentials"
    creds_dir.mkdir(parents=True, exist_ok=True)
    creds_path = creds_dir / "gmail-credentials.json"
    token_path = creds_dir / "gmail-token.json"

    # GitHub Actions path: write env-var contents to disk so Google libs can read them
    if os.environ.get("GMAIL_OAUTH_JSON") and not creds_path.exists():
        creds_path.write_text(os.environ["GMAIL_OAUTH_JSON"])
        logger.info("Wrote OAuth credentials from GMAIL_OAUTH_JSON env var.")
    if os.environ.get("GMAIL_TOKEN_JSON") and not token_path.exists():
        token_path.write_text(os.environ["GMAIL_TOKEN_JSON"])
        logger.info("Wrote token from GMAIL_TOKEN_JSON env var.")

    creds = None
    if token_path.exists():
        creds = Credentials.from_authorized_user_file(str(token_path), GMAIL_SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logger.info("Refreshing expired token.")
            creds.refresh(Request())
        else:
            if not creds_path.exists():
                raise FileNotFoundError(
                    f"Missing OAuth credentials file: {creds_path}\n"
                    f"Download from Google Cloud Console (OAuth Desktop App) "
                    f"and place at this path. See SETUP.md."
                )
            logger.info("Running OAuth browser flow (first-time setup).")
            flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), GMAIL_SCOPES)
            creds = flow.run_local_server(port=0)
        token_path.write_text(creds.to_json())
        logger.info(f"Saved token to {token_path}")

    return build("gmail", "v1", credentials=creds, cache_discovery=False)


# ============================================================
# Email body extraction
# ============================================================
def extract_html_body(message: dict) -> str:
    """Walk Gmail message payload tree, return decoded HTML body (or empty)."""

    def walk(part: dict) -> Optional[str]:
        mime = part.get("mimeType", "")
        body = part.get("body", {})
        if mime == "text/html" and body.get("data"):
            return base64.urlsafe_b64decode(body["data"]).decode("utf-8", errors="replace")
        for sub in part.get("parts", []) or []:
            result = walk(sub)
            if result:
                return result
        return None

    return walk(message.get("payload", {})) or ""


def get_subject(message: dict) -> str:
    """Extract subject from Gmail message headers."""
    for h in message.get("payload", {}).get("headers", []):
        if h.get("name", "").lower() == "subject":
            return h.get("value", "")
    return ""


def get_received_dt(message: dict):
    """Get email received datetime as UTC (used as anchor for relative time parsing)."""
    from datetime import datetime, timezone
    internal = message.get("internalDate")
    if internal:
        # Gmail returns ms since epoch (string)
        return datetime.fromtimestamp(int(internal) / 1000, tz=timezone.utc)
    return datetime.now(timezone.utc)


# ============================================================
# Truncation detection ("See all N jobs" / "View all N jobs")
# ============================================================
_TRUNCATION_PATTERNS = [
    re.compile(r"see\s+all\s+(\d+)\s+jobs?", re.IGNORECASE),
    re.compile(r"view\s+all\s+(\d+)\s+jobs?", re.IGNORECASE),
    re.compile(r"see\s+(\d+)\s+more\s+jobs?", re.IGNORECASE),
    re.compile(r"(\d+)\s+more\s+jobs?\s+match", re.IGNORECASE),
]


def detect_truncation(html: str) -> Optional[int]:
    """
    Search for 'See all N jobs' / 'View all N jobs' patterns in alert email.
    Returns total advertised job count if found, else None.
    """
    if not html:
        return None
    # Strip HTML tags for clean pattern matching
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text)
    for pattern in _TRUNCATION_PATTERNS:
        m = pattern.search(text)
        if m:
            try:
                return int(m.group(1))
            except (ValueError, IndexError):
                continue
    return None


# ============================================================
# URL cleanup (strip tracking params)
# ============================================================
def clean_job_url(url: str) -> str:
    """Strip tracking params; keep canonical job URL."""
    if not url:
        return url
    try:
        parsed = urlparse(url)
        # Drop ALL query params for known job-sites (cleaner dedup)
        if any(host in parsed.netloc for host in ("linkedin.com", "seek.com")):
            return urlunparse(parsed._replace(query="", fragment=""))
        return url
    except Exception:
        return url


# ============================================================
# LinkedIn parser
# ============================================================
LINKEDIN_JOB_URL_RE = re.compile(
    r"https?://(?:www\.)?linkedin\.com/(?:comm/)?jobs/view/\d+",
    re.IGNORECASE,
)

# Status badge patterns (NOT location data — skip these)
_STATUS_BADGE_PATTERNS = [
    re.compile(r"actively recruiting", re.IGNORECASE),
    re.compile(r"\d+\s+(?:company|school)\s+alum", re.IGNORECASE),
    re.compile(r"\d+\s+connection", re.IGNORECASE),
    re.compile(r"promoted", re.IGNORECASE),
    re.compile(r"easy apply", re.IGNORECASE),
    re.compile(r"people clicked apply", re.IGNORECASE),
    re.compile(r"viewed", re.IGNORECASE),
    re.compile(r"be an early applicant", re.IGNORECASE),
]


def _is_status_badge(text: str) -> bool:
    """Check if a text line is a LinkedIn status badge (not location data)."""
    return any(p.search(text) for p in _STATUS_BADGE_PATTERNS)


def parse_linkedin_alert(html: str, subject: str = "", email_received_dt=None) -> list[JobPost]:
    """
    Extract job posts from a LinkedIn job-alert email.

    LinkedIn alerts use a card-based layout. Strategy:
      1) Find every <a> linking to /jobs/view/<id>
      2) For each, walk up the DOM to find the surrounding job-card block
      3) Extract title (from <a> text), company + location (sibling text nodes)
      4) Search the card text for relative-time strings ("X days ago") → posted_at
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")
    jobs: list[JobPost] = []
    seen_urls: set[str] = set()

    for a in soup.find_all("a", href=LINKEDIN_JOB_URL_RE):
        href = a.get("href", "").strip()
        clean_url = clean_job_url(href)
        if clean_url in seen_urls:
            continue

        # Title from anchor text
        title = a.get_text(strip=True)
        if not title or len(title) < 3:
            continue

        # Walk up to find the job-card container
        card = a.find_parent("table") or a.find_parent("td") or a.parent
        company = ""
        location = ""
        posted_text = ""
        posted_at = None
        posted_at_source = "unknown"

        if card:
            # Strategy: collect non-link text nodes near the anchor
            card_text = card.get_text("\n")
            text_lines = [
                line.strip() for line in card_text.splitlines() if line.strip()
            ]
            # LinkedIn email card pattern (confirmed from real emails):
            #   Line 0: [Title]                              (linked)
            #   Line 1: [Company · City, Region, Country]    (merged with · separator)
            #   Line 2: [Status badge]                       ("Actively recruiting" / "X school alumni")
            #   Line 3+: [snippet / posted time]
            try:
                title_idx = next(
                    i for i, line in enumerate(text_lines)
                    if line.lower().startswith(title.lower()[:20])
                )
                if title_idx + 1 < len(text_lines):
                    company_line = text_lines[title_idx + 1]
                    # Split "Company · Location" by middle dot separator
                    # LinkedIn uses various dot chars: · (U+00B7), · (HTML), or plain ·
                    if " · " in company_line:
                        parts = company_line.split(" · ", 1)
                        company = parts[0].strip()
                        location = parts[1].strip()
                    elif " \u00b7 " in company_line:
                        parts = company_line.split(" \u00b7 ", 1)
                        company = parts[0].strip()
                        location = parts[1].strip()
                    else:
                        company = company_line
                        # Fallback: check next line for location (skip status badges)
                        if title_idx + 2 < len(text_lines):
                            next_line = text_lines[title_idx + 2]
                            if not _is_status_badge(next_line):
                                location = next_line
            except StopIteration:
                pass

            # Search the entire card text for relative-time hints
            posted_at, posted_at_source = parse_relative_time(card_text, email_received_dt)
            # Capture the raw matched fragment for debugging
            for line in text_lines:
                if (
                    "ago" in line.lower()
                    or "today" in line.lower()
                    or "yesterday" in line.lower()
                ):
                    posted_text = line
                    break

        if not company:
            continue  # require company

        # Auto-detect region from location string
        try:
            regions_cfg = load_config("search-profiles.yaml").get("regions", {})
            detected_region = detect_region(location, regions_cfg)
        except Exception:
            detected_region = "unknown"

        jobs.append(JobPost(
            source="linkedin",
            source_region=detected_region,
            title=title,
            company=company,
            location=location,
            url=clean_url,
            description="",  # LinkedIn alerts don't include descriptions
            posted_at=posted_at,
            posted_at_source=posted_at_source,
            raw={
                "alert_subject": subject,
                "posted_text": posted_text,
            },
        ))
        seen_urls.add(clean_url)

    logger.info(f"LinkedIn parser: extracted {len(jobs)} jobs from email '{subject[:60]}'")
    return jobs


# ============================================================
# Seek parser
# ============================================================
SEEK_JOB_URL_RE = re.compile(
    r"https?://(?:www\.)?seek\.com\.(?:au|sg|nz|ph|my|hk|id|th)/job/\d+",
    re.IGNORECASE,
)


def parse_seek_alert(html: str, subject: str = "", email_received_dt=None) -> list[JobPost]:
    """
    Extract job posts from a Seek job-alert email.
    Seek emails include richer data (salary, snippet) than LinkedIn.
    """
    if not html:
        return []
    soup = BeautifulSoup(html, "lxml")
    jobs: list[JobPost] = []
    seen_urls: set[str] = set()

    for a in soup.find_all("a", href=SEEK_JOB_URL_RE):
        href = a.get("href", "").strip()
        clean_url = clean_job_url(href)
        if clean_url in seen_urls:
            continue

        title = a.get_text(strip=True)
        if not title or len(title) < 3:
            continue

        card = a.find_parent("table") or a.find_parent("td") or a.parent
        company = ""
        location = ""
        snippet = ""
        posted_text = ""
        posted_at = None
        posted_at_source = "unknown"

        if card:
            card_text = card.get_text("\n")
            text_lines = [
                line.strip()
                for line in card_text.splitlines()
                if line.strip() and len(line.strip()) > 1
            ]
            # Seek typical: [Title] [Company] [Location] [Salary] [Snippet]
            try:
                title_idx = next(
                    i for i, line in enumerate(text_lines)
                    if line.lower().startswith(title.lower()[:20])
                )
                if title_idx + 1 < len(text_lines):
                    company = text_lines[title_idx + 1]
                if title_idx + 2 < len(text_lines):
                    location = text_lines[title_idx + 2]
                if title_idx + 3 < len(text_lines):
                    snippet = text_lines[title_idx + 3]
            except StopIteration:
                pass

            # Posted-at extraction
            posted_at, posted_at_source = parse_relative_time(card_text, email_received_dt)
            for line in text_lines:
                if (
                    "ago" in line.lower()
                    or "today" in line.lower()
                    or "yesterday" in line.lower()
                ):
                    posted_text = line
                    break

        if not company:
            continue

        jobs.append(JobPost(
            source="seek",
            source_region="unknown",
            title=title,
            company=company,
            location=location,
            url=clean_url,
            description=snippet,
            posted_at=posted_at,
            posted_at_source=posted_at_source,
            raw={
                "alert_subject": subject,
                "posted_text": posted_text,
            },
        ))
        seen_urls.add(clean_url)

    logger.info(f"Seek parser: extracted {len(jobs)} jobs from email '{subject[:60]}'")
    return jobs


# ============================================================
# Main collector
# ============================================================
def fetch_messages(service, query: str, max_results: int = 50) -> list[dict]:
    """Page through Gmail search results matching query."""
    messages: list[dict] = []
    page_token: Optional[str] = None
    while True:
        kwargs = {"userId": "me", "q": query, "maxResults": max_results}
        if page_token:
            kwargs["pageToken"] = page_token
        resp = service.users().messages().list(**kwargs).execute()
        messages.extend(resp.get("messages", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            break
    logger.info(f"Gmail query {query!r} → {len(messages)} messages")
    return messages


def collect_from_label(
    service, label: str, parser, lookback_days: int
) -> tuple[list[JobPost], dict]:
    """
    Fetch all messages under a label and run parser on each.

    Returns:
        (jobs_list, monitoring_stats)
        monitoring_stats = {
            'total_emails': int,
            'truncation_events': list of dicts with subject + advertised + parsed,
        }
    """
    query = f'label:"{label}" newer_than:{lookback_days}d'
    msg_refs = fetch_messages(service, query)

    jobs: list[JobPost] = []
    truncation_events: list[dict] = []

    for ref in msg_refs:
        try:
            msg = service.users().messages().get(
                userId="me", id=ref["id"], format="full"
            ).execute()
        except Exception as e:
            logger.warning(f"Failed to fetch message {ref['id']}: {e}")
            continue

        html = extract_html_body(msg)
        subject = get_subject(msg)
        email_dt = get_received_dt(msg)

        if not html:
            logger.debug(f"No HTML body in message: {subject!r}")
            continue

        # Parse jobs from this email
        email_jobs = parser(html, subject=subject, email_received_dt=email_dt)
        jobs.extend(email_jobs)

        # Truncation monitoring
        advertised = detect_truncation(html)
        if advertised is not None:
            parsed_count = len(email_jobs)
            missed = max(0, advertised - parsed_count)
            event = {
                "email_subject": subject,
                "advertised": advertised,
                "parsed": parsed_count,
                "missed": missed,
            }
            truncation_events.append(event)
            logger.warning(
                f"⚠️ Truncation detected — '{subject[:60]}': "
                f"advertised={advertised}, parsed={parsed_count}, missed≈{missed}"
            )

    return jobs, {
        "total_emails": len(msg_refs),
        "truncation_events": truncation_events,
    }


def main() -> int:
    p = argparse.ArgumentParser(description="Collect jobs from Gmail alert labels.")
    p.add_argument(
        "--source", choices=["linkedin", "seek", "all"], default="all",
        help="Which source to collect from (default: all)",
    )
    p.add_argument(
        "--lookback", type=int, default=None,
        help="Override lookback_days from sources.yaml",
    )
    p.add_argument(
        "--save-raw", action="store_true",
        help="Save raw JSON output to data/raw_*.json",
    )
    p.add_argument(
        "--push-supabase", action="store_true",
        help="Push collected jobs to Supabase (cloud collection)",
    )
    args = p.parse_args()

    load_env()
    sources_cfg = load_config("sources.yaml")["sources"]

    service = get_gmail_service()
    all_jobs: list[JobPost] = []
    all_truncation: list[dict] = []

    if args.source in ("linkedin", "all") and sources_cfg["linkedin_alerts"]["enabled"]:
        cfg = sources_cfg["linkedin_alerts"]
        lookback = args.lookback or cfg["lookback_days"]
        jobs, mon = collect_from_label(service, cfg["gmail_label"], parse_linkedin_alert, lookback)
        all_jobs.extend(jobs)
        all_truncation.extend(mon["truncation_events"])
        logger.info(f"LinkedIn total: {len(jobs)} jobs from {mon['total_emails']} emails")

    if args.source in ("seek", "all") and sources_cfg["seek_alerts"]["enabled"]:
        cfg = sources_cfg["seek_alerts"]
        lookback = args.lookback or cfg["lookback_days"]
        jobs, mon = collect_from_label(service, cfg["gmail_label"], parse_seek_alert, lookback)
        all_jobs.extend(jobs)
        all_truncation.extend(mon["truncation_events"])
        logger.info(f"Seek total: {len(jobs)} jobs from {mon['total_emails']} emails")

    logger.info(f"Combined total: {len(all_jobs)} jobs")

    # Truncation summary
    if all_truncation:
        total_missed = sum(e["missed"] for e in all_truncation)
        logger.warning(
            f"⚠️ TRUNCATION SUMMARY: {len(all_truncation)} email(s) truncated, "
            f"~{total_missed} jobs not captured. "
            f"→ Consider splitting alerts to narrow scope."
        )
    else:
        logger.info("✅ No truncation detected in this run.")

    if args.save_raw:
        path = save_raw_jobs(all_jobs, source=args.source)
        logger.info(f"Saved raw output to {path}")

        # Also save monitoring stats alongside
        if all_truncation:
            from datetime import datetime, timezone
            import json
            date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            mon_path = JOB_SEARCH_DIR / "data" / f"truncation_{args.source}_{date}.json"
            with open(mon_path, "w", encoding="utf-8") as f:
                json.dump({"events": all_truncation}, f, indent=2, ensure_ascii=False)
            logger.info(f"Saved truncation events to {mon_path}")

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
        raw, new = push_jobs_to_supabase(all_jobs, source="gmail", classify_fn=classify_fn)
        logger.info(f"Supabase push: raw={raw}, new={new}")

    # Print summary table
    if all_jobs:
        from collections import Counter
        by_source = Counter(j.source for j in all_jobs)
        by_posted_source = Counter(j.posted_at_source for j in all_jobs)
        logger.info("Per-source breakdown: " + ", ".join(f"{k}={v}" for k, v in by_source.items()))
        logger.info("Posted-at coverage: " + ", ".join(f"{k}={v}" for k, v in by_posted_source.items()))

    return 0


if __name__ == "__main__":
    sys.exit(main())