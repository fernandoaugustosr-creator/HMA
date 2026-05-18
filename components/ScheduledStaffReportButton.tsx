'use client'

import React, { useState } from 'react'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { getMonthlyScheduledStaffReport } from '@/app/actions'
import ScheduledStaffReport from './ScheduledStaffReport'

interface ScheduledStaffReportButtonProps {
  selectedMonth: number
  selectedYear: number
  monthLabel: string
}

export default function ScheduledStaffReportButton({ selectedMonth, selectedYear, monthLabel }: ScheduledStaffReportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any | null>(null)

  const handleOpenReport = async () => {
    setLoading(true)
    try {
      const res = await getMonthlyScheduledStaffReport(selectedMonth, selectedYear)
      if (res.success) {
        setReportData(res.data)
      } else {
        alert(res.message)
      }
    } catch (e) {
      console.error(e)
      alert('Erro ao carregar relatório de escalados')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpenReport}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-300 text-slate-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <FileSpreadsheet size={16} />
        )}
        Relatório de Escalados
      </button>

      {reportData && (
        <ScheduledStaffReport
          data={reportData}
          monthName={monthLabel}
          year={selectedYear}
          onClose={() => setReportData(null)}
        />
      )}
    </>
  )
}
