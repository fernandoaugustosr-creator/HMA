'use client'

import { useFormState } from 'react-dom'
import { createNurse } from '@/app/actions'
import { useRef, useEffect, useState } from 'react'

const initialState = {
  message: '',
  success: false
}

export default function NurseForm({ sections = [] as any[] }: { sections?: any[] }) {
  const [state, formAction] = useFormState(createNurse, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const [useDefaultPassword, setUseDefaultPassword] = useState(false)

  useEffect(() => {
    if (state.success && formRef.current) {
      formRef.current.reset()
      setUseDefaultPassword(false)
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
            <option value="TECNICO">Téc. de Enfermagem</option>
            <option value="MEDICO">Médico(a)</option>
            <option value="MOTORISTA">Motorista</option>
            <option value="RECEPCAO">Recepção</option>
            <option value="AGENTE_DE_PORTARIA">Agente de Portaria</option>
            <option value="ASSISTENTE_SOCIAL">Assistente Social</option>
            <option value="COORDENADOR">Coordenador(a)</option>
          </select>
        </div>
        <div>
          <label htmlFor="vinculo" className="block text-sm font-medium text-gray-700">Vínculo</label>
          <input
            type="text"
            name="vinculo"
            id="vinculo"
            list="vinculo-options"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-black"
            placeholder="Ex: Concurso, Seletivo"
          />
          <datalist id="vinculo-options">
            <option value="CONCURSO" />
            <option value="SELETIVO" />
            <option value="TERCEIRIZADO" />
            <option value="ESCALA DUPLA" />
            <option value="ESCALA DESCOBERTA" />
          </datalist>
        </div>
        <div>
          <label htmlFor="sectionId" className="block text-sm font-medium text-gray-700">Setor (Opcional)</label>
          <select
            name="sectionId"
            id="sectionId"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 bg-white text-black"
            defaultValue=""
          >
            <option value="">Selecione...</option>
            {sections.map((section: any) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div>
         <label htmlFor="password" className="block text-sm font-medium text-gray-700">Senha (Opcional - Padrão: 123456)</label>
         <input
            type="password"
            name="password"
            id="password"
            disabled={useDefaultPassword}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2 text-black ${useDefaultPassword ? 'bg-gray-100' : 'bg-white'}`}
            placeholder={useDefaultPassword ? "Usando senha padrão (123456)" : "******"}
          />
          <div className="mt-2 flex items-center">
            <input
              id="useDefaultPassword"
              name="useDefaultPassword"
              type="checkbox"
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              checked={useDefaultPassword}
              onChange={(e) => setUseDefaultPassword(e.target.checked)}
            />
            <label htmlFor="useDefaultPassword" className="ml-2 block text-sm text-gray-900">
              Usar senha padrão (123456)
            </label>
          </div>
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
