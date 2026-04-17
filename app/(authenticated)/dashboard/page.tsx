import { getUserDashboardData, getCoordinationRequests, getTimeOffRequests, getRecentAbsences, getAbsenceSettings, getBirthdaysForMonth } from '@/app/actions'
import { getSwapRequests } from '@/app/swap-actions'
import { redirect } from 'next/navigation'
import MyShifts from './MyShifts'
import AdminDailySchedule from './AdminDailySchedule'
import PendingSwapsList from './PendingSwapsList'
import ManagementReportButton from '@/components/ManagementReportButton'

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { month?: string; year?: string; birthdayMonth?: string }
}) {
  const [data, recentAbsences, absenceSettings, swaps] = await Promise.all([
    getUserDashboardData(),
    getRecentAbsences(),
    getAbsenceSettings(),
    getSwapRequests()
  ])

  if (!data) {
    redirect('/')
  }

  const { shifts, timeOffs, user } = data

  const now = new Date()
  const rawMonth = searchParams?.month ? parseInt(searchParams.month, 10) : NaN
  const rawYear = searchParams?.year ? parseInt(searchParams.year, 10) : NaN
  const rawBirthdayMonth = searchParams?.birthdayMonth ? parseInt(searchParams.birthdayMonth, 10) : NaN

  const selectedMonth = rawMonth >= 1 && rawMonth <= 12 ? rawMonth : now.getMonth() + 1
  const selectedYear = rawYear >= 2000 && rawYear <= 2100 ? rawYear : now.getFullYear()
  const selectedBirthdayMonth = rawBirthdayMonth >= 1 && rawBirthdayMonth <= 12 ? rawBirthdayMonth : now.getMonth() + 1
  const birthdays = await getBirthdaysForMonth(selectedBirthdayMonth)

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

  const filteredCoordinatorSwaps = swaps.filter((s: any) => 
    s.status === 'pending' || isSameMonthYear(s.requester_shift_date)
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

  const currentMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || ''

  const currentYearValue = now.getFullYear()
  const yearOptions = Array.from({ length: 5 }, (_, index) => currentYearValue - 2 + index)

  return (
    <div className="w-full p-4 space-y-6">
      <div className="bg-white shadow rounded-lg p-6 font-sans">
        <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Bem-vindo(a), {user.name}</h1>
        <p className="text-gray-600 font-medium">{user.role}</p>
      </div>

      <AdminDailySchedule />

      {/* MyShifts (Moved up, Non-Coordinators only) */}
      {user.role !== 'COORDENADOR' && user.role !== 'COORDENACAO_GERAL' && (
         <MyShifts shifts={shifts} currentUserId={user.id} />
      )}

      {/* Grid containing Recent Absences and MyTimeOffs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Minhas Folgas (or Admin Approvals) */}
          {user.role !== 'COORDENADOR' && user.role !== 'COORDENACAO_GERAL' && (
            <div className="bg-white shadow rounded-lg p-6 flex flex-col h-full font-sans">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {user.isAdmin ? 'Todas as Folgas' : 'Minhas Folgas'}
                  </h2>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">{timeOffs.length}</span>
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
                              <p className="text-xs text-gray-500 mt-1 font-medium">{req.reason || 'Sem motivo'}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${getStatusColor(req.status)}`}>
                              {getStatusText(req.status)}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
            </div>
          )}

          {/* Pending Swaps for Approval */}
          <PendingSwapsList swaps={swaps} currentUserId={user.id} />
      </div>

      <div className="bg-white shadow rounded-lg p-6 font-sans">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800 tracking-tight">Aniversariantes do mês</h2>
          <p className="text-xs text-gray-500 mt-1">Mês selecionado: {monthOptions.find(m => m.value === selectedBirthdayMonth)?.label}</p>
        </div>

        <div className="flex items-center justify-between mb-3">
          <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full font-bold">{birthdays.length}</span>
          <form className="flex items-center gap-2">
            <input type="hidden" name="month" value={String(selectedMonth)} />
            <input type="hidden" name="year" value={String(selectedYear)} />
            <label htmlFor="birthdayMonth" className="text-xs text-gray-600 font-semibold">Mês</label>
            <select
              id="birthdayMonth"
              name="birthdayMonth"
              defaultValue={String(selectedBirthdayMonth)}
              className="border border-gray-300 rounded px-2 py-1 text-xs bg-white text-gray-800 font-semibold"
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="bg-indigo-600 text-white px-2 py-1 rounded text-xs font-bold hover:bg-indigo-700 transition-colors"
            >
              Filtrar
            </button>
          </form>
        </div>
        {birthdays.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum aniversariante cadastrado neste mês.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {birthdays.map((b: any) => (
              <div key={b.id} className="flex items-center gap-3 px-3 py-2 rounded border border-gray-100 bg-gray-50">
                <span className="w-9 text-center font-black text-indigo-700">{String(b.day).padStart(2, '0')}</span>
                <span className="text-sm font-semibold text-gray-900 truncate">{b.name}</span>
              </div>
            ))}
          </div>
        )}
        <div className="text-xs text-gray-400 mt-3">Exibe somente o dia (sem o ano).</div>
      </div>

      {(user.role === 'COORDENADOR' || user.role === 'COORDENACAO_GERAL') && (
        <div className="space-y-4 font-sans">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-800 tracking-tight">Cadastros por período</h2>
              <ManagementReportButton 
                selectedMonth={selectedMonth} 
                selectedYear={selectedYear} 
                monthLabel={currentMonthLabel}
              />
            </div>
            <form className="flex items-center gap-2 text-sm text-gray-700">
              <label htmlFor="month" className="sr-only">
                Mês
              </label>
              <select
                id="month"
                name="month"
                defaultValue={String(selectedMonth)}
                className="border border-gray-300 rounded px-2 py-1 bg-white text-gray-800 font-bold"
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
                className="border border-gray-300 rounded px-2 py-1 bg-white text-gray-800 font-bold"
              >
                {yearOptions.map((yearOption) => (
                  <option key={yearOption} value={yearOption}>
                    {yearOption}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="bg-indigo-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-indigo-700 transition-colors"
              >
                Aplicar
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white shadow rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 tracking-tight">Trocas de Plantão</h3>
                <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full font-bold">
                  {filteredCoordinatorSwaps.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                {filteredCoordinatorSwaps.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma troca registrada neste período.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Solicitante → Solicitado</th>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Data</th>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCoordinatorSwaps.slice(0, 50).map((swap: any) => (
                        <tr key={swap.id}>
                          <td className="px-2 py-1 text-gray-900">
                             <div className="flex flex-col">
                                <span className="font-bold">{swap.requester_name || '...'}</span>
                                <span className="text-xs text-gray-500">→ {swap.requested_name || '...'}</span>
                             </div>
                          </td>
                          <td className="px-2 py-1 text-gray-700">
                            <div className="flex flex-col">
                                <span className="font-medium">{formatDate(swap.requester_shift_date)}</span>
                                {swap.requested_shift_date && <span className="text-xs text-gray-500">({formatDate(swap.requested_shift_date)})</span>}
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-bold ${getStatusColor(
                                swap.status
                              )}`}
                            >
                              {getStatusText(swap.status)}
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
                <h3 className="text-lg font-semibold text-gray-800 tracking-tight">Folgas cadastradas</h3>
                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">
                  {filteredCoordinatorTimeOffs.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                {filteredCoordinatorTimeOffs.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma folga registrada neste período.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Servidor</th>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Período</th>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCoordinatorTimeOffs.slice(0, 5).map((req: any) => (
                        <tr key={req.id}>
                          <td className="px-2 py-1 text-gray-900 font-bold">
                            {req.nurses?.name || 'Desconhecido'}
                          </td>
                          <td className="px-2 py-1 text-gray-700 font-medium">
                            {formatDate(req.start_date)}
                            {req.end_date && req.end_date !== req.start_date
                              ? ` - ${formatDate(req.end_date)}`
                              : ''}
                          </td>
                          <td className="px-2 py-1">
                            <span
                              className={`text-xs px-2 py-1 rounded-full font-bold ${getStatusColor(
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
                <h3 className="text-lg font-semibold text-gray-800 tracking-tight">Faltas</h3>
                <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">
                  {filteredCoordinatorAbsences.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                {filteredCoordinatorAbsences.length === 0 ? (
                  <p className="text-sm text-gray-500">Nenhuma falta registrada neste período.</p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Servidor</th>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Data</th>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Motivo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCoordinatorAbsences.slice(0, 5).map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-2 py-1 text-gray-900 font-bold">
                            {item.nurse_name || findNurseName(item.nurse_id)}
                          </td>
          <td className="px-2 py-1 text-gray-700 font-medium">
            {item.date ? formatDate(item.date) : '—'}
          </td>
                          <td
                            className="px-2 py-1 text-gray-500 truncate max-w-xs font-medium"
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
                <h3 className="text-lg font-semibold text-gray-800 tracking-tight">Solicitações de pagamentos</h3>
                <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-bold">
                  {filteredCoordinatorPayments.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                {filteredCoordinatorPayments.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhum pagamento solicitado neste período.
                  </p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Servidor</th>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Data</th>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Horas</th>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Local</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCoordinatorPayments.slice(0, 5).map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-2 py-1 text-gray-900 font-bold">
                            {item.nurse_name || findNurseName(item.nurse_id)}
                          </td>
                          <td className="px-2 py-1 text-gray-700 font-medium">
                            {item.shift_date
                              ? new Date(item.shift_date).toLocaleDateString('pt-BR')
                              : '—'}
                          </td>
                          <td className="px-2 py-1 text-gray-700 font-bold">
                            {item.shift_hours ? `${item.shift_hours}h` : '—'}
                          </td>
                          <td
                            className="px-2 py-1 text-gray-500 truncate max-w-xs font-medium"
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
                <h3 className="text-lg font-semibold text-gray-800 tracking-tight">Outras solicitações</h3>
                <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full font-bold">
                  {filteredCoordinatorGeneralRequests.length}
                </span>
              </div>
              <div className="overflow-x-auto">
                {filteredCoordinatorGeneralRequests.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    Nenhuma outra solicitação registrada neste período.
                  </p>
                ) : (
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Descrição</th>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Servidor</th>
                        <th className="px-2 py-1 text-left font-bold text-gray-700">Data</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredCoordinatorGeneralRequests.slice(0, 5).map((item: any) => (
                        <tr key={item.id}>
                          <td className="px-2 py-1 text-gray-900 font-medium">{item.content}</td>
                          <td className="px-2 py-1 text-gray-700 font-bold">
                            {item.nurse_name || findNurseName(item.nurse_id)}
                          </td>
                          <td className="px-2 py-1 text-gray-700 font-medium">
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
