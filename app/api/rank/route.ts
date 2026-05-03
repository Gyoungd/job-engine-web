import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { callAnthropic, MODELS } from '@/lib/anthropic'
import { SKILLS_MATRIX, PROJECTS_INVENTORY, ROLE_SIGNALS } from '@/lib/profile-context'

interface RankResult {
  hash: string
  score: number
  classified_role: string
  reasoning: string
}

const SYSTEM_PROMPT = `You are a job-fit scoring engine. You evaluate job descriptions against a candidate's verified skills and project portfolio.

CANDIDATE PROFILE:
${SKILLS_MATRIX}

PROJECT PORTFOLIO:
${PROJECTS_INVENTORY}

SCORING RULES:
- Score 0-100 based on skill match, experience relevance, and seniority fit
- 90-100: Near-perfect match, candidate has all required skills + relevant projects
- 80-89: Strong match, most skills present, minor gaps
- 70-79: Good match, core skills present but some gaps
- 60-69: Partial match, significant skill gaps but transferable experience
- Below 60: Weak match
- Candidate is a recent Master's graduate — penalize roles requiring 5+ years senior experience
- Only consider skills from the verified stack above
- Classify role as DA (Data Analyst), DS (Data Scientist), or DE (Data Engineer)

OUTPUT FORMAT (strict JSON array, no markdown):
[{"hash":"<hash>","score":<number>,"classified_role":"<DA|DS|DE>","reasoning":"<1-2 sentences>"}]`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const mode: string = body.mode ?? 'top10'
    const hashes: string[] = body.jd_hashes ?? []
    const limit = Math.min(body.limit ?? 10, 20)

    // Fetch jobs to score
    let jobs: any[]

    if (mode === 'top10' || hashes.length === 0) {
      // Score unscored jobs, newest first
      const { data, error } = await supabaseAdmin
        .from('seen_jobs')
        .select('hash, title, company, location, source_region, classified_role')
        .is('score', null)
        .order('first_seen', { ascending: false })
        .limit(limit)

      if (error) throw error
      jobs = data ?? []
    } else {
      // Score specific jobs
      const { data, error } = await supabaseAdmin
        .from('seen_jobs')
        .select('hash, title, company, location, source_region, classified_role')
        .in('hash', hashes)

      if (error) throw error
      jobs = data ?? []
    }

    if (jobs.length === 0) {
      return NextResponse.json({ scores: [], message: 'No unscored jobs found' })
    }

    // Build prompt with all jobs
    const jobList = jobs.map((j, i) => (
      `${i + 1}. hash="${j.hash}" | title="${j.title}" | company="${j.company ?? 'N/A'}" | location="${j.location ?? 'N/A'}" | region="${j.source_region ?? 'unknown'}"`
    )).join('\n')

    const prompt = `Score these ${jobs.length} job descriptions for fit with the candidate profile.

JOB LISTINGS:
${jobList}

Return a JSON array with exactly ${jobs.length} items. No markdown fences, just raw JSON.`

    // Call Haiku
    const raw = await callAnthropic({
      model: MODELS.RANK,
      system: SYSTEM_PROMPT,
      prompt,
      maxTokens: 2048,
    })

    // Parse response
    let scores: RankResult[]
    try {
      // Strip potential markdown fences
      const cleaned = raw.replace(/```json\s*|```\s*/g, '').trim()
      scores = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse rank response:', raw)
      return NextResponse.json(
        { error: 'Failed to parse scoring response', raw },
        { status: 500 }
      )
    }

    // Validate and store scores
    const results: RankResult[] = []

    for (const s of scores) {
      if (!s.hash || typeof s.score !== 'number') continue

      const score = Math.max(0, Math.min(100, Math.round(s.score)))
      const role = ['DA', 'DS', 'DE'].includes(s.classified_role)
        ? s.classified_role
        : 'unknown'

      const { error } = await supabaseAdmin
        .from('seen_jobs')
        .update({
          score,
          score_reasoning: s.reasoning ?? '',
          classified_role: role,
        })
        .eq('hash', s.hash)

      if (!error) {
        results.push({ ...s, score, classified_role: role })
      }
    }

    return NextResponse.json({
      scores: results,
      scored_count: results.length,
      model: MODELS.RANK,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('Rank error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}