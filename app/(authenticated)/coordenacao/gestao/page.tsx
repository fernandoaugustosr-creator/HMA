import { getSections, getNurses, checkAdmin } from '@/app/actions'
import GestaoClient from './GestaoClient'
import { redirect } from 'next/navigation'
import { getCurrentPortalConfig } from '@/lib/portal-session'

export const dynamic = 'force-dynamic'

export default async function GestaoPage() {
  const portalConfig = getCurrentPortalConfig()
  try {
    await checkAdmin()
  } catch (e) {
    redirect(portalConfig.loginPath)
  }

  const [sections, nurses] = await Promise.all([getSections(), getNurses()])

  return (
    <div className="w-full p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Gestão de Coordenações</h1>
        <p className="text-gray-600">Crie locais e atribua coordenadores.</p>
      </div>
      
      <GestaoClient sections={sections} nurses={nurses} />
    </div>
  )
}
