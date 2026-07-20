import { cookies } from 'next/headers'

export type PortalKey = 'hma' | 'samu'

export interface PortalConfig {
  key: PortalKey
  label: string
  basePath: string
  sessionCookieName: string
  selectionCookieName: string
  loginPath: string
  dashboardPath: string
  changePasswordPath: string
}

export const HMA_PORTAL: PortalConfig = {
  key: 'hma',
  label: 'HMA',
  basePath: '',
  sessionCookieName: 'session_user',
  selectionCookieName: 'login_selection_options',
  loginPath: '/',
  dashboardPath: '/dashboard',
  changePasswordPath: '/alterar-senha',
}

export const SAMU_PORTAL: PortalConfig = {
  key: 'samu',
  label: 'SAMU',
  basePath: '/samu',
  sessionCookieName: 'session_user_samu',
  selectionCookieName: 'login_selection_options_samu',
  loginPath: '/samu',
  dashboardPath: '/samu/dashboard',
  changePasswordPath: '/samu/alterar-senha',
}

export function getPortalConfigByPath(pathname: string): PortalConfig {
  return pathname.startsWith('/samu') ? SAMU_PORTAL : HMA_PORTAL
}

export function getCurrentPortalConfig(): PortalConfig {
  const cookieStore = cookies()
  if (cookieStore.get(SAMU_PORTAL.sessionCookieName)) {
    return SAMU_PORTAL
  }
  return HMA_PORTAL
}

export function getCurrentSessionCookie() {
  const cookieStore = cookies()
  return cookieStore.get(SAMU_PORTAL.sessionCookieName) || cookieStore.get(HMA_PORTAL.sessionCookieName)
}

export function getCurrentSessionUser<T = any>(): T | null {
  const sessionCookie = getCurrentSessionCookie()
  if (!sessionCookie) return null

  try {
    return JSON.parse(sessionCookie.value) as T
  } catch {
    return null
  }
}
