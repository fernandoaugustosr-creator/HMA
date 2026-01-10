'use client'

interface MyShiftsProps {
    shifts: any[]
    currentUserId: string
}

export default function MyShifts({ shifts, currentUserId }: MyShiftsProps) {
    const formatDate = (dateString: string) => {
        if (!dateString) return ''
        const [year, month, day] = dateString.split('-')
        return `${day}/${month}/${year}`
    }

    const todayStr = new Date().toISOString().split('T')[0]
    const myShifts = Array.isArray(shifts) 
        ? shifts
            .filter((s: any) => s.nurse_id === currentUserId && (s.shift_date || s.date) >= todayStr)
            .sort((a, b) => (a.shift_date || a.date).localeCompare(b.shift_date || b.date))
            .slice(0, 10) // Show next 10 shifts
        : []

    return (
        <div className="bg-white shadow rounded-lg p-6 flex flex-col h-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Meus Próximos Plantões
            </h2>
            <span className="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded-full">{myShifts.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto max-h-96">
            {myShifts.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">Nenhum plantão futuro agendado.</p>
            ) : (
              <ul className="space-y-2">
                {myShifts.map((shift: any) => (
                  <li key={shift.id || `${shift.date}_${shift.nurse_id}`} className="border-b border-gray-100 pb-2 last:border-0">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-700">{formatDate(shift.shift_date || shift.date)}</span>
                      <span className="text-sm text-gray-500 capitalize">
                        {(shift.type || shift.shift_type) === 'day' ? 'Dia' : (shift.type || shift.shift_type) === 'night' ? 'Noite' : (shift.type || shift.shift_type || 'N/A')}
                        {` • ${shift.unit_name || shift.section_name || 'Sem Setor'}`}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
    )
}
