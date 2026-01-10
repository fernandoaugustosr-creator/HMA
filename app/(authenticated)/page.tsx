import { getUserDashboardData, getNurses } from '@/app/actions'
import { getSwapRequests } from '@/app/swap-actions'
import { redirect } from 'next/navigation'
import AdminDailySchedule from './dashboard/AdminDailySchedule'
import MyShifts from './dashboard/MyShifts'

export default async function DashboardPage() {
  const data = await getUserDashboardData()

  if (!data) {
    redirect('/login')
  }

  const { shifts, timeOffs, user } = data
  // We can ignore the unused variables if they are not used, but let's keep them if needed
  // const swaps = await getSwapRequests()
  // const nurses = await getNurses()

  const formatDate = (dateString: string) => {
    if (!dateString) return ''
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

      {/* Top Section: Daily Schedule for Everyone */}
      <div className="h-full">
         <AdminDailySchedule />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Meus Plantões */}
        <MyShifts shifts={shifts} currentUserId={user.id} />

        {/* Minhas Folgas (or Admin Approvals) */}
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
