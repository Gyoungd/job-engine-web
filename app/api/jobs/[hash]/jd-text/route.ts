import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ hash: string }> },
) {
  try {
    const { hash } = await params
    if (!hash) return NextResponse.json({ error: 'Missing hash' }, { status: 400 })

    const body = await req.json()
    const jd_text: string | undefined = body.jd_text
    if (!jd_text?.trim()) return NextResponse.json({ error: 'jd_text required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('seen_jobs')
      .update({ jd_text: jd_text.trim() })
      .eq('hash', hash)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
