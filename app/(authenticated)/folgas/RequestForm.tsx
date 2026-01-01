'use client'

import { useFormState } from 'react-dom'
import { requestTimeOff } from '@/app/actions'
import { useRef, useEffect } from 'react'

const initialState = {
  message: '',
  success: false
}

export default function RequestForm() {
  const [state, formAction] = useFormState(requestTimeOff, initialState)
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
          <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Data de Início</label>
          <input
            type="date"
            name="startDate"
            id="startDate"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
          />
        </div>
        <div>
          <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Data de Fim</label>
          <input
            type="date"
            name="endDate"
            id="endDate"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
          />
        </div>
      </div>
      
      <div>
         <label htmlFor="reason" className="block text-sm font-medium text-gray-700">Motivo</label>
         <textarea
            name="reason"
            id="reason"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2"
            placeholder="Ex: Viagem familiar, consulta médica..."
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
          Solicitar Folga
        </button>
      </div>
    </form>
  )
}
