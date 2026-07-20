'use client'

import { Suspense } from 'react'
import { useFormState } from 'react-dom'
import Image from 'next/image'
import type { StaticImageData } from 'next/image'
import logoHma from '@/public/logo-hma.png'
import logoPrefeitura from '@/public/logo-prefeitura.png'
import PublicScheduleList from './PublicScheduleList'

const initialState = {
  message: '',
}

interface PortalLandingPageContentProps {
  loginAction: (prevState: any, formData: FormData) => Promise<any>
  portalTitle: string
  portalSubtitle: string
  footerText: string
  showPublicSchedules?: boolean
  portalLogo?: StaticImageData
  showPortalBadge?: boolean
  theme?: 'indigo' | 'red'
}

export default function PortalLandingPageContent({
  loginAction,
  portalTitle,
  portalSubtitle,
  footerText,
  showPublicSchedules = true,
  portalLogo = logoHma,
  showPortalBadge = true,
  theme = 'indigo',
}: PortalLandingPageContentProps) {
  const [state, formAction] = useFormState(loginAction, initialState as any)
  const palette = theme === 'red'
    ? {
        bg: 'bg-gradient-to-b from-rose-50 via-red-50/70 to-orange-50',
        blobA: 'bg-red-400/15',
        blobB: 'bg-rose-400/12',
        blobC: 'bg-orange-400/10',
        ring: 'from-red-600 via-rose-500 to-orange-400',
        chip: 'bg-red-100 text-red-700',
        hoverCard: 'hover:bg-red-50/50 hover:border-red-200/80 focus:ring-red-500',
        title: 'text-red-700 group-hover:text-red-800',
        button: 'bg-red-600 hover:bg-red-700 shadow-red-200/70',
        input: 'focus:ring-red-500/20 focus:border-red-300',
        back: 'text-red-600 hover:text-red-700',
      }
    : {
        bg: 'bg-gradient-to-b from-slate-50 via-indigo-50/40 to-slate-100',
        blobA: 'bg-indigo-400/15',
        blobB: 'bg-blue-400/10',
        blobC: 'bg-emerald-400/10',
        ring: 'from-indigo-600 via-blue-600 to-emerald-500',
        chip: 'bg-indigo-100 text-indigo-700',
        hoverCard: 'hover:bg-indigo-50/50 hover:border-indigo-200/80 focus:ring-indigo-500',
        title: 'text-indigo-700 group-hover:text-indigo-800',
        button: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200/70',
        input: 'focus:ring-indigo-500/20 focus:border-indigo-300',
        back: 'text-indigo-600 hover:text-indigo-700',
      }

  if (state?.step === 'select_profile' && state.profiles) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${palette.bg} py-12 px-4 sm:px-6 lg:px-8 font-sans`}>
        <div className="max-w-md w-full space-y-8 bg-white/85 backdrop-blur rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/70 p-8">
          <div className="text-center">
            {showPortalBadge && <div className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] mb-4 ${palette.chip}`}>{portalTitle}</div>}
            <h2 className="text-3xl font-black text-gray-900 tracking-tight">
              Selecione o Perfil
            </h2>
            <p className="mt-2 text-sm text-gray-500 font-medium">
              Identificamos múltiplos vínculos. Escolha qual deseja acessar.
            </p>
          </div>
          <div className="mt-8 space-y-4">
            {state.profiles.map((profile: any) => (
              <form key={profile.id} action={formAction}>
                <input type="hidden" name="selectedProfileId" value={profile.id} />
                <button
                  type="submit"
                  className={`w-full flex flex-col items-center justify-center py-5 px-4 border border-slate-200/80 rounded-2xl shadow-sm text-sm font-medium text-slate-700 bg-white ${palette.hoverCard} focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 group`}
                >
                  <span className={`font-bold text-xl ${palette.title}`}>{profile.role}</span>
                  <span className="text-gray-500 font-semibold mt-1 uppercase text-xs tracking-wider">{profile.vinculo}</span>
                  {profile.name && <span className="text-xs text-gray-400 mt-2 font-medium bg-gray-50 px-2 py-0.5 rounded-full">{profile.name}</span>}
                </button>
              </form>
            ))}
          </div>
          <div className="text-center mt-6">
            <button onClick={() => window.location.reload()} className={`text-sm font-bold transition-colors ${palette.back}`}>
              ← Voltar para Login
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen relative ${palette.bg} flex flex-col items-center justify-start p-4 md:p-8 pt-8 md:pt-12 font-sans overflow-y-auto print:bg-white print:p-0 print:block print:min-h-0`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none print:hidden">
        <div className={`absolute -top-24 -left-20 h-80 w-80 rounded-full blur-3xl ${palette.blobA}`} />
        <div className={`absolute -bottom-24 -right-20 h-80 w-80 rounded-full blur-3xl ${palette.blobB}`} />
        <div className={`absolute top-48 right-16 h-56 w-56 rounded-full blur-3xl hidden md:block ${palette.blobC}`} />
      </div>
      <div className="max-w-7xl w-full flex flex-col gap-8 print:block print:max-w-none print:w-full relative">
        <div className="bg-white/85 backdrop-blur rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/70 p-6 md:p-8 print:hidden">
          <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${palette.ring} mb-6`} />
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex items-center gap-8 justify-center lg:justify-start">
              <Image
                src={logoPrefeitura}
                alt="Prefeitura de Açailândia"
                width={160}
                height={54}
                className="h-12 md:h-14 w-auto object-contain"
                priority
              />
              <div className="h-10 w-px bg-slate-200/80 hidden sm:block" />
              <div className="flex items-center gap-4">
                <Image
                  src={portalLogo}
                  alt={portalTitle}
                  width={160}
                  height={54}
                  className="h-12 md:h-14 w-auto object-contain"
                  priority
                />
                {showPortalBadge && <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.2em] ${palette.chip}`}>{portalTitle}</span>}
              </div>
            </div>

            <form action={formAction} className="w-full lg:w-auto">
              <div className="mb-4">
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{portalTitle}</h1>
                <p className="text-slate-600 font-medium mt-1">{portalSubtitle}</p>
              </div>
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="w-full md:w-[260px]">
                  <label htmlFor="cpf" className="block text-xs font-black text-slate-800 mb-2 uppercase tracking-widest">
                    CPF
                  </label>
                  <input
                    id="cpf"
                    name="cpf"
                    type="text"
                    required
                    className={`appearance-none block w-full px-5 py-4 border border-slate-200/80 rounded-2xl text-slate-800 bg-white focus:outline-none focus:ring-4 transition-all duration-200 text-base font-bold ${palette.input}`}
                    autoComplete="username"
                  />
                </div>
                <div className="w-full md:w-[260px]">
                  <label htmlFor="password" className="block text-xs font-black text-slate-800 mb-2 uppercase tracking-widest">
                    SENHA
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className={`appearance-none block w-full px-5 py-4 border border-slate-200/80 rounded-2xl text-slate-800 bg-white focus:outline-none focus:ring-4 transition-all duration-200 text-base font-bold ${palette.input}`}
                    placeholder="••••••"
                    autoComplete="current-password"
                  />
                </div>
                <button
                  type="submit"
                  className={`w-full md:w-auto h-[56px] px-10 rounded-2xl text-white shadow-lg transition-all duration-200 transform active:scale-[0.98] font-black ${palette.button}`}
                >
                  Entrar
                </button>
              </div>

              {state?.message && (
                <div className="mt-4 bg-red-50 text-red-600 text-sm font-bold p-3 rounded-2xl text-center border border-red-100">
                  {state.message}
                </div>
              )}
            </form>
          </div>
        </div>

        {showPublicSchedules && (
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/70 p-6 md:p-8 print:p-0 print:shadow-none print:border-none">
            <div className={`h-1.5 w-full rounded-full bg-gradient-to-r ${palette.ring} mb-6 print:hidden`} />
            <div className="flex items-center justify-between mb-8 print:hidden">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Escalas Publicadas</h2>
                <p className="text-slate-600 font-medium text-lg mt-1">Consulte e baixe as escalas sem necessidade de login</p>
              </div>
            </div>

            <Suspense fallback={<div className="text-center py-12">Carregando escalas...</div>}>
              <PublicScheduleList />
            </Suspense>
          </div>
        )}

        <div className="text-center text-gray-400 text-sm font-bold uppercase tracking-widest print:hidden">
          © {new Date().getFullYear()} {footerText}
        </div>
      </div>
    </div>
  )
}
