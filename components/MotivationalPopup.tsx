'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Quote, Sparkles } from 'lucide-react'
import type { MotivationalPhrase } from '@/app/actions'
import logoHma from '@/public/logo-hma.png'

const LAST_NONCE_KEY = 'motivational_popup_last_nonce_v1'

export default function MotivationalPopup({
  phrase,
  loginNonce,
}: {
  phrase: MotivationalPhrase | null
  loginNonce: string | null
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!phrase) return
    if (!loginNonce) return
    try {
      if (typeof window === 'undefined') return
      const lastSeen = window.sessionStorage.getItem(LAST_NONCE_KEY)
      if (lastSeen === loginNonce) return
      window.sessionStorage.setItem(LAST_NONCE_KEY, loginNonce)
      setOpen(true)
    } catch (_) {
      // fallback: mostra na mesma hora se storage falhar (mas só 1x/montagem)
      setOpen(true)
    }
  }, [phrase, loginNonce])

  const handleClose = () => {
    setOpen(false)
  }

  if (!open || !phrase) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden border border-white/30 animate-[fadeIn_.25s_ease-out]">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-blue-700 to-indigo-600" />
        <div className="absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-20 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />

        <div className="relative px-8 pt-8 pb-6 text-center">
          {/* 🏥 LOGO HMA - CENTRALIZADO DENTRO DO CARD BRANCO */}
          <div className="mx-auto mb-4 bg-white rounded-2xl border-2 border-white/60 shadow-lg shadow-blue-950/30 p-2 max-w-[260px] w-full flex items-center justify-center text-center">
            <Image src={logoHma} alt="Logo HMA" width={220} height={220} className="h-24 w-auto md:h-28 object-contain mx-auto block" priority />
          </div>

          {/* 🏥 NOME COMPLETO ABAIXO DA LOGO */}
          <h2 className="text-white font-black tracking-tight leading-tight">
            <div className="text-[17px] md:text-[18px] drop-shadow-sm">
              Hospital Municipal
            </div>
            <div className="text-[16px] md:text-[17px] text-blue-100 mt-0.5 drop-shadow-sm">
              de Açailândia
            </div>
          </h2>

          <div className="mt-4 mb-2 h-px w-24 mx-auto bg-white/30" />

          <h3 className="text-yellow-100/90 text-[11px] font-black uppercase tracking-[0.25em] mb-1">
            Bem-vindo(a) — Frase do Dia
          </h3>

          <div className="relative">
            <Quote size={28} className="absolute -top-2 -left-2 text-white/20" />
            <p className="text-white text-lg md:text-xl font-semibold leading-relaxed py-4 px-3 italic drop-shadow-sm">
              {phrase.text}
            </p>
            <Quote size={28} className="absolute -bottom-2 -right-2 text-white/20 rotate-180" />
          </div>
        </div>

        <div className="relative bg-white/10 backdrop-blur border-t border-white/20 px-8 py-4 flex justify-end">
          <button
            onClick={handleClose}
            className="px-8 py-2.5 rounded-xl font-bold text-blue-900 bg-white hover:bg-blue-50 shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2"
          >
            OK
            <Sparkles size={15} />
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
