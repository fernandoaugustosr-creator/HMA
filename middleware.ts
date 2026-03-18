import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session_user')
  const path = request.nextUrl.pathname

  // Public paths that don't require authentication
  // We now allow '/' to be public
  if (path === '/login' || path === '/') {
    if (session) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  if (!session) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const currentUser = session.value
  
  // Se estiver logado
  if (currentUser) {
    try {
      const user = JSON.parse(currentUser)
      // Se precisar trocar a senha e não estiver na página de alterar senha
      if (user.mustChangePassword && !request.nextUrl.pathname.startsWith('/alterar-senha')) {
        return NextResponse.redirect(new URL('/alterar-senha', request.url))
      }
    } catch (e) {
      // Erro no cookie, força logout
      const response = NextResponse.redirect(new URL('/', request.url))
      response.cookies.delete('session_user')
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
