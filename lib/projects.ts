import { docs_v1 } from 'googleapis'
import { getUserDocs } from './google'

const PROJECT_BASE_DOC_ID = process.env.GDOC_BASE_PJT ?? ''

export interface ProjectChange {
  action: 'Replace' | 'Add'
  newProjectName: string
  oldProjectName?: string
}

// ───────────────────────────────────────────
// PARSE: resume_changes.md → ProjectChange[]
// ───────────────────────────────────────────
export function parseProjectChanges(resumeChanges: string): ProjectChange[] {
  const changes: ProjectChange[] = []
  const blocks = resumeChanges.split('[PROJECT SWAP / ADDITION]')

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]
    const actionMatch = block.match(/Action:\s*(Replace|Add)/)
    const projectMatch = block.match(/Project:\s*(.+?)(?:\n|$)/)
    if (!actionMatch || !projectMatch) continue

    const action = actionMatch[1] as 'Replace' | 'Add'
    const newProjectName = projectMatch[1].trim()

    let oldProjectName: string | undefined
    if (action === 'Replace') {
      const sectionMatch = block.match(/Section:[^\n]*replace\s+"([^"]+)"/)
      if (sectionMatch) oldProjectName = sectionMatch[1].trim()
    }

    changes.push({ action, newProjectName, oldProjectName })
  }
  return changes
}

// ───────────────────────────────────────────
// HELPERS
// ───────────────────────────────────────────
function paragraphText(p: docs_v1.Schema$Paragraph): string {
  return (p.elements ?? []).map(e => e.textRun?.content ?? '').join('')
}

function isBoldParagraph(p: docs_v1.Schema$Paragraph): boolean {
  const firstRun = p.elements?.find(e => e.textRun?.content?.trim())?.textRun
  return !!firstRun?.textStyle?.bold
}

interface ProjectBlock {
  paragraphs: docs_v1.Schema$Paragraph[]
  startIndex: number
  endIndex: number
}

function findProjectBlock(
  doc: docs_v1.Schema$Document,
  projectName: string,
  stopAtSection?: string
): ProjectBlock | null {
  const content = doc.body?.content ?? []
  let startIdx = -1

  for (let i = 0; i < content.length; i++) {
    const p = content[i].paragraph
    if (!p) continue
    if (paragraphText(p).includes(projectName) && isBoldParagraph(p)) {
      startIdx = i
      break
    }
  }
  if (startIdx === -1) return null

  let endIdx = content.length
  for (let i = startIdx + 1; i < content.length; i++) {
    const p = content[i].paragraph
    if (!p) continue
    const text = paragraphText(p).trim()

    if (stopAtSection && text.startsWith(stopAtSection)) {
      endIdx = i
      break
    }
    if (text && isBoldParagraph(p)) {
      endIdx = i
      break
    }
  }

  return {
    paragraphs: content.slice(startIdx, endIdx).map(c => c.paragraph!).filter(Boolean),
    startIndex: content[startIdx].startIndex ?? 0,
    endIndex: content[endIdx - 1].endIndex ?? 0,
  }
}

function findProjectsSectionEnd(doc: docs_v1.Schema$Document): number {
  const content = doc.body?.content ?? []
  let foundProjects = false
  for (let i = 0; i < content.length; i++) {
    const p = content[i].paragraph
    if (!p) continue
    const text = paragraphText(p).trim()
    if (!foundProjects && text === 'PROJECTS') {
      foundProjects = true
      continue
    }
    if (foundProjects && text === 'EDUCATION') {
      return content[i].startIndex ?? 0
    }
  }
  return content[content.length - 1].endIndex ?? 1
}

