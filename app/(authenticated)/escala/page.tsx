import { cookies } from 'next/headers'
import Schedule from '@/components/Schedule'

export const dynamic = 'force-dynamic'

export default function SchedulePage({ searchParams }: { searchParams?: { tab?: string, unit?: string } }) {
  const session = cookies().get('session_user')
  const user = session ? JSON.parse(session.value) : null
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'COORDENACAO_GERAL' || user?.cpf === '02170025367'
  const isCadastro = searchParams?.tab === 'cadastro'
  return (
    <div className="w-full">
      {isCadastro && (
        <div className="p-4 md:p-6 pb-0">
          <h1 className="text-xl md:text-2xl font-bold text-indigo-700">Cadastro de escalas</h1>
          <p className="text-sm text-gray-600">
            Use a grade abaixo no modelo tipo Excel para cadastrar a escala mensal.
          </p>
        </div>
      )}
      <Schedule isAdmin={isAdmin} initialUnitId={searchParams?.unit} />
    </div>
  )
}
