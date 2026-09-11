'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Shield, X, Save, Loader2, Crown, Building2, Check } from 'lucide-react'

interface LocalReportsPermissionCfg {
  allowCoordGeral: boolean
  allowCoordSetor: boolean
}

interface LocalReportsPermissions {
  management: LocalReportsPermissionCfg
  scheduled: LocalReportsPermissionCfg
  updatedAt?: string
  updatedBy?: string
}

type LocalReportsPermissionsLike = LocalReportsPermissions

import { getReportsPermissions, saveReportsPermissions } from '@/app/actions'

interface ReportsPermissionModalProps {
  open: boolean
  onClose: () => void
}

type ReportKind = 'management' | 'scheduled'

// Cor AZUL HMA = extraída da logo (azul royal/marinho) + gradiente HMA padrão
const HMA_BLUE_ACCENT = '#1e3a8a'      // blue-900 (azul logo HMA)
const HMA_BLUE_PRIMARY = '#2563eb'     // blue-600 (base toggle ligado)
const HMA_BLUE_LIGHT = '#dbeafe'       // blue-100 (bg quando ligado)
const HMA_BLUE_TEXT = '#1e40af'        // blue-800 (texto quando ligado)

interface ToggleSwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  size?: 'md' | 'lg'
  disabled?: boolean
}

function ToggleSwitch({ checked, onChange, size = 'lg', disabled = false }: ToggleSwitchProps) {
  const w = size === 'lg' ? 'w-16' : 'w-12'
  const h = size === 'lg' ? 'h-9' : 'h-7'
  const dotSize = size === 'lg' ? 'w-7 h-7' : 'w-5 h-5'
  const dotTranslate = size === 'lg' ? 'translate-x-7' : 'translate-x-5'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex flex-shrink-0 ${w} ${h} border-2 rounded-full cursor-pointer transition-colors duration-300 focus:outline-none focus:ring-4 ${
        disabled
          ? 'opacity-50 cursor-not-allowed'
          : 'focus:ring-blue-200 hover:brightness-105'
      } ${
        checked
          ? 'border-blue-600 shadow-[0_0_0_2px_rgba(37,99,235,0.08)]'
          : 'border-slate-300 bg-slate-100'
      }`}
      style={checked ? { backgroundColor: HMA_BLUE_PRIMARY, borderColor: HMA_BLUE_ACCENT } : undefined}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-flex items-center justify-center ${dotSize} transform rounded-full bg-white shadow-[0_2px_8px_rgba(15,23,42,0.2)] ring-0 transition-transform duration-300 ease-out absolute top-1/2 -translate-y-1/2 left-1 ${
          checked ? `${dotTranslate}` : 'translate-x-0'
        }`}
      >
        {checked && <Check size={size === 'lg' ? 14 : 11} style={{ color: HMA_BLUE_PRIMARY }} strokeWidth={3.2} />}
      </span>
    </button>
  )
}

interface PermissionCardProps {
  kind: ReportKind
  cfg: LocalReportsPermissionCfg
  onChange: (cfg: LocalReportsPermissionCfg) => void
  saving: boolean
}

