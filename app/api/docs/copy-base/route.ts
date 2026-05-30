import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getUserDocs } from '@/lib/google'
import { google } from 'googleapis'
import { applyProjectChanges, parseProjectChanges } from '@/lib/projects'

const BASE_DOCS: Record<string, string> = {
  DA: process.env.GDOC_BASE_DA ?? '',
  DS: process.env.GDOC_BASE_DS ?? '',
  DE: process.env.GDOC_BASE_DE ?? '',
}

const TRIMMED_FOLDER_ID = process.env.GDRIVE_TRIMMED_FOLDER_ID ?? ''

function getUserDrive() {
  const tokenJson = process.env.GMAIL_TOKEN_JSON
  const credJson = process.env.GMAIL_CREDENTIALS_JSON
  if (!tokenJson || !credJson) throw new Error('Gmail OAuth env vars not set')

  const token = JSON.parse(tokenJson)
  const cred = JSON.parse(credJson)
  const { client_id, client_secret } = cred.installed

  const oauth2 = new google.auth.OAuth2(client_id, client_secret)
  oauth2.setCredentials({
    access_token: token.token,
    refresh_token: token.refresh_token,
    token_type: 'Bearer',
    expiry_date: token.expiry_date ?? 0,
  })

  return google.drive({ version: 'v3', auth: oauth2 })
}

function parseOriginalRevised(text: string): Array<{ original: string; revised: string }> {
  const pairs: Array<{ original: string; revised: string }> = []
  const blocks = text.split('[ORIGINAL]')

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]
    const origMatch = block.match(/^\s*"([\s\S]*?)"/)
    if (!origMatch) continue

    const revisedIdx = block.indexOf('[REVISED')
    if (revisedIdx === -1) continue

    const revisedMatch = block.slice(revisedIdx).match(/\[REVISED[^\]]*\]\s*"([\s\S]*?)"/)
    if (!revisedMatch) continue

    const original = origMatch[1].trim()
    const revised = revisedMatch[1].trim()
    if (original && revised && original !== revised) {
      pairs.push({ original, revised })
    }
  }

  return pairs
}

