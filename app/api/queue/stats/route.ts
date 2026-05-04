import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  try {
    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString()
    const oneDayAgo = new Date(
      Date.now() - 24 * 60 * 60 * 1000
    ).toISOString()

    const [rawRes, newRes, targetRes, topRes] = await Promise.all([
      supabaseAdmin
        .from('seen_jobs')
        .select('*', { count: 'exact', head: true })
        .gte('first_seen', sevenDaysAgo),

      supabaseAdmin
        .from('seen_jobs')
        .select('*', { count: 'exact', head: true })
        .gte('posted_at', oneDayAgo),

      supabaseAdmin
        .from('seen_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('queued', true)
        .in('classified_role', ['DA', 'DS', 'DE']),

      supabaseAdmin
        .from('seen_jobs')
        .select('*', { count: 'exact', head: true })
        .gte('score', 80),
    ])

    return NextResponse.json({
      raw: rawRes.count ?? 0,
      new: newRes.count ?? 0,
      target: targetRes.count ?? 0,
      top: topRes.count ?? 0,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}