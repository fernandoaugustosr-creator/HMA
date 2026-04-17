'use client'

import { useState, useEffect, useMemo } from 'react'
import { getDailyShifts, getAllUnits, getAllUnitNumbers } from '@/app/actions'

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
    const [filterMode, setFilterMode] = useState<'day' | 'night' | 'all'>('all')
    const [units, setUnits] = useState<{ id: string, title: string }[]>([])
    const [selectedUnitId, setSelectedUnitId] = useState<string>('')
    const [unitNumbersMap, setUnitNumbersMap] = useState<Record<string, string>>({})

    useEffect(() => {
        async function fetchUnits() {
            try {
                const res = await getAllUnits()
                setUnits((res || []).filter((u: any) => u?.id && u?.title))
            } catch (e) {
                setUnits([])
            }
        }
        fetchUnits()
    }, [])

    useEffect(() => {
        async function fetchUnitNumbers() {
            try {
                const map = await getAllUnitNumbers()
                setUnitNumbersMap(map || {})
            } catch (e) {
                setUnitNumbersMap({})
            }
        }
        fetchUnitNumbers()
    }, [])

    useEffect(() => {
        if (selectedUnitId === '') {
            setShifts([])
            setLoading(false)
            return
        }

        let cancelled = false

        async function fetchShifts() {
            setLoading(true)
            try {
                const res = await getDailyShifts(selectedDate)
                if (cancelled) return
                if (res.success && res.data) {
                    setShifts(res.data)
                } else {
                    setShifts([])
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Error fetching daily shifts:', error)
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        fetchShifts()
        return () => {
            cancelled = true
        }
    }, [selectedDate, selectedUnitId])

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
        const t = String(shift.shift_type || '')
        if (filterMode === 'day') return ['day', 'mt', 'morning', 'afternoon', 'dn'].includes(t)
        if (filterMode === 'night') return ['night', 'dn'].includes(t)
        return true
    })

    const sortedUnits = useMemo(() => {
        const list = [...units]
        list.sort((a, b) => {
            const numA = unitNumbersMap[String(a.id)] || ''
            const numB = unitNumbersMap[String(b.id)] || ''
            const parsedA = parseInt(numA, 10)
            const parsedB = parseInt(numB, 10)
            const aHas = !isNaN(parsedA)
            const bHas = !isNaN(parsedB)
            if (aHas && bHas && parsedA !== parsedB) return parsedA - parsedB
            if (aHas && !bHas) return -1
            if (!aHas && bHas) return 1
            return String(a.title || '').localeCompare(String(b.title || ''))
        })
        return list
    }, [units, unitNumbersMap])

    const unitsById: Record<string, string> = {}
    sortedUnits.forEach(u => { unitsById[String(u.id)] = String(u.title) })

    const getUnitLabel = (unitId: string) => {
        if (unitId === '__none__') return 'Sem Setor'
        const title = unitsById[unitId] || 'Setor'
        const num = unitNumbersMap[unitId]
        return num ? `${num} - ${title}` : title
    }

    const filteredByUnit = selectedUnitId === ''
        ? []
        : selectedUnitId === '__all__'
        ? filteredShifts
        : filteredShifts.filter((s: any) => {
            const u = s.unit_id ? String(s.unit_id) : '__none__'
            return u === selectedUnitId
        })

    const groupedShifts = filteredByUnit.reduce((acc: any, shift: any) => {
        const unitId = shift.unit_id ? String(shift.unit_id) : '__none__'
        if (!acc[unitId]) acc[unitId] = []
        acc[unitId].push(shift)
        return acc
    }, {})

    const unitIdsToRender = useMemo(() => {
        if (selectedUnitId === '') return []
        if (selectedUnitId !== '__all__') return [selectedUnitId]
        return [
            ...sortedUnits.map(u => String(u.id)),
            '__none__'
        ]
    }, [selectedUnitId, sortedUnits])

    // Sempre que a data mudar ou os plantões mudarem, expandir todos
    useEffect(() => {
        const newOpenUnits: Record<string, boolean> = {}
        if (selectedUnitId === '') {
            setOpenUnits({})
            return
        }
        if (selectedUnitId !== '__all__') {
            newOpenUnits[selectedUnitId] = true
        } else {
            unitIdsToRender.forEach((unitId) => {
                const count = groupedShifts[unitId]?.length || 0
                newOpenUnits[unitId] = count > 0
            })
        }
        setOpenUnits(newOpenUnits)
    }, [groupedShifts, selectedUnitId, unitIdsToRender])

    const toggleUnit = (unit: string) => {
        setOpenUnits(prev => ({
            ...prev,
            [unit]: !prev[unit]
        }))
    }

    return (
        <div className="bg-white shadow-sm rounded-xl border border-gray-100 flex flex-col h-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50/30">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="flex flex-col gap-3">
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

                      <div className="flex items-center gap-2">
                        <select
                            value={selectedUnitId}
                            onChange={(e) => setSelectedUnitId(e.target.value)}
                            className="w-full md:w-[360px] pl-3 pr-8 py-2 border border-gray-200 rounded-lg text-sm bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none shadow-sm transition-all hover:border-gray-300"
                        >
                            <option value="">Selecione um setor</option>
                            {sortedUnits.map(u => (
                                <option key={u.id} value={String(u.id)}>{getUnitLabel(String(u.id))}</option>
                            ))}
                            <option value="__none__">Sem Setor</option>
                        </select>
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
                            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${filterMode === 'night' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Noite
                        </button>
                        <button 
                            onClick={() => setFilterMode('all')}
                            className={`px-3 py-1.5 text-xs md:text-sm font-medium rounded-md transition-all ${filterMode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
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
            </div>
            
            <div className="flex-1 overflow-y-auto max-h-[500px] p-6 bg-gray-50/50 custom-scrollbar">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-3"></div>
                        <span className="text-sm font-medium">Carregando escala...</span>
                    </div>
                ) : selectedUnitId === '' ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h8M8 12h8m-8 5h5M6 3h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2z" />
                        </svg>
                        <p className="text-sm font-medium">Selecione um setor para visualizar a escala.</p>
                    </div>
                ) : filteredByUnit.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                        <svg className="w-12 h-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium">Nenhum profissional escalado para este setor nesta data.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {unitIdsToRender.map((unitId) => {
                            const title = getUnitLabel(unitId)
                            const isOpen = openUnits[unitId] ?? false
                            const count = groupedShifts[unitId]?.length || 0
                            return (
                                <div key={unitId} className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md">
                                    <button
                                        type="button"
                                        onClick={() => toggleUnit(unitId)}
                                        className="w-full flex items-center justify-between p-4 bg-white hover:bg-gray-50/80 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-1 h-8 rounded-full ${isOpen ? 'bg-indigo-500' : 'bg-gray-300 group-hover:bg-indigo-400'} transition-colors`}></div>
                                            <span className="font-semibold text-gray-700 text-sm md:text-base text-left">{title}</span>
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
                                                const unitShifts = groupedShifts[unitId] || []
                                                if (unitShifts.length === 0) {
                                                    return (
                                                        <div className="text-sm text-gray-500 bg-white border border-dashed border-gray-200 rounded-lg px-4 py-6 text-center">
                                                            Nenhum profissional escalado para este setor nesta data.
                                                        </div>
                                                    )
                                                }
                                                const nurses = unitShifts.filter((s: any) => (s.nurse_role || '').toUpperCase().includes('ENFERMEIRO'))
                                                const technicians = unitShifts.filter((s: any) => (s.nurse_role || '').toUpperCase().includes('TECNICO') || (s.nurse_role || '').toUpperCase().includes('TÉCNICO'))
                                                const others = unitShifts.filter((s: any) => 
                                                    !(s.nurse_role || '').toUpperCase().includes('ENFERMEIRO') && 
                                                    !(s.nurse_role || '').toUpperCase().includes('TECNICO') &&
                                                    !(s.nurse_role || '').toUpperCase().includes('TÉCNICO')
                                                )

                                                const renderCard = (shift: any, index: number) => {
                                                    const t = String(shift.shift_type || '')
                                                    const label =
                                                        t === 'night' ? 'N' :
                                                        t === 'day' ? 'D' :
                                                        t === 'dn' ? 'DN' :
                                                        t === 'mt' ? 'MT' :
                                                        t === 'morning' ? 'M' :
                                                        t === 'afternoon' ? 'T' :
                                                        t ? t.toUpperCase().slice(0, 2) : '?'
                                                    const color =
                                                        t === 'night' ? 'bg-slate-700' :
                                                        t === 'dn' ? 'bg-indigo-700' :
                                                        'bg-emerald-600'
                                                    return (
                                                    <div key={shift.id || index} className="bg-white rounded-md border border-gray-200 shadow-sm flex overflow-hidden h-20 hover:shadow-md transition-shadow">
                                                        {/* Left Color Block */}
                                                        <div className={`w-12 flex flex-col items-center justify-center text-white shrink-0 ${color}`}>
                                                            <span className="text-xl font-bold leading-none">
                                                                {label}
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
                                                )}

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

                                                        {/* Funções do Setor Column */}
                                                        {(technicians.length > 0 || others.length > 0) && (
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-rose-100">
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

