'use client'

import React, { useState } from 'react'
import { FileBarChart, Loader2 } from 'lucide-react'
import { getMonthlyManagementReport } from '@/app/actions'
import ManagementReport from './ManagementReport'

interface ManagementReportButtonProps {
  selectedMonth: number
  selectedYear: number
  monthLabel: string
}

export default function ManagementReportButton({ selectedMonth, selectedYear, monthLabel }: ManagementReportButtonProps) {
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any | null>(null)

  const handleOpenReport = async () => {
    setLoading(true)
    try {
      const res = await getMonthlyManagementReport(selectedMonth, selectedYear)
      if (res.success) {
        setReportData(res.data)
      } else {
        alert(res.message)
      }
    } catch (e) {
      console.error(e)
      alert('Erro ao carregar relatório')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={handleOpenReport}
        disabled={loading}
        className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-indigo-600 text-indigo-700 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <FileBarChart size={16} />
        )}
        Relatório Gerencial
      </button>

      {reportData && (
        <ManagementReport 
          data={reportData}
          monthName={monthLabel}
          year={selectedYear}
          onClose={() => setReportData(null)}
        />
      )}
    </>
  )
}
