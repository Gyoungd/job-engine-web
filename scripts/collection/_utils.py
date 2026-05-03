"""
Job Search Pipeline — Shared Utilities

Provides:
    - Standard logger setup
    - SQLite seen_jobs.db management (dedup tracking)
    - JD object schema + hash function
    - Config loader (YAML files)
    - Region detection (location string → region key)
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import sqlite3
import sys
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import yaml


# ============================================================
# Paths (relative to project root: 01_job-engine/)
# ============================================================
JOB_SEARCH_DIR = Path(__file__).resolve().parent.parent
CONFIG_DIR = JOB_SEARCH_DIR / "config"
DATA_DIR = JOB_SEARCH_DIR / "data"
QUEUE_DIR = DATA_DIR / "queue"
LOGS_DIR = JOB_SEARCH_DIR / "logs"
SEEN_DB_PATH = DATA_DIR / "seen_jobs.db"

DATA_DIR.mkdir(parents=True, exist_ok=True)
QUEUE_DIR.mkdir(parents=True, exist_ok=True)
LOGS_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# Logger setup
# ============================================================
def get_logger(name: str, level: str = "INFO") -> logging.Logger:
    """Configure a logger that writes to both console and a daily log file."""
    logger = logging.getLogger(name)
    if logger.handlers:  # already configured
        return logger

    logger.setLevel(getattr(logging, level.upper(), logging.INFO))
    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    logger.addHandler(console)

    # Daily log file
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    file_handler = logging.FileHandler(LOGS_DIR / f"{today}_{name}.log", encoding="utf-8")
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    return logger


# ============================================================
# JD Schema (standardized across all collectors)
# ============================================================
@dataclass
class JobPost:
    """Standardized job post object — used by all collectors."""

    source: str                      # 'linkedin' | 'seek' | 'adzuna' | 'saramin'
    source_region: str               # 'melbourne' | 'korea' | 'singapore' | 'malaysia' | 'unknown'
    title: str
    company: str
    location: str
    url: str
    description: str = ""            # may be empty for LinkedIn alerts
    posted_at: Optional[str] = None  # ISO 8601 string
    posted_at_source: str = "unknown"  # 'api' | 'estimated_from_alert' | 'unknown'
    collected_at: str = ""           # ISO 8601 string (set on creation)
    raw: dict[str, Any] = field(default_factory=dict)
    hash: str = ""                   # SHA256 — set after construction

    def __post_init__(self) -> None:
        if not self.collected_at:
            self.collected_at = datetime.now(timezone.utc).isoformat()
        if not self.hash:
            self.hash = compute_hash(self.company, self.title, self.location)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def compute_hash(company: str, title: str, location: str) -> str:
    """SHA256 hash of normalized (company, title, location) for dedup."""
    norm = lambda s: re.sub(r"\s+", " ", (s or "").strip().lower())
    key = f"{norm(company)}|{norm(title)}|{norm(location)}"
    return hashlib.sha256(key.encode("utf-8")).hexdigest()


# ============================================================
# SQLite seen-jobs tracker
# ============================================================
SCHEMA = """
CREATE TABLE IF NOT EXISTS seen_jobs (
    hash             TEXT PRIMARY KEY,
    source           TEXT NOT NULL,
    title            TEXT NOT NULL,
    company          TEXT NOT NULL,
    location         TEXT,
    url              TEXT,
    first_seen       TEXT NOT NULL,
    last_seen        TEXT NOT NULL,
    times_seen       INTEGER DEFAULT 1,
    queued           INTEGER DEFAULT 0,
    classified_role  TEXT DEFAULT 'unknown',
    source_region    TEXT DEFAULT 'unknown'
);
CREATE INDEX IF NOT EXISTS idx_first_seen ON seen_jobs(first_seen);
CREATE INDEX IF NOT EXISTS idx_source ON seen_jobs(source);
CREATE INDEX IF NOT EXISTS idx_classified_role ON seen_jobs(classified_role);
"""

# Migration for existing DBs (adds new columns if missing)
_MIGRATIONS = [
    "ALTER TABLE seen_jobs ADD COLUMN classified_role TEXT DEFAULT 'unknown'",
    "ALTER TABLE seen_jobs ADD COLUMN source_region TEXT DEFAULT 'unknown'",
]


def init_db(db_path: Path = SEEN_DB_PATH) -> sqlite3.Connection:
    """Initialize (or open) the seen_jobs database. Runs migrations for existing DBs."""
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)
    # Run migrations (safe — ALTER TABLE ADD COLUMN is no-op if column exists in some SQLite versions,
    # but raises error in others, so we catch and skip)
    for sql in _MIGRATIONS:
        try:
            conn.execute(sql)
        except sqlite3.OperationalError:
            pass  # column already exists
    conn.commit()
    return conn


def is_seen(conn: sqlite3.Connection, job_hash: str) -> bool:
    """Check whether a JD hash is already in the database."""
    cur = conn.execute("SELECT 1 FROM seen_jobs WHERE hash = ?", (job_hash,))
    return cur.fetchone() is not None


def mark_seen(
    conn: sqlite3.Connection,
    job: JobPost,
    queued: bool = False,
    classified_role: str = "unknown",
) -> bool:
    """
    Record a JD as seen. Returns True if NEW, False if already existed.
    Updates last_seen and times_seen on duplicates.
    """
    now = datetime.now(timezone.utc).isoformat()
    cur = conn.execute("SELECT times_seen FROM seen_jobs WHERE hash = ?", (job.hash,))
    row = cur.fetchone()

    if row is None:
        conn.execute(
            """INSERT INTO seen_jobs
               (hash, source, title, company, location, url,
                first_seen, last_seen, times_seen, queued,
                classified_role, source_region)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)""",
            (
                job.hash, job.source, job.title, job.company,
                job.location, job.url, now, now, 1 if queued else 0,
                classified_role, job.source_region,
            ),
        )
        conn.commit()
        return True

    conn.execute(
        """UPDATE seen_jobs
           SET last_seen = ?, times_seen = times_seen + 1, queued = MAX(queued, ?),
               classified_role = ?, source_region = ?
           WHERE hash = ?""",
        (now, 1 if queued else 0, classified_role, job.source_region, job.hash),
    )
    conn.commit()
    return False


# ============================================================
# Config loader
# ============================================================
def load_config(filename: str) -> dict[str, Any]:
    """Load a YAML config file from config/ directory."""
    path = CONFIG_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {path}")
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


# ============================================================
# Region detection
# ============================================================
def detect_region(location: str, regions_config: dict[str, Any]) -> str:
    """
    Match a JD location string against region patterns from search-profiles.yaml.
    Returns region key ('melbourne', 'korea', etc.) or 'unknown'.
    """
    if not location:
        return "unknown"
    loc = location.lower()
    for region_key, region_def in regions_config.items():
        for pattern in region_def.get("location_match", []):
            if pattern.lower() in loc:
                return region_key
    return "unknown"


# ============================================================
# Relative time parsing (LinkedIn/Seek alert email cards)
# ============================================================
# Patterns observed in LinkedIn/Seek alert email cards:
#   "5 days ago", "2 hours ago", "yesterday", "today",
#   "posted 3 days ago", "reposted today", "1 week ago"
_RELATIVE_TIME_RE = re.compile(
    r"\b(\d+)\s*(minute|hour|day|week|month)s?\s*ago\b",
    re.IGNORECASE,
)
_TODAY_RE = re.compile(r"\b(today|just now|just posted|posted today)\b", re.IGNORECASE)
_YESTERDAY_RE = re.compile(r"\byesterday\b", re.IGNORECASE)


def parse_relative_time(
    text: str,
    reference_dt: Optional[datetime] = None,
) -> tuple[Optional[str], str]:
    """
    Parse relative-time strings from LinkedIn/Seek alert cards.

    Args:
        text: any text near the job card (e.g., "Posted 3 days ago")
        reference_dt: anchor datetime (typically the email received date).
                      Defaults to current UTC time.

    Returns:
        (iso_datetime_string, source_tag)
        source_tag = 'estimated_from_alert' if parsed, 'unknown' otherwise.
    """
    if not text:
        return None, "unknown"

    from datetime import timedelta

    if reference_dt is None:
        reference_dt = datetime.now(timezone.utc)

    text_lower = text.lower()

    # Today / Just now → same calendar day, 09:00 UTC
    if _TODAY_RE.search(text_lower):
        dt = reference_dt.replace(hour=9, minute=0, second=0, microsecond=0)
        return dt.isoformat(), "estimated_from_alert"

    # Yesterday
    if _YESTERDAY_RE.search(text_lower):
        dt = (reference_dt - timedelta(days=1)).replace(
            hour=9, minute=0, second=0, microsecond=0
        )
        return dt.isoformat(), "estimated_from_alert"

    # X minute/hour/day/week/month(s) ago
    m = _RELATIVE_TIME_RE.search(text_lower)
    if m:
        num = int(m.group(1))
        unit = m.group(2).lower()
        delta_map = {
            "minute": timedelta(minutes=num),
            "hour": timedelta(hours=num),
            "day": timedelta(days=num),
            "week": timedelta(weeks=num),
            "month": timedelta(days=num * 30),  # approximate
        }
        dt = reference_dt - delta_map[unit]
        return dt.isoformat(), "estimated_from_alert"

    return None, "unknown"


# ============================================================
# Save raw collected jobs (Phase 2 output, before filtering)
# ============================================================
def save_raw_jobs(jobs: list[JobPost], source: str) -> Path:
    """Save raw collector output to data/raw_<source>_<date>.json (overwrite)."""
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_path = DATA_DIR / f"raw_{source}_{date}.json"
    payload = {
        "source": source,
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "count": len(jobs),
        "jobs": [j.to_dict() for j in jobs],
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return out_path


def load_env(env_path: Optional[Path] = None) -> None:
    """Load .env file if present (no-op in GitHub Actions where env vars are pre-set)."""
    try:
        from dotenv import load_dotenv
        if env_path is None:
            env_path = JOB_SEARCH_DIR.parent / ".env"
        if env_path.exists():
            load_dotenv(env_path)
    except ImportError:
        pass  # python-dotenv optional


def require_env(key: str) -> str:
    """Get required env var or raise."""
    val = os.environ.get(key)
    if not val:
        raise RuntimeError(
            f"Required environment variable {key!r} is not set. "
            f"Set it in .env (local) or GitHub Secrets (Actions)."
        )
    return val