async function applyResumeChanges(docId: string, resumeChanges: string) {
  const pairs = parseOriginalRevised(resumeChanges)
  if (pairs.length === 0) return { applied: 0 }

  const docs = getUserDocs()
  const requests = pairs.map(({ original, revised }) => ({
    replaceAllText: {
      containsText: { text: original, matchCase: true },
      replaceText: revised,
    },
  }))

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests },
  })

  return { applied: pairs.length }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const applicationId: string = body.application_id
    const roleOverride: string | undefined = body.role?.toUpperCase()
    const force: boolean = !!body.force

    if (!applicationId) {
      return NextResponse.json({ error: 'application_id is required' }, { status: 400 })
    }

    const { data: app, error: appErr } = await supabaseAdmin
      .from('applications')
      .select('*, seen_jobs!inner(title, company, classified_role)')
      .eq('id', applicationId)
      .single()

    if (appErr || !app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    if (app.doc_url && !force) {
      return NextResponse.json({
        doc_url: app.doc_url,
        doc_id: app.doc_id,
        message: 'Document already exists',
        db_verified: true,
      })
    }

    // If regenerating, soft-delete the previous doc by moving it to Drive trash
    let trashedOldDocId: string | null = null
    let trashError: string | undefined
    if (force && app.doc_id) {
      try {
        const drive = getUserDrive()
        await drive.files.update({ fileId: app.doc_id, requestBody: { trashed: true } })
        trashedOldDocId = app.doc_id
        console.log(`[copy-base] Trashed previous doc ${app.doc_id}`)
      } catch (e) {
        trashError = e instanceof Error ? e.message : 'Unknown error'
        console.warn('[copy-base] Failed to trash previous doc:', trashError)
      }
    }

    const role = roleOverride ?? app.classified_role ?? app.seen_jobs?.classified_role ?? 'DA'
    const baseDocId = BASE_DOCS[role]

    if (!baseDocId) {
      return NextResponse.json({ error: `No base doc for role: ${role}` }, { status: 400 })
    }

    const company = app.seen_jobs?.company ?? 'Company'
    const companyClean = company.replace(/[^\w\s가-힣-]/g, '').trim()
    const fileName = `Gayoung Dan_Resume_${companyClean}`

    const drive = getUserDrive()

    const copyRes = await drive.files.copy({
      fileId: baseDocId,
      requestBody: {
        name: fileName,
        parents: TRIMMED_FOLDER_ID ? [TRIMMED_FOLDER_ID] : undefined,
      },
    })

    const newDocId = copyRes.data.id
    const docUrl = `https://docs.google.com/document/d/${newDocId}/edit`

    // Apply resume changes to the copied doc
    let changesApplied = 0
    let changesError: string | undefined
    if (app.resume_changes && newDocId) {
      try {
        const result = await applyResumeChanges(newDocId, app.resume_changes)
        changesApplied = result.applied
        console.log(`[copy-base] Applied ${changesApplied} resume changes to ${newDocId}`)
      } catch (e) {
        changesError = e instanceof Error ? e.message : 'Unknown error'
        console.warn('[copy-base] Failed to apply resume changes:', changesError)
      }
    }

    let projectsApplied = 0
    let projectErrors: string[] = []
    if (app.resume_changes && newDocId) {
      const projectChanges = parseProjectChanges(app.resume_changes)
      if (projectChanges.length > 0) {
        try {
          const result = await applyProjectChanges(newDocId, projectChanges)
          projectsApplied = result.applied
          projectErrors = result.errors
          console.log('[copy-base] Applied ${projectsApplied} project swaps, ${projectErrors.length} errors')
        } catch (e) {
          console.warn('[copy-base] Project swap failed:', e)
        }
      }
    }

    // Update DB
    const generatedAt = new Date().toISOString()
    const updatePayload: Record<string, unknown> = {
      doc_id: newDocId,
      doc_url: docUrl,
      status: 'docs_copied',
      doc_generated_at: generatedAt,
    }
    let { data: updated, error: err1 } = await supabaseAdmin
      .from('applications')
      .update(updatePayload)
      .eq('id', applicationId)
      .select('id, status, doc_url, doc_id')

    // Retry without doc_generated_at if the column doesn't exist yet
    if (err1 && /doc_generated_at/i.test(err1.message ?? '')) {
      console.warn('[copy-base] doc_generated_at column missing — retrying without it')
      const { doc_generated_at: _omit, ...fallback } = updatePayload
      void _omit
      const retry = await supabaseAdmin
        .from('applications')
        .update(fallback)
        .eq('id', applicationId)
        .select('id, status, doc_url, doc_id')
      updated = retry.data
      err1 = retry.error
    }

    if (err1) {
      console.error('[copy-base] Update error:', JSON.stringify(err1))

      const results: Record<string, string> = {}
      const { error: e1 } = await supabaseAdmin.from('applications').update({ status: 'docs_copied' }).eq('id', applicationId)
      results.status = e1 ? `FAIL: ${e1.message}` : 'OK'
      const { error: e2 } = await supabaseAdmin.from('applications').update({ doc_url: docUrl }).eq('id', applicationId)
      results.doc_url = e2 ? `FAIL: ${e2.message}` : 'OK'
      const { error: e3 } = await supabaseAdmin.from('applications').update({ doc_id: newDocId }).eq('id', applicationId)
      results.doc_id = e3 ? `FAIL: ${e3.message}` : 'OK'

      console.error('[copy-base] Individual update results:', results)
      return NextResponse.json({
        doc_id: newDocId, doc_url: docUrl, file_name: fileName, role,
        db_verified: false, db_field_results: results,
        changes_applied: changesApplied, changes_error: changesError,
      })
    }

    if (!updated || updated.length === 0) {
      console.error('[copy-base] Update matched 0 rows for id:', applicationId)
      await supabaseAdmin.from('applications').update({ status: 'docs_copied' }).eq('id', applicationId)
      await supabaseAdmin.from('applications').update({ doc_url: docUrl }).eq('id', applicationId)
      await supabaseAdmin.from('applications').update({ doc_id: newDocId }).eq('id', applicationId)

      const { data: verify } = await supabaseAdmin
        .from('applications')
        .select('id, status, doc_url, doc_id')
        .eq('id', applicationId)
        .single()

      return NextResponse.json({
        doc_id: newDocId, doc_url: docUrl, file_name: fileName, role,
        db_verified: verify?.doc_url === docUrl, db_state: verify,
        changes_applied: changesApplied, changes_error: changesError,
        projects_applied: projectsApplied,
        project_errors: projectErrors,
      })
    }

    return NextResponse.json({
      doc_id: newDocId, doc_url: docUrl, file_name: fileName, role,
      db_verified: true,
      changes_applied: changesApplied, changes_error: changesError,
      projects_applied: projectsApplied,
      project_errors: projectErrors,
      regenerated: force,
      trashed_old_doc_id: trashedOldDocId,
      trash_error: trashError,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[copy-base] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
