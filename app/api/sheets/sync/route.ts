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

function hyperlinkCell(url: string | null | undefined): string {
  if (!url) return ''
  const safe = url.replace(/"/g, '%22')
  return `=HYPERLINK("${safe}","[URL]")`
}

async function getOverviewSheetId(sheets: ReturnType<typeof getSheets>): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID })
  const sheet = meta.data.sheets?.find(s => s.properties?.title === 'Overview')
  return sheet?.properties?.sheetId ?? 0
}

export async function POST() {
  try {
    if (!SHEET_ID) {
      return NextResponse.json({ error: 'GOOGLE_SHEET_ID not configured' }, { status: 500 })
    }

    // 1. Fetch apps from Supabase (left join so apps without seen_jobs are still included)
    const { data: apps, error } = await supabaseAdmin
      .from('applications')
      .select('*, seen_jobs!left(title, company, location, url, classified_role)')
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
        if (job?.url) updateData.push({ range: `Overview!E${rowNum}`, values: [[hyperlinkCell(job.url)]] })
        if (app.doc_url) updateData.push({ range: `Overview!M${rowNum}`, values: [[app.doc_url]] })
        if (app.notes) updateData.push({ range: `Overview!N${rowNum}`, values: [[app.notes]] })
        if (app.job_type) updateData.push({ range: `Overview!H${rowNum}`, values: [[app.job_type]] })
        if (app.due_date) updateData.push({ range: `Overview!G${rowNum}`, values: [[app.due_date]] })
      } else {
        // New row — collect for batch insert
        appendRows.push([
          formatDateAU(app.submitted_at ?? app.created_at),  // A: Date Applied
          job?.company ?? '',                                  // B: Company Name
          statusLabel,                                         // C: Status
          app.classified_role ?? '',                           // D: Role Type
          hyperlinkCell(job?.url),                             // E: JD URL (hyperlink formula)
          '',                                                  // F: Position Upload Date (manual)
          app.due_date ?? '',                                  // G: Due Date
          app.job_type ?? '',                                  // H: Job Type
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

    // 5. Insert new rows inside the table using InsertDimensionRequest
    //    (inheritFromBefore: true copies dropdowns, date format, conditional formatting from row above)
    if (appendRows.length > 0) {
      const overviewSheetId = await getOverviewSheetId(sheets)
      const insertAt = existingRows.length // 0-based index: after last existing row

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          requests: [{
            insertDimension: {
              range: {
                sheetId: overviewSheetId,
                dimension: 'ROWS',
                startIndex: insertAt,
                endIndex: insertAt + appendRows.length,
              },
              inheritFromBefore: true,
            },
          }],
        },
      })

      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: appendRows.map((row, i) => ({
            range: `Overview!A${insertAt + 1 + i}`,
            values: [row],
          })),
        },
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
