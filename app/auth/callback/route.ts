import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/ssr'
import { ALLOWED_EMAILS } from '@/lib/supabase/middleware'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const origin = url.origin

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createSupabaseServer()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user?.email || !ALLOWED_EMAILS.has(data.user.email)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=not_allowed`)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
