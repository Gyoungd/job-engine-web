import { google } from 'googleapis'

function getAuth() {
  const saJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!saJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var not set')

  const credentials = JSON.parse(saJson)

  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  })
}

export function getDrive() {
  return google.drive({ version: 'v3', auth: getAuth() })
}

export function getDocs() {
  return google.docs({ version: 'v1', auth: getAuth() })
}

export function getSheets() {
  return google.sheets({ version: 'v4', auth: getAuth() })
}

/* ─── Base Resume Doc IDs ─── */
export const BASE_DOCS: Record<string, string> = {
  DA: process.env.GDOC_BASE_DA ?? '',
  DS: process.env.GDOC_BASE_DS ?? '',
  DE: process.env.GDOC_BASE_DE ?? '',
}

export const TRIMMED_FOLDER_ID = process.env.GDRIVE_TRIMMED_FOLDER_ID ?? ''

export function getUserDocs() {
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

  return google.docs({ version: 'v1', auth: oauth2 })
}