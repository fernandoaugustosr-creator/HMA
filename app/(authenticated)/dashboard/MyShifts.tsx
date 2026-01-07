'use client'

interface MyShiftsProps {
    shifts: any[]
}

export default function MyShifts({ shifts }: MyShiftsProps) {
    const formatDate = (dateString: string) => {
        if (!dateString) return ''
        const [year, month, day] = dateString.split('-')
        return `${day}/${month}/${year}`
    }

    return (
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
    )
}
