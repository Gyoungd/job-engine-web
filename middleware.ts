import { NextResponse, type NextRequest } from 'next/server'
import { ALLOWED_EMAILS, updateSession } from './lib/supabase/middleware'

const PUBLIC_PATHS = new Set(['/', '/login', '/auth/callback'])

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const { res, user } = await updateSession(req)

  const isApi = pathname.startsWith('/api/')
  const isPublic = PUBLIC_PATHS.has(pathname)
  const authed = !!user && !!user.email && ALLOWED_EMAILS.has(user.email)

  if (authed) {
    if (pathname === '/' || pathname === '/login') {
      const url = req.nextUrl.clone()
      url.pathname = '/dashboard'
      url.search = ''
      return NextResponse.redirect(url)
    }
    return res
  }

  if (isPublic) return res

  if (isApi) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )
  }

  const url = req.nextUrl.clone()
  url.pathname = '/'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon|apple-touch-icon|manifest|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)',
  ],
}
