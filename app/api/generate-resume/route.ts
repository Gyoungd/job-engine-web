import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { callAnthropic, MODELS } from '@/lib/anthropic'
import { SKILLS_MATRIX, PROJECTS_INVENTORY } from '@/lib/profile-context'
import fs from 'fs'
import path from 'path'

function preClassifyRole(title: string): 'DA' | 'DS' | 'DE' {
  const t = title.toLowerCase()
  if (/scientist|machine.?learning|\bml\b|statistical model|nlp|deep.?learn/.test(t)) return 'DS'
  if (/engineer|pipeline|etl|streaming|platform|infrastructure|architect/.test(t)) return 'DE'
  return 'DA'
}

function loadBaseResume(role: 'DA' | 'DS' | 'DE'): string {
  try {
    const file = path.join(process.cwd(), 'profile', `${role.toLowerCase()}.md`)
    return fs.readFileSync(file, 'utf-8')
  } catch {
    return ''
  }
}

// Strip markdown markers so [ORIGINAL] matches plain text in Google Docs
function stripMarkdown(text: string): string {
  let result = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // links
    .replace(/\\(.)/g, '$1')                   // escapes
    .replace(/^[*-] /gm, '')                   // bullet list markers (* text / - text)

  // Multi-pass: handles nested bold+italic like **text *italic* text**
  for (let i = 0; i < 3; i++) {
    result = result
      .replace(/\*\*\*([^*]+)\*\*\*/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
  }

  return result.replace(/\*+/g, '')  // any remaining asterisks
}

const SYSTEM_PROMPT = `You are a resume tailoring engine for Gayoung Dan (Ina), a recent Master of Data Science graduate from Monash University.

You operate in three roles simultaneously:
1. CAREER COUNSELOR: Assess genuine fit. Be direct about strengths and weaknesses relative to this role.
2. CAREER STRATEGIST: Identify the 3 most critical gaps between candidate's current profile and role requirements. Prioritise gaps that resume edits can actually close.
3. PRECISION RESUME EDITOR: Make only edits that close the highest-impact gaps. Fewer, sharper changes beat comprehensive rewrites.

HARD CONSTRAINTS — NEVER VIOLATE:
- NEVER rewrite entire resume
- NEVER change resume formatting or layout
- NEVER add fake metrics, invented statistics, fabricated outcomes
- NEVER invent technologies not in the verified skills matrix below
- NEVER add project content not in the projects inventory below
- ALWAYS perform Project Base scan

CANDIDATE SKILLS (VERIFIED — do NOT add anything outside this list):
${SKILLS_MATRIX}

PROJECT PORTFOLIO (source of truth for project swaps):
${PROJECTS_INVENTORY}

ROLE-SPECIFIC EMPHASIS:
DA: KPI/reporting project top, BI tools in summary, business impact phrasing, quantify outputs
DS: ML project top, metric visibility (RMSE/AUC/F1/p-value), feature engineering wording, evaluation methodology
DE: Pipeline/streaming project top, ETL terminology, data volume/scale, infrastructure trade-offs

PROJECT SWAP DECISION RULES:
- Recommend swap ONLY IF: candidate project matches ≥3 of the top 5 JD signals AND the project being replaced matches ≤1
- Never recommend more than 1 swap per resume
- Never add a project if total would exceed 5 projects in the resume
- If base resume already contains the best-fit projects → state "No swap recommended" explicitly
- Prefer most recent + most relevant; never swap out a project with unique metrics/outcomes unless the replacement is clearly stronger

BULLET REWRITING RULES:
- Only rewrite a bullet if it lacks a JD keyword that can be naturally inserted OR significantly undersells a clearly relevant capability
- Do NOT rewrite bullets that already contain matching keywords — output [ORIGINAL] = [REVISED] is wasteful; skip those entirely
- Never remove existing metrics, numbers, or quantified outcomes (e.g. 4.8M+ records, R²=0.88, p<0.001)
- Maximum change: rephrase the action verb or add JD-aligned context — do not reconstruct the bullet from scratch
- Limit to max 3 [ORIGINAL]/[REVISED] bullet pairs per section
- Summary line: rewrite only if role classification differs from base resume; otherwise light keyword insert only
- NO DUPLICATE OPENING VERBS: across all project and experience bullets in the full resume draft, each bullet must open with a distinct action verb — if a verb is already used elsewhere, choose a different one
- NO AI-GEN WRITING PATTERNS: banned words and constructs include "leveraged", "utilized", "spearheaded", "facilitated", "streamlined", "fostered", "robust", "seamless", "cutting-edge", "dynamic"; banned punctuation patterns include mid-sentence em-dash (—) and en-dash (–) used as a connector inside bullet body text; write in the same direct past-tense style as the existing resume bullets

SUITABILITY SCORING:
- Base score: 40%
- +5% per verified skill from the top 5 JD signals found in the candidate's skills matrix (max +25%)
- +5% per project already in base resume that directly matches JD signals (max +15%)
- +10% if role classification confidence is High; +5% if Medium; +0% if Low
- -10% if JD requires domain experience (e.g. finance, healthcare) not demonstrated in any project or work history
- -5% if role is ambiguous cross-type (e.g. DA/DS hybrid with no clear lean)
- Cap at 90% — entry-level candidate with no full-time data role
- Tier A: ≥70% | Tier B: 50–69% | Do not generate for <50%

RESUME TRIMMING PRINCIPLE (apply before writing any [ORIGINAL]/[REVISED]):
- Only make a change if it closes a gap identified in CAREER STRATEGY. If not, skip it.
- Priority order: Summary > Skills > Experience bullets > Project bullets
- Adding a missing JD keyword beats rephrasing a bullet that already conveys the right idea

OUTPUT FORMAT (follow exactly):
---
ROLE CLASSIFICATION
Best fit: [DA / DS / DE]
Confidence: [High / Medium / Low]
Reason: [1-2 sentences]
---
JOB ANALYSIS
Company: [name]
Role: [title]
Role type: [DA / DS / DE]

Top 5 signals:
1. [signal]
2. [signal]
3. [signal]
4. [signal]
5. [signal]

Tier: [A / B]
Suitability %: [X]% — [1 sentence rationale]
Job Type: [Full-time / Part-time / Contract / Internship / Graduate Program / On-site / Hybrid / Unknown]
Due Date: [DD/MM/YYYY or Unknown]
---
PROJECT BASE SCAN
Shortlisted candidates (top 3, ranked by JD fit):
1. [Project Name] — [match reason] | In base resume: [Yes/No]
2. [Project Name] — [match reason] | In base resume: [Yes/No]
3. [Project Name] — [match reason] | In base resume: [Yes/No]

Swap recommendation:
Remove: [weaker project or "None"]
Add: [stronger from Project Base or "None"]
Reason: [1-2 sentences]
---
CAREER STRATEGY
3 critical gaps between this candidate and role requirements:
Gap 1: [Specific gap] — Resume action: [what edit addresses this, or "not closeable via resume — address in cover letter/interview"]
Gap 2: [Specific gap] — Resume action: [...]
Gap 3: [Specific gap] — Resume action: [...]

Counselor note: [1-2 sentences — overall candidacy strength, what to emphasise, any red flags]
---
RESUME CHANGES
CRITICAL RULES FOR [ORIGINAL]/[REVISED]:
- [ORIGINAL] MUST be copied VERBATIM from the CURRENT BASE RESUME TEXT provided in the user prompt
- NEVER invent, paraphrase, or describe the original — copy the exact characters
- NEVER use placeholders like "(Summary / profile line...)" — always use the real text
- Both [ORIGINAL] and [REVISED] MUST be wrapped in double quotes "like this"
- If you cannot find matching text in the base resume, skip that change entirely

[ORIGINAL]
"exact current text copied from base resume"

[REVISED]
"improved text"

[If project swap needed:]
[PROJECT SWAP / ADDITION]
Action: [Add / Replace]
Project: [name]
Section: [section + position]
Content: [exact text from projects-inventory.md]

[List ALL edits below, following the format above]
---`

// LinkedIn and Seek require authentication — fetching their URLs returns a login page, not JD content
const AUTH_WALLED = /linkedin\.com|seek\.com\.au/i

async function fetchJdText(url: string): Promise<string | null> {
  if (AUTH_WALLED.test(url)) return null
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JobEngineBot/1.0)' },
    })
    if (!res.ok) return null
    const html = await res.text()
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const jdHash: string = body.jd_hash
    const jdText: string | undefined = body.jd_text
    const force: boolean = body.force === true

    if (!jdHash) {
      return NextResponse.json({ error: 'jd_hash is required' }, { status: 400 })
    }

    // Fetch job from DB
    const { data: job, error: jobErr } = await supabaseAdmin
      .from('seen_jobs')
      .select('*')
      .eq('hash', jdHash)
      .single()

    if (jobErr || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // Check if already generated
    const { data: existing } = await supabaseAdmin
      .from('applications')
      .select('id')
      .eq('jd_hash', jdHash)
      .limit(1)

    if (existing && existing.length > 0 && !force) {
      return NextResponse.json({
        error: 'Resume already generated for this JD',
        application_id: existing[0].id,
      }, { status: 409 })
    }

    // Resolve JD text: user-provided > already archived > auto-scrape from URL > metadata fallback
    const resolvedJdText = jdText
      ?? (job.jd_text as string | null | undefined)
      ?? (job.url ? await fetchJdText(job.url as string) : null)
      ?? null

    // Build prompt
    const jdContent = resolvedJdText ?? `Title: ${job.title}\nCompany: ${job.company ?? 'N/A'}\nLocation: ${job.location ?? 'N/A'}\nURL: ${job.url ?? 'N/A'}\nSource: ${job.source ?? 'N/A'}`

    // Load base resume from local markdown file
    const preRole = preClassifyRole(job.title ?? '')
    const baseResumeRaw = loadBaseResume(preRole)
    const baseResumeText = baseResumeRaw ? stripMarkdown(baseResumeRaw) : ''

    const prompt = `Analyze this job description and generate resume tailoring changes.

JOB DESCRIPTION:
${jdContent}

CURRENT BASE RESUME PLAIN TEXT (copy [ORIGINAL] values verbatim from here — no paraphrasing):
${baseResumeText || '(unavailable — use your best judgment)'}

Follow the output format exactly. Every resume edit must be in [ORIGINAL]/[REVISED] format.
Only use skills and projects from the verified lists in your system prompt.`

    // Call Sonnet
    const result = await callAnthropic({
      model: MODELS.GENERATE,
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 4096,
    })

    // Parse suitability % from response
    const suitMatch = result.match(/Suitability\s*%?:\s*(\d+)/)
    const suitabilityPct = suitMatch ? parseInt(suitMatch[1]) : null

    // Parse role from response
    const roleMatch = result.match(/Best fit:\s*(DA|DS|DE)/i)
    const classifiedRole = roleMatch ? roleMatch[1].toUpperCase() : (job.classified_role ?? 'unknown')

    // Parse tier
    const tierMatch = result.match(/Tier:\s*(A|B)/i)
    const tier = tierMatch ? tierMatch[1].toUpperCase() : null

    // Parse job_type and due_date (Phase 2 metadata)
    const jobTypeMatch = result.match(/^Job Type:\s*(.+)$/m)
    const jobTypeRaw = jobTypeMatch?.[1]?.trim()
    const jobType = jobTypeRaw && jobTypeRaw !== 'Unknown' ? jobTypeRaw : null

    const dueDateMatch = result.match(/^Due Date:\s*(.+)$/m)
    const dueDateRaw = dueDateMatch?.[1]?.trim()
    const dueDate = dueDateRaw && dueDateRaw !== 'Unknown' ? dueDateRaw : null

    // Create folder path
    const today = new Date().toISOString().slice(0, 10)
    const companySlug = (job.company ?? 'unknown')
      .replace(/[^a-zA-Z0-9가-힣]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30)
    const folderPath = `${today}_${companySlug}_${classifiedRole}`

    // Store or update in applications table
    let app: { id: string } | null = null
    if (force && existing?.[0]) {
      const { data: updated, error: appErr } = await supabaseAdmin
        .from('applications')
        .update({
          resume_changes: result,
          suitability_pct: suitabilityPct,
          classified_role: classifiedRole,
          job_type: jobType,
          due_date: dueDate,
        })
        .eq('id', existing[0].id)
        .select('id')
        .single()
      if (appErr) {
        console.error('Failed to update application:', appErr)
        return NextResponse.json({ error: 'Failed to update application' }, { status: 500 })
      }
      app = updated
    } else {
      const { data: inserted, error: appErr } = await supabaseAdmin
        .from('applications')
        .insert({
          jd_hash: jdHash,
          folder_path: folderPath,
          classified_role: classifiedRole,
          resume_changes: result,
          status: 'draft',
          suitability_pct: suitabilityPct,
          job_type: jobType,
          due_date: dueDate,
        })
        .select('id')
        .single()
      if (appErr) {
        console.error('Failed to save application:', appErr)
        return NextResponse.json({ error: 'Failed to save application' }, { status: 500 })
      }
      app = inserted
    }

    if (!app) {
      return NextResponse.json({ error: 'Failed to persist application' }, { status: 500 })
    }

    // Update score + jd_text on seen_jobs
    const seenJobsUpdate: Record<string, unknown> = {}
    if (suitabilityPct && !job.score) {
      seenJobsUpdate.score = suitabilityPct
      seenJobsUpdate.classified_role = classifiedRole
    }
    if (resolvedJdText && !job.jd_text) {
      seenJobsUpdate.jd_text = resolvedJdText
    }
    if (Object.keys(seenJobsUpdate).length > 0) {
      await supabaseAdmin
        .from('seen_jobs')
        .update(seenJobsUpdate)
        .eq('hash', jdHash)
    }

    return NextResponse.json({
      application_id: app.id,
      folder_path: folderPath,
      classified_role: classifiedRole,
      suitability_pct: suitabilityPct,
      tier,
      job_type: jobType,
      due_date: dueDate,
      resume_changes: result,
      model: MODELS.GENERATE,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Generate resume error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}