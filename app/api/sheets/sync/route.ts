import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSheets } from '@/lib/google'

const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? ''

export async function POST() {
  try {
    if (!SHEET_ID) {
      return NextResponse.json({ error: 'GOOGLE_SHEET_ID not configured' }, { status: 500 })
    }

    const { data: apps, error } = await supabaseAdmin
      .from('applications')
      .select('*, seen_jobs!inner(title, company, location, url, classified_role)')
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: false })

    if (error) throw error

    if (!apps || apps.length === 0) {
      return NextResponse.json({ synced: 0, message: 'No submitted applications to sync' })
    }

    const sheets = getSheets()

    const header = ['Date', 'Company', 'Role', 'Type', 'Suit%', 'Status', 'Doc URL', 'JD URL', 'Notes']

    const rows = apps.map(app => {
      const job = app.seen_jobs
      return [
        app.submitted_at?.slice(0, 10) ?? app.created_at?.slice(0, 10) ?? '',
        job?.company ?? '',
        job?.title ?? '',
        app.classified_role ?? '',
        app.suitability_pct ?? '',
        app.status ?? '',
        app.doc_url ?? '',
        job?.url ?? '',
        app.notes ?? '',
      ]
    })

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Applications!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [header, ...rows],
      },
    })

    return NextResponse.json({
      synced: rows.length,
      sheet_id: SHEET_ID,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Sheets sync error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
