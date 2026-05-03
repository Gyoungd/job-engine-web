# Job Engine — Product Specification

> **Last Updated:** 2026-05-04
> **Owner:** Gayoung Dan (Ina)
> **Status:** Active Development — Phase 4 COMPLETE, Phase 5 SPECIFIED, ready for implementation
> **Repository:** [https://github.com/Gyoungd/job-engine-web](https://github.com/Gyoungd/job-engine-web)
> **Production URL:** [https://job-engine-web.vercel.app](https://job-engine-web.vercel.app)

---

## Document Purpose

This document is the **single source of truth** for Job Engine product scope, feature mapping, and development roadmap. All API endpoints, UI components, and user flows are tracked here against their implementation status.

For technical implementation details (auth flows, env vars, code patterns), see `CLAUDE.md` in repository root.

For collection pipeline rules (resume tailoring constraints, ATS keywords), see `PIPELINE_RULES.md`.

---

## 1. Product Overview

### 1.1 Problem Statement

Manual job search workflow scattered across LinkedIn alerts, Seek emails, Adzuna API, and a local Python `/apply` pipeline running only on a personal laptop. No mobile access, no centralized dashboard, no automated daily collection.

### 1.2 Solution

Personal mobile-first web dashboard that consolidates job collection, AI-powered scoring, automated resume tailoring, and application pipeline tracking. Replaces local Claude Code commands with cloud-based API endpoints.

### 1.3 Target User

Single user (Gayoung Dan): recent Master of Data Science graduate from Monash University, applying to Data Analyst / Scientist / Engineer roles in Melbourne, Seoul, Singapore, and Malaysia.

**Device profile:** iPhone 16 Pro (iOS 18+) primary, MacBook secondary.

### 1.4 Success Metrics

- Collection runs without manual intervention (8 runs/day Gmail + 1 run/day Adzuna)
- Resume generation completes in under 60 seconds
- All applications tracked in one pipeline view (mobile + desktop)
- Total monthly cost under $50 USD (Anthropic API + Pro subscription)
- Zero PK violations in `seen_jobs` (atomic upsert verified)

---

## 2. System Architecture

### 2.1 Stack

```
Frontend:    Next.js 16 + Tailwind CSS (App Router)
Backend:     Vercel Serverless Functions (TypeScript)
Database:    Supabase (PostgreSQL)
AI:          Anthropic API (Haiku 4.5 for ranking, Sonnet 4.6 for generation)
Storage:     Google Drive (user OAuth) + Google Sheets (Service Account)
Hosting:     Vercel (Hobby tier)
Collection:  GitHub Actions cron (Python scripts pushing to Supabase)
```

### 2.2 Data Flow

```
[Gmail alerts (LinkedIn + Seek) — 8 runs/day, 8am-10pm AEST, 2hr interval]
[Adzuna REST API — 1 run/day, 12am AEST]
            ↓
[GitHub Actions runners (ubuntu-latest)]
            ↓
[Python: collect → dedup → classify → atomic upsert]
            ↓
[Supabase: seen_jobs (UPSERT) + collection_runs (INSERT)]
            ↓
[Web app: Home tab loads /api/queue/stats + /api/queue]
            ↓
[User clicks "Generate top 10" → POST /api/rank → Haiku scores]
            ↓
[User clicks "Generate resume" → POST /api/generate-resume → Sonnet]
            ↓
[Supabase: applications table]
            ↓
[User clicks "Generate Docs" → POST /api/docs/copy-base → Google Drive]
            ↓
[User edits in Google Docs → exports PDF → submits manually]
            ↓
[User clicks "Mark applied" → POST /api/applications/mark-applied]
            ↓
[Supabase + Google Sheets sync]
```

**Notification model:** No proactive notifications in MVP. User pulls the dashboard at convenience (typical: 12pm AEST lunch break, evening, before sleep). Push notifications evaluated in Phase 5.1 based on usage data.

### 2.3 Database Schema

```
seen_jobs           Job listings collected from sources
  - hash (PK)         SHA256(company|title|location), normalized
  - source            'linkedin' | 'seek' | 'adzuna' | 'worknet' | 'jobkorea'
  - title, company, location, url
  - first_seen        TIMESTAMPTZ — set on INSERT, immutable
  - last_seen         TIMESTAMPTZ — updated on every UPSERT collision
  - times_seen        INTEGER — incremented on collision
  - queued            INTEGER — 0/1, MAX(old, new) on collision
  - classified_role   'DA' | 'DS' | 'DE' | 'unknown'
  - source_region     'melbourne' | 'korea' | 'singapore' | 'malaysia' | 'unknown'
  - score             INTEGER — Haiku ranking output (NULL if unscored)
  - score_reasoning   TEXT — Haiku rationale

applications        Resume drafts and submission tracking
  - id (UUID PK), jd_hash (FK → seen_jobs.hash)
  - folder_path       e.g., "2026-05-04_musinsa_DS"
  - classified_role, resume_changes, doc_url, doc_id
  - status            'draft' | 'docs_copied' | 'submitted' | 'pending'
                      | 'phone' | 'offer' | 'rejected'
  - suitability_pct, submitted_at, response_status, notes
  - created_at, updated_at

collection_runs     Cron audit log (one row per run)
  - id (UUID PK), run_at TIMESTAMPTZ DEFAULT now()
  - source            'gmail' | 'adzuna' | 'worknet' | 'jobkorea'
  - raw_count         INTEGER — total JDs parsed (incl. duplicates)
  - new_count         INTEGER — JDs that were new INSERTs
  - sources           JSONB — per-alert breakdown
```

### 2.4 Concurrency & Idempotency

All `seen_jobs` writes use **atomic UPSERT** (`ON CONFLICT (hash) DO UPDATE`) to handle:

- Race conditions when multiple cron runs overlap
- Duplicate JDs across sources (LinkedIn + Adzuna posting same role)
- Re-runs after partial failures

GitHub Actions concurrency group `collect-gmail` and `collect-adzuna` set with `cancel-in-progress: false` — running jobs finish before next trigger fires.

---

## 3. Feature Map by Tab

Each tab section maps UI components to API endpoints, with implementation status flags.

**Status legend:**

- ✅ Done — Implemented and verified
- 🟡 Partial — Built but not fully connected
- ⏳ Planned — Specified, not started
- 💤 Backlog — Phase B / nice-to-have

---

### 3.1 Home Tab (Dashboard)

**Purpose:** At-a-glance overview of queue status, top picks, drafts, and pipeline.


| Component                 | Function                                      | API                                                      | Status |
| ------------------------- | --------------------------------------------- | -------------------------------------------------------- | ------ |
| Stats grid (4 cards)      | Display Raw / New / Target / Top counts       | `GET /api/queue/stats`                                   | ✅      |
| Refresh queue button      | Re-fetch latest counts                        | `GET /api/queue/stats` + `GET /api/queue`                | ✅      |
| Generate top 10 button    | Trigger Haiku scoring on unscored jobs        | `POST /api/rank`                                         | ✅      |
| Top picks list (12 cards) | Display ranked JDs with score, role, location | `GET /api/queue?filter=ranked&limit=12`                  | ✅      |
| Preview JD button         | Open JD URL in new tab                        | External link                                            | ✅      |
| Generate resume button    | Trigger Sonnet resume tailoring               | `POST /api/generate-resume`                              | ✅      |
| Draft state on job cards  | Badge + "View Draft →" for jobs with drafts   | `GET /api/applications` cross-ref by `jd_hash`           | ✅      |
| Drafts ready section      | Show pending drafts (max 3)                   | `GET /api/applications?status=draft,docs_copied&limit=3` | ✅      |
| Pipeline card             | Submitted / Pending / Response counts         | `GET /api/applications/summary`                          | ✅      |


**User flow:**

1. User opens app → stats and top picks load; cards with existing drafts show "View Draft →"
2. User reviews top picks → clicks "Generate resume" on chosen JD
3. App calls Sonnet → card immediately shows "✓ Draft ready" badge + "View Draft →"
4. User navigates to Drafts tab to generate docs + apply

---

### 3.2 Search Tab

**Purpose:** Full-text and filter-based exploration of all collected JDs.


| Component               | Function                                       | API                               | Status                          |
| ----------------------- | ---------------------------------------------- | --------------------------------- | ------------------------------- |
| Filter bar (role)       | All / DA / DS / DE                             | `GET /api/queue?role=`            | ⏳ Phase 5                       |
| Filter bar (region)     | All / Melbourne / Korea / Singapore / Malaysia | `GET /api/queue?region=`          | ⏳ Phase 5                       |
| Filter bar (source)     | All / LinkedIn / Seek / Adzuna                 | `GET /api/queue?source=`          | ⏳ Phase 5                       |
| Search input            | Text search by title + company                 | `GET /api/queue?q=`               | ⏳ Phase 5 (API needs `q` param) |
| Sort dropdown           | Newest / Oldest / Score desc                   | `GET /api/queue?sort=`            | ⏳ Phase 5                       |
| Result list (paginated) | Job cards with same layout as Home top picks   | `GET /api/queue?limit=20&offset=` | ⏳ Phase 5                       |
| Generate resume button  | Same as Home tab                               | `POST /api/generate-resume`       | ⏳ Phase 5                       |


---

### 3.3 Drafts Tab

**Purpose:** Manage generated resume drafts before submission.


| Component              | Function                                                       | API                                   | Status |
| ---------------------- | -------------------------------------------------------------- | ------------------------------------- | ------ |
| Status filter          | All / Draft / Docs copied / Submitted                          | `GET /api/applications?status=`       | ✅      |
| Draft card             | Show role badge, generation time, status indicators            | `GET /api/applications`               | ✅      |
| Resume changes preview | Display resume-changes.md content (modal or expand)            | `GET /api/applications/:id`           | ✅      |
| Generate Docs button   | Copy base resume → Trimmed folder; becomes "Open Resume" after | `POST /api/docs/copy-base`            | ✅      |
| Open Resume button     | Opens created Google Doc (replaces Generate Docs after copy)   | External link                         | ✅      |
| Mark applied button    | Update status to submitted + sync to Sheets                    | `POST /api/applications/mark-applied` | ✅      |


**User flow:**

1. User opens Drafts tab → sees all generated drafts
2. User clicks Generate Docs → API copies base resume to Trimmed folder
3. User opens new Google Doc → manually applies resume-changes → exports PDF
4. User submits to employer → returns to app → clicks Mark applied
5. App updates Supabase + Google Sheets row

---

### 3.4 Pipeline Tab

**Purpose:** Track full application lifecycle and outcomes.


| Component              | Function                                              | API                             | Status |
| ---------------------- | ----------------------------------------------------- | ------------------------------- | ------ |
| Stats row              | Submitted / Pending / Interview / Offer counts        | `GET /api/applications/summary` | ✅      |
| Status filter          | All / Submitted / Interview / Rejected                | `GET /api/applications?status=` | ✅      |
| Sort dropdown          | Newest / Oldest / Response date                       | `GET /api/applications?sort=`   | ✅      |
| Application table      | Date / Company / Role / Tier / Suit% / Status / Notes | `GET /api/applications`         | ✅      |
| Status update dropdown | Inline edit per row                                   | `PATCH /api/applications/:id`   | ✅      |
| Notes inline edit      | Editable text per row                                 | `PATCH /api/applications/:id`   | ✅      |
| Sync to Sheets button  | Push all changes to Google Sheets                     | `POST /api/sheets/sync`         | ✅      |
| View JD link           | Open original JD URL                                  | External link                   | ✅      |
| View doc link          | Open Google Doc                                       | External link                   | ✅      |


---

### 3.5 Profile Tab

**Purpose:** Collection health monitoring + app settings.


| Component                   | Function                                                   | API                                | Status     |
| --------------------------- | ---------------------------------------------------------- | ---------------------------------- | ---------- |
| User info card              | Name, target roles, target regions                         | Static or `GET /api/config`        | ⏳ Phase 5  |
| **Today's collection card** | `N runs · M new JDs` (sliding 24h window)                  | `GET /api/collection-runs/summary` | ⏳ Phase 5  |
| **Last new JD timestamp**   | "Last new JD: 23 min ago"                                  | `GET /api/collection-runs/summary` | ⏳ Phase 5  |
| **This week summary card**  | `N runs · M new JDs` (sliding 7d window)                   | `GET /api/collection-runs/summary` | ⏳ Phase 5  |
| API connection status       | Anthropic / Google Docs / Sheets / Adzuna / WorkNet status | `GET /api/config/health`           | 💤 Phase B |
| Settings toggles            | Auto-rank / Notify threshold                               | `GET/PATCH /api/config`            | 💤 Phase B |
| Reconnect button            | Re-trigger OAuth flow if token expired                     | UI only (manual script)            | 💤 Phase B |


**Today's collection card spec:**

- "Today" = sliding 24h window (NOT calendar day boundary in MVP — calendar-aware version is Phase 5.1 if needed)
- Display format: `8 runs · 12 new JDs`
- Empty state: `No runs today` (when 0 runs)

**Last new JD timestamp spec:**

- Source: `MAX(seen_jobs.first_seen)`
- Display format: relative time (`23 min ago`, `2 hours ago`, `yesterday`)
- Empty state: `No JDs collected yet`

---

## 4. API Endpoint Index

Complete API surface with implementation status.

### Queue endpoints


| Method | Path               | Purpose                         | Status |
| ------ | ------------------ | ------------------------------- | ------ |
| GET    | `/api/queue/stats` | Raw / New / Target / Top counts | ✅      |
| GET    | `/api/queue`       | Paginated job list with filters | ✅      |


### Scoring & Generation


| Method | Path                   | Purpose                             | Status |
| ------ | ---------------------- | ----------------------------------- | ------ |
| POST   | `/api/rank`            | Score N unscored jobs with Haiku    | ✅      |
| POST   | `/api/generate-resume` | Generate resume-changes with Sonnet | ✅      |


### Document automation


| Method | Path                      | Purpose                            | Status       |
| ------ | ------------------------- | ---------------------------------- | ------------ |
| POST   | `/api/docs/copy-base`     | Copy base resume to Trimmed folder | ✅            |
| POST   | `/api/docs/apply-changes` | Auto-apply resume-changes to doc   | 💤 (Phase B) |


### Application management


| Method | Path                             | Purpose                            | Status |
| ------ | -------------------------------- | ---------------------------------- | ------ |
| GET    | `/api/applications`              | List all applications with filters | ✅      |
| GET    | `/api/applications/summary`      | Pipeline counts                    | ✅      |
| GET    | `/api/applications/:id`          | Single application detail          | ✅      |
| PATCH  | `/api/applications/:id`          | Update status / notes / response   | ✅      |
| POST   | `/api/applications/mark-applied` | Mark submitted + sync Sheets       | ✅      |


### Collection monitoring


| Method | Path                           | Purpose                                        | Status     |
| ------ | ------------------------------ | ---------------------------------------------- | ---------- |
| GET    | `/api/collection-runs/summary` | Today/Week aggregates + last new JD timestamp  | ⏳ Phase 5  |
| GET    | `/api/collection-runs/latest`  | Most recent run details (per-source breakdown) | 💤 Phase B |


### Sheets sync


| Method | Path               | Purpose                     | Status |
| ------ | ------------------ | --------------------------- | ------ |
| POST   | `/api/sheets/sync` | Full Supabase → Sheets sync | ✅      |


### Configuration


| Method | Path                 | Purpose                     | Status     |
| ------ | -------------------- | --------------------------- | ---------- |
| GET    | `/api/config`        | Read user settings          | 💤 Phase B |
| PATCH  | `/api/config`        | Update user settings        | 💤 Phase B |
| GET    | `/api/config/health` | API connection status check | 💤 Phase B |


### Notifications (Phase 5.1)


| Method | Path                      | Purpose                               | Status      |
| ------ | ------------------------- | ------------------------------------- | ----------- |
| POST   | `/api/notify-subscribe`   | Save Web Push subscription            | ⏳ Phase 5.1 |
| POST   | `/api/notify-push`        | Send push notification (cron-invoked) | ⏳ Phase 5.1 |
| DELETE | `/api/notify-unsubscribe` | Remove push subscription              | ⏳ Phase 5.1 |


### Collection (manual trigger — Phase B)


| Method | Path                      | Purpose                                  | Status     |
| ------ | ------------------------- | ---------------------------------------- | ---------- |
| POST   | `/api/collection/trigger` | Manually trigger GitHub Actions workflow | 💤 Phase B |


---

## 5. Roadmap by Phase

### Phase 1 — Foundation ✅ COMPLETE

- Supabase project + 3 tables (seen_jobs, applications, collection_runs)
- SQLite → Supabase migration (76 jobs)
- Next.js 16 + Vercel deployment
- Repository setup + environment variables

### Phase 2 — Core Read APIs ✅ COMPLETE

- `GET /api/queue/stats`
- `GET /api/queue`
- Home tab UI with live data
- Mobile-responsive layout matching design system

### Phase 3 — AI & Document APIs ✅ COMPLETE

- `POST /api/rank` (Haiku scoring)
- `POST /api/generate-resume` (Sonnet tailoring)
- `POST /api/docs/copy-base` (user OAuth Drive copy)
- `GET /api/applications` + `/summary`
- OAuth setup (Drive scope) + JSON env var formatting

### Phase 4 — UI Wiring & Drafts/Pipeline ✅ COMPLETE

**Goal:** Connect all built APIs to UI and complete remaining tabs.

Completed:

1. ✅ Wire Home tab buttons to live APIs (rank, generate-resume, summary, drafts ready)
2. ✅ Build Drafts tab UI + status filter, resume-changes preview, Generate Docs, Mark applied
3. ✅ Build Pipeline tab UI + status dropdown, notes inline edit, sort/filter
4. ✅ Add `GET /api/applications/:id` for detail view
5. ✅ Add `PATCH /api/applications/:id` for status/notes update
6. ✅ Add `POST /api/applications/mark-applied` (Supabase + Google Sheets sync)
7. ✅ Add `POST /api/sheets/sync` (one-way Supabase → Sheets)
8. ✅ Home tab duplicate prevention — job cards show draft state badge + "View Draft →"
9. ✅ Drafts tab "Generate Docs" → "Open Resume" button transition with optimistic update
10. ✅ Google OAuth switched to [gayoung.dan.data@gmail.com](mailto:gayoung.dan.data@gmail.com)

---

### Phase 5 — Cloud Collection & Profile Tab ⏳ PLANNED

**Goal:** Replace local SQLite collection with cloud-based GitHub Actions cron pushing to Supabase. Add Profile tab collection health monitoring. Complete Search tab.

**Non-goals (explicit):**

- Email digest (deleted from scope — user feedback: low action conversion)
- Push notifications (deferred to Phase 5.1 pending usage data)
- Settings persistence (`/api/config` deferred to Phase B)

#### Task 1 — Supabase write layer (Python)

**File:** `job-search/scripts/supabase_utils.py` (new)

Implements atomic UPSERT helpers replacing SQLite `mark_seen()` for cloud collection.

**Functions:**

- `get_client() -> Client` — lazy singleton, uses `SUPABASE_SERVICE_ROLE_KEY`
- `upsert_job(job, classified_role, queued) -> bool` — atomic UPSERT, returns True if new
- `log_collection_run(source, raw_count, new_count, sources_breakdown)` — append to `collection_runs`
- `push_jobs_to_supabase(jobs, source, classify_fn) -> tuple[int, int]` — batch entry point for collectors

**Idempotency contract:**

```sql
-- Equivalent SQL semantics for upsert_job():
INSERT INTO seen_jobs (...) VALUES (...)
ON CONFLICT (hash) DO UPDATE SET
  last_seen = NOW(),
  times_seen = seen_jobs.times_seen + 1,
  queued = GREATEST(seen_jobs.queued, EXCLUDED.queued),
  classified_role = EXCLUDED.classified_role,
  source_region = EXCLUDED.source_region;
```

Existing `_utils.py` (SQLite layer) remains untouched — supports local/dev fallback.

**Acceptance criteria:**

- Calling `upsert_job()` twice with the same `JobPost` produces no PK violation
- After two calls: `times_seen=2`, `last_seen` updated, `first_seen` immutable
- `push_jobs_to_supabase()` returns accurate `(raw_count, new_count)` tuple
- `collection_runs` row inserted on every batch call

#### Task 2 — Modify collectors to dual-write

**Files:** `job-search/scripts/1_collect_alerts.py`, `1_collect_adzuna.py`, `2_dedup_only.py`

Add `--push-supabase` (collectors) and `--supabase` (dedup) CLI flags. Default behavior preserves existing SQLite-only flow.

`**1_collect_alerts.py`:**

- After existing local SQLite write, if `--push-supabase` flag set, call `push_jobs_to_supabase(jobs, source='gmail', classify_fn=...)`
- `classify_fn` reuses existing `classify_role()` from `2_dedup_only.py`

`**1_collect_adzuna.py`:**

- Same pattern as alerts. `source='adzuna'`.

`**2_dedup_only.py`:**

- When `--supabase` flag set, run dedup against Supabase `seen_jobs` instead of SQLite
- Update `queued=1` for newly-classified target-role JDs (DA/DS/DE)

**Acceptance criteria:**

- Running with no flags: SQLite-only (unchanged behavior)
- Running with `--push-supabase`: writes to both SQLite (local) and Supabase (cloud)
- Manual smoke test: invoke with `--push-supabase` locally → verify Supabase row count increases

#### Task 3 — GitHub Actions workflows

**Files:** `.github/workflows/collect-gmail.yml`, `.github/workflows/collect-adzuna.yml`

**Cron schedule (UTC ↔ AEST mapping):**


| Workflow             | Cron (UTC)                   | AEST Equivalent                                |
| -------------------- | ---------------------------- | ---------------------------------------------- |
| `collect-gmail.yml`  | `0 22,0,2,4,6,8,10,12 * * `* | 8am, 10am, 12pm, 2pm, 4pm, 6pm, 8pm, 10pm AEST |
| `collect-adzuna.yml` | `0 14 * * *`                 | 12am AEST                                      |


**Rationale:**

- Gmail 8 runs/day @ 2hr interval = matches LinkedIn alert email cadence (1.5–2hr observed)
- Adzuna 1 run/day = Adzuna free tier quota preservation (~250 calls/month)
- Schedule terminates at 10pm AEST = before user typical sleep (1am AEST)

**Workflow structure (both files):**

```yaml
on:
  schedule:
    - cron: '<as above>'
  workflow_dispatch:  # manual trigger for debugging

concurrency:
  group: collect-<source>
  cancel-in-progress: false  # let running jobs finish (no race)

jobs:
  collect:
    runs-on: ubuntu-latest
    timeout-minutes: 10  # gmail: 10, adzuna: 5
    steps:
      - checkout
      - setup-python (3.11, pip cache)
      - install deps (job-search/requirements.txt + supabase)
      - restore credentials (gmail-only — write secrets to .credentials/)
      - run collection script with --push-supabase
      - run dedup with --supabase
```

**Acceptance criteria:**

- `workflow_dispatch` succeeds end-to-end: secrets resolved → script runs → Supabase row inserted → `collection_runs` audit row created
- Two consecutive runs (manual): second run does NOT cause PK violations
- Failure visible in GitHub Actions UI (no silent failures)

#### Task 4 — GitHub Secrets configuration

**Required secrets (6):**


| Secret name                 | Source / format                                                       |
| --------------------------- | --------------------------------------------------------------------- |
| `SUPABASE_URL`              | From Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`)                     |
| `SUPABASE_SERVICE_ROLE_KEY` | From Supabase project settings (NOT anon key)                         |
| `ADZUNA_APP_ID`             | From `.env` `ADZUNA_APP_ID`                                           |
| `ADZUNA_APP_KEY`            | From `.env` `ADZUNA_APP_KEY`                                          |
| `GMAIL_CREDENTIALS_JSON`    | Single-line JSON: `cat .credentials/gmail-credentials.json | jq -c .` |
| `GMAIL_TOKEN_JSON`          | Single-line JSON: `cat .credentials/gmail-token.json | jq -c .`       |


**Acceptance criteria:**

- All 6 secrets present in repo Settings → Secrets → Actions
- Workflow can read all secrets (verified via `workflow_dispatch` smoke test)

#### Task 5 — Profile tab + collection summary API

**Files:**

- `app/api/collection-runs/summary/route.ts` (new)
- `app/profile/page.tsx` (new) or update existing

**API contract — `GET /api/collection-runs/summary`:**

Request: no params

Response:

```json
{
  "today": {
    "runs": 8,
    "new_jds": 12,
    "last_new_jd_at": "2026-05-04T13:42:00Z"
  },
  "week": {
    "runs": 56,
    "new_jds": 89
  }
}
```

Implementation:

- Today = `run_at >= NOW() - INTERVAL '24 hours'` (sliding window, NOT calendar day)
- Week = `run_at >= NOW() - INTERVAL '7 days'`
- `last_new_jd_at` = `MAX(seen_jobs.first_seen)`
- Empty state: `runs=0`, `new_jds=0`, `last_new_jd_at=null`

**UI components (Profile tab):**

- Today's collection card: `{runs} runs · {new_jds} new JDs`
- Last new JD card: `Last new JD: {relative_time}` (e.g., `23 min ago`)
- Week summary card: `{runs} runs · {new_jds} new JDs`
- Static user info card: name, target roles, target regions (DA/DS/DE; MEL/KR/SG/MY)

**Acceptance criteria:**

- Card values match `SELECT COUNT(*), SUM(new_count) FROM collection_runs WHERE ...` direct query
- Empty state displays correctly when no runs in period
- Mobile (390px) layout matches `DESIGN_SYSTEM.md` card spec

#### Task 6 — Search tab UI + filters

**Files:**

- `app/api/queue/route.ts` (modify — add `q` param)
- `app/search/page.tsx` (new)

**API additions — `GET /api/queue`:**

- `?q=string` — case-insensitive ILIKE on `title` + `company`
- `?role=DA|DS|DE` — already supported, document
- `?region=melbourne|korea|singapore|malaysia` — already supported
- `?source=linkedin|seek|adzuna` — already supported
- `?sort=newest|oldest|score` — `newest` = `first_seen DESC`, `score` = `score DESC NULLS LAST`
- `?limit=20&offset=N` — pagination

**UI components:**

- Filter bar: 3 dropdowns (role, region, source) + search input
- Sort dropdown
- Result list: same card layout as Home top picks
- Pagination: load more button OR infinite scroll (TBD during implementation)

**Acceptance criteria:**

- Empty `q` parameter returns all results (no error)
- Filter combinations work: e.g., `?role=DA&region=melbourne&q=analyst`
- Pagination preserves filters across pages

#### Phase 5 Rollout sequence

```
Day 1:  Task 1 (supabase_utils.py)         — verify locally
Day 2:  Task 2 (collector flags)            — verify with --push-supabase locally
Day 3:  Task 3 + 4 (workflows + secrets)    — workflow_dispatch smoke test
Day 4:  Task 5 (Profile tab + summary API)
Day 5:  Task 6 (Search tab)
Day 6:  End-to-end test: let cron run for 24h → verify Profile tab numbers match DB
```

#### Known dependencies & blockers

- **Gmail OAuth token rotation:** `GMAIL_TOKEN_JSON` may need refresh if 7+ days inactive. Increased cron frequency (8x/day) reduces this risk.
- **Adzuna free tier quota:** ~250 calls/month assumed. Monitor first 7 days of cloud cron for actual usage.
- **WorkNet API:** still in application — when keys arrive, add 3rd workflow `collect-worknet.yml` with same pattern.
- **Existing local SQLite:** unchanged. Local `/apply` workflow continues to function with SQLite during cloud cron rollout.

---

### Phase 5.1 — Mobile Push Notifications (PWA) ⏳ DEFERRED

**Trigger condition:** After 2-3 weeks of Phase 5 production use, evaluate whether passive dashboard pull is sufficient or push notifications would meaningfully change application throughput.

**Goal:** iPhone 16 Pro (iOS 18+) Web Push notifications for high-score new JDs.

**Tasks:**

1. **PWA conversion**
  - Add `next-pwa` package OR manual service worker
  - Create `public/manifest.json` with app name, icons (192px, 512px), theme color (`#4682bf`)
  - Create `public/sw.js` with push event handler
  - Verify PWA installability on iOS Safari (16.4+ required)
2. **VAPID keys + DB**
  - Generate VAPID key pair (one-time)
  - Add to env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
  - New table: `push_subscriptions (endpoint TEXT PK, p256dh TEXT, auth TEXT, created_at TIMESTAMPTZ)`
3. **Subscribe / unsubscribe APIs**
  - `POST /api/notify-subscribe` — save subscription on user opt-in
  - `DELETE /api/notify-unsubscribe` — remove subscription
4. **Push trigger**
  - `POST /api/notify-push` — invoked from cron after successful collection
  - Filter: only trigger for new JDs with `score >= 85` (TBD threshold)
  - Use `web-push` library (Node.js, MIT)
5. **Settings UI**
  - Profile tab: notifications ON/OFF toggle
  - Threshold slider (default 85)

**iOS Safari constraints (verified at implementation time):**

- Must be installed via "Add to Home Screen" — push fails on regular Safari tabs
- iOS 16.4+ required (iPhone 16 Pro on iOS 18+ ✅)
- User must grant notification permission on first launch (one-time)

**Estimated effort:** 4-6 hours implementation + iOS device testing.

**Acceptance criteria:**

- After installing PWA on iPhone 16 Pro and granting permission, a test JD with `score >= 85` arriving via cron triggers a system notification on the device
- Tapping notification opens the app to the relevant JD card

---

### Phase B — Backlog 💤

Items deferred indefinitely or pending business case validation.

- `POST /api/docs/apply-changes` — Auto-apply resume-changes to Google Doc
- `POST /api/collection/trigger` — Manual refresh button (currently: `workflow_dispatch` from GitHub UI)
- `GET /api/collection-runs/latest` — Detailed per-source run breakdown
- `GET/PATCH /api/config` — User settings persistence (auto-rank, notify threshold)
- `GET /api/config/health` — Live API connection status check
- Bi-directional Sheets sync (currently: app → Sheets only)
- Cold email outreach feature (separate scope from notifications)

---

### Known Issues

#### Phase 4

- **Supabase batch update quirk:** `copy-base` API combined `.update().select()` returns 0 rows; fallback to individual field updates works. Root cause: likely PostgREST/trigger interaction. Non-blocking — all data persists correctly.
- **One-way sync only:** App → Google Drive. Drive-side deletions are not reflected in the app.

#### Phase 5 (anticipated)

- **GitHub Actions failure noise:** 8 cron runs/day × any persistent error = 8+ failure emails/day. Mitigation if it becomes problematic: add throttled notification (notify only after N consecutive failures) — Phase 5.1 candidate.
- **Sliding 24h window vs calendar day:** Profile "Today's collection" uses 24h sliding window for simplicity. Edge case: at 11:59pm AEST, "today" includes runs from yesterday afternoon. Calendar-aware version is Phase 5.1 if it becomes confusing in practice.

---

## 6. Cost Tracking


| Service                    | Tier      | Monthly Cost     | Notes                                           |
| -------------------------- | --------- | ---------------- | ----------------------------------------------- |
| Anthropic API (Haiku)      | Pay-as-go | ~$1              | ~10 rank calls/day                              |
| Anthropic API (Sonnet)     | Pay-as-go | ~$15-30          | ~10-20 generate calls/day                       |
| Anthropic Pro subscription | Fixed     | $20              | Required for Claude Code (existing)             |
| Vercel                     | Hobby     | $0               | 100 GB-hrs functions, 100 GB bandwidth          |
| Supabase                   | Free      | $0               | 500 MB DB, 5 GB transfer                        |
| GitHub Actions             | Free      | $0               | Private repo, ~180 min/month at Phase 5 cadence |
| Google Workspace APIs      | Free      | $0               | Within standard quotas                          |
| **Total**                  |           | **$36-51/month** |                                                 |


**Note on Phase 5 GitHub Actions usage:**

- Gmail workflow: 8 runs/day × ~1.5 min × 30 days = 360 min/month
- Adzuna workflow: 1 run/day × ~1 min × 30 days = 30 min/month
- Combined: ~390 min/month = 19.5% of free 2000 min/month quota ✅

---

## 7. Constraints & Non-Goals

### Hard constraints

- **Single user only** — no multi-tenancy, no auth UI
- **Resume content immutable** — never invent metrics, technologies, or projects (see `PIPELINE_RULES.md` hard constraints)
- **Manual submission** — app generates drafts, user submits to employer manually
- **No auto-apply** — Mark applied is always user-initiated
- **Atomic upsert** — all `seen_jobs` writes use `ON CONFLICT (hash)` semantics

### Out of scope (by design)

- Multi-user accounts or sharing
- Automated job application submission to employer portals
- Interview scheduling integration
- Salary negotiation tools
- Recruiter contact management (separate cold email feature in Phase B)
- **Email digest** (removed from roadmap — low user action conversion)

---

## 8. Reference Documents


| Document                    | Purpose                                           |
| --------------------------- | ------------------------------------------------- |
| `DESIGN_SYSTEM.md`          | UI color palette, component specs, typography     |
| `PIPELINE_RULES.md`         | `/apply` pipeline logic + ATS keyword rules       |
| `skills-matrix.md`          | Verified technical stack (resume source of truth) |
| `projects-inventory.md`     | Project portfolio (resume swap candidates)        |
| `job_engine_mobile_v2.html` | Original UI mockup                                |
| `CLAUDE.md`                 | Technical memory for Claude Code sessions         |
| `AGENTS.md`                 | Cursor agent operational context                  |


---

## 9. Change Log


| Date       | Phase        | Summary                                                                                                                                                            |
| ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-02 | Phase 1-2    | Initial setup, deployment, queue APIs, Home tab                                                                                                                    |
| 2026-05-03 | Phase 3      | Rank, generate-resume, docs/copy-base APIs + OAuth                                                                                                                 |
| 2026-05-03 | Phase 4      | Home API wiring, Drafts tab, Pipeline tab, 4 new APIs                                                                                                              |
| 2026-05-03 | Phase 4.1    | UX fixes: draft state on Home cards, Generate Docs → Open Resume, duplicate prevention, OAuth account switch                                                       |
| 2026-05-04 | Phase 5 spec | Cloud collection cadence finalized (Gmail 8x/day @ 2hr, Adzuna 1x/day); email digest removed; Profile tab spec'd; Phase 5.1 (PWA push) deferred pending usage data |
| *TBD*      | Phase 5      | Implementation: supabase_utils.py, dual-write collectors, GH Actions workflows, Profile tab, Search tab                                                            |


