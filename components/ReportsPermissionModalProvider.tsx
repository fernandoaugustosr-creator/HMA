'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Shield, Settings, Check } from 'lucide-react'
import ReportsPermissionModal from './ReportsPermissionModal'
import SidebarPermissionModal from './SidebarPermissionModal'

interface ReportsPermissionModalContextValue {
  open: () => void
  close: () => void
  isOpen: boolean
}

const ReportsPermissionModalContext = createContext<ReportsPermissionModalContextValue | null>(null)

export function useReportsPermissionModal() {
  const ctx = useContext(ReportsPermissionModalContext)
  if (!ctx) {
    throw new Error('useReportsPermissionModal deve ser usado em <ReportsPermissionModalProvider>')
  }
  return ctx
}

interface ReportsPermissionModalProviderProps {
  children: React.ReactNode
  showButton?: boolean
}

// Cor AZUL HMA
const HMA_BLUE_ACCENT = '#1e3a8a'
const HMA_BLUE_PRIMARY = '#2563eb'

export default function ReportsPermissionModalProvider({ children, showButton = false }: ReportsPermissionModalProviderProps) {
  const [open, setOpen] = useState(false)

  const value = useMemo<ReportsPermissionModalContextValue>((() => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: open,
  })), [open])

  return (
    <ReportsPermissionModalContext.Provider value={value}>
      {showButton && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed z-[9996] bottom-5 right-5 sm:bottom-6 sm:right-6 inline-flex items-center gap-2 sm:gap-2.5 px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl text-white hover:brightness-110 active:scale-[0.97] transition-all border border-white/15 group"
          style={{
            backgroundColor: HMA_BLUE_PRIMARY,
            boxShadow: `0 14px 35px -10px ${HMA_BLUE_ACCENT}99, 0 6px 16px -6px rgba(30,58,138,0.35)`,
            backgroundImage: `linear-gradient(135deg, ${HMA_BLUE_ACCENT} 0%, ${HMA_BLUE_PRIMARY} 55%, #3b82f6 100%)`,
          }}
          title="Configurar permissões do menu lateral (somente Coordenação Geral)"
        >
          <div className="relative w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center shrink-0">
            <Shield size={17} strokeWidth={2.4} className="drop-shadow-sm" />
            <div className="absolute -right-0.5 -top-0.5 w-3.5 h-3.5 rounded-full bg-white/25 flex items-center justify-center group-hover:bg-white/35 transition-colors">
              <Settings size={10} strokeWidth={2.6} className="text-white" />
            </div>
          </div>
          <span className="hidden sm:inline text-[11px] font-black uppercase tracking-[0.08em] leading-none">
            Permissões do Menu
          </span>
          <span className="inline sm:hidden text-[10px] font-black uppercase tracking-wider leading-none">
            Permissões
          </span>
        </button>
      )}

      {children}

      {/* NOVO: Sidebar Permission Modal (completo, com todos os menus) */}
      <SidebarPermissionModal open={open} onClose={() => setOpen(false)} />
    </ReportsPermissionModalContext.Provider>
  )
}
