import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function GET() {
  try {
    const [submittedRes, pendingRes, responseRes] = await Promise.all([
      supabaseAdmin
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'submitted'),
      supabaseAdmin
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .in('status', ['draft', 'docs_copied']),
      supabaseAdmin
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .not('response_status', 'is', null),
    ])

    return NextResponse.json({
      submitted: submittedRes.count ?? 0,
      pending: pendingRes.count ?? 0,
      response: responseRes.count ?? 0,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}