'use client'

import { useFormState } from 'react-dom'
import { login } from '@/app/actions'
import Image from 'next/image'
import logoHma from '@/public/logo-hma.png'
import logoPrefeitura from '@/public/logo-prefeitura.png'
import PublicScheduleList from './PublicScheduleList'
import { Suspense } from 'react'

const initialState = {
  message: '',
}

export default function LandingPageContent() {
  const [state, formAction] = useFormState(login, initialState as any)

  if (state?.step === 'select_profile' && state.profiles) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 via-indigo-50/40 to-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-md w-full space-y-8 bg-white/85 backdrop-blur rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/70 p-8">
          <div className="text-center">
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
                  className="w-full flex flex-col items-center justify-center py-5 px-4 border border-slate-200/80 rounded-2xl shadow-sm text-sm font-medium text-slate-700 bg-white hover:bg-indigo-50/50 hover:border-indigo-200/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 group"
                >
                  <span className="font-bold text-xl text-indigo-700 group-hover:text-indigo-800">{profile.role}</span>
                  <span className="text-gray-500 font-semibold mt-1 uppercase text-xs tracking-wider">{profile.vinculo}</span>
                  {profile.name && <span className="text-xs text-gray-400 mt-2 font-medium bg-gray-50 px-2 py-0.5 rounded-full">{profile.name}</span>}
                </button>
              </form>
            ))}
          </div>
          <div className="text-center mt-6">
             <button onClick={() => window.location.reload()} className="text-indigo-600 hover:text-indigo-700 text-sm font-bold transition-colors">
                 ← Voltar para Login
             </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative bg-gradient-to-b from-slate-50 via-indigo-50/40 to-slate-100 flex flex-col items-center justify-start p-4 md:p-8 pt-8 md:pt-12 font-sans overflow-y-auto print:bg-white print:p-0 print:block print:min-h-0">
      <div className="absolute inset-0 overflow-hidden pointer-events-none print:hidden">
        <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute top-48 right-16 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl hidden md:block" />
      </div>
      <div className="max-w-7xl w-full flex flex-col gap-8 print:block print:max-w-none print:w-full relative">
        <div className="bg-white/85 backdrop-blur rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/70 p-6 md:p-8 print:hidden">
          <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-500 mb-6" />
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
              <Image
                src={logoHma}
                alt="HMA"
                width={160}
                height={54}
                className="h-12 md:h-14 w-auto object-contain"
                priority
              />
            </div>

            <form action={formAction} className="w-full lg:w-auto">
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
                    className="appearance-none block w-full px-5 py-4 border border-slate-200/80 rounded-2xl text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all duration-200 text-base font-bold"
                    placeholder="02170025367"
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
                    className="appearance-none block w-full px-5 py-4 border border-slate-200/80 rounded-2xl text-slate-800 bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-300 transition-all duration-200 text-base font-bold"
                    placeholder="••••••"
                    autoComplete="current-password"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full md:w-auto h-[56px] px-10 rounded-2xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200/70 transition-all duration-200 transform active:scale-[0.98] font-black"
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

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-200/70 p-6 md:p-8 print:p-0 print:shadow-none print:border-none">
          <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-500 mb-6 print:hidden" />
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

        <div className="text-center text-gray-400 text-sm font-bold uppercase tracking-widest print:hidden">
          © {new Date().getFullYear()} Hospital Municipal de Açailândia • Gestão de Enfermagem
        </div>
      </div>
    </div>
  )
}