function PermissionCard({ kind, cfg, onChange, saving }: PermissionCardProps) {
  const isGerencial = kind === 'management'

  const title = isGerencial ? 'Relatório Gerencial' : 'Relatório de Escalados'
  const subtitle = isGerencial
    ? 'Dados consolidados de plantões, concursos e seletivos'
    : 'Listagem dos profissionais escalados por mês'

  const headerClass = isGerencial
    ? 'from-[#1e40af] via-[#2563eb] to-[#1e40af]'
    : 'from-[#1d4ed8] via-[#3b82f6] to-[#1d4ed8]'

  return (
    <div className="rounded-2xl border border-blue-100 bg-white overflow-hidden shadow-[0_10px_30px_-12px_rgba(30,64,175,0.15)] hover:shadow-[0_14px_40px_-12px_rgba(30,64,175,0.22)] transition-shadow">
      {/* Header com gradiente AZUL HMA */}
      <div
        className={`px-5 py-3.5 md:px-6 md:py-4 text-white flex items-center justify-between gap-3 bg-gradient-to-r ${headerClass}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(4px)' }}
          >
            <Shield size={18} className="drop-shadow-sm" />
          </div>
          <div className="min-w-0">
            <div className="font-black text-sm md:text-base leading-tight truncate">{title}</div>
            <div className="text-[10.5px] md:text-[11px] font-semibold text-white/80 leading-tight truncate">
              {subtitle}
            </div>
          </div>
        </div>

        {/* Status geral (verde ativado / cinza desativado) */}
        <div
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest shrink-0 ${
            cfg.allowCoordGeral || cfg.allowCoordSetor
              ? 'bg-emerald-500/15 text-white border-white/20'
              : 'bg-white/10 text-white/70 border-white/15'
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${
            cfg.allowCoordGeral || cfg.allowCoordSetor ? 'bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.8)] animate-pulse' : 'bg-white/40'
          }`} />
          {cfg.allowCoordGeral || cfg.allowCoordSetor ? 'LIBERADO' : 'DESLIGADO'}
        </div>
      </div>

      {/* Body: 2 toggles lado a lado */}
      <div className="p-4 md:p-5 space-y-3 md:space-y-4">
        {/* Toggle 1: Coordenadores GERAL */}
        <div
          className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-all duration-200 ${
            cfg.allowCoordGeral
              ? 'bg-blue-50 border-blue-200 shadow-[0_4px_14px_-6px_rgba(30,64,175,0.12)]'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                cfg.allowCoordGeral ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-500'
              }`}
              style={cfg.allowCoordGeral ? { backgroundColor: HMA_BLUE_PRIMARY } : undefined}
            >
              <Crown size={18} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`text-sm md:text-[15px] font-black leading-tight truncate ${
                  cfg.allowCoordGeral ? 'text-blue-900' : 'text-slate-700'
                }`}
                style={cfg.allowCoordGeral ? { color: HMA_BLUE_ACCENT } : undefined}
              >
                Coordenadores Gerais
              </div>
              <div className="text-[11px] md:text-xs font-semibold text-slate-500 leading-snug truncate">
                Coordenação Geral / Admin do sistema
              </div>
            </div>
          </div>
          <ToggleSwitch
            size="lg"
            checked={cfg.allowCoordGeral}
            disabled={saving}
            onChange={(v) => onChange({ ...cfg, allowCoordGeral: v })}
          />
        </div>

        {/* Toggle 2: Coordenadores de SETOR */}
        <div
          className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-all duration-200 ${
            cfg.allowCoordSetor
              ? 'bg-blue-50 border-blue-200 shadow-[0_4px_14px_-6px_rgba(30,64,175,0.12)]'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                cfg.allowCoordSetor ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'bg-slate-100 text-slate-500'
              }`}
              style={cfg.allowCoordSetor ? { backgroundColor: HMA_BLUE_PRIMARY } : undefined}
            >
              <Building2 size={18} strokeWidth={2.2} />
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`text-sm md:text-[15px] font-black leading-tight truncate ${
                  cfg.allowCoordSetor ? 'text-blue-900' : 'text-slate-700'
                }`}
                style={cfg.allowCoordSetor ? { color: HMA_BLUE_ACCENT } : undefined}
              >
                Coordenadores de Setor
              </div>
              <div className="text-[11px] md:text-xs font-semibold text-slate-500 leading-snug truncate">
                Chefes de cada setor / enfermagem
              </div>
            </div>
          </div>
          <ToggleSwitch
            size="lg"
            checked={cfg.allowCoordSetor}
            disabled={saving}
            onChange={(v) => onChange({ ...cfg, allowCoordSetor: v })}
          />
        </div>

        {/* Resumo quando ambos desligados */}
        {!cfg.allowCoordGeral && !cfg.allowCoordSetor && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 flex items-start gap-2.5">
            <div className="w-5 h-5 shrink-0 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mt-0.5">
              <span className="text-[11px] font-black">!</span>
            </div>
            <div>
              <div className="text-[11.5px] font-black uppercase tracking-wider text-amber-800 leading-tight">
                Relatório bloqueado para todos
              </div>
              <div className="text-[11px] font-semibold text-amber-700 leading-snug">
                Apenas Coordenação Geral (super admin) continuará tendo acesso.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ReportsPermissionModal({ open, onClose }: ReportsPermissionModalProps) {
  const [initialLoading, setInitialLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [form, setForm] = useState<LocalReportsPermissions | null>(null)

  const loadInitial = useCallback(async () => {
    setInitialLoading(true)
    try {
      const data = await getReportsPermissions() as unknown as LocalReportsPermissions
      setForm(data)
    } finally {
      setInitialLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) loadInitial()
  }, [open, loadInitial])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const res = await saveReportsPermissions(form as unknown as any)
      if (res.success) {
        setToast({ type: 'ok', msg: res.message })
        setTimeout(onClose, 800)
      } else {
        setToast({ type: 'err', msg: res.message })
      }
    } catch (e: any) {
      setToast({ type: 'err', msg: `Erro: ${e?.message || String(e)}` })
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/55 backdrop-blur-[2px] flex items-center justify-center z-[9999] p-3 md:p-6 overflow-y-auto">
      <div
        className="bg-white rounded-2xl shadow-[0_30px_70px_-15px_rgba(30,58,138,0.45)] ring-1 ring-blue-100 w-full max-w-4xl md:max-w-5xl max-h-[93vh] md:max-h-[88vh] flex flex-col overflow-hidden"
      >
        {/* Header principal do modal */}
        <div
          className="px-5 py-4 md:px-6 md:py-5 flex items-center justify-between gap-3 shrink-0 text-white"
          style={{
            background: `linear-gradient(90deg, ${HMA_BLUE_ACCENT} 0%, #2563eb 45%, #1d4ed8 100%)`,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(4px)' }}
            >
              <Shield size={20} className="drop-shadow-sm" />
            </div>
            <div className="min-w-0">
              <div className="font-black text-base md:text-lg leading-tight truncate">
                Permissões dos Relatórios
              </div>
              <div className="text-[11px] md:text-[12px] font-semibold text-white/85 leading-tight truncate">
                Habilite ou desabilite o acesso por tipo de coordenador
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/12 hover:bg-white/20 transition-colors text-white inline-flex items-center justify-center shrink-0"
            aria-label="Fechar"
          >
            <X size={17} strokeWidth={2.4} />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 md:space-y-5 bg-gradient-to-b from-blue-50/30 via-white to-white">
          {toast && (
            <div
              className={`rounded-xl border px-4 py-2.5 flex items-center gap-2 text-xs font-bold shadow-sm ${
                toast.type === 'ok'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {toast.type === 'ok' ? <Check size={15} /> : <X size={15} />}
              <span className="truncate">{toast.msg}</span>
            </div>
          )}

          {initialLoading && (
            <div className="flex flex-col items-center justify-center py-14 gap-3 text-slate-500">
              <Loader2 size={24} className="animate-spin text-blue-600" />
              <div className="text-xs font-black uppercase tracking-widest">
                Carregando permissões atuais...
              </div>
            </div>
          )}

          {!initialLoading && form && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
              {(['management', 'scheduled'] as ReportKind[]).map(kind => (
                <PermissionCard
                  key={kind}
                  kind={kind}
                  cfg={form[kind]}
                  onChange={(nextCfg) => {
                    setForm(prev => prev ? { ...prev, [kind]: nextCfg } : prev)
                  }}
                  saving={saving || initialLoading}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-blue-100 bg-gradient-to-r from-slate-50 via-blue-50/40 to-slate-50 px-4 md:px-6 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving || initialLoading}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-slate-700 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || initialLoading || !form}
            className="px-5 py-2 rounded-xl text-white text-xs font-black uppercase tracking-widest shadow-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 inline-flex items-center justify-center gap-2"
            style={{ backgroundColor: HMA_BLUE_PRIMARY, boxShadow: '0 10px 25px -8px rgba(30,64,175,0.45)' }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={15} />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
