import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSheets } from '@/lib/google'

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

    let sheetsSync = false
    if (SHEET_ID) {
      try {
        const sheets = getSheets()
        const job = app.seen_jobs
        await sheets.spreadsheets.values.append({
          spreadsheetId: SHEET_ID,
          range: 'Applications!A:H',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[
              now.slice(0, 10),
              job?.company ?? '',
              job?.title ?? '',
              app.classified_role ?? '',
              app.suitability_pct ?? '',
              'submitted',
              app.doc_url ?? '',
              job?.url ?? '',
            ]],
          },
        })
        sheetsSync = true
      } catch (sheetErr) {
        console.error('Sheets sync failed (non-blocking):', sheetErr)
      }
    }

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