// ───────────────────────────────────────────
// REPRODUCE: paragraphs → batchUpdate requests
// ───────────────────────────────────────────
function buildReproduceRequests(
  paragraphs: docs_v1.Schema$Paragraph[],
  insertAt: number
): docs_v1.Schema$Request[] {
  const requests: docs_v1.Schema$Request[] = []
  const rawText = paragraphs.map(p => paragraphText(p)).join('')

  // 1. text 한 번에 삽입
  requests.push({ insertText: { location: { index: insertAt }, text: rawText } })

  // 2. style 적용
  let cursor = insertAt
  for (const p of paragraphs) {
    const pText = paragraphText(p)
    const pStart = cursor
    const pEnd = cursor + pText.length

    // 2-1. textRun 스타일 (bold, italic, color 등)
    let runCursor = pStart
    for (const el of p.elements ?? []) {
      if (!el.textRun) continue
      const runText = el.textRun.content ?? ''
      const runEnd = runCursor + runText.length
      const ts = el.textRun.textStyle

      if (ts && Object.keys(ts).length > 0) {
        const styleEnd = runText.endsWith('\n') ? runEnd - 1 : runEnd
        if (styleEnd > runCursor) {
          requests.push({
            updateTextStyle: {
              range: { startIndex: runCursor, endIndex: styleEnd },
              textStyle: ts,
              fields: Object.keys(ts).join(','),
            },
          })
        }
      }
      runCursor = runEnd
    }

    // 2-2. paragraph 스타일 (alignment, tabStops, indent)
    const ps = p.paragraphStyle
    if (ps) {
      const safePs: docs_v1.Schema$ParagraphStyle = {}
      const fields: string[] = []
      if (ps.alignment) { safePs.alignment = ps.alignment; fields.push('alignment') }
      if (ps.tabStops) { safePs.tabStops = ps.tabStops; fields.push('tabStops') }
      if (ps.indentStart) { safePs.indentStart = ps.indentStart; fields.push('indentStart') }
      if (ps.indentFirstLine) { safePs.indentFirstLine = ps.indentFirstLine; fields.push('indentFirstLine') }

      if (fields.length > 0) {
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: pStart, endIndex: pEnd },
            paragraphStyle: safePs,
            fields: fields.join(','),
          },
        })
      }
    }

    // 2-3. bullet
    if (p.bullet) {
      requests.push({
        createParagraphBullets: {
          range: { startIndex: pStart, endIndex: pEnd },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      })
    }

    cursor = pEnd
  }
  return requests
}

// ───────────────────────────────────────────
// MAIN: apply project changes to resume doc
// ───────────────────────────────────────────
export async function applyProjectChanges(
  resumeDocId: string,
  changes: ProjectChange[]
): Promise<{ applied: number; errors: string[] }> {
  if (changes.length === 0) return { applied: 0, errors: [] }
  if (!PROJECT_BASE_DOC_ID) return { applied: 0, errors: ['GDOC_BASE_PJT not set'] }

  const docs = getUserDocs()
  const errors: string[] = []
  let applied = 0

  const baseDoc = (await docs.documents.get({ documentId: PROJECT_BASE_DOC_ID })).data

  for (const change of changes) {
    try {
      const newBlock = findProjectBlock(baseDoc, change.newProjectName)
      if (!newBlock) {
        errors.push(`Base에서 못 찾음: ${change.newProjectName}`)
        continue
      }

      // 매 swap마다 resume doc 새로 fetch (인덱스 변동)
      const resumeDoc = (await docs.documents.get({ documentId: resumeDocId })).data

      if (change.action === 'Replace' && change.oldProjectName) {
        const oldBlock = findProjectBlock(resumeDoc, change.oldProjectName, 'EDUCATION')
        if (!oldBlock) {
          errors.push(`Resume에서 못 찾음: ${change.oldProjectName}`)
          continue
        }

        // Step 1: 기존 삭제
        await docs.documents.batchUpdate({
          documentId: resumeDocId,
          requestBody: {
            requests: [{
              deleteContentRange: {
                range: { startIndex: oldBlock.startIndex, endIndex: oldBlock.endIndex },
              },
            }],
          },
        })

        // Step 2: 같은 위치에 새 프로젝트 삽입
        const requests = buildReproduceRequests(newBlock.paragraphs, oldBlock.startIndex)
        await docs.documents.batchUpdate({
          documentId: resumeDocId,
          requestBody: { requests },
        })
        applied++
      } else if (change.action === 'Add') {
        const insertAt = findProjectsSectionEnd(resumeDoc)
        const requests = buildReproduceRequests(newBlock.paragraphs, insertAt)
        await docs.documents.batchUpdate({
          documentId: resumeDocId,
          requestBody: { requests },
        })
        applied++
      }
    } catch (e) {
      errors.push(`${change.newProjectName}: ${e instanceof Error ? e.message : 'Unknown'}`)
    }
  }

  return { applied, errors }
}