import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/ssr'

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServer()
  await supabase.auth.signOut()
  const url = new URL(req.url)
  return NextResponse.redirect(`${url.origin}/`, { status: 303 })
}
