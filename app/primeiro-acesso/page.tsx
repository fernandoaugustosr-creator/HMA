'use client'

import { useFormState } from 'react-dom'
import { checkCpf, updateRegistration } from './actions'
import Link from 'next/link'

const initialState = {
  success: false,
  message: '',
  cpf: '',
  name: '',
  coren: '',
  id: ''
}

export default function PrimeiroAcessoPage() {
  const [checkState, checkAction] = useFormState(checkCpf, initialState)
  const [updateState, updateAction] = useFormState(updateRegistration, initialState)

  const isStep2 = checkState?.success
  const isFinished = updateState?.success

  if (isFinished) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-extrabold text-green-600">Sucesso!</h2>
            <div className="text-green-600 font-medium text-lg">
              {updateState.message}
            </div>
            <p className="text-gray-600">
              Sua senha foi atualizada com sucesso. Agora você pode fazer login.
            </p>
            <Link 
              href="/login"
              className="inline-flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Ir para Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {!isStep2 ? 'Primeiro Acesso' : 'Completar Cadastro'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {!isStep2 
              ? 'Informe seu CPF para localizar seu cadastro' 
              : `Olá, ${checkState?.name || 'Enfermeiro(a)'}. Confirme seus dados e defina sua senha.`}
          </p>
        </div>

        {!isStep2 ? (
          <form className="mt-8 space-y-6" action={checkAction}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <label htmlFor="cpf" className="sr-only">
                  CPF
                </label>
                <input
                  id="cpf"
                  name="cpf"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-black bg-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="CPF (apenas números)"
                />
              </div>
            </div>

            {checkState?.message && !checkState.success && (
              <div className="text-red-500 text-sm text-center">
                {checkState.message}
              </div>
            )}

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Buscar Cadastro
              </button>
            </div>
            
            <div className="text-center mt-4">
              <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
                Voltar para Login
              </Link>
            </div>
          </form>
        ) : (
          <div className="mt-8 space-y-6">
            <form action={updateAction} className="space-y-6">
              <input type="hidden" name="id" value={checkState?.id || ''} />
              
              <div className="rounded-md shadow-sm space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Nome Completo
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    defaultValue={checkState?.name || ''}
                    required
                    className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-black bg-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="coren" className="block text-sm font-medium text-gray-700">
                    COREN
                  </label>
                  <input
                    id="coren"
                    name="coren"
                    type="text"
                    defaultValue={checkState?.coren || ''}
                    required
                    className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-black bg-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                    Nova Senha
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-black bg-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Digite sua nova senha"
                  />
                </div>
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirmar Nova Senha
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    required
                    className="mt-1 appearance-none block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-black bg-white rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Confirme sua nova senha"
                  />
                </div>
              </div>

              {updateState?.message && !updateState.success && (
                <div className="text-red-500 text-sm text-center">
                  {updateState.message}
                </div>
              )}

              <div>
                <button
                  type="submit"
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  Salvar Senha e Acessar
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
