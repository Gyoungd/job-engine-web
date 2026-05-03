import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  try {
    const now = new Date()
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const [todayRes, weekRes, lastJdRes] = await Promise.all([
      supabaseAdmin
        .from('collection_runs')
        .select('id, new_count')
        .gte('run_at', h24),

      supabaseAdmin
        .from('collection_runs')
        .select('id, new_count')
        .gte('run_at', d7),

      supabaseAdmin
        .from('seen_jobs')
        .select('first_seen')
        .order('first_seen', { ascending: false })
        .limit(1),
    ])

    if (todayRes.error) throw todayRes.error
    if (weekRes.error) throw weekRes.error
    if (lastJdRes.error) throw lastJdRes.error

    const todayRuns = todayRes.data ?? []
    const weekRuns = weekRes.data ?? []
    const lastJd = lastJdRes.data?.[0]

    return NextResponse.json({
      today: {
        runs: todayRuns.length,
        new_jds: todayRuns.reduce((sum, r) => sum + (r.new_count ?? 0), 0),
        last_new_jd_at: lastJd?.first_seen ?? null,
      },
      week: {
        runs: weekRuns.length,
        new_jds: weekRuns.reduce((sum, r) => sum + (r.new_count ?? 0), 0),
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
