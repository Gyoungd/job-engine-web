# Database Migrations

## 001_add_posted_at.sql

**Purpose:** Add `posted_at` and `posted_at_source` columns to `seen_jobs` table to track JD posted date (not collection date).

**What it does:**
1. Adds `posted_at` column (TIMESTAMPTZ, nullable) — stores JD posted timestamp
2. Adds `posted_at_source` column (TEXT) — tracks source: `'api'` (Adzuna API), `'estimated_from_alert'` (LinkedIn/Seek), or `'unknown'`
3. Creates index `idx_posted_at` for efficient "posted_at >= X" queries

**Why:** Enables accurate "New 24h" stats based on JD posted date rather than collection date.

### How to Run

#### Option 1: Supabase Dashboard (GUI)

1. Go to [Supabase Dashboard](https://app.supabase.com/) → Your project
2. Navigate to **SQL Editor**
3. Click **+ New Query**
4. Copy-paste the contents of `001_add_posted_at.sql`
5. Click **Run** (or Cmd+Enter)

#### Option 2: Supabase CLI

```bash
supabase db push  # if migrations are in supabase/migrations/
# OR
psql "postgresql://..." < scripts/migrations/001_add_posted_at.sql
```

#### Option 3: Direct Postgres (if you have access)

```bash
psql -U postgres -h your-host -d your-db -f scripts/migrations/001_add_posted_at.sql
```

### Optional: Backfill Existing Data

If you want old rows to count in "New 24h" stats, uncomment the backfill line in the migration:

```sql
UPDATE seen_jobs SET posted_at = first_seen WHERE posted_at IS NULL;
```

**⚠️ Note:** This makes old rows appear as "new" if `first_seen` was within the last 24 hours. Only do this if desired.

### Verification

After migration, verify columns exist:

```sql
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'seen_jobs' AND column_name IN ('posted_at', 'posted_at_source');
```

You should see:
- `posted_at` | `timestamp with time zone`
- `posted_at_source` | `text`

---

## Code Changes Paired with This Migration

### 1. Collection Scripts

**File:** `scripts/collection/supabase_utils.py`
- **Change:** Added `posted_at` and `posted_at_source` to upsert payload

**File:** `scripts/collection/_utils.py`
- **Change:** Updated SQLite schema + migrations + INSERT/UPDATE statements

### 2. API

**File:** `app/api/queue/stats/route.ts`
- **Change:** "New" stat now uses `gte('posted_at', oneDayAgo)` instead of `eq('queued', true)`

### 3. Home Page

**File:** `app/page.tsx`
- **Change:** Added tooltips to stat cards (hover to see what each stat means)

---

## Rollback

If needed to revert:

```sql
ALTER TABLE seen_jobs DROP COLUMN posted_at;
ALTER TABLE seen_jobs DROP COLUMN posted_at_source;
DROP INDEX IF EXISTS idx_posted_at;
```
