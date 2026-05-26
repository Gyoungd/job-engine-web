# Job Engine Web

> **An AI-built job search pipeline, shipped end-to-end.**
> Built solo with Claude Code as a working portfolio piece.

**Live:** [job-engine-web.vercel.app](https://job-engine-web.vercel.app)
**Detailed spec:** [PRODUCT_SPEC.md](./PRODUCT_SPEC.md) — full feature
map, API surface, schema, roadmap, change log (~1000 lines).

---

## What it does

A personal mobile-first dashboard that consolidates a complete job-search
workflow:

- **Collect** — pulls postings from Gmail alerts (LinkedIn, Seek) and the
  Adzuna API on a GitHub Actions cron (8 runs/day AEST). Atomic UPSERT
  into Supabase, dedup by hash.
- **Rank** — scores fit against my profile with Claude Haiku 4.5; returns
  a 0–100 score plus a reason.
- **Tailor** — generates a per-job resume diff with Claude Sonnet 4.6.
  Outputs `[ORIGINAL] / [REVISED]` pairs that match the actual base
  resume text in `profile/*.md`.
- **Apply** — copies the base Google Doc and runs the diff via the Docs
  API (`batchUpdate.replaceAllText`). Formatting preserved.
- **Track** — application status moves through Drafts → Submitted →
  Interview → Offer in Supabase, with a fire-and-forget sync to Google
  Sheets.

## Architecture

```
Gmail / Adzuna  →  GitHub Actions  →  Supabase (seen_jobs)
                                        │
                          /api/rank (Haiku)
                                        │
                          /api/generate-resume (Sonnet)
                                        │
                          /api/docs/copy-base (Google Docs batchUpdate)
                                        │
                          applications table  ←→  Google Sheets
```

Frontend: Next.js 16 App Router on Vercel. Auth: Supabase SSR + Google
OAuth, allow-list of one. Public landing page in front of the auth wall;
all API routes return `401` to unauth'd callers via middleware.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind v4, PWA (iOS Add-to-Home-Screen) |
| Backend | Vercel Functions (App Router route handlers) |
| Database | Supabase (PostgreSQL) — `seen_jobs`, `applications`, `collection_runs` |
| AI | Anthropic Claude — Haiku 4.5 (ranking), Sonnet 4.6 (resume tailoring) |
| Storage | Google Drive (OAuth — file copy) + Google Docs API (Service Account — text replace) + Google Sheets (Service Account — pipeline sync) |
| Collection | GitHub Actions cron (Python scripts → Supabase) |
| Hosting | Vercel (Hobby) |

## How it's built

Spec-driven workflow with Claude Code. Every feature starts as a written
spec in [PRODUCT_SPEC.md](./PRODUCT_SPEC.md); Claude Code authors the
implementation under direction. I own the architecture, schema, and
review.

## Status

- **Phase 5** ✅ Cloud collection cron + Profile tab + Search tab
- **Phase 5.1** 🟡 PWA install on iOS — push notifications deferred
- **Phase 5.2** ✅ Top-picks lifecycle (active → applied → pipeline)
- **Phase 5.3** ✅ Stale job handling (`is_expired` + 14-day age filter)
- **Phase 6** ⏳ Auth wall + public landing for portfolio positioning

## Running locally

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build
```

Required environment variables (see `PRODUCT_SPEC.md` § 2 for full
schema): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `GDOC_BASE_PJT`,
`GDOC_BASE_DA` / `DS` / `DE`, plus Google service-account JSON and
Gmail OAuth tokens.

## Project layout

```
app/
  page.tsx              ← public landing (this is what recruiters see)
  dashboard/page.tsx    ← personal dashboard (auth-gated)
  login/                ← Google OAuth entry
  auth/callback         ← Supabase OAuth code exchange
  api/                  ← route handlers (queue, rank, generate-resume,
                          docs, applications, sheets, jobs)
  _landing/             ← landing-only components (Bento + animations)
lib/
  supabase/             ← SSR + browser + middleware clients
  anthropic.ts          ← Claude client
  google.ts             ← Drive/Docs/Sheets clients
  projects.ts           ← Google Docs project block manipulation
  profile-context.ts    ← SKILLS_MATRIX + PROJECTS_INVENTORY
middleware.ts           ← single-user email allow-list, route gating
profile/                ← base resume markdown (DA / DS / DE variants)
scripts/                ← collection scripts (Python)
```

## Author

**Gayoung Dan (Ina)** — Master of Data Science, Monash University (2025).
Melbourne, Australia.

[gayoung.dan.data@gmail.com](mailto:gayoung.dan.data@gmail.com)

---

_For the full engineering detail — every endpoint, every schema column,
every constraint, every phase decision — read
[PRODUCT_SPEC.md](./PRODUCT_SPEC.md)._
