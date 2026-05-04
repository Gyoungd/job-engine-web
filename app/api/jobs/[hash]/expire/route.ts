import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params
    if (!hash) return NextResponse.json({ error: 'Missing hash' }, { status: 400 })

    const { data: app } = await supabaseAdmin
      .from('applications')
      .select('id')
      .eq('jd_hash', hash)
      .limit(1)
      .maybeSingle()

    if (app) {
      return NextResponse.json(
        { error: 'Cannot expire a job that has an existing application' },
        { status: 409 },
      )
    }

    const { error } = await supabaseAdmin
      .from('seen_jobs')
      .update({ is_expired: true, expired_at: new Date().toISOString() })
      .eq('hash', hash)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
