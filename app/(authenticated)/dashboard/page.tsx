import { getUserDashboardData } from '@/app/actions'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const data = await getUserDashboardData()

  if (!data) {
    redirect('/login')
  }

  const { shifts, timeOffs, user } = data

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800'
      case 'rejected': return 'bg-red-100 text-red-800'
      default: return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Aprovado'
      case 'rejected': return 'Rejeitado'
      default: return 'Pendente'
    }
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800">Bem-vindo(a), {user.name}</h1>
        <p className="text-gray-600">{user.role}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Meus Plantões */}
        <div className="bg-white shadow rounded-lg p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Meus Plantões
            </h2>
            <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">{shifts.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-96">
            {shifts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Nenhum plantão agendado.</p>
            ) : (
              <ul className="space-y-2">
                {shifts.map((shift: any) => (
                  <li key={shift.id || `${shift.date}_${shift.nurse_id}`} className="border-b border-gray-100 pb-2 last:border-0">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">{formatDate(shift.shift_date || shift.date)}</span>
                      <span className="text-sm text-gray-500 capitalize">{shift.type === 'day' ? 'Dia' : 'Noite'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Minhas Trocas */}
        <div className="bg-white shadow rounded-lg p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Minhas Trocas
            </h2>
            <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">0</span>
          </div>
          
          <div className="flex-1">
             {/* Placeholder for now as Trocas logic is not fully defined/implemented */}
            <p className="text-gray-500 text-sm text-center py-4">Funcionalidade em breve.</p>
          </div>
        </div>

        {/* Minhas Folgas */}
        <div className="bg-white shadow rounded-lg p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {user.isAdmin ? 'Todas as Folgas' : 'Minhas Folgas'}
            </h2>
            <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">{timeOffs.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-96">
            {timeOffs.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Nenhuma solicitação.</p>
            ) : (
              <ul className="space-y-3">
                {timeOffs.map((req: any) => (
                  <li key={req.id} className="border-b border-gray-100 pb-2 last:border-0">
                    <div className="flex justify-between items-start">
                      <div>
                        {user.isAdmin && (
                            <p className="text-xs font-bold text-indigo-600 mb-0.5">{req.nurse_name}</p>
                        )}
                        <p className="text-sm font-medium text-gray-800">
                          {formatDate(req.start_date)} {req.end_date && req.end_date !== req.start_date ? ` - ${formatDate(req.end_date)}` : ''}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{req.reason || 'Sem motivo'}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(req.status)}`}>
                        {getStatusText(req.status)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
