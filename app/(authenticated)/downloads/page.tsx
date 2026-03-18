'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { getReleasedSchedules } from '@/app/actions'
import Schedule from '@/components/Schedule'
import { FileText, ArrowLeft, Download, Calendar } from 'lucide-react'
import Image from 'next/image'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export default function DownloadsPage() {
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

            // If within 10 days of end of month, prefer the next month
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
                // Fallback to current month if target wasn't found (or if target was current month anyway)
                const currentYear = now.getFullYear()
                const currentMonth = now.getMonth() + 1
                
                const hasCurrentMonth = data.some(
                    r => r.year === currentYear && r.month === currentMonth
                )

                if (hasCurrentMonth) {
                    setSelectedMonthYear(`${currentYear}-${currentMonth}`)
                } else {
                    const sorted = [...data].sort((a, b) => {
                        if (a.year !== b.year) return b.year - a.year
                        return b.month - a.month
                    })
                    const mostRecent = sorted[0]
                    setSelectedMonthYear(`${mostRecent.year}-${mostRecent.month}`)
                }
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
        const oldTitle = document.title
        if (selectedRelease) {
            const fileName = `Escala_${selectedRelease.unit_name}_${MONTHS[selectedRelease.month - 1]}_${selectedRelease.year}`.replace(/\s+/g, '_')
            document.title = fileName
        }

        window.print()
        
        printTimeoutRef.current = null
        // Release lock after print dialog opens (or a bit later)
        setTimeout(() => {
            document.title = oldTitle
            setIsPrinting(false)
        }, 1000)
    }, 1200)
  }, [selectedRelease])

  const handlePrint = (release: any) => {
    if (isPrinting) return

    const fileName = `Escala_${release.unit_name}_${MONTHS[release.month - 1]}_${release.year}`.replace(/\s+/g, '_')
    const oldTitle = document.title

    if (selectedRelease?.id === release.id) {
        // If already loaded, just print
        setIsPrinting(true)
        document.title = fileName
        setTimeout(() => {
            window.print()
            // Reset after a delay to prevent double-clicks immediately after dialog closes
            setTimeout(() => {
                document.title = oldTitle
                setIsPrinting(false)
            }, 1000)
        }, 100)
    } else {
        // Triggers render of Schedule -> onLoaded -> print
        setIsPrinting(true)
        setSelectedRelease(release)
    }
  }

  const [currentYear, currentMonth] = selectedMonthYear ? selectedMonthYear.split('-').map(Number) : [0, 0]

  return (
    <>
      <div className="p-6 print:hidden">
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
                  <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3 border-b pb-2">
                    <Image
                      src="/logo-hma.png"
                      alt="HMA"
                      width={120}
                      height={40}
                      className="h-8 w-auto object-contain"
                      priority
                      unoptimized
                    />
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-lg text-sm uppercase tracking-wide">
                      {MONTHS[currentMonth - 1]} {currentYear}
                    </span>
                  </h2>
                )}

                <div className="space-y-4">
                    {filteredReleases.map(release => (
                      <div 
                        key={release.id}
                        className={`bg-white p-4 rounded-xl border shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 group border-l-4 relative overflow-hidden ${selectedRelease?.id === release.id ? 'border-blue-300 border-l-blue-600 ring-2 ring-blue-100' : 'border-gray-200 border-l-blue-500'}`}
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
                        <div className="flex items-center gap-2 relative z-10">
                          <button
                            type="button"
                            onClick={() => handlePrint(release)}
                            disabled={isPrinting}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-white text-xs font-semibold transition-colors ${
                              isPrinting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                            title="Baixar escala em PDF (via impressão do navegador)"
                          >
                            {isPrinting && selectedRelease?.id === release.id ? (
                                <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
                            ) : (
                                <Download size={14} />
                            )}
                            <span>{isPrinting && selectedRelease?.id === release.id ? 'Gerando...' : 'Baixar'}</span>
                          </button>
                        </div>
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

      {/* Hidden Print Area - Only visible quando imprimir */}
      <div className="hidden print:block bg-white print-schedule-root">
        {selectedRelease && (
          <div className="w-full flex justify-start items-start">
            <div className="w-full">
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
            margin: 5mm 15mm;
          }
          body {
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-schedule-root {
            width: 100% !important;
            background-color: #ffffff !important;
            display: block !important;
            zoom: 0.85; /* Use 85% scale */
          }
          
          @supports not (zoom: 1) {
            .print-schedule-root {
              width: 117.65% !important;
              transform: scale(0.85) !important;
              transform-origin: top left !important;
            }
          }
        }
      `}</style>
    </>
  )
}
