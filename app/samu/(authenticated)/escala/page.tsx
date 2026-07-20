import Schedule from '@/components/Schedule'
import { getCurrentSessionUser } from '@/lib/portal-session'

export const dynamic = 'force-dynamic'

export default function SamuSchedulePage({ searchParams }: { searchParams?: { tab?: string, unit?: string } }) {
  const user = getCurrentSessionUser()
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'COORDENACAO_GERAL' || user?.cpf === '02170025367'
  const isCadastro = searchParams?.tab === 'cadastro'

  return (
    <div className="w-full">
      {isCadastro && (
        <div className="p-4 md:p-6 pb-0">
          <h1 className="text-xl md:text-2xl font-bold text-red-700">Cadastro de escalas SAMU</h1>
          <p className="text-sm text-gray-600">
            Use a grade abaixo no modelo tipo Excel para cadastrar a escala mensal.
          </p>
        </div>
      )}
      <div className="download-print-root">
        <Schedule isAdmin={isAdmin} initialUnitId={searchParams?.unit} portalVariant="samu" />
      </div>
    </div>
  )
}
