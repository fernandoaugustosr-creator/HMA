import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ensureSamuUnit, getNurses, getSections } from '@/app/actions'
import NurseList from '@/components/NurseList'

export const dynamic = 'force-dynamic'

export default async function SamuServidoresPage() {
  const session = cookies().get('session_user')
  const user = session ? JSON.parse(session.value) : null
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'COORDENACAO_GERAL' || user?.cpf === '02170025367'

  if (!isAdmin) {
    redirect('/dashboard')
  }

  const [samuUnit, nurses, sections] = await Promise.all([
    ensureSamuUnit(),
    getNurses(),
    getSections()
  ])

  const samuNurses = (nurses || []).filter((nurse: any) => String(nurse.unit_id || '') === String(samuUnit.id))

  return (
    <div className="w-full">
      <div className="mb-8 px-4 pt-4 md:px-6 md:pt-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Servidores SAMU</h1>
          <p className="text-gray-600">
            Cadastre aqui somente os servidores que podem acessar a escala exclusiva do SAMU.
          </p>
        </div>
      </div>

      <div className="px-4 pb-6 md:px-6">
        <NurseList
          nurses={samuNurses}
          sections={sections}
          forcedUnitId={String(samuUnit.id)}
          scopeLabel="SAMU"
          emptyMessage="Nenhum servidor SAMU cadastrado."
        />
      </div>
    </div>
  )
}
