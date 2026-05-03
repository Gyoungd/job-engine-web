import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'

const VALID_STATUSES = ['draft', 'docs_copied', 'submitted', 'sent_cold', 'online_test', 'interview', 'offer', 'rejected', 'withdrawn']

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const { data, error } = await supabaseAdmin
      .from('applications')
      .select('*, seen_jobs!inner(title, company, location, url, classified_role, score, score_reasoning)')
      .eq('id', id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const updates: Record<string, unknown> = {}

    if (body.status && VALID_STATUSES.includes(body.status)) {
      updates.status = body.status
      if (['sent_cold', 'online_test', 'interview', 'offer', 'rejected'].includes(body.status)) {
        updates.response_status = body.status
      }
    }

    if (typeof body.notes === 'string') {
      updates.notes = body.notes
    }

    if (typeof body.response_status === 'string') {
      updates.response_status = body.response_status
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const { data, error } = await supabaseAdmin
      .from('applications')
      .update(updates)
      .eq('id', id)
      .select('*, seen_jobs!inner(title, company, location, url, classified_role, score)')
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
