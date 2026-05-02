import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const filter = sp.get('filter') ?? 'all'
    const role   = sp.get('role')   ?? 'all'
    const region = sp.get('region') ?? 'all'
    const source = sp.get('source') ?? 'all'
    const limit  = Math.min(parseInt(sp.get('limit') ?? '20'), 100)
    const offset = parseInt(sp.get('offset') ?? '0')

    let q = supabaseAdmin
      .from('seen_jobs')
      .select('*', { count: 'exact' })

    if (filter === 'ranked') {
      q = q.not('score', 'is', null).order('score', { ascending: false })
    } else if (filter === 'new') {
      q = q.eq('queued', true).order('first_seen', { ascending: false })
    } else {
      q = q.order('first_seen', { ascending: false })
    }

    if (role   !== 'all') q = q.eq('classified_role', role)
    if (region !== 'all') q = q.eq('source_region', region)
    if (source !== 'all') q = q.eq('source', source)

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