import { getUserDashboardData, getCoordinationRequests, getTimeOffRequests } from '@/app/actions'
import { getSwapRequests } from '@/app/swap-actions'
import { redirect } from 'next/navigation'
import AdminDailySchedule from './dashboard/AdminDailySchedule'
import MyShifts from './dashboard/MyShifts'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { month?: string; year?: string }
}) {
  const data = await getUserDashboardData()

  if (!data) {
    redirect('/login')
  }

  const { shifts, timeOffs, user } = data

  const now = new Date()
  const rawMonth = searchParams?.month ? parseInt(searchParams.month, 10) : NaN
  const rawYear = searchParams?.year ? parseInt(searchParams.year, 10) : NaN

  const selectedMonth = rawMonth >= 1 && rawMonth <= 12 ? rawMonth : now.getMonth() + 1
  const selectedYear = rawYear >= 2000 && rawYear <= 2100 ? rawYear : now.getFullYear()

  let coordinatorAbsences: any[] = []
  let coordinatorPayments: any[] = []
  let coordinatorGeneralRequests: any[] = []
  let coordinatorTimeOffs = timeOffs

  let coordinatorNurses: any[] = []

  if (user.role === 'COORDENADOR' || user.role === 'COORDENACAO_GERAL') {
    const [coordData, timeOffData] = await Promise.all([
      getCoordinationRequests(),
      getTimeOffRequests(),
    ])

    coordinatorAbsences = coordData.absences || []
    coordinatorPayments = coordData.paymentRequests || []
    coordinatorGeneralRequests = coordData.generalRequests || []
    coordinatorTimeOffs = timeOffData || []
    coordinatorNurses = coordData.nurses || []
  }

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

  const findNurseName = (id: string | null | undefined) => {
    if (!id) return ''
    const nurse = coordinatorNurses.find((n: any) => n.id === id)
    return nurse ? nurse.name : id
  }

  const getMonthYearFromDate = (dateInput: string | null | undefined) => {
    if (!dateInput) return null
    const str = String(dateInput)
    const [yearStr, monthStr] = str.split('T')[0].split('-')
    const yearNum = parseInt(yearStr, 10)
    const monthNum = parseInt(monthStr, 10)
    if (Number.isNaN(yearNum) || Number.isNaN(monthNum)) return null
    return { year: yearNum, month: monthNum }
  }

  const isSameMonthYear = (dateInput: string | null | undefined) => {
    const parts = getMonthYearFromDate(dateInput)
    if (!parts) return false
    return parts.year === selectedYear && parts.month === selectedMonth
  }

  const filteredCoordinatorTimeOffs = coordinatorTimeOffs.filter((req: any) =>
    isSameMonthYear(req.start_date)
  )

  const filteredCoordinatorAbsences = coordinatorAbsences.filter((item: any) =>
    isSameMonthYear(item.date)
  )

  const filteredCoordinatorPayments = coordinatorPayments.filter((item: any) =>
    isSameMonthYear(item.shift_date)
  )

  const filteredCoordinatorGeneralRequests = coordinatorGeneralRequests.filter((item: any) =>
    isSameMonthYear(item.created_at)
  )

  const monthOptions = [
    { value: 1, label: 'Janeiro' },
    { value: 2, label: 'Fevereiro' },
    { value: 3, label: 'Março' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Maio' },
    { value: 6, label: 'Junho' },
    { value: 7, label: 'Julho' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Setembro' },
    { value: 10, label: 'Outubro' },
    { value: 11, label: 'Novembro' },
    { value: 12, label: 'Dezembro' },
  ]

  const currentYearValue = now.getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYearValue - 2 + index)

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

      {user.role !== 'COORDENADOR' && user.role !== 'COORDENACAO_GERAL' && (
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
      )}

      {(user.role === 'COORDENADOR' || user.role === 'COORDENACAO_GERAL') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Cadastros por período</h2>
            <form className="flex items-center gap-2 text-sm text-gray-700">
              <label htmlFor="month" className="sr-only">
                Mês
              </label>
              <select
                id="month"
                name="month"
                defaultValue={String(selectedMonth)}
                className="border border-gray-300 rounded px-2 py-1 bg-white text-gray-800"
              >
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <label htmlFor="year" className="sr-only">
                Ano
              </label>
              <select
                id="year"
                name="year"
                defaultValue={String(selectedYear)}
                className="border border-gray-300 rounded px-2 py-1 bg-white text-gray-800"
              >
                {yearOptions.map((yearOption) => (
                  <option key={yearOption} value={yearOption}>
                    {yearOption}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700"
              >
                Aplicar
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Folgas cadastradas</h3>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  {filteredCoordinatorTimeOffs.length}
                </span>
              </div>
              <div className="max-h-80 overflow-auto">
                {filteredCoordinatorTimeOffs.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma folga registrada neste período.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Servidor</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Período</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCoordinatorTimeOffs.slice(0, 5).map((req: any) => (
                        <tr key={req.id}>
                          <td className="px-2 py-1 text-gray-900">
                            {req.nurses?.name || 'Desconhecido'}
                          </td>
                          <td className="px-2 py-1 text-gray-700">
                            {formatDate(req.start_date)}
                            {req.end_date && req.end_date !== req.start_date
                              ? ` - ${formatDate(req.end_date)}`
                              : ''}
                          </td>
                          <td className="px-2 py-1">
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(
                                req.status
                              )}`}
                            >
                              {getStatusText(req.status)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Faltas</h3>
                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                  {filteredCoordinatorAbsences.length}
                </span>
              </div>
              <div className="max-h-80 overflow-auto">
                {filteredCoordinatorAbsences.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma falta registrada neste período.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Servidor</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Data</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCoordinatorAbsences.slice(0, 5).map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-2 py-1 text-gray-900">
                            {item.nurse_name || findNurseName(item.nurse_id)}
                          </td>
                          <td className="px-2 py-1 text-gray-700">
                            {item.date
                              ? new Date(item.date).toLocaleDateString('pt-BR')
                              : '—'}
                          </td>
                          <td
                            className="px-2 py-1 text-gray-500 truncate max-w-xs"
                            title={item.reason || ''}
                          >
                            {item.reason || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Solicitações de pagamentos</h3>
                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
                  {filteredCoordinatorPayments.length}
                </span>
              </div>
              <div className="max-h-80 overflow-auto">
                {filteredCoordinatorPayments.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum pagamento solicitado neste período.
                  </p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Servidor</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Data</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Horas</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Local</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCoordinatorPayments.slice(0, 5).map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-2 py-1 text-gray-900">
                            {item.nurse_name || findNurseName(item.nurse_id)}
                          </td>
                          <td className="px-2 py-1 text-gray-700">
                            {item.shift_date
                              ? new Date(item.shift_date).toLocaleDateString('pt-BR')
                              : '—'}
                          </td>
                          <td className="px-2 py-1 text-gray-700">
                            {item.shift_hours ? `${item.shift_hours}h` : '—'}
                          </td>
                          <td
                            className="px-2 py-1 text-gray-500 truncate max-w-xs"
                            title={item.location || ''}
                          >
                            {item.location || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Outras solicitações</h3>
                <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">
                  {filteredCoordinatorGeneralRequests.length}
                </span>
              </div>
              <div className="max-h-80 overflow-auto">
                {filteredCoordinatorGeneralRequests.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhuma outra solicitação registrada neste período.
                  </p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Descrição</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Servidor</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-700">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCoordinatorGeneralRequests.slice(0, 5).map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-2 py-1 text-gray-900">{item.content}</td>
                          <td className="px-2 py-1 text-gray-700">
                            {item.nurse_name || findNurseName(item.nurse_id)}
                          </td>
                          <td className="px-2 py-1 text-gray-700">
                            {item.created_at
                              ? new Date(item.created_at).toLocaleDateString('pt-BR')
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
