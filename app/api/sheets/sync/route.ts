import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSheets } from '@/lib/google'

const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? ''
const OVERVIEW_RANGE = 'Overview!A:P'

// Col indices (0-based): A=0 B=1 C=2 D=3 E=4 F=5 G=6 H=7 I=8 J=9 K=10 L=11 M=12 N=13 O=14 P=15
const COL = { DATE: 0, COMPANY: 1, STATUS: 2, ROLE: 3, JD_URL: 4, POS_DATE: 5, DUE_DATE: 6, JOB_TYPE: 7, LOCATION: 8, FOLLOWUP: 9, ONLINE_TEST: 10, INTERVIEW: 11, RESUME: 12, NOTES: 13, LINKS: 14, APP_ID: 15 }

const STATUS_MAP: Record<string, string> = {
  draft: 'Prep to Apply',
  docs_copied: 'Prep to Apply',
  submitted: 'Submitted',
  sent_cold: 'Sent Cold',
  online_test: 'Online Test',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

function formatDateAU(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

function todayAU(): string {
  return formatDateAU(new Date().toISOString())
}

export async function POST() {
  try {
    if (!SHEET_ID) {
      return NextResponse.json({ error: 'GOOGLE_SHEET_ID not configured' }, { status: 500 })
    }

    // 1. Fetch apps from Supabase (only statuses that belong in tracker)
    const { data: apps, error } = await supabaseAdmin
      .from('applications')
      .select('*, seen_jobs!inner(title, company, location, url, classified_role)')
      .in('status', ['draft', 'docs_copied', 'submitted', 'sent_cold', 'online_test', 'interview', 'offer', 'rejected', 'withdrawn'])
      .order('submitted_at', { ascending: true, nullsFirst: false })

    if (error) throw error
    if (!apps || apps.length === 0) {
      return NextResponse.json({ synced: 0, appended: 0, message: 'No applications to sync' })
    }

    const sheets = getSheets()

    // 2. Read existing Overview rows to build App ID → row number map
    const readResult = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: OVERVIEW_RANGE,
    })
    const existingRows: string[][] = (readResult.data.values ?? []) as string[][]

    // Row 1 (index 0) is header; data starts at index 1 → sheet row 2
    const appIdToRow = new Map<string, number>()
    for (let i = 1; i < existingRows.length; i++) {
      const appId = existingRows[i][COL.APP_ID]
      if (appId) appIdToRow.set(appId.trim(), i + 1) // 1-indexed sheet row
    }

    // 3. Build update + append batches
    const updateData: { range: string; values: string[][] }[] = []
    const appendRows: string[][] = []

    const GHOST_DAYS = 45
    const now = Date.now()

    for (const app of apps) {
      const job = app.seen_jobs as { title: string; company: string; location: string; url: string; classified_role: string } | null

      // Auto-ghost: submitted/sent_cold with no response for 45+ days
      const isGhost =
        ['submitted', 'sent_cold'].includes(app.status) &&
        !!app.submitted_at &&
        (now - new Date(app.submitted_at).getTime()) / (1000 * 60 * 60 * 24) >= GHOST_DAYS

      const statusLabel = isGhost ? 'Ghost' : (STATUS_MAP[app.status] ?? app.status)
      const onlineTest = ['online_test', 'interview', 'offer', 'rejected'].includes(app.status) ? 'TRUE' : 'FALSE'
      const interviewScheduled = ['interview', 'offer'].includes(app.status) ? 'TRUE' : 'FALSE'

      const rowNum = appIdToRow.get(app.id)

      if (rowNum) {
        // Update only mutable columns — preserve manual data (C, D, E, F, G, H, I, O)
        updateData.push({ range: `Overview!C${rowNum}`, values: [[statusLabel]] })
        updateData.push({ range: `Overview!J${rowNum}`, values: [[todayAU()]] })
        updateData.push({ range: `Overview!K${rowNum}`, values: [[onlineTest]] })
        updateData.push({ range: `Overview!L${rowNum}`, values: [[interviewScheduled]] })
        if (app.doc_url) updateData.push({ range: `Overview!M${rowNum}`, values: [[app.doc_url]] })
        if (app.notes) updateData.push({ range: `Overview!N${rowNum}`, values: [[app.notes]] })
        // Phase 2: job_type → H, due_date → G
        if (app.job_type) updateData.push({ range: `Overview!H${rowNum}`, values: [[app.job_type]] })
        if (app.due_date) updateData.push({ range: `Overview!G${rowNum}`, values: [[app.due_date]] })
      } else {
        // New row — append with all columns A-P
        appendRows.push([
          formatDateAU(app.submitted_at ?? app.created_at),  // A: Date Applied
          job?.company ?? '',                                  // B: Company Name
          statusLabel,                                         // C: Status
          app.classified_role ?? '',                           // D: Role Type
          job?.url ?? '',                                      // E: JD URL
          '',                                                  // F: Position Upload Date (manual)
          app.due_date ?? '',                                  // G: Due Date (Phase 2)
          app.job_type ?? '',                                  // H: Job Type (Phase 2)
          job?.location ?? '',                                 // I: Location
          todayAU(),                                           // J: Follow-up Date
          onlineTest,                                          // K: Online Test
          interviewScheduled,                                  // L: Interview Scheduled
          app.doc_url ?? '',                                   // M: Resume URL
          app.notes ?? '',                                     // N: Notes
          '',                                                  // O: Links (manual)
          app.id,                                              // P: App ID (lookup key)
        ])
      }
    }

    // 4. Execute batch update for existing rows
    if (updateData.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: updateData,
        },
      })
    }

    // 5. Append new rows (sequentially to preserve order)
    for (const row of appendRows) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: 'Overview!A:P',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [row] },
      })
    }

    return NextResponse.json({
      synced: updateData.length > 0 ? apps.length - appendRows.length : 0,
      appended: appendRows.length,
      sheet_id: SHEET_ID,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Sheets sync error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
