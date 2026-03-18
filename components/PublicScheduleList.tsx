'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { getReleasedSchedules } from '@/app/actions'
import Schedule from '@/components/Schedule'
import { FileText, Download, Calendar } from 'lucide-react'
import Image from 'next/image'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export default function PublicScheduleList() {
  const [releases, setReleases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRelease, setSelectedRelease] = useState<any | null>(null)
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('')
  const [isPrinting, setIsPrinting] = useState(false)
  const printTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getReleasedSchedules()
        setReleases(data)

        if (data.length > 0) {
            const now = new Date()
            let targetYear = now.getFullYear()
            let targetMonth = now.getMonth() + 1
            const daysInMonth = new Date(targetYear, targetMonth, 0).getDate()

            if (daysInMonth - now.getDate() <= 10) {
                targetMonth += 1
                if (targetMonth > 12) {
                    targetMonth = 1
                    targetYear += 1
                }
            }

            const hasTargetMonth = data.some(
                r => r.year === targetYear && r.month === targetMonth
            )

            if (hasTargetMonth) {
                setSelectedMonthYear(`${targetYear}-${targetMonth}`)
            } else {
                const sorted = [...data].sort((a, b) => {
                    if (a.year !== b.year) return b.year - a.year
                    return b.month - a.month
                })
                const mostRecent = sorted[0]
                setSelectedMonthYear(`${mostRecent.year}-${mostRecent.month}`)
            }
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const monthYearOptions = React.useMemo(() => {
      const options = new Set<string>()
      releases.forEach(r => {
          options.add(`${r.year}-${r.month}`)
      })
      return Array.from(options).sort((a, b) => {
          const [yearA, monthA] = a.split('-').map(Number)
          const [yearB, monthB] = b.split('-').map(Number)
          if (yearA !== yearB) return yearB - yearA
          return monthB - monthA
      })
  }, [releases])

  const filteredReleases = React.useMemo(() => {
      if (!selectedMonthYear) return []
      const [year, month] = selectedMonthYear.split('-').map(Number)
      return releases.filter(r => r.year === year && r.month === month)
  }, [releases, selectedMonthYear])

  const handleScheduleLoaded = useCallback(() => {
    if (printTimeoutRef.current) {
        clearTimeout(printTimeoutRef.current)
    }

    printTimeoutRef.current = setTimeout(() => {
        window.print()
        printTimeoutRef.current = null
        setTimeout(() => setIsPrinting(false), 1000)
    }, 1200)
  }, [])

  const handlePrint = (release: any) => {
    if (isPrinting) return

    if (selectedRelease?.id === release.id) {
        setIsPrinting(true)
        setTimeout(() => {
            window.print()
            setTimeout(() => setIsPrinting(false), 1000)
        }, 100)
    } else {
        setIsPrinting(true)
        setSelectedRelease(release)
    }
  }

  const [currentYear, currentMonth] = selectedMonthYear ? selectedMonthYear.split('-').map(Number) : [0, 0]

  return (
    <div className="w-full">
      <div className="print:hidden">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                {selectedMonthYear && (
                  <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wide">
                    {MONTHS[currentMonth - 1]} {currentYear}
                  </span>
                )}
            </div>
            
            {!loading && releases.length > 0 && (
                <div className="bg-white p-1.5 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2">
                    <Calendar className="text-blue-600" size={16} />
                    <select 
                        value={selectedMonthYear}
                        onChange={(e) => setSelectedMonthYear(e.target.value)}
                        className="bg-transparent font-bold text-xs text-gray-700 outline-none cursor-pointer min-w-[150px]"
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
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500 text-sm">Carregando escalas...</p>
            </div>
        ) : releases.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                <FileText size={32} className="mx-auto mb-4 text-gray-300" />
                <p className="text-sm">Nenhuma escala liberada encontrada.</p>
            </div>
        ) : (
            <div className="space-y-3">
                {filteredReleases.map(release => (
                  <div 
                    key={release.id}
                    className={`bg-white p-3 rounded-xl border shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 group border-l-4 relative overflow-hidden ${selectedRelease?.id === release.id ? 'border-blue-300 border-l-blue-600 ring-2 ring-blue-100' : 'border-gray-200 border-l-blue-500'}`}
                  >
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors text-blue-600">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-gray-900">{release.unit_name}</h3>
                        <p className="text-gray-500 text-[10px]">
                          Liberado em: {release.released_at ? new Date(release.released_at).toLocaleDateString('pt-BR') : '-'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePrint(release)}
                      disabled={isPrinting}
                      className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-white text-[10px] font-semibold transition-colors ${
                        isPrinting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {isPrinting && selectedRelease?.id === release.id ? (
                          <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
                      ) : (
                          <Download size={12} />
                      )}
                      <span>{isPrinting && selectedRelease?.id === release.id ? 'Gerando...' : 'Baixar'}</span>
                    </button>
                  </div>
                ))}
                
                {filteredReleases.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                        <p className="text-sm">Nenhuma escala para este mês.</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Hidden Print Area */}
      <div className="hidden print:block bg-white print-schedule-root">
        {selectedRelease && (
          <div className="w-full flex justify-center">
            <div className="w-[95%]">
              <Schedule 
                key={selectedRelease.id}
                isAdmin={false} 
                printOnly={true}
                initialMonth={selectedRelease.month - 1}
                initialYear={selectedRelease.year}
                initialUnitId={selectedRelease.unit_id}
                onLoaded={handleScheduleLoaded}
              />
            </div>
          </div>
        )}
      </div>
      
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 0;
          }
          body {
            overflow: hidden;
          }
          .print-schedule-root {
            width: 100%;
            background-color: #ffffff !important;
            display: flex;
            justify-content: flex-start;
            align-items: flex-start;
            zoom: 0.85;
          }
          @supports not (zoom: 1) {
            .print-schedule-root {
              width: 117.65%;
              transform: scale(0.85);
              transform-origin: top left;
            }
          }
        }
      `}</style>
    </div>
  )
}
