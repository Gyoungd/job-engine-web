
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

---

# Job Engine Web — Project Overview

## Purpose
Automated job application pipeline for Gayoung Dan (Ina). Collects job postings, ranks them, generates tailored resume changes via Claude API, and applies those changes to Google Docs base resumes.

## Pipeline Flow
1. **Collect** — GitHub Actions scrapes job boards → inserts into `seen_jobs` (Supabase)
2. **Rank** — `/api/rank` scores each job using Claude Haiku against candidate's skills/projects
3. **Generate** — `/api/generate-resume` calls Claude Sonnet with base resume + JD → produces [ORIGINAL]/[REVISED] diff + project swap instructions
4. **Apply** — `/api/docs/copy-base` copies Google Docs base resume → `lib/projects.ts` applies project swaps via Google Docs API batchUpdate
5. **Track** — results stored in `applications` table; UI shows status per job

## Key Files

| File | Role |
|---|---|
| `profile/da.md` / `ds.md` / `de.md` | Base resume content (source of truth for Claude's [ORIGINAL] matching) |
| `lib/profile-context.ts` | `SKILLS_MATRIX` + `PROJECTS_INVENTORY` injected into SYSTEM_PROMPT |
| `lib/projects.ts` | Google Docs project block manipulation (find / delete / insert via batchUpdate) |
| `app/api/generate-resume/route.ts` | Main tailoring logic — SYSTEM_PROMPT lives here |
| `app/api/docs/copy-base/route.ts` | Copies Google Docs base doc for a specific role |

## Resume Section Order (current)
Name → Subtitle/Info → Summary → Technical Skills → Professional Experience → Projects → Education

This order must be consistent between:
- `profile/*.md` (plain text sent to Claude for [ORIGINAL] matching)
- Google Docs base documents (actual docs manipulated by batchUpdate)

## Google Docs Section Boundary Conventions
`lib/projects.ts` uses these exact heading strings to navigate documents:
- `PROJECTS` — section start marker
- `EDUCATION` — stop boundary for project block search and section-end detection

If section heading text in Google Docs changes, update the string constants in `lib/projects.ts` accordingly.

## Role Classification
- `DA` — Data Analyst (default fallback)
- `DS` — Data Scientist (triggered by: scientist, machine learning, ml, statistical model, nlp, deep learning)
- `DE` — Data Engineer (triggered by: engineer, pipeline, etl, streaming, platform, infrastructure, architect)
- Pre-classification in `route.ts:preClassifyRole()` selects which `profile/*.md` to load before Claude call

## Environment Variables Required
- `ANTHROPIC_API_KEY` — Claude API
- `GDOC_BASE_PJT` — Google Docs ID of the project base document (for project swap source)
- `GDOC_BASE_DA` / `GDOC_BASE_DS` / `GDOC_BASE_DE` — base resume doc IDs per role (used by copy-base)
- Supabase keys — see Supabase dashboard

