import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Schedule from '@/components/Schedule'
import { ensureSamuUnit, getMyScalePermissionUnitIds, getSamuUnit } from '@/app/actions'

export const dynamic = 'force-dynamic'

export default async function SamuSchedulePage() {
  const session = cookies().get('session_user')
  const user = session ? JSON.parse(session.value) : null
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'COORDENACAO_GERAL' || user?.cpf === '02170025367'

  const samuUnit = isAdmin ? await ensureSamuUnit() : await getSamuUnit()
  if (!samuUnit) {
    redirect('/dashboard')
  }

  if (!isAdmin) {
    const unitIds = await getMyScalePermissionUnitIds()
    const hasAccess = unitIds.includes('*') || unitIds.some((unitId) => String(unitId) === String(samuUnit.id))
    if (!hasAccess) {
      redirect('/dashboard')
    }
  }

  return (
    <div className="w-full">
      <div className="p-4 md:p-6 pb-0">
        <h1 className="text-xl md:text-2xl font-bold text-indigo-700">Escala SAMU</h1>
        <p className="text-sm text-gray-600">
          Area exclusiva da escala do SAMU, com acesso restrito aos servidores liberados.
        </p>
      </div>
      <div className="download-print-root">
        <Schedule
          isAdmin={isAdmin}
          initialUnitId={String(samuUnit.id)}
          initialUnitName={String(samuUnit.title || 'SAMU')}
          lockedUnitIds={[String(samuUnit.id)]}
        />
      </div>
    </div>
  )
}
