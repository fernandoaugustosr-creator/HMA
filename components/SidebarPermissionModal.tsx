'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Shield, X, Save, Loader2, Crown, Building2, Users, LayoutDashboard, CalendarCheck2, Users2, Repeat2, CalendarRange, ClipboardList, Download, ShieldCheck, History, ArrowLeftRight, FileBarChart, FileSpreadsheet } from 'lucide-react'
import type { SidebarMenuItemId, MenuAccessLevel, SidebarMenuPermissions } from '@/lib/sidebar-menu-items'
import { SIDEBAR_MENU_ITEMS } from '@/lib/sidebar-menu-items'
import { getSidebarPermissions, saveSidebarPermissions } from '@/app/actions'

interface LocalSidebarPermCfg {
  items: Record<string, MenuAccessLevel>
  reports: { management: MenuAccessLevel; scheduled: MenuAccessLevel }
  updatedAt?: string
  updatedBy?: string
}

interface SidebarPermissionModalProps {
  open: boolean
  onClose: () => void
}

const LEVELS: { id: MenuAccessLevel; label: string; sublabel: string; Icon: any; accentClass: string; dotBg: string }[] = [
  {
    id: 'EVERYONE',
    label: 'Todos',
    sublabel: 'Qualquer usuário logado',
    Icon: Users,
    accentClass: 'border-sky-200 bg-gradient-to-r from-sky-50 to-cyan-50 text-sky-800 hover:from-sky-100 hover:to-cyan-100 shadow-[0_2px_8px_rgba(14,165,233,0.10)]',
    dotBg: 'bg-gradient-to-br from-sky-500 to-cyan-500',
  },
  {
    id: 'COORD_SETOR',
    label: 'Coordenadores + Geral',
    sublabel: 'Setor e Coord Geral',
    Icon: Building2,
    accentClass: 'border-violet-200 bg-gradient-to-r from-violet-50 to-indigo-50 text-indigo-800 hover:from-violet-100 hover:to-indigo-100 shadow-[0_2px_8px_rgba(99,102,241,0.10)]',
    dotBg: 'bg-gradient-to-br from-violet-500 to-indigo-600',
  },
  {
    id: 'COORD_GERAL_ONLY',
    label: 'Somente Coord Geral',
    sublabel: 'Acesso máximo restrito',
    Icon: Crown,
    accentClass: 'border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 hover:from-amber-100 hover:to-orange-100 shadow-[0_2px_8px_rgba(245,158,11,0.10)]',
    dotBg: 'bg-gradient-to-br from-amber-500 to-orange-600',
  },
]

const HMA_BLUE_DEEP = '#1e3a8a'
const HMA_BLUE_PRIMARY = '#2563eb'
const HMA_BLUE_SOFT = '#3b82f6'

// Mapeamento de ícones para cada item do menu
const ICONS_BY_ID: Record<string, any> = {
  dashboard: LayoutDashboard,
  escala: CalendarCheck2,
  servidores: Users2,
  relatorios: FileBarChart,
  permultas: Repeat2,
  coordenacao: ShieldCheck,
  logs: History,
  trocas: ArrowLeftRight,
  folgas: CalendarRange,
  downloads: Download,
}

function LevelPillSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: MenuAccessLevel
  onChange: (v: MenuAccessLevel) => void
  disabled?: boolean
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {LEVELS.map((lvl) => {
        const isActive = value === lvl.id
        return (
          <button
            key={lvl.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(lvl.id)}
            className={[
              'relative rounded-2xl border p-3.5 sm:p-4 text-left transition-all duration-200 active:scale-[0.97]',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
              isActive
                ? `${lvl.accentClass} focus-visible:ring-blue-500/60 ring-2 ring-offset-1`
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60',
              disabled ? 'opacity-60 cursor-not-allowed' : '',
            ].join(' ')}
            style={isActive ? { boxShadow: 'inset 0 0 0 1px rgba(37,99,235,0.3)' } : undefined}
            title={`${lvl.label} - ${lvl.sublabel}`}
          >
            {isActive && (
              <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full flex items-center justify-center shadow-md"
                style={{ backgroundImage: `linear-gradient(135deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 55%, ${HMA_BLUE_SOFT} 100%)` }}
              >
                <svg className="w-3.5 h-3.5 text-white" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${isActive ? lvl.dotBg + ' text-white shadow-md' : 'bg-slate-100 text-slate-500'}`}>
                <lvl.Icon size={21} strokeWidth={2.3} />
              </div>
              <span className="text-[13.5px] font-black leading-none tracking-tight truncate">{lvl.label}</span>
            </div>
            <div className="text-[12px] leading-snug font-semibold opacity-85 line-clamp-2">
              {lvl.sublabel}
            </div>
          </button>
        )
      })}
    </div>
  )
}

interface MenuItemCardProps {
  id: SidebarMenuItemId | 'management' | 'scheduled'
  label: string
  Icon: any
  level: MenuAccessLevel
  onChange: (v: MenuAccessLevel) => void
  isReport?: boolean
  accentTop?: string
}

function MenuItemCard({ id, label, Icon, level, onChange, isReport = false, accentTop }: MenuItemCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-[0_2px_10px_rgba(15,23,42,0.05)] hover:shadow-[0_6px_18px_rgba(37,99,235,0.10)] transition-all duration-300 group"
    >
      {/* Faixa superior azul HMA */}
      <div
        className="absolute top-0 left-0 right-0 h-2 opacity-90"
        style={{
          backgroundImage: accentTop || `linear-gradient(90deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 50%, ${HMA_BLUE_SOFT} 100%)`,
        }}
      />

      {/* Padrão subtle background */}
      <div
        className="absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-[0.06] blur-3xl pointer-events-none"
        style={{ backgroundImage: `radial-gradient(circle, ${HMA_BLUE_PRIMARY} 0%, transparent 70%)` }}
      />

      <div className="relative p-4.5 sm:p-5 pt-5.5">
        {/* Header do Card */}
        <div className="flex items-start gap-3.5 mb-4">
          <div
            className="h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 shadow-[0_4px_14px_rgba(37,99,235,0.24)]"
            style={{ backgroundImage: `linear-gradient(135deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 55%, ${HMA_BLUE_SOFT} 100%)` }}
          >
            <Icon size={26} strokeWidth={2.2} className="text-white drop-shadow-sm" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-[16px] font-black text-slate-800 leading-tight truncate">{label}</h3>
              {isReport && (
                <span className="shrink-0 inline-flex items-center gap-1 rounded-md border border-blue-200/70 bg-blue-50/60 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-wider text-blue-800">
                  <FileSpreadsheet size={11} strokeWidth={3} />
                  Relatório
                </span>
              )}
            </div>
            <p className="mt-1.5 text-[12px] font-semibold text-slate-500 leading-snug">
              Quem pode visualizar este item no menu lateral
            </p>
          </div>
        </div>

        {/* Nível selecionado (badge) */}
        <div className="mb-4 flex items-center gap-2.5">
          <span className="text-[10.5px] font-black uppercase tracking-widest text-slate-400">Nível atual:</span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black text-white shadow-md"
            style={{ backgroundImage: `linear-gradient(135deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 55%, ${HMA_BLUE_SOFT} 100%)` }}
          >
            {LEVELS.find(l => l.id === level)?.label ?? level}
          </span>
        </div>

        {/* Pills */}
        <LevelPillSelector value={level} onChange={onChange} />

        {level === 'COORD_GERAL_ONLY' && (
          <div className="mt-4 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/70 via-orange-50/40 to-amber-50/70 px-3.5 py-3 flex items-start gap-3">
            <div className="mt-0.5 h-6 w-6 rounded-full shrink-0 bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md">
              <svg className="w-3.5 h-3.5 text-white" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <div className="text-[12px] font-black text-amber-900 leading-tight">Acesso restrito</div>
              <div className="text-[11px] font-semibold text-amber-700/90 leading-snug">
                Apenas Coordenadores Gerais e Admins verão este item. Outros usuários NÃO verão esta opção.
              </div>
            </div>
          </div>
        )}

        {level === 'EVERYONE' && id !== 'dashboard' && id !== 'downloads' && (
          <div className="mt-4 rounded-2xl border border-sky-200/70 bg-gradient-to-r from-sky-50/70 via-cyan-50/40 to-sky-50/70 px-3.5 py-3 flex items-start gap-3">
            <div className="mt-0.5 h-6 w-6 rounded-full shrink-0 bg-gradient-to-br from-sky-400 to-cyan-500 flex items-center justify-center shadow-md">
              <svg className="w-3.5 h-3.5 text-white" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-[12px] font-black text-sky-900 leading-tight">Acesso público</div>
              <div className="text-[11px] font-semibold text-sky-700/90 leading-snug">
                Todos os usuários logados (incluindo servidores comuns) verão este item no menu.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SidebarPermissionModal({ open, onClose }: SidebarPermissionModalProps) {
  const [initialLoading, setInitialLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [form, setForm] = useState<LocalSidebarPermCfg | null>(null)

  const loadInitial = useCallback(async () => {
    setInitialLoading(true)
    try {
      const data = (await getSidebarPermissions()) as unknown as LocalSidebarPermCfg
      setForm({
        items: { ...data.items },
        reports: { ...data.reports },
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy,
      })
    } finally {
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadInitial()
      setToast(null)
    }
  }, [open, loadInitial])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3800)
    return () => clearTimeout(t)
  }, [toast])

  const updateItem = (id: SidebarMenuItemId, v: MenuAccessLevel) => {
    setForm(prev => prev ? ({ ...prev, items: { ...prev.items, [id]: v } }) : prev)
  }

  const updateReport = (sub: 'management' | 'scheduled', v: MenuAccessLevel) => {
    setForm(prev => prev ? ({ ...prev, reports: { ...prev.reports, [sub]: v } }) : prev)
  }

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await saveSidebarPermissions(form as unknown as SidebarMenuPermissions)
      if (res.success) {
        setToast({ type: 'ok', msg: res.message })
        setTimeout(onClose, 900)
      } else {
        setToast({ type: 'err', msg: res.message })
      }
    } catch (e: any) {
      setToast({ type: 'err', msg: `Erro: ${e?.message || String(e)}` })
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    if (!form) return
    const defaultsMap = Object.fromEntries(
      (SIDEBAR_MENU_ITEMS as unknown as { id: SidebarMenuItemId; defaultLevel: MenuAccessLevel }[]).map(m => [m.id, m.defaultLevel])
    ) as Record<SidebarMenuItemId, MenuAccessLevel>
    setForm({
      ...form,
      items: defaultsMap,
      reports: { management: 'COORD_GERAL_ONLY', scheduled: 'COORD_SETOR' },
    })
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Dialog */}
      <div
        className="relative w-full max-w-7xl max-h-[92vh] rounded-[28px] bg-white shadow-[0_30px_80px_-15px_rgba(30,58,138,0.35)] border border-slate-200/80 overflow-hidden flex flex-col animate-in"
      >
        {/* Header do Dialog */}
        <div
          className="relative px-6 sm:px-8 py-5 sm:py-6 border-b border-slate-200/80 overflow-hidden"
        >
          {/* Glow de fundo do header */}
          <div
            className="absolute top-0 right-0 w-[55%] h-full opacity-[0.08] blur-3xl pointer-events-none"
            style={{ backgroundImage: `radial-gradient(ellipse at top right, ${HMA_BLUE_PRIMARY} 0%, transparent 70%)` }}
          />
          <div
            className="absolute top-0 left-0 right-0 h-1.5 opacity-95"
            style={{ backgroundImage: `linear-gradient(90deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 50%, ${HMA_BLUE_SOFT} 100%)` }}
          />

          <div className="relative z-10 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <div
                className="h-16 w-16 rounded-2xl shrink-0 flex items-center justify-center shadow-[0_6px_18px_rgba(37,99,235,0.3)]"
                style={{ backgroundImage: `linear-gradient(135deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 55%, ${HMA_BLUE_SOFT} 100%)` }}
              >
                <Shield size={30} strokeWidth={2.2} className="text-white drop-shadow-md" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 className="text-[24px] sm:text-[28px] font-black text-slate-800 leading-tight tracking-tight">
                  Permissões do Menu Lateral
                </h2>
                <p className="mt-2 text-[13px] sm:text-[14px] font-semibold text-slate-500 leading-snug">
                  Defina o nível de acesso de cada item do menu. Coordenação Geral sempre acessa tudo, independente da configuração.
                </p>
                {form?.updatedAt && (
                  <div className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-400 tracking-wide">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 border border-slate-200/60">
                      <svg className="w-3.5 h-3.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Última alteração: {new Date(form.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      {form.updatedBy && <> · por {String(form.updatedBy).slice(0, 32)}</>}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="relative z-10 shrink-0 h-12 w-12 rounded-2xl flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-all duration-200 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-offset-1 disabled:opacity-50 border border-slate-200/70 bg-white shadow-sm"
              aria-label="Fechar"
            >
              <X size={24} strokeWidth={2.3} />
            </button>
          </div>
        </div>

        {/* Conteúdo Scrollável */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-10 py-6 sm:py-8">
          {initialLoading || !form ? (
            <div className="flex flex-col items-center justify-center py-28 gap-4">
              <div className="relative h-24 w-24">
                <div
                  className="absolute inset-0 rounded-full opacity-30 animate-ping"
                  style={{ backgroundImage: `linear-gradient(135deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 100%)` }}
                />
                <div
                  className="relative h-24 w-24 rounded-full flex items-center justify-center shadow-[0_8px_28px_rgba(37,99,235,0.3)]"
                  style={{ backgroundImage: `linear-gradient(135deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 55%, ${HMA_BLUE_SOFT} 100%)` }}
                >
                  <Loader2 size={42} strokeWidth={2.2} className="text-white animate-spin drop-shadow-sm" />
                </div>
              </div>
              <div className="text-lg font-black text-slate-700 uppercase tracking-wider mt-2">Carregando permissões...</div>
              <div className="text-sm font-semibold text-slate-500">Buscando configurações salvas</div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* 🔵 SEÇÃO: ITENS PRINCIPAIS DO MENU */}
              <section>
                <div className="flex items-end justify-between mb-5 px-1">
                  <div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div
                        className="h-8 w-1.5 rounded-full"
                        style={{ backgroundImage: `linear-gradient(180deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 100%)` }}
                      />
                      <h3 className="text-[16px] sm:text-[18px] font-black uppercase tracking-[0.14em] text-slate-700 leading-none">
                        Itens do Menu Principal
                      </h3>
                    </div>
                    <p className="text-[12.5px] font-semibold text-slate-500 ml-3.5 leading-snug">
                      Configure o nível de acesso de cada item do menu lateral do sistema.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4.5 sm:gap-5">
                  {(SIDEBAR_MENU_ITEMS as unknown as { id: SidebarMenuItemId; label: string }[]).map((item) => (
                    <MenuItemCard
                      key={item.id}
                      id={item.id}
                      label={item.label}
                      Icon={ICONS_BY_ID[item.id] ?? ClipboardList}
                      level={(form.items[item.id] ?? 'COORD_GERAL_ONLY') as MenuAccessLevel}
                      onChange={(v) => updateItem(item.id, v)}
                    />
                  ))}
                </div>
              </section>

              {/* 📊 SEÇÃO: RELATÓRIOS ESPECÍFICOS */}
              <section>
                <div className="flex items-end justify-between mb-5 px-1">
                  <div>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div
                        className="h-8 w-1.5 rounded-full"
                        style={{ backgroundImage: `linear-gradient(180deg, #8b5cf6 0%, ${HMA_BLUE_PRIMARY} 100%)` }}
                      />
                      <h3 className="text-[16px] sm:text-[18px] font-black uppercase tracking-[0.14em] text-slate-700 leading-none">
                        Relatórios Específicos
                      </h3>
                    </div>
                    <p className="text-[12.5px] font-semibold text-slate-500 ml-3.5 leading-snug">
                      Estes itens aparecem como submenu de "Relatórios". Cada relatório tem seu próprio nível.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 sm:gap-5">
                  <MenuItemCard
                    id="management"
                    label="Relatório Gerencial"
                    Icon={FileBarChart}
                    level={form.reports.management}
                    onChange={(v) => updateReport('management', v)}
                    isReport
                    accentTop={`linear-gradient(90deg, #7c3aed 0%, ${HMA_BLUE_PRIMARY} 50%, ${HMA_BLUE_SOFT} 100%)`}
                  />
                  <MenuItemCard
                    id="scheduled"
                    label="Relatório de Escalados"
                    Icon={FileSpreadsheet}
                    level={form.reports.scheduled}
                    onChange={(v) => updateReport('scheduled', v)}
                    isReport
                    accentTop={`linear-gradient(90deg, #059669 0%, ${HMA_BLUE_PRIMARY} 50%, ${HMA_BLUE_SOFT} 100%)`}
                  />
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div className="absolute left-1/2 -translate-x-1/2 top-24 sm:top-20 z-50 pointer-events-none">
            <div
              className={`rounded-2xl px-5 py-4 shadow-[0_10px_30px_rgba(15,23,42,0.25)] border flex items-center gap-4 pointer-events-auto ${
                toast.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              }`}
            >
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
                  toast.type === 'ok' ? 'bg-gradient-to-br from-emerald-500 to-green-600 text-white' : 'bg-gradient-to-br from-red-500 to-rose-600 text-white'
                } shadow-md`}
              >
                {toast.type === 'ok' ? (
                  <svg className="w-5 h-5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <X size={20} strokeWidth={3} />
                )}
              </div>
              <div className="min-w-0 max-w-sm">
                <div className={`text-[13px] font-black leading-tight ${toast.type === 'ok' ? 'text-emerald-900' : 'text-red-900'}`}>
                  {toast.type === 'ok' ? 'Salvo com sucesso!' : 'Erro ao salvar'}
                </div>
                <div className={`text-[12px] font-semibold leading-snug truncate ${toast.type === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {toast.msg}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className="relative px-7 sm:px-10 py-5 sm:py-5.5 border-t border-slate-200/80 bg-gradient-to-b from-white via-white to-slate-50/70"
        >
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={resetToDefaults}
              disabled={saving || initialLoading || !form}
              className="group flex items-center gap-2.5 px-4.5 py-3 rounded-2xl text-[12.5px] font-black uppercase tracking-wider text-slate-500 border border-slate-200 hover:text-slate-700 hover:border-slate-300 hover:bg-white transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1 shadow-sm"
            >
              <svg className="w-5 h-5" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Restaurar padrões
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex items-center gap-2.5 px-5 py-3 rounded-2xl text-[13px] font-black uppercase tracking-wider text-slate-600 border border-slate-200 bg-white hover:text-slate-800 hover:border-slate-300 hover:bg-slate-50 transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 focus-visible:ring-offset-1 shadow-sm"
              >
                <X size={17} strokeWidth={2.5} />
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || initialLoading || !form}
                className="relative flex items-center gap-2.5 px-6 py-3 rounded-2xl text-[13px] font-black uppercase tracking-wider text-white transition-all duration-200 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-blue-500/70 shadow-[0_6px_20px_rgba(37,99,235,0.32)] hover:shadow-[0_8px_28px_rgba(37,99,235,0.45)] hover:brightness-[1.08]"
                style={{ backgroundImage: `linear-gradient(135deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 55%, ${HMA_BLUE_SOFT} 100%)` }}
              >
                {saving ? (
                  <Loader2 size={18} strokeWidth={2.5} className="animate-spin" />
                ) : (
                  <Save size={18} strokeWidth={2.5} />
                )}
                {saving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
