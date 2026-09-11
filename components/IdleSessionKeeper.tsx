'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { LogOut, AlertTriangle, Clock, Hand } from 'lucide-react'
import { touchSession, forceLogoutIdle } from '@/app/actions'

const WARNING_SECONDS_BEFORE_LOGOUT = 60
const TOUCH_COOLDOWN_SECONDS = 180 // 3 minutos

const IDLE_FLAG_KEY = 'autologout_last_reason_is_idle_v1'

export default function IdleSessionKeeper({
  idleTimeoutSeconds,
  loginPath,
  loginNonce,
}: {
  idleTimeoutSeconds: number
  loginPath: string
  loginNonce: string | null
}) {
  const lastActivityAtRef = useRef<number>(Date.now())
  const lastTouchedAtRef = useRef<number>(0)
  const loggedOutRef = useRef<boolean>(false)

  const [remaining, setRemaining] = useState<number>(idleTimeoutSeconds)
  const [warningOpen, setWarningOpen] = useState<boolean>(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const remainingMinutes = Math.floor(remaining / 60)
  const remainingSeconds = remaining % 60

  const performLogoutByInactivity = useCallback(async () => {
    if (loggedOutRef.current) return
    loggedOutRef.current = true
    try {
      try { window.localStorage.setItem(IDLE_FLAG_KEY, '1') } catch (_) { /* noop */ }
    } catch (_) { /* noop */ }
    try {
      await forceLogoutIdle()
    } catch (e: any) {
      try { setLogoutError(e?.message || String(e)) } catch (_) { /* noop */ }
    }
    try {
      window.location.href = loginPath || '/'
    } catch (_) {
      try { window.location.replace(loginPath || '/') } catch (__) { /* noop */ }
    }
  }, [loginPath])

  // Touch session to refresh cookie sliding expiration
  const tryTouchSession = useCallback(async (force = false) => {
    try {
      const now = Date.now()
      const minDiff = TOUCH_COOLDOWN_SECONDS * 1000
      if (!force && now - lastTouchedAtRef.current < minDiff) return
      lastTouchedAtRef.current = now
      await touchSession()
    } catch (_) { /* noop */ }
  }, [])

  // Activity listeners
  useEffect(() => {
    let mounted = true

    const bump = () => {
      lastActivityAtRef.current = Date.now()
      setRemaining(idleTimeoutSeconds)
      if (warningOpen) setWarningOpen(false)
      void tryTouchSession(false)
    }

    const events = ['mousedown', 'keydown', 'touchstart', 'pointerdown', 'wheel', 'scroll'] as const
    const listenerOpts = { passive: true, capture: true } as const
    events.forEach(ev => {
      window.addEventListener(ev, bump, listenerOpts)
    })

    // Ticker every 1s
    const interval = window.setInterval(() => {
      if (!mounted || loggedOutRef.current) return
      const now = Date.now()
      const elapsedMs = now - lastActivityAtRef.current
      const elapsedSec = Math.floor(elapsedMs / 1000)
      const newRemaining = Math.max(0, idleTimeoutSeconds - elapsedSec)
      setRemaining(newRemaining)
      if (newRemaining <= WARNING_SECONDS_BEFORE_LOGOUT && newRemaining > 0) {
        setWarningOpen(true)
      }
      if (newRemaining <= 0) {
        void performLogoutByInactivity()
      }
    }, 1000)

    // Touch once immediately at mount to refresh cookie maxAge on navigation
    void tryTouchSession(true)

    return () => {
      mounted = false
      events.forEach(ev => {
        window.removeEventListener(ev, bump, listenerOpts as any)
      })
      window.clearInterval(interval)
    }
  }, [idleTimeoutSeconds, warningOpen, tryTouchSession, performLogoutByInactivity])

  // Clear any stale flag when a NEW loginNonce arrives (fresh login)
  useEffect(() => {
    if (!loginNonce) return
    try { window.localStorage.removeItem(IDLE_FLAG_KEY) } catch (_) { /* noop */ }
    try {
      const clearForNonce = 'autologout_ignore_warning_for_nonce_' + loginNonce
      sessionStorage.setItem('idle_warning_dismissed_nonce', clearForNonce)
    } catch (_) { /* noop */ }
  }, [loginNonce])

  if (!warningOpen && !logoutError) return null

  return (
    <>
      {warningOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-white/30 bg-white">
            <div className="h-2 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500" />
            <div className="px-8 pt-7 pb-6">
              <div className="flex items-start gap-4">
                <div className="shrink-0 h-14 w-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                  <AlertTriangle size={26} className="text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Sessão prestes a expirar
                  </h3>
                  <p className="text-slate-600 text-sm font-medium mt-1 leading-relaxed">
                    Você está inativo(a). O sistema irá <span className="font-bold text-red-600">desconectar automaticamente</span> para segurança dos dados, se não houver atividade.
                  </p>
                  <div className="mt-4 rounded-2xl bg-gradient-to-r from-amber-50 to-red-50 border border-amber-200 px-4 py-3 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white border border-amber-200 flex items-center justify-center shrink-0 shadow-sm">
                      <Clock size={18} className="text-orange-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-black text-orange-700 uppercase tracking-wider leading-none">
                        Tempo restante
                      </p>
                      <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums leading-none">
                        {String(remainingMinutes).padStart(2, '0')}
                        <span className="text-orange-500 mx-1">:</span>
                        {String(remainingSeconds).padStart(2, '0')}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        lastActivityAtRef.current = Date.now()
                        setRemaining(idleTimeoutSeconds)
                        setWarningOpen(false)
                        void tryTouchSession(true)
                      }}
                      className="shrink-0 px-5 py-2.5 rounded-xl font-bold text-white bg-gradient-to-r from-blue-800 via-blue-700 to-indigo-600 hover:from-blue-900 hover:via-blue-800 hover:to-indigo-700 shadow-md shadow-blue-900/10 transition-all flex items-center gap-2"
                    >
                      <Hand size={16} />
                      Permanecer conectado
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border-t border-slate-200 px-8 py-4 flex justify-end items-center gap-2">
              <button
                onClick={() => performLogoutByInactivity()}
                className="px-5 py-2 rounded-xl font-bold text-red-700 bg-white border border-red-200 hover:bg-red-50 shadow-sm flex items-center gap-2 transition-all"
              >
                <LogOut size={15} />
                Sair agora
              </button>
            </div>
          </div>
        </div>
      )}

      {logoutError && (
        <div className="fixed top-5 right-5 z-[10000] max-w-sm rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 shadow-xl text-sm font-semibold">
          Erro ao finalizar sessão: {logoutError}
        </div>
      )}
    </>
  )
}
