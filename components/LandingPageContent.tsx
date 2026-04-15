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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
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
                  className="w-full flex flex-col items-center justify-center py-5 px-4 border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-indigo-50 hover:border-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 group"
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
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col items-center justify-start p-4 md:p-8 pt-6 md:pt-10 font-sans overflow-y-auto print:bg-white print:p-0 print:block print:min-h-0">
      <div className="max-w-7xl w-full flex flex-col gap-6 print:block print:max-w-none print:w-full">
        <div className="bg-white rounded-[2rem] shadow-2xl shadow-slate-200/60 border border-white p-4 md:p-6 print:hidden">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center justify-center lg:justify-start gap-6">
              <Image
                src={logoPrefeitura}
                alt="Prefeitura de Açailândia"
                width={140}
                height={48}
                className="h-10 w-auto object-contain"
                priority
              />
              <div className="h-8 w-px bg-gray-200" />
              <Image
                src={logoHma}
                alt="HMA"
                width={140}
                height={48}
                className="h-10 w-auto object-contain"
                priority
              />
            </div>

            <form action={formAction} className="flex flex-col md:flex-row md:items-end gap-3 w-full lg:w-auto">
              <div className="flex-1 md:w-[220px]">
                <label htmlFor="cpf" className="block text-xs font-black text-[#1e293b] mb-1 ml-1 uppercase tracking-wider">
                  CPF
                </label>
                <input
                  id="cpf"
                  name="cpf"
                  type="text"
                  required
                  className="appearance-none block w-full px-4 py-3 border-none rounded-xl text-[#1e293b] bg-[#eef2ff] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 text-sm font-bold"
                  placeholder="02170025367"
                />
              </div>

              <div className="flex-1 md:w-[220px]">
                <label htmlFor="password" title="password" className="block text-xs font-black text-[#1e293b] mb-1 ml-1 uppercase tracking-wider">
                  Senha
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="appearance-none block w-full px-4 py-3 border-none rounded-xl text-[#1e293b] bg-[#eef2ff] focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200 text-sm font-bold"
                  placeholder="••••••"
                />
              </div>

              <button
                type="submit"
                className="w-full md:w-auto flex justify-center px-6 py-3 border border-transparent text-sm font-black rounded-xl text-white bg-[#4f46e5] hover:bg-[#4338ca] shadow-lg shadow-indigo-200 transition-all duration-200 transform active:scale-[0.98]"
              >
                Entrar
              </button>
            </form>
          </div>

          {state?.message && (
            <div className="mt-4 bg-red-50 text-red-600 text-sm font-bold p-3 rounded-xl text-center border border-red-100">
              {state.message}
            </div>
          )}
        </div>

        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-2xl shadow-slate-200/60 border border-white h-full print:p-0 print:shadow-none print:border-none">
          <div className="flex items-center justify-between mb-4 print:hidden">
            <div>
              <h2 className="text-2xl font-black text-[#1e293b] tracking-tight">Escalas Publicadas</h2>
              <p className="text-gray-500 font-medium text-sm mt-1">Consulte e baixe as escalas sem necessidade de login</p>
            </div>
          </div>

          <Suspense fallback={<div className="text-center py-12">Carregando escalas...</div>}>
            <PublicScheduleList />
          </Suspense>
        </div>
      </div>
      
      <div className="mt-12 text-center text-gray-400 text-sm font-bold uppercase tracking-widest print:hidden">
        © {new Date().getFullYear()} Hospital Municipal de Açailândia • Gestão de Enfermagem
      </div>
    </div>
  )
}
