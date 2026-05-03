import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { google } from 'googleapis'

const BASE_DOCS: Record<string, string> = {
  DA: process.env.GDOC_BASE_DA ?? '',
  DS: process.env.GDOC_BASE_DS ?? '',
  DE: process.env.GDOC_BASE_DE ?? '',
}

const TRIMMED_FOLDER_ID = process.env.GDRIVE_TRIMMED_FOLDER_ID ?? ''

/**
function getUserDrive() {
  const tokenJson = process.env.GMAIL_TOKEN_JSON
  if (!tokenJson) throw new Error('GMAIL_TOKEN_JSON not set')

  const token = JSON.parse(tokenJson)

  // 직접 입력 (gmail-credentials.json 값)
  const CLIENT_ID = '806336906152-jjddo8te1i6ojiegmaaqu8op1mn4i043.apps.googleusercontent.com'
  const CLIENT_SECRET = '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'

  const oauth2 = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET)
  oauth2.setCredentials({
    access_token: token.token,
    refresh_token: token.refresh_token,
    token_type: 'Bearer',
  })
*/

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
  })

  return google.drive({ version: 'v3', auth: oauth2 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const applicationId: string = body.application_id
    const roleOverride: string | undefined = body.role?.toUpperCase()

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

    if (app.doc_url) {
      return NextResponse.json({
        doc_url: app.doc_url,
        doc_id: app.doc_id,
        message: 'Document already exists',
      })
    }

    const role = roleOverride ?? app.classified_role ?? app.seen_jobs?.classified_role ?? 'DA'
    const baseDocId = BASE_DOCS[role]

    if (!baseDocId) {
      return NextResponse.json({ error: `No base doc for role: ${role}` }, { status: 400 })
    }

    const company = app.seen_jobs?.company ?? 'Company'
    const companyClean = company.replace(/[^\w\s가-힣-]/g, '').trim()
    const fileName = `Gayoung Dan_Resume_${companyClean}`

    // 사용자 OAuth로 복사 → 본인 Drive 용량 사용
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

    await supabaseAdmin
      .from('applications')
      .update({
        doc_id: newDocId,
        doc_url: docUrl,
        status: 'docs_copied',
      })
      .eq('id', applicationId)

    return NextResponse.json({
      doc_id: newDocId,
      doc_url: docUrl,
      file_name: fileName,
      role,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Copy base doc error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}