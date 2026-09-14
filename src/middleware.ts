import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Rutas que requieren sesión de business owner
const PROTECTED_BUSINESS_ROUTES = [
  '/dashboard',
  '/cards',
  '/scanner',
  '/customers',
  '/settings',
  '/poster',
  '/onboarding',
]

// Rutas públicas (sin auth requerida)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PUBLIC_ROUTES = ['/', '/login', '/register', '/join', '/pricing']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Dev-only CORS for the Flutter mobile app's web preview (flutter build web
  // served from a different localhost port has no native-app exemption from
  // browser CORS). Never applies in production or to non-localhost origins.
  if (process.env.NODE_ENV !== 'production' && pathname.startsWith('/api/mobile/')) {
    const origin = request.headers.get('origin')
    const isLocalOrigin = origin && /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2)(:\d+)?$/.test(origin)
    if (request.method === 'OPTIONS') {
      const preflight = new NextResponse(null, { status: 204 })
      if (isLocalOrigin) {
        preflight.headers.set('Access-Control-Allow-Origin', origin)
        preflight.headers.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS')
        preflight.headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type')
      }
      return preflight
    }
    if (isLocalOrigin) {
      supabaseResponse.headers.set('Access-Control-Allow-Origin', origin)
    }
  }
  const isProtected = PROTECTED_BUSINESS_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))

  // Redirigir a login si intenta acceder a ruta protegida sin sesión
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(url)
  }

  // Redirigir al dashboard si ya tiene sesión e intenta ir a login/register
  if (user && (pathname === '/login' || pathname === '/register')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
