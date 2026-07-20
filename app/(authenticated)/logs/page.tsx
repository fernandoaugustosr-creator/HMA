import { checkUser, getLoginLogs } from '@/app/actions'
import LogsClient from './LogsClient'
import { redirect } from 'next/navigation'
import { getCurrentPortalConfig } from '@/lib/portal-session'

export const dynamic = 'force-dynamic'

export default async function LogsPage() {
  const portalConfig = getCurrentPortalConfig()
  const user = await checkUser()
  const isDirector = user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'

  if (!isDirector) {
    redirect(portalConfig.loginPath)
  }

  const res = await getLoginLogs()
  const loginLogs = res.success && Array.isArray(res.logs) ? res.logs : []

  return (
    <div className="w-full p-4 py-8">
      <LogsClient loginLogs={loginLogs} isDirector={isDirector} />
    </div>
  )
}
