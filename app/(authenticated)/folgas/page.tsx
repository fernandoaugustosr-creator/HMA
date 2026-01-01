import { getTimeOffRequests, getNurses } from '@/app/actions'
import RequestForm from './RequestForm'
import RequestList from './RequestList'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'

export default async function FolgasPage() {
  const requests = await getTimeOffRequests()
  
  const session = cookies().get('session_user')
  const user = session ? JSON.parse(session.value) : null
  const isAdmin = user?.cpf === '02170025367'

  const nurses = isAdmin ? await getNurses() : []

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Gestão de Folgas</h1>
        <p className="text-gray-600">Solicite e acompanhe suas folgas.</p>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">
          {isAdmin ? 'Cadastrar Folga' : 'Nova Solicitação'}
        </h2>
        <RequestForm nurses={nurses} />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-700">
                {isAdmin ? 'Solicitações Recebidas' : 'Minhas Solicitações'}
            </h2>
        </div>
        <RequestList requests={requests} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
