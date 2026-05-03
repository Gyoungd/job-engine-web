import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { callAnthropic, MODELS } from '@/lib/anthropic'
import { SKILLS_MATRIX, PROJECTS_INVENTORY } from '@/lib/profile-context'

const SYSTEM_PROMPT = `You are a resume tailoring engine for Gayoung Dan (Ina), a recent Master of Data Science graduate from Monash University.

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
RESUME CHANGES
[List EVERY edit as [ORIGINAL]/[REVISED] pairs]

[ORIGINAL]
"exact current text to find"

[REVISED]
"improved text"

[If project swap needed:]
[PROJECT SWAP / ADDITION]
Action: [Add / Replace]
Project: [name]
Section: [section + position]
Content: [exact text from projects-inventory.md]
---`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const jdHash: string = body.jd_hash
    const jdText: string | undefined = body.jd_text

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

    if (existing && existing.length > 0) {
      return NextResponse.json({
        error: 'Resume already generated for this JD',
        application_id: existing[0].id,
      }, { status: 409 })
    }

    // Build prompt
    const jdContent = jdText ?? `Title: ${job.title}\nCompany: ${job.company ?? 'N/A'}\nLocation: ${job.location ?? 'N/A'}\nURL: ${job.url ?? 'N/A'}\nSource: ${job.source ?? 'N/A'}`

    const prompt = `Analyze this job description and generate resume tailoring changes.

JOB DESCRIPTION:
${jdContent}

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

    // Create folder path
    const today = new Date().toISOString().slice(0, 10)
    const companySlug = (job.company ?? 'unknown')
      .replace(/[^a-zA-Z0-9가-힣]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 30)
    const folderPath = `${today}_${companySlug}_${classifiedRole}`

    // Store in applications table
    const { data: app, error: appErr } = await supabaseAdmin
      .from('applications')
      .insert({
        jd_hash: jdHash,
        folder_path: folderPath,
        classified_role: classifiedRole,
        resume_changes: result,
        status: 'draft',
        suitability_pct: suitabilityPct,
      })
      .select()
      .single()

    if (appErr) {
      console.error('Failed to save application:', appErr)
      return NextResponse.json({ error: 'Failed to save application' }, { status: 500 })
    }

    // Update score on seen_jobs if not already scored
    if (suitabilityPct && !job.score) {
      await supabaseAdmin
        .from('seen_jobs')
        .update({
          score: suitabilityPct,
          classified_role: classifiedRole,
        })
        .eq('hash', jdHash)
    }

    return NextResponse.json({
      application_id: app.id,
      folder_path: folderPath,
      classified_role: classifiedRole,
      suitability_pct: suitabilityPct,
      tier,
      resume_changes: result,
      model: MODELS.GENERATE,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Generate resume error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}