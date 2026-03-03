'use client'

import { useFormState } from 'react-dom'
import { login } from '@/app/actions'
import Image from 'next/image'

const initialState = {
  message: '',
}

export default function LoginPage() {
  const [state, formAction] = useFormState(login, initialState as any)

  if (state?.step === 'select_profile' && state.profiles) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-gray-900">
              Selecione o Perfil
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Identificamos múltiplos vínculos. Escolha qual deseja acessar.
            </p>
          </div>
          <div className="mt-8 space-y-4">
            {state.profiles.map((profile: any) => (
              <form key={profile.id} action={formAction}>
                <input type="hidden" name="selectedProfileId" value={profile.id} />
                <button
                  type="submit"
                  className="w-full flex flex-col items-center justify-center py-4 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                >
                  <span className="font-bold text-lg text-indigo-700">{profile.role}</span>
                  <span className="text-gray-600 font-medium">{profile.vinculo}</span>
                  {profile.name && <span className="text-xs text-gray-400 mt-1">{profile.name}</span>}
                </button>
              </form>
            ))}
          </div>
          <div className="text-center mt-4">
             <button onClick={() => window.location.reload()} className="text-indigo-600 hover:text-indigo-500 text-sm font-medium">
                 Voltar para Login
             </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div>
          <div className="flex justify-center">
            <Image
              src="/logo-hma.png"
              alt="LOGOHMA"
              width={160}
              height={56}
              className="h-14 w-auto object-contain"
              priority
            />
          </div>
          <h2 className="mt-4 text-center text-3xl font-extrabold text-gray-900">
            Acessar Sistema
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Entre com seu CPF e senha
          </p>
        </div>
        <form className="mt-8 space-y-6" action={formAction}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div className="mb-4">
              <label htmlFor="cpf" className="sr-only">
                CPF
              </label>
              <input
                id="cpf"
                name="cpf"
                type="text"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-black bg-white rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="CPF (ex: 02170025367)"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-black bg-white rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Senha"
              />
            </div>
          </div>

          {state?.message && (
            <div className="text-red-500 text-sm text-center">
              {state.message}
            </div>
          )}

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Entrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
