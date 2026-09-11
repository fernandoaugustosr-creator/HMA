'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { FileBarChart, FileSpreadsheet, Loader2 } from 'lucide-react'
import { getMonthlyManagementReport, getMonthlyScheduledStaffReport } from '@/app/actions'
import ManagementReport from './ManagementReport'
import ScheduledStaffReport from './ScheduledStaffReport'

export type ReportKind = 'management' | 'scheduled'

interface ReportLauncherContextValue {
  openReport: (kind: ReportKind, month?: number, year?: number) => void
}

const ReportLauncherContext = createContext<ReportLauncherContextValue | null>(null)

export function useReportLauncher() {
  const ctx = useContext(ReportLauncherContext)
  if (!ctx) {
    throw new Error('useReportLauncher deve ser usado dentro de <ReportLauncherProvider>')
  }
  return ctx
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function getDefaultMonthLabel(month: number, year: number) {
  return MONTH_NAMES[month - 1] ?? ''
}

interface ReportLauncherProviderProps {
  children: React.ReactNode
  canRunManagementReport?: boolean
  canRunScheduledReport?: boolean
}

export default function ReportLauncherProvider({
  children,
  canRunManagementReport = true,
  canRunScheduledReport = true,
}: ReportLauncherProviderProps) {
  const [pending, setPending] = useState<{ kind: ReportKind; month: number; year: number } | null>(null)
  const [managementData, setManagementData] = useState<any | null>(null)
  const [scheduledData, setScheduledData] = useState<any | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const activeMonth = pending?.month ?? new Date().getMonth() + 1
  const activeYear = pending?.year ?? new Date().getFullYear()
  const activeLabel = useMemo(() => getDefaultMonthLabel(activeMonth, activeYear), [activeMonth, activeYear])

  const openReport = useCallback<ReportLauncherContextValue['openReport']>(async (kind, month, year) => {
    const targetMonth = month ?? new Date().getMonth() + 1
    const targetYear = year ?? new Date().getFullYear()

    if (kind === 'management' && !canRunManagementReport) {
      setErrorMsg('Você não tem permissão para acessar o Relatório Gerencial.')
      return
    }
    if (kind === 'scheduled' && !canRunScheduledReport) {
      setErrorMsg('Você não tem permissão para acessar o Relatório de Escalados.')
      return
    }

    setPending({ kind, month: targetMonth, year: targetYear })
    setErrorMsg(null)
    try {
      if (kind === 'management') {
        const res = await getMonthlyManagementReport(targetMonth, targetYear)
        if (res.success) {
          setManagementData(res.data)
        } else {
          setErrorMsg(res.message || 'Erro ao carregar relatório gerencial')
        }
      } else {
        const res = await getMonthlyScheduledStaffReport(targetMonth, targetYear)
        if (res.success) {
          setScheduledData(res.data)
        } else {
          setErrorMsg(res.message || 'Erro ao carregar relatório de escalados')
        }
      }
    } catch (e: any) {
      console.error(e)
      setErrorMsg(e?.message ? `Erro: ${e.message}` : 'Erro ao carregar relatório')
    } finally {
      setPending(null)
    }
  }, [canRunManagementReport, canRunScheduledReport])

  useEffect(() => {
    if (errorMsg) {
      const t = setTimeout(() => setErrorMsg(null), 5000)
      return () => clearTimeout(t)
    }
  }, [errorMsg])

  const ctxValue = useMemo<ReportLauncherContextValue>(
    () => ({ openReport }),
    [openReport]
  )

  return (
    <ReportLauncherContext.Provider value={ctxValue}>
      {children}

      {pending && (
        <div className="fixed bottom-4 right-4 z-[9998] bg-white rounded-2xl shadow-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
          <Loader2 size={18} className="animate-spin text-indigo-600" />
          <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Carregando {pending.kind === 'management' ? 'Relatório Gerencial' : 'Relatório de Escalados'}...
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="fixed bottom-4 right-4 z-[9998] bg-red-50 rounded-2xl shadow-xl border border-red-200 px-4 py-3 flex items-center gap-3 max-w-sm">
          <div className="text-xs font-bold text-red-700">{errorMsg}</div>
        </div>
      )}

      {managementData && (
        <ManagementReport
          data={managementData}
          monthName={activeLabel}
          year={activeYear}
          onClose={() => setManagementData(null)}
        />
      )}

      {scheduledData && (
        <ScheduledStaffReport
          data={scheduledData}
          monthName={activeLabel}
          year={activeYear}
          onClose={() => setScheduledData(null)}
        />
      )}
    </ReportLauncherContext.Provider>
  )
}

interface SidebarReportLinkProps {
  kind: ReportKind
  label: string
  iconClass: string
  Icon: typeof FileBarChart
  submenu?: boolean
  compact?: boolean
  containerClass?: string
  onClick?: () => void
}

export function SidebarReportLink({ kind, label, Icon, iconClass, submenu = false, compact = false, containerClass = '', onClick }: SidebarReportLinkProps) {
  const { openReport } = useReportLauncher()
  const today = new Date()

  let baseClass = ''
  if (submenu && compact) {
    baseClass = `${containerClass} flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-semibold rounded-xl transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white text-slate-500 hover:bg-blue-50 hover:text-blue-900 border border-transparent hover:border-blue-200/60 cursor-pointer`
  } else if (submenu) {
    baseClass = `${containerClass} ml-10 mt-1 flex items-center px-4 py-2 text-xs font-semibold rounded-xl transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white cursor-pointer ${iconClass}`
  } else {
    baseClass = `group flex items-center rounded-2xl transition-colors select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white px-4 py-3 cursor-pointer ${iconClass}`
  }

  return (
    <a
      href="#"
      onClick={(e) => {
        e.preventDefault()
        openReport(kind, today.getMonth() + 1, today.getFullYear())
        if (onClick) setTimeout(onClick, 0)
      }}
      className={baseClass}
    >
      {submenu && compact ? (
        <span className="shrink-0 text-slate-500 group-hover:text-blue-700"><Icon size={15} strokeWidth={2.2} /></span>
      ) : !submenu ? (
        <span className="mr-3 shrink-0 text-slate-500 group-hover:text-indigo-700"><Icon size={22} /></span>
      ) : null}
      <span className="truncate font-semibold">{label}</span>
    </a>
  )
}

interface DashboardReportButtonProps {
  kind: ReportKind
  variant?: 'indigo' | 'emerald'
  selectedMonth?: number
  selectedYear?: number
  monthLabel?: string
}

export function DashboardReportButton({
  kind,
  variant = 'indigo',
  selectedMonth,
  selectedYear,
  monthLabel
}: DashboardReportButtonProps) {
  const { openReport } = useReportLauncher()
  const [loading, setLoading] = useState(false)
  const today = new Date()
  const month = selectedMonth ?? today.getMonth() + 1
  const year = selectedYear ?? today.getFullYear()
  const label = monthLabel ?? getDefaultMonthLabel(month, year)

  const baseStyle = variant === 'emerald'
    ? 'border-emerald-700 text-emerald-700 hover:bg-emerald-50'
    : 'border-indigo-600 text-indigo-700 hover:bg-indigo-50'

  return (
    <a
      href="#"
      onClick={async (e) => {
        e.preventDefault()
        if (loading) return
        setLoading(true)
        try {
          await openReport(kind, month, year)
        } finally {
          setLoading(false)
        }
      }}
      className="inline-flex items-center gap-2 px-4 py-2 bg-white border-2 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-sm active:scale-95 disabled:opacity-50 "
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        kind === 'management' ? <FileBarChart size={16} /> : <FileSpreadsheet size={16} />
      )}
      {kind === 'management' ? 'Relatório Gerencial' : 'Relatório de Escalados'}
    </a>
  )
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _labelCache = MONTH_NAMES
