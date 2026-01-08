'use client'

import { useState, useEffect } from 'react'
import { getDailyShifts } from '@/app/actions'

export default function AdminDailySchedule() {
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])
    const [shifts, setShifts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        async function fetchShifts() {
            setLoading(true)
            try {
                const res = await getDailyShifts(selectedDate)
                if (res.success && res.data) {
                    setShifts(res.data)
                } else {
                    setShifts([])
                }
            } catch (error) {
                console.error('Error fetching daily shifts:', error)
            } finally {
                setLoading(false)
            }
        }
        fetchShifts()
    }, [selectedDate])

    const getShiftTypeLabel = (type: string) => {
        switch (type) {
            case 'day': return 'Diurno (07:00 - 19:00)'
            case 'night': return 'Noturno (19:00 - 07:00)'
            case 'morning': return 'Manhã'
            case 'afternoon': return 'Tarde'
            default: return type
        }
    }

    // Agrupar plantões por setor (Unit)
    const groupedShifts = shifts.reduce((acc: any, shift: any) => {
        const unit = shift.unit_name || 'Sem Setor'
        if (!acc[unit]) {
            acc[unit] = []
        }
        acc[unit].push(shift)
        return acc
    }, {})

    // Ordenar setores alfabeticamente
    const sortedUnits = Object.keys(groupedShifts).sort()

    return (
        <div className="bg-white shadow rounded-lg p-6 flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Plantões do Dia
                </h2>
                <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-gray-300 rounded px-2 py-1 text-sm bg-white text-gray-800"
                />
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-96">
                {loading ? (
                    <div className="text-center py-4 text-gray-500">Carregando...</div>
                ) : shifts.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">Nenhum profissional escalado para esta data.</p>
                ) : (
                    <div className="space-y-6">
                        {sortedUnits.map((unit) => (
                            <div key={unit}>
                                <h3 className="text-sm font-bold text-gray-700 bg-gray-50 px-3 py-2 rounded mb-2 border-l-4 border-indigo-500">
                                    {unit}
                                </h3>
                                <ul className="space-y-3 pl-2">
                                    {groupedShifts[unit].map((shift: any, index: number) => (
                                        <li key={shift.id || index} className="border-b border-gray-100 pb-2 last:border-0">
                                            <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-gray-800">{shift.nurse_name}</p>
                                                <p className="text-xs text-gray-500">
                                                    {shift.nurse_role} • {shift.unit_name || 'Sem Setor'}
                                                </p>
                                            </div>
                                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${shift.shift_type === 'night' ? 'bg-indigo-100 text-indigo-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                    {shift.shift_type === 'day' ? 'DIA' : shift.shift_type === 'night' ? 'NOITE' : (shift.shift_type || 'N/A').toUpperCase()}
                                                </span>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
