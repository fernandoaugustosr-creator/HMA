import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isSamuPath = path.startsWith('/samu')
  const portalConfig = isSamuPath
    ? {
        sessionCookieName: 'session_user_samu',
        loginPath: '/samu',
        dashboardPath: '/samu/dashboard',
        changePasswordPath: '/samu/alterar-senha',
      }
    : {
        sessionCookieName: 'session_user',
        loginPath: '/',
        dashboardPath: '/dashboard',
        changePasswordPath: '/alterar-senha',
      }
  const session = request.cookies.get(portalConfig.sessionCookieName)
  const loginPath = portalConfig.loginPath
  const dashboardPath = portalConfig.dashboardPath
  const changePasswordPath = portalConfig.changePasswordPath
  const isPublicPath = isSamuPath ? path === '/samu' : path === '/login' || path === '/'

  if (isPublicPath) {
    if (session) {
      return NextResponse.redirect(new URL(dashboardPath, request.url))
    }
    return NextResponse.next()
  }

  if (!session) {
    return NextResponse.redirect(new URL(loginPath, request.url))
  }

  const currentUser = session.value
  
  if (currentUser) {
    try {
      const user = JSON.parse(currentUser)
      if (user.mustChangePassword && !request.nextUrl.pathname.startsWith(changePasswordPath)) {
        return NextResponse.redirect(new URL(changePasswordPath, request.url))
      }
    } catch (e) {
      const response = NextResponse.redirect(new URL(loginPath, request.url))
      response.cookies.delete(portalConfig.sessionCookieName)
      return response
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
