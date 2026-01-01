import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const currentUser = request.cookies.get('session_user')?.value

  // Se não estiver logado e não estiver na página de login, redirecionar para login
  if (!currentUser && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Se estiver logado e tentar acessar a página de login, redirecionar para home
  if (currentUser && request.nextUrl.pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
