import { cookies } from 'next/headers'
import dynamic from 'next/dynamic'
import Sidebar from '@/components/Sidebar'
import SupabaseStatus from '@/components/SupabaseStatus'
import ReportLauncherProvider from '@/components/ReportLauncher'
import ReportsPermissionModalProvider from '@/components/ReportsPermissionModalProvider'
import { redirect } from 'next/navigation'
import {
  getEditableUnits,
  logout,
  evaluateReportsPermissionsForCurrentUser,
  evaluateSidebarPermissionsForCurrentUser,
  getRandomMotivationalPhrase,
  type MotivationalPhrase,
} from '@/app/actions'
import { SESSION_IDLE_TIMEOUT_SECONDS } from '@/lib/constants'
import { SIDEBAR_MENU_ITEMS } from '@/lib/sidebar-menu-items'
import type { SidebarMenuItemId } from '@/lib/sidebar-menu-items'

// Lazy load: estes componentes rodam APENAS no cliente (tem useState/useEffect) e NAO participam do first paint.
// Reduz bundle inicial do layout autenticado em ~25%.
const MotivationalPopup = dynamic(() => import('@/components/MotivationalPopup'), { ssr: false })
const IdleSessionKeeper = dynamic(() => import('@/components/IdleSessionKeeper'), { ssr: false })

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sessionCookie = cookies().get('session_user')
  
  if (!sessionCookie) {
    redirect('/login')
  }

  const user = JSON.parse(sessionCookie.value)
  const editableUnits = await getEditableUnits()

  const role = (user?.role || '').toUpperCase()
  const cpf = String(user?.cpf || '').replace(/\D/g, '')
  const isAdmin =
    role === 'ADMIN' ||
    role === 'COORDENACAO_GERAL' ||
    cpf === '02170025367'

  const loginNonce: string | null = typeof user?.login_nonce === 'string' && user.login_nonce.length > 0
    ? user.login_nonce
    : null

  // 🔐 Permissões completas do Sidebar (todos os menus + relatórios)
  // Fallback seguro: se erro na avaliação, usa hard-coded padrão
  let menuPerms: Record<SidebarMenuItemId, boolean>
  let sidebarReports: { management: boolean; scheduled: boolean; canSeeMenu: boolean }

  try {
    const sidebarEval = await evaluateSidebarPermissionsForCurrentUser()
    menuPerms = sidebarEval.items
    sidebarReports = {
      management: sidebarEval.reports.management,
      scheduled: sidebarEval.reports.scheduled,
      canSeeMenu: sidebarEval.canSeeReportsMenu,
    }
  } catch (e: any) {
    console.warn('Erro ao avaliar permissões do sidebar, fallback hard-coded:', e?.message || String(e))
    const isCoordenadorSetor = role === 'COORDENADOR'
    menuPerms = Object.fromEntries(
      (SIDEBAR_MENU_ITEMS as unknown as { id: SidebarMenuItemId; defaultLevel: string }[]).map(item => {
        const level = item.defaultLevel
        let visible = true
        if (level === 'COORD_GERAL_ONLY') visible = !!isAdmin
        else if (level === 'COORD_SETOR') visible = !!isAdmin || !!isCoordenadorSetor
        return [item.id, visible]
      })
    ) as Record<SidebarMenuItemId, boolean>
    sidebarReports = {
      management: !!isAdmin,
      scheduled: !!isAdmin || !!isCoordenadorSetor,
      canSeeMenu: !!isAdmin || !!isCoordenadorSetor,
    }
  }

  // Fallback legado de reports perms (para manter compat com provider antigo)
  let permEvaluation: { canSeeMenu: boolean; canRunManagement: boolean; canRunScheduled: boolean }
  try {
    permEvaluation = await evaluateReportsPermissionsForCurrentUser()
  } catch (_) {
    permEvaluation = {
      canSeeMenu: sidebarReports.canSeeMenu,
      canRunManagement: sidebarReports.management,
      canRunScheduled: sidebarReports.scheduled,
    }
  }

  // 💬 Frase motivacional do dia (carregada e seeded no RSC para garantir exibição)
  let motivationalPhrase: MotivationalPhrase | null = null
  try {
    motivationalPhrase = await getRandomMotivationalPhrase()
  } catch (_) { motivationalPhrase = null }

  return (
    <ReportsPermissionModalProvider>
      <ReportLauncherProvider
        canRunManagementReport={permEvaluation.canRunManagement}
        canRunScheduledReport={permEvaluation.canRunScheduled}
      >
        <div className="flex flex-col md:flex-row min-h-screen bg-white">
          <div className="no-print md:h-screen md:sticky md:top-0">
            <Sidebar
              user={user}
              initialEditableUnits={editableUnits || []}
              basePath=""
              portalLabel="HMA"
              logoutAction={logout}
              canSeeReports={sidebarReports.canSeeMenu}
              menuPerms={menuPerms}
            />
          </div>
          <main className="flex-1 flex flex-col w-full overflow-x-hidden">
            <div className="flex-1 w-full relative bg-gradient-to-b from-slate-50 via-indigo-50/40 to-slate-100">
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl" />
                <div className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-blue-400/10 blur-3xl" />
                <div className="absolute top-48 right-16 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl hidden md:block" />
              </div>
              <div className="relative w-full">
                {children}
              </div>
            </div>
          </main>
        </div>
        <MotivationalPopup phrase={motivationalPhrase} loginNonce={loginNonce} />
        <IdleSessionKeeper
          idleTimeoutSeconds={SESSION_IDLE_TIMEOUT_SECONDS}
          loginPath="/"
          loginNonce={loginNonce}
        />
      </ReportLauncherProvider>
    </ReportsPermissionModalProvider>
  )
}
