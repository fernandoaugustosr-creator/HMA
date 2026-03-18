'use client'

import { useFormState } from 'react-dom'
import { login } from '@/app/actions'
import Image from 'next/image'
import logoHma from '@/public/logo-hma.png'
import logoPrefeitura from '@/public/logo-prefeitura.png'
import PublicScheduleList from './PublicScheduleList'

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
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-4 md:p-8 font-sans">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Side: Login Form */}
        <div className="lg:col-span-5 bg-white p-8 md:p-10 rounded-3xl shadow-2xl shadow-indigo-100 border border-white relative overflow-hidden">
          {/* Decorative background element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16 z-0 opacity-50" />
          
          <div className="relative z-10">
            <div className="flex justify-center items-center gap-8 mb-8">
              <Image
                src={logoPrefeitura}
                alt="Prefeitura de Açailândia"
                width={160}
                height={54}
                className="h-12 w-auto object-contain drop-shadow-sm"
                priority
              />
              <div className="h-8 w-px bg-gray-200" />
              <Image
                src={logoHma}
                alt="HMA"
                width={160}
                height={54}
                className="h-12 w-auto object-contain drop-shadow-sm"
                priority
              />
            </div>
            
            <div className="text-center mb-10">
              <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-2">
                Acessar Sistema
              </h1>
              <p className="text-gray-500 font-medium">
                Entre com seu CPF e senha para gerenciar suas escalas
              </p>
            </div>

            <form className="space-y-5" action={formAction}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="cpf" className="block text-sm font-bold text-gray-700 mb-1 ml-1">
                    CPF
                  </label>
                  <input
                    id="cpf"
                    name="cpf"
                    type="text"
                    required
                    className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl placeholder-gray-400 text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all duration-200 text-base"
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <label htmlFor="password" title="password" className="block text-sm font-bold text-gray-700 mb-1 ml-1">
                    Senha
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="appearance-none block w-full px-4 py-3 border border-gray-200 rounded-xl placeholder-gray-400 text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent focus:bg-white transition-all duration-200 text-base"
                    placeholder="••••••"
                  />
                </div>
              </div>

              {state?.message && (
                <div className="bg-red-50 text-red-600 text-sm font-bold p-3 rounded-xl text-center border border-red-100 animate-pulse">
                  {state.message}
                </div>
              )}

              <button
                type="submit"
                className="w-full flex justify-center py-4 px-4 border border-transparent text-lg font-black rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:shadow-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 transform active:scale-[0.98]"
              >
                Entrar
              </button>
            </form>
          </div>
        </div>

        {/* Right Side: Public Schedule List */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white/60 backdrop-blur-sm p-6 md:p-8 rounded-3xl border border-white shadow-sm h-full min-h-[500px]">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">Escalas Publicadas</h2>
                    <p className="text-gray-500 font-medium text-sm">Consulte e baixe as escalas sem necessidade de login</p>
                </div>
            </div>
            
            <PublicScheduleList />
          </div>
        </div>

      </div>
      
      <div className="mt-12 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">
        © {new Date().getFullYear()} Hospital Municipal de Açailândia • Gestão de Enfermagem
      </div>
    </div>
  )
}
