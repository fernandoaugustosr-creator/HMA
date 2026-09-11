'use client'

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
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
}

export default function ReportsPermissionModalProvider({ children }: ReportsPermissionModalProviderProps) {
  const [open, setOpen] = useState(false)

  const value = useMemo<ReportsPermissionModalContextValue>((() => ({
    open: () => setOpen(true),
    close: () => setOpen(false),
    isOpen: open,
  })), [open])

  return (
    <ReportsPermissionModalContext.Provider value={value}>
      {children}
      <SidebarPermissionModal open={open} onClose={() => setOpen(false)} />
    </ReportsPermissionModalContext.Provider>
  )
}
