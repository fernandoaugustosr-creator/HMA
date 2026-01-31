'use client'

import { useState, useEffect } from 'react'
import { getDailyShifts } from '@/app/actions'

export default function AdminDailySchedule() {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    const initialDate = `${year}-${month}-${day}`

    const [selectedDate, setSelectedDate] = useState<string>(initialDate)
    const [shifts, setShifts] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [openUnits, setOpenUnits] = useState<Record<string, boolean>>({})
    const [filterMode, setFilterMode] = useState<'day' | 'night' | 'all'>('day')

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

    const filteredShifts = shifts.filter((shift: any) => {
        if (filterMode === 'day') return shift.shift_type === 'day' || shift.shift_type === 'mt'
        if (filterMode === 'night') return shift.shift_type === 'night'
        return true
    })

    // Agrupar plantões por setor (Unit)
    const groupedShifts = filteredShifts.reduce((acc: any, shift: any) => {
        const unit = shift.unit_name || 'Sem Setor'
        if (!acc[unit]) {
            acc[unit] = []
        }
        acc[unit].push(shift)
        return acc
    }, {})

    // Ordenar setores alfabeticamente
    const sortedUnits = Object.keys(groupedShifts).sort()

    // Sempre que a data mudar ou os plantões mudarem, expandir todos
    useEffect(() => {
        const newOpenUnits: Record<string, boolean> = {}
        shifts.forEach((shift: any) => {
             const unit = shift.unit_name || 'Sem Setor'
             newOpenUnits[unit] = true
        })
        setOpenUnits(newOpenUnits)
    }, [shifts])

    const toggleUnit = (unit: string) => {
        setOpenUnits(prev => ({
            ...prev,
            [unit]: !prev[unit]
        }))
    }

    return (
        <div className="bg-white shadow-sm rounded-xl border border-gray-100 flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/30">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 leading-tight">Plantões do Dia</h2>
                        <p className="text-xs text-gray-500">Visão geral dos profissionais escalados</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setFilterMode('day')}
                            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${filterMode === 'day' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Dia
                        </button>
                        <button 
                            onClick={() => setFilterMode('night')}
                            disabled={true}
                            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all opacity-50 cursor-not-allowed ${filterMode === 'night' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}
                        >
                            Noite
                        </button>
                        <button 
                            onClick={() => setFilterMode('all')}
                            disabled={true}
                            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all opacity-50 cursor-not-allowed ${filterMode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-400'}`}
                        >
                            Todos
                        </button>
                    </div>

                    <div className="relative">
                        <input 
                            type="date" 
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="pl-3 pr-2 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm transition-all hover:border-gray-300"
                        />
                    </div>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[500px] p-6 bg-gray-50/50 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
                        <span className="text-sm font-medium">Carregando escala...</span>
                    </div>
                ) : filteredShifts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium">Nenhum profissional escalado para esta data.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sortedUnits.map((unit) => {
                            const isOpen = openUnits[unit] ?? false
                            const count = groupedShifts[unit]?.length || 0
                            return (
                                <div key={unit} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
                                    <button
                                        type="button"
                                        onClick={() => toggleUnit(unit)}
                                        className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50/80 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1 h-8 rounded-full ${isOpen ? 'bg-indigo-500' : 'bg-gray-300 group-hover:bg-indigo-400'} transition-colors`}></div>
                                            <span className="font-semibold text-gray-700 text-sm md:text-base text-left">{unit}</span>
                                            <span className="bg-indigo-50 text-indigo-600 text-xs px-2.5 py-0.5 rounded-full font-medium border border-indigo-100">
                                                {count}
                                            </span>
                                        </div>
                                        <div className={`transform transition-transform duration-200 text-gray-400 ${isOpen ? 'rotate-180' : ''}`}>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </button>
                                    
                                    {isOpen && (
                                        <div className="border-t border-gray-50 bg-gray-50/30 p-4">
                                            {(() => {
                                                const unitShifts = groupedShifts[unit] || []
                                                const nurses = unitShifts.filter((s: any) => (s.nurse_role || '').toUpperCase().includes('ENFERMEIRO'))
                                                const technicians = unitShifts.filter((s: any) => (s.nurse_role || '').toUpperCase().includes('TECNICO') || (s.nurse_role || '').toUpperCase().includes('TÉCNICO'))
                                                const others = unitShifts.filter((s: any) => 
                                                    !(s.nurse_role || '').toUpperCase().includes('ENFERMEIRO') && 
                                                    !(s.nurse_role || '').toUpperCase().includes('TECNICO') &&
                                                    !(s.nurse_role || '').toUpperCase().includes('TÉCNICO')
                                                )

                                                const renderCard = (shift: any, index: number) => (
                                                    <div key={shift.id || index} className="bg-white rounded-md border border-gray-200 shadow-sm flex overflow-hidden h-20 hover:shadow-md transition-shadow">
                                                        {/* Left Color Block */}
                                                        <div className={`w-12 flex flex-col items-center justify-center text-white shrink-0 ${
                                                            shift.shift_type === 'night' ? 'bg-slate-700' : 'bg-emerald-600'
                                                        }`}>
                                                            <span className="text-xl font-bold leading-none">
                                                                {shift.shift_type === 'night' ? 'N' : 'D'}
                                                            </span>
                                                            <svg className="w-4 h-4 mt-1 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                            </svg>
                                                        </div>
                                                        
                                                        {/* Right Content */}
                                                        <div className="flex-1 p-2 flex flex-col justify-center min-w-0">
                                                            <p className="text-xs font-bold text-gray-800 truncate" title={shift.nurse_name}>
                                                                {shift.nurse_name}
                                                            </p>
                                                            <div className="flex items-center justify-between mt-1">
                                                                <span className="text-[10px] text-gray-500 truncate uppercase">
                                                                    {shift.nurse_role?.replace('ENFERMEIRO', 'ENF').replace('TECNICO', 'TEC') || 'N/A'}
                                                                </span>
                                                                <span className="text-[10px] text-gray-400">
                                                                    {/* Placeholder for ID or other info if needed */}
                                                                </span>
                                                            </div>
                                                            
                                                            {shift.swap_with_name && (
                                                                <div className="mt-1 flex items-center gap-1 bg-orange-50 text-orange-700 px-1 py-0.5 rounded text-[9px] truncate border border-orange-100" title={`Permuta com: ${shift.swap_with_name}`}>
                                                                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                                                                    </svg>
                                                                    <span className="truncate">{shift.swap_with_name.split(' ')[0]}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )

                                                return (
                                                    <div className="flex flex-col lg:flex-row gap-6">
                                                        {/* Enfermeiros Column */}
                                                        {nurses.length > 0 && (
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-indigo-100">
                                                                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Enfermeiros</span>
                                                                    <span className="text-xs text-gray-400 font-medium">{nurses.length} profissionais</span>
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                                                                    {nurses.map((shift: any, i: number) => renderCard(shift, i))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Técnicos Column */}
                                                        {(technicians.length > 0 || others.length > 0) && (
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-rose-100">
                                                                    <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Técnicos</span>
                                                                    <span className="text-xs text-gray-400 font-medium">{technicians.length + others.length} profissionais</span>
                                                                </div>
                                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                                                                    {[...technicians, ...others].map((shift: any, i: number) => renderCard(shift, i))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
