import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import crypto from 'crypto'

function norm(s: string): string {
  return (s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const company: string = body.company ?? ''
    const title: string = body.title ?? ''
    const location: string = body.location ?? ''
    const url: string | null = body.url?.trim() || null
    const classifiedRole: string = body.classified_role ?? 'unknown'
    const sourceRegion: string = body.source_region ?? 'unknown'
    const jdText: string | null = body.jd_text?.trim() || null

    if (!company.trim() || !title.trim()) {
      return NextResponse.json({ error: 'company and title are required' }, { status: 400 })
    }

    // Hash logic identical to Python: SHA256(norm(company)|norm(title)|norm(location))
    const key = `${norm(company)}|${norm(title)}|${norm(location)}`
    const hash = crypto.createHash('sha256').update(key, 'utf8').digest('hex')

    const now = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('seen_jobs')
      .upsert(
        {
          hash,
          source: 'manual',
          title: title.trim(),
          company: company.trim(),
          location: location.trim() || null,
          url,
          first_seen: now,
          last_seen: now,
          times_seen: 1,
          queued: 1,
          classified_role: classifiedRole,
          source_region: sourceRegion,
          ...(jdText ? { jd_text: jdText } : {}),
        },
        { onConflict: 'hash', ignoreDuplicates: false },
      )

    if (error) {
      console.error('Failed to upsert job:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ hash, is_new: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
