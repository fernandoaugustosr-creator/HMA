import { getNurses, getSections } from '@/app/actions'
import NurseList from '@/components/NurseList'
import { redirect } from 'next/navigation'
import { getCurrentPortalConfig, getCurrentSessionUser } from '@/lib/portal-session'

export const dynamic = 'force-dynamic'

export default async function ServidoresPage() {
  const portalConfig = getCurrentPortalConfig()
  const user = getCurrentSessionUser()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'COORDENACAO_GERAL' || user?.cpf === '02170025367'

  if (!isAdmin) {
    redirect(portalConfig.loginPath)
  }

  const [nurses, sections] = await Promise.all([getNurses(), getSections()])

  return (
    <div className="w-full">
      <div className="mb-8 flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-800">Servidores</h1>
           <p className="text-gray-600">Gerencie a equipe de enfermagem.</p>
        </div>
      </div>
      
      <NurseList nurses={nurses} sections={sections} />
    </div>
  )
}
