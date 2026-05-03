import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const status = sp.get('status')  // comma-separated: draft,docs_copied
    const limit = Math.min(parseInt(sp.get('limit') ?? '20'), 100)
    const offset = parseInt(sp.get('offset') ?? '0')

    let q = supabaseAdmin
      .from('applications')
      .select('*, seen_jobs!inner(title, company, location, url, classified_role, score)', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (status) {
      const statuses = status.split(',').map(s => s.trim())
      q = q.in('status', statuses)
    }

    q = q.range(offset, offset + limit - 1)

    const { data, count, error } = await q
    if (error) throw error

    return NextResponse.json({
      applications: data ?? [],
      total: count ?? 0,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}