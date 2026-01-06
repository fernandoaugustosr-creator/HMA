'use client'

import { useFormState } from 'react-dom'
import { changePassword } from '@/app/actions'
import { LogOut } from 'lucide-react'
import { logout } from '@/app/actions'

const initialState = {
  success: false,
  message: ''
}

export default function AlterarSenhaPage() {
  const [state, formAction] = useFormState(changePassword, initialState)

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="bg-white p-8 rounded-lg shadow-md border border-red-200">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-red-600">Alteração de Senha Obrigatória</h2>
          <p className="text-gray-600 mt-2">
            Por segurança, você deve alterar sua senha padrão (123456) antes de acessar o sistema.
          </p>
        </div>

        <form action={formAction} className="space-y-6">
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">Nova Senha</label>
            <input
              type="password"
              name="newPassword"
              id="newPassword"
              required
              minLength={6}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-black"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirmar Nova Senha</label>
            <input
              type="password"
              name="confirmPassword"
              id="confirmPassword"
              required
              minLength={6}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-black"
              placeholder="Repita a nova senha"
            />
          </div>

          {state?.message && (
            <div className={`text-sm text-center p-2 rounded ${state.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {state.message}
            </div>
          )}

          <button
            type="submit"
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Alterar Senha e Entrar
          </button>
        </form>

        <div className="mt-6 border-t pt-4 text-center">
            <p className="text-sm text-gray-500 mb-2">Não quer alterar agora?</p>
            <form action={logout}>
                <button 
                    type="submit"
                    className="text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1 w-full"
                >
                    <LogOut size={16} />
                    Sair do Sistema
                </button>
            </form>
        </div>
      </div>
    </div>
  )
}
