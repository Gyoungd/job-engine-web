import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

const APPLIED_STATUSES = ['submitted', 'sent_cold', 'online_test', 'interview', 'offer'] as const

type AppRow = {
  id: string
  status: string
  doc_url: string | null
  submitted_at: string | null
  created_at: string
}

type SeenJobRow = Record<string, unknown>

type JobWithApp = SeenJobRow & { application: AppRow | null }

function isAppliedStatus(status: string | undefined): boolean {
  return !!status && (APPLIED_STATUSES as readonly string[]).includes(status)
}

async function fetchLatestApplicationsByHash(hashes: string[]): Promise<Map<string, AppRow>> {
  const map = new Map<string, AppRow>()
  const unique = [...new Set(hashes.filter(Boolean))]
  const chunkSize = 150
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const { data: apps, error } = await supabaseAdmin
      .from('applications')
      .select('id, jd_hash, status, doc_url, submitted_at, created_at')
      .in('jd_hash', chunk)
    if (error) throw error
    for (const row of apps ?? []) {
      const h = row.jd_hash as string
      const cur = map.get(h)
      const next: AppRow = {
        id: row.id as string,
        status: row.status as string,
        doc_url: (row.doc_url as string | null) ?? null,
        submitted_at: (row.submitted_at as string | null) ?? null,
        created_at: row.created_at as string,
      }
      if (!cur || new Date(next.created_at).getTime() > new Date(cur.created_at).getTime()) {
        map.set(h, next)
      }
    }
  }
  return map
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySeenJobFilters(q: any, opts: {
    filter: string
    role: string
    region: string
    source: string
    search: string
    scoreGte: number | null
  }) {
  let query = q
  if (opts.search) {
    query = query.or(`title.ilike.%${opts.search}%,company.ilike.%${opts.search}%`)
  }
  if (opts.filter === 'ranked') {
    query = query.not('score', 'is', null)
  } else if (opts.filter === 'new') {
    query = query.eq('queued', true)
  }
  if (opts.role !== 'all') query = query.eq('classified_role', opts.role)
  if (opts.region !== 'all') query = query.eq('source_region', opts.region)
  if (opts.source !== 'all') query = query.eq('source', opts.source)
  if (opts.scoreGte != null && !Number.isNaN(opts.scoreGte)) {
    query = query.gte('score', opts.scoreGte)
  }
  // Hide manually expired jobs
  query = query.eq('is_expired', false)
  // 14-day stale filter: use posted_at if present, else fall back to first_seen
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  query = query.or(`posted_at.gte.${cutoff},and(posted_at.is.null,first_seen.gte.${cutoff})`)
  return query
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applySeenJobOrder(q: any, filter: string, sort: string) {
  if (sort === 'oldest') {
    return q.order('first_seen', { ascending: true })
  }
  if (sort === 'score') {
    return q.order('score', { ascending: false, nullsFirst: false })
  }
  if (filter === 'ranked') {
    return q.order('score', { ascending: false })
  }
  return q.order('first_seen', { ascending: false })
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const filter = sp.get('filter') ?? 'all'
    const role = sp.get('role') ?? 'all'
    const region = sp.get('region') ?? 'all'
    const source = sp.get('source') ?? 'all'
    const sort = sp.get('sort') ?? ''
    const search = sp.get('q') ?? ''
    const limit = Math.min(parseInt(sp.get('limit') ?? '20'), 100)
    const offset = parseInt(sp.get('offset') ?? '0')
    const includeApplication = sp.get('include_application') === 'true'
    const excludeStatus = sp.get('exclude_status') ?? ''
    const scoreGteParam = sp.get('score_gte')
    const scoreGte = scoreGteParam != null && scoreGteParam !== '' ? Number(scoreGteParam) : null

    const excludeSet = new Set(
      excludeStatus.split(',').map(s => s.trim()).filter(Boolean),
    )

    const filterOpts = { filter, role, region, source, search, scoreGte }

    if (!includeApplication) {
      let q = applySeenJobFilters(
        supabaseAdmin.from('seen_jobs').select('*', { count: 'exact' }),
        filterOpts,
      )
      q = applySeenJobOrder(q, filter, sort)
      q = q.range(offset, offset + limit - 1)
      const { data, count, error } = await q
      if (error) throw error
      return NextResponse.json({
        jobs: data ?? [],
        total: count ?? 0,
      })
    }

    let q = applySeenJobFilters(
      supabaseAdmin.from('seen_jobs').select('*'),
      filterOpts,
    )
    q = applySeenJobOrder(q, filter, sort)
    q = q.limit(2000)

    const { data: jobRows, error } = await q
    if (error) throw error

    const rows = (jobRows ?? []) as SeenJobRow[]
    const hashes = rows.map(r => r.hash as string)
    const appByHash = await fetchLatestApplicationsByHash(hashes)

    let jobs: JobWithApp[] = rows.map(row => {
      const hash = row.hash as string
      const application = appByHash.get(hash) ?? null
      return { ...row, application }
    })

    if (excludeSet.size > 0) {
      jobs = jobs.filter(
        j => !j.application || !excludeSet.has(j.application.status),
      )
    }

    if (filter === 'ranked') {
      jobs.sort((a, b) => {
        const aApplied = isAppliedStatus(a.application?.status)
        const bApplied = isAppliedStatus(b.application?.status)
        const aActive = aApplied ? 0 : 1
        const bActive = bApplied ? 0 : 1
        if (aActive !== bActive) return bActive - aActive
        const aScore = (a.score as number | null | undefined) ?? -1
        const bScore = (b.score as number | null | undefined) ?? -1
        if (aScore !== bScore) return bScore - aScore
        const aFs = (a.first_seen as string) ?? ''
        const bFs = (b.first_seen as string) ?? ''
        return new Date(bFs).getTime() - new Date(aFs).getTime()
      })
    }

    const total = jobs.length
    const paginated = jobs.slice(offset, offset + limit)

    return NextResponse.json({
      jobs: paginated,
      total,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
