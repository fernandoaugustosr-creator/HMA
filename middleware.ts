import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const currentUser = request.cookies.get('session_user')?.value

  // Se não estiver logado e não estiver na página de login, redirecionar para login
  if (!currentUser && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  // Se estiver logado
  if (currentUser) {
    // Se tentar acessar a página de login, redirecionar para home
    if (request.nextUrl.pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    try {
      const user = JSON.parse(currentUser)
      // Se precisar trocar a senha e não estiver na página de alterar senha
      if (user.mustChangePassword && !request.nextUrl.pathname.startsWith('/alterar-senha')) {
        return NextResponse.redirect(new URL('/alterar-senha', request.url))
      }
    } catch (e) {
      // Erro no cookie, força logout
      const response = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.delete('session_user')
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
