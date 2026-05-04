import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSheets } from '@/lib/google'

const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? ''

export async function POST() {
  try {
    const { count, error: countErr } = await supabaseAdmin
      .from('applications')
      .select('*', { count: 'exact', head: true })

    if (countErr) throw new Error(`Count apps: ${countErr.message}`)

    const total = count ?? 0

    if (total > 0) {
      const { error: delErr } = await supabaseAdmin
        .from('applications')
        .delete()
        .gte('created_at', '2000-01-01')

      if (delErr) throw new Error(`Delete apps: ${delErr.message}`)
    }

    let sheetsCleared = false
    if (SHEET_ID) {
      try {
        const sheets = getSheets()
        await sheets.spreadsheets.values.clear({
          spreadsheetId: SHEET_ID,
          range: 'Applications!A1:Z1000',
        })
        sheetsCleared = true
      } catch (sheetErr) {
        console.error('Sheets clear failed:', sheetErr)
      }
    }

    return NextResponse.json({
      deleted_applications: total,
      scores_cleared: false,
      sheets_cleared: sheetsCleared,
      message: 'Reset complete (applications only). Google Drive docs must be deleted manually.',
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Reset error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
