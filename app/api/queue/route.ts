import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const filter = sp.get('filter') ?? 'all'
    const role   = sp.get('role')   ?? 'all'
    const region = sp.get('region') ?? 'all'
    const source = sp.get('source') ?? 'all'
    const sort   = sp.get('sort')   ?? ''
    const search = sp.get('q')      ?? ''
    const limit  = Math.min(parseInt(sp.get('limit') ?? '20'), 100)
    const offset = parseInt(sp.get('offset') ?? '0')

    let q = supabaseAdmin
      .from('seen_jobs')
      .select('*', { count: 'exact' })

    if (search) {
      q = q.or(`title.ilike.%${search}%,company.ilike.%${search}%`)
    }

    if (filter === 'ranked') {
      q = q.not('score', 'is', null)
    } else if (filter === 'new') {
      q = q.eq('queued', true)
    }

    if (role   !== 'all') q = q.eq('classified_role', role)
    if (region !== 'all') q = q.eq('source_region', region)
    if (source !== 'all') q = q.eq('source', source)

    if (sort === 'oldest') {
      q = q.order('first_seen', { ascending: true })
    } else if (sort === 'score') {
      q = q.order('score', { ascending: false, nullsFirst: false })
    } else if (filter === 'ranked') {
      q = q.order('score', { ascending: false })
    } else {
      q = q.order('first_seen', { ascending: false })
    }

    q = q.range(offset, offset + limit - 1)

    const { data, count, error } = await q
    if (error) throw error

    return NextResponse.json({
      jobs: data ?? [],
      total: count ?? 0,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}