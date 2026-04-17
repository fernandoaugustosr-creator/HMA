'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
import { getReleasedSchedules, getAllUnitNumbers } from '@/app/actions'
import Schedule from '@/components/Schedule'
import { FileText, Download, Calendar } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export default function PublicScheduleList() {
  const searchParams = useSearchParams()
  const [releases, setReleases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRelease, setSelectedRelease] = useState<any | null>(null)
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>('')
  const [isPrinting, setIsPrinting] = useState(false)
  const [unitNumbersMap, setUnitNumbersMap] = useState<Record<string, string>>({})
  const printTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [data, numbers] = await Promise.all([
            getReleasedSchedules(),
            getAllUnitNumbers()
        ])
        setReleases(data)
        setUnitNumbersMap(numbers || {})

        if (data.length > 0) {
            // Check for query params first
            const qUnitId = searchParams.get('unit')
            const qMonth = searchParams.get('month')
            const qYear = searchParams.get('year')

            if (qUnitId && qMonth && qYear) {
                const monthNum = parseInt(qMonth)
                const yearNum = parseInt(qYear)
                setSelectedMonthYear(`${yearNum}-${monthNum}`)
                
                const targetRelease = data.find(r => 
                    r.unit_id === qUnitId && 
                    r.month === monthNum && 
                    r.year === yearNum
                )
                
                if (targetRelease) {
                    setSelectedRelease(targetRelease)
                    setIsPrinting(true)
                    return // Stop here
                }
            }

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
  }, [searchParams])

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
      const list = releases.filter(r => r.year === year && r.month === month)
      list.sort((a, b) => {
          const numA = unitNumbersMap[String(a.unit_id || '')] || ''
          const numB = unitNumbersMap[String(b.unit_id || '')] || ''
          const parsedA = parseInt(numA, 10)
          const parsedB = parseInt(numB, 10)
          const aHas = !isNaN(parsedA)
          const bHas = !isNaN(parsedB)
          if (aHas && bHas && parsedA !== parsedB) return parsedA - parsedB
          if (aHas && !bHas) return -1
          if (!aHas && bHas) return 1
          return String(a.unit_name || '').localeCompare(String(b.unit_name || ''))
      })
      return list
  }, [releases, selectedMonthYear, unitNumbersMap])

  const handleScheduleLoaded = useCallback(() => {
    if (printTimeoutRef.current) {
        clearTimeout(printTimeoutRef.current)
    }

    printTimeoutRef.current = setTimeout(() => {
        const oldTitle = document.title
        if (selectedRelease) {
            const fileName = `Escala_${selectedRelease.unit_name}_${MONTHS[selectedRelease.month - 1]}_${selectedRelease.year}`.replace(/\s+/g, '_')
            document.title = fileName
        }
        
        window.print()
        
        printTimeoutRef.current = null
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
          document.title = fileName
          setTimeout(() => {
              window.print()
              setTimeout(() => {
                  document.title = oldTitle
                  setIsPrinting(false)
              }, 1000)
          }, 100)
      } else {
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
    <div className="w-full">
      <div className="print:hidden">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
                {selectedMonthYear && (
                  <span className="bg-[#e0e7ff] text-[#4338ca] px-5 py-2 rounded-full text-sm font-black uppercase tracking-widest shadow-sm">
                    {MONTHS[currentMonth - 1]} {currentYear}
                  </span>
                )}
            </div>
            
            {!loading && releases.length > 0 && (
                <div className="bg-white p-2 rounded-2xl border border-gray-200 shadow-sm flex items-center gap-3 px-4">
                    <Calendar className="text-blue-600" size={20} />
                    <select 
                        value={selectedMonthYear}
                        onChange={(e) => setSelectedMonthYear(e.target.value)}
                        className="bg-transparent font-bold text-base text-gray-700 outline-none cursor-pointer min-w-[160px] py-1"
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
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-500 text-base font-medium">Carregando escalas...</p>
            </div>
        ) : releases.length === 0 ? (
            <div className="text-center py-16 text-gray-400 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                <FileText size={48} className="mx-auto mb-4 text-gray-200" />
                <p className="text-lg font-medium">Nenhuma escala liberada encontrada.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredReleases.map(release => (
                  <div 
                    key={release.id}
                    className={`bg-white p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 group ${selectedRelease?.id === release.id ? 'border-indigo-300 ring-2 ring-indigo-50' : 'border-gray-100 hover:border-indigo-100'}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-3 bg-[#eff6ff] rounded-2xl group-hover:bg-[#dbeafe] transition-colors text-[#3b82f6] shrink-0">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-sm md:text-base text-[#1e293b] group-hover:text-indigo-900 transition-colors uppercase tracking-tight truncate">
                            {(() => {
                                const num = unitNumbersMap[String(release.unit_id || '')]
                                const title = String(release.unit_name || '')
                                return num ? `${num} - ${title}` : title
                            })()}
                        </h3>
                        <p className="text-gray-400 text-xs font-medium mt-1">
                          Liberado em: {release.released_at ? new Date(release.released_at).toLocaleDateString('pt-BR') : '-'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePrint(release)}
                      disabled={isPrinting}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-black transition-all transform active:scale-95 shadow-sm shrink-0 ${
                        isPrinting && selectedRelease?.id === release.id 
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-[#3b82f6] hover:bg-[#2563eb]'
                      }`}
                    >
                      {isPrinting && selectedRelease?.id === release.id ? (
                          <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                      ) : (
                          <Download size={18} />
                      )}
                      <span>{isPrinting && selectedRelease?.id === release.id ? 'GERANDO...' : 'BAIXAR'}</span>
                    </button>
                  </div>
                ))}
                
                {filteredReleases.length === 0 && (
                    <div className="text-center py-12 text-gray-400 md:col-span-2">
                        <p className="text-lg font-medium">Nenhuma escala para este mês.</p>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* Hidden Print Area */}
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
    </div>
  )
}
