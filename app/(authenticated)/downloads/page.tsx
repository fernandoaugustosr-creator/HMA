'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { getReleasedSchedules } from '@/app/actions'
import Schedule from '@/components/Schedule'
import { FileText, ArrowLeft, Download, Calendar } from 'lucide-react'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export default function DownloadsPage() {
  const [releases, setReleases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRelease, setSelectedRelease] = useState<any | null>(null)
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('')
  const printTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getReleasedSchedules()
        setReleases(data)
        
        // Find the most recent date to set as default
        if (data.length > 0) {
            const sorted = [...data].sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year
                return b.month - a.month
            })
            const mostRecent = sorted[0]
            setSelectedMonthYear(`${mostRecent.year}-${mostRecent.month}`)
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Extract unique Month/Year options
  const monthYearOptions = React.useMemo(() => {
      const options = new Set<string>()
      releases.forEach(r => {
          options.add(`${r.year}-${r.month}`)
      })
      // Convert to array and sort descending
      return Array.from(options).sort((a, b) => {
          const [yearA, monthA] = a.split('-').map(Number)
          const [yearB, monthB] = b.split('-').map(Number)
          if (yearA !== yearB) return yearB - yearA
          return monthB - monthA
      })
  }, [releases])

  // Filter releases based on selection
  const filteredReleases = React.useMemo(() => {
      if (!selectedMonthYear) return []
      const [year, month] = selectedMonthYear.split('-').map(Number)
      return releases.filter(r => r.year === year && r.month === month)
  }, [releases, selectedMonthYear])

  const handleScheduleLoaded = useCallback(() => {
    // Clear any existing timeout to prevent multiple prints
    if (printTimeoutRef.current) {
        clearTimeout(printTimeoutRef.current)
    }

    // Auto-trigger print after a short delay to ensure rendering
    printTimeoutRef.current = setTimeout(() => {
        window.print()
        printTimeoutRef.current = null
    }, 500)
  }, [])

  const handlePrint = (release: any) => {
    if (selectedRelease?.id === release.id) {
        // If already loaded, just print
        window.print()
    } else {
        // Triggers render of Schedule -> onLoaded -> print
        setSelectedRelease(release)
    }
  }

  const [currentYear, currentMonth] = selectedMonthYear ? selectedMonthYear.split('-').map(Number) : [0, 0]

  return (
    <div className="p-6">
      <div className="print:hidden">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-800">Escalas Liberadas</h1>
                <p className="text-gray-600">Selecione o mês e a escala para visualizar e baixar.</p>
            </div>
            
            {/* Dropdown Filter */}
            {!loading && releases.length > 0 && (
                <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2">
                    <Calendar className="text-blue-600" size={20} />
                    <select 
                        value={selectedMonthYear}
                        onChange={(e) => setSelectedMonthYear(e.target.value)}
                        className="bg-transparent font-bold text-gray-700 outline-none cursor-pointer min-w-[200px]"
                    >
                        {monthYearOptions.map(opt => {
                            const [y, m] = opt.split('-').map(Number)
                            return (
                                <option key={opt} value={opt}>
                                    {MONTHS[m - 1]} {y}
                                </option>
                            )
                        })}
                    </select>
                </div>
            )}
        </div>
        
        {loading ? (
            <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Carregando escalas...</p>
            </div>
        ) : releases.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Nenhuma escala liberada encontrada.</p>
            </div>
        ) : (
            <div className="space-y-8">
                {/* Display Header for Selected Month */}
                {selectedMonthYear && (
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2 border-b pb-2">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm uppercase tracking-wide">
                            {MONTHS[currentMonth - 1]} {currentYear}
                        </span>
                    </h2>
                )}

                <div className="space-y-4">
                    {filteredReleases.map(release => (
                        <div 
                            key={release.id}
                            onClick={() => handlePrint(release)}
                            className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-4 group border-l-4 relative overflow-hidden ${selectedRelease?.id === release.id ? 'border-blue-300 border-l-blue-600 ring-2 ring-blue-100' : 'border-gray-200 border-l-blue-500'}`}
                        >
                            <div className="flex items-center gap-4 relative z-10">
                                <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors text-blue-600">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-lg text-gray-900">{release.unit_name}</h3>
                                    <p className="text-gray-500 text-xs flex items-center gap-2">
                                        Liberado em: {release.released_at ? new Date(release.released_at).toLocaleDateString('pt-BR') : '-'}
                                    </p>
                                </div>
                            </div>
                            
{/* Print Button removed as requested */}
{/* 
                            <div className="relative z-10">
                                <div className="bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-600 font-bold py-2 px-6 rounded-lg flex items-center gap-2 transition-all duration-300">
                                    <Download size={18} />
                                    <span className="hidden md:inline">
                                        {selectedRelease?.id === release.id ? 'Imprimir novamente' : 'Baixar Escala'}
                                    </span>
                                </div>
                            </div>
*/}
                        </div>
                    ))}
                </div>
                
                {filteredReleases.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                        <p>Nenhuma escala encontrada para este mês.</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Hidden Print Area - Only visible when printing */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999]">
         {selectedRelease && (
            <Schedule 
                key={selectedRelease.id} // Force remount on change
                isAdmin={false} 
                printOnly={true}
                initialMonth={selectedRelease.month - 1}
                initialYear={selectedRelease.year}
                initialUnitId={selectedRelease.unit_id}
                onLoaded={handleScheduleLoaded}
            />
         )}
      </div>
    </div>
  )
}
