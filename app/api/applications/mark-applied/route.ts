import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? ''

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const applicationId: string = body.application_id

    if (!applicationId) {
      return NextResponse.json({ error: 'application_id is required' }, { status: 400 })
    }

    const { data: app, error: appErr } = await supabaseAdmin
      .from('applications')
      .select('*, seen_jobs!inner(title, company, location, url, classified_role)')
      .eq('id', applicationId)
      .single()

    if (appErr || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    const now = new Date().toISOString()
    const { error: updateErr } = await supabaseAdmin
      .from('applications')
      .update({
        status: 'submitted',
        submitted_at: now,
        updated_at: now,
      })
      .eq('id', applicationId)

    if (updateErr) throw updateErr

    // Sheets sync is handled by the frontend's fire-and-forget /api/sheets/sync call
    const sheetsSync = !!SHEET_ID

    return NextResponse.json({
      id: applicationId,
      status: 'submitted',
      submitted_at: now,
      sheets_synced: sheetsSync,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Mark applied error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
