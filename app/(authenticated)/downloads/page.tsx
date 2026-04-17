'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { getAllUnitNumbers, getReleasedSchedules } from '@/app/actions'
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
  const [selectedUnitId, setSelectedUnitId] = useState<string>('')
  const [unitNumbersMap, setUnitNumbersMap] = useState<Record<string, string>>({})
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

  useEffect(() => {
    let cancelled = false
    getAllUnitNumbers()
      .then((res: any) => {
        if (cancelled) return
        if (res?.success && res?.data) {
          setUnitNumbersMap(res.data as Record<string, string>)
        } else {
          setUnitNumbersMap({})
        }
      })
      .catch(() => {
        if (cancelled) return
        setUnitNumbersMap({})
      })
    return () => {
      cancelled = true
    }
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

  const releasedUnitOptions = React.useMemo(() => {
      const uniqueUnits = new Map<string, string>()
      filteredReleases.forEach(release => {
          if (release.unit_id && release.unit_name) {
              uniqueUnits.set(String(release.unit_id), String(release.unit_name))
          }
      })

      return Array.from(uniqueUnits.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => {
            const aNumRaw = unitNumbersMap[a.id]
            const bNumRaw = unitNumbersMap[b.id]
            const aNum = aNumRaw ? parseInt(String(aNumRaw), 10) : NaN
            const bNum = bNumRaw ? parseInt(String(bNumRaw), 10) : NaN
            const aHas = !Number.isNaN(aNum)
            const bHas = !Number.isNaN(bNum)
            if (aHas && bHas && aNum !== bNum) return aNum - bNum
            if (aHas !== bHas) return aHas ? -1 : 1
            return a.name.localeCompare(b.name, 'pt-BR')
          })
  }, [filteredReleases, unitNumbersMap])

  const visibleReleases = React.useMemo(() => {
      const base = selectedUnitId
        ? filteredReleases.filter(release => String(release.unit_id) === selectedUnitId)
        : filteredReleases

      return [...base].sort((a: any, b: any) => {
        const aMapped = a?.unit_id ? unitNumbersMap[String(a.unit_id)] : ''
        const bMapped = b?.unit_id ? unitNumbersMap[String(b.unit_id)] : ''
        const aNum = aMapped ? parseInt(String(aMapped), 10) : NaN
        const bNum = bMapped ? parseInt(String(bMapped), 10) : NaN
        const aHas = !Number.isNaN(aNum)
        const bHas = !Number.isNaN(bNum)
        if (aHas && bHas && aNum !== bNum) return aNum - bNum
        if (aHas !== bHas) return aHas ? -1 : 1

        const aTime = a?.released_at ? new Date(a.released_at).getTime() : 0
        const bTime = b?.released_at ? new Date(b.released_at).getTime() : 0
        if (aTime !== bTime) return aTime - bTime
        return String(a?.unit_name || '').localeCompare(String(b?.unit_name || ''), 'pt-BR')
      })
  }, [filteredReleases, selectedUnitId, unitNumbersMap])

  useEffect(() => {
      setSelectedUnitId('')
      setSelectedRelease(null)
  }, [selectedMonthYear])

  useEffect(() => {
      if (!selectedRelease) return
      const stillVisible = visibleReleases.some(release => release.id === selectedRelease.id)
      if (!stillVisible) {
          setSelectedRelease(null)
      }
  }, [visibleReleases, selectedRelease])

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

  const handlePrint = async (release: any) => {
    if (isPrinting) return

    setIsPrinting(true)
    
    try {
      const fileName = `Escala_${release.unit_name}_${MONTHS[release.month - 1]}_${release.year}`.replace(/\s+/g, '_')
      const oldTitle = document.title

      if (selectedRelease?.id === release.id) {
          // If already loaded, just print
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
          setSelectedRelease(release)
      }
    } catch (e) {
      console.error(e)
      alert('Erro ao carregar dados da escala para impressão.')
      setIsPrinting(false)
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
            
            {/* Dropdown Filters */}
            {!loading && releases.length > 0 && (
                <div className="flex flex-col md:flex-row gap-2">
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

                    <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2">
                        <FileText className="text-blue-600" size={20} />
                        <select
                            value={selectedUnitId}
                            onChange={(e) => setSelectedUnitId(e.target.value)}
                            className="bg-transparent font-bold text-gray-700 outline-none cursor-pointer min-w-[260px]"
                        >
                            <option value="">Todas as escalas liberadas</option>
                            {releasedUnitOptions.map(option => (
                                <option key={option.id} value={option.id}>
                                    {option.name}
                                </option>
                            ))}
                        </select>
                    </div>
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

                <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                    {selectedUnitId
                      ? `${visibleReleases.length} escala(s) liberada(s) encontrada(s) para o setor selecionado.`
                      : `${filteredReleases.length} escala(s) liberada(s) disponível(is) neste mês.`}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleReleases.map((release, idx) => {
                      const mappedNumberRaw = release?.unit_id ? unitNumbersMap[String(release.unit_id)] : ''
                      const mappedNumber = mappedNumberRaw ? String(mappedNumberRaw).trim() : ''
                      const parsedNumberMatch = String(release?.unit_name || '').match(/^\s*(\d+)\s*-/)
                      const parsedNumber = parsedNumberMatch ? parsedNumberMatch[1] : ''
                      const unitNumber = mappedNumber || parsedNumber
                      const safeUnitNumber = unitNumber ? String(unitNumber).padStart(2, '0') : ''
                      const baseName = String(release?.unit_name || '').replace(/^\s*\d+\s*-\s*/, '').trim()
                      const displayName = safeUnitNumber ? `${safeUnitNumber} - ${baseName || String(release?.unit_name || '')}` : String(release?.unit_name || '')

                      return (
                      <div 
                        key={release.id}
                        className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all flex items-start justify-between gap-3 px-4 py-4 group relative overflow-hidden ${selectedRelease?.id === release.id ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200'}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="min-w-0">
                            <h3 className="font-bold text-[15px] text-gray-900 whitespace-normal break-words leading-snug">
                              {displayName}
                            </h3>
                            <p className="text-gray-500 text-xs font-semibold">
                              Liberado em: {release.released_at ? new Date(release.released_at).toLocaleDateString('pt-BR') : '-'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handlePrint(release)}
                            disabled={isPrinting}
                            className={`inline-flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-full text-white text-[11px] font-black uppercase tracking-wide transition-colors ${
                              isPrinting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                            title="Baixar escala em PDF (via impressão do navegador)"
                          >
                            {isPrinting && selectedRelease?.id === release.id ? (
                                <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>
                            ) : (
                                <Download size={14} />
                            )}
                            <span>{isPrinting && selectedRelease?.id === release.id ? 'GERANDO...' : 'BAIXAR'}</span>
                          </button>
                        </div>
                      </div>
                      )
                    })}
                </div>
                
                {visibleReleases.length === 0 && (
                    <div className="text-center py-8 text-gray-400">
                        <p>Nenhuma escala liberada encontrada para este filtro.</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Hidden Print Area - Only visible quando imprimir */}
      <div className="hidden print:block bg-white download-print-root">
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
    </>
  )
}
