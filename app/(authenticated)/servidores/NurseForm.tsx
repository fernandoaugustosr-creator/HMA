'use client'

import { useFormState } from 'react-dom'
import { createNurse } from '@/app/actions'
import { useRef, useEffect } from 'react'

const initialState = {
  message: '',
  success: false
}

export default function NurseForm() {
  const [state, formAction] = useFormState(createNurse, initialState)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.success && formRef.current) {
      formRef.current.reset()
    }
  }, [state.success])

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome Completo</label>
          <input
            type="text"
            name="name"
            id="name"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-black"
            placeholder="Ex: Ana Souza"
          />
        </div>
        <div>
          <label htmlFor="cpf" className="block text-sm font-medium text-gray-700">CPF</label>
          <input
            type="text"
            name="cpf"
            id="cpf"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-black"
            placeholder="Apenas números"
          />
        </div>
        <div>
          <label htmlFor="coren" className="block text-sm font-medium text-gray-700">COREN</label>
          <input
            type="text"
            name="coren"
            id="coren"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-black"
            placeholder="Ex: 123456"
          />
        </div>
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700">Cargo</label>
          <select
            name="role"
            id="role"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-black"
          >
            <option value="ENFERMEIRO">Enfermeiro(a)</option>
            <option value="TECNICO">Técnico(a) de Enfermagem</option>
          </select>
        </div>
        <div>
          <label htmlFor="vinculo" className="block text-sm font-medium text-gray-700">Vínculo</label>
          <input
            type="text"
            name="vinculo"
            id="vinculo"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-black"
            placeholder="Ex: Concurso, Seletivo"
          />
        </div>
      </div>
      
      <div>
         <label htmlFor="password" className="block text-sm font-medium text-gray-700">Senha (Opcional - Padrão: 123456)</label>
         <input
            type="password"
            name="password"
            id="password"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-black"
            placeholder="******"
          />
      </div>
      
      {state.message && (
        <div className={`text-sm ${state.success ? 'text-green-600' : 'text-red-600'}`}>
          {state.message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cadastrar Servidor
        </button>
      </div>
    </form>
  )
}
