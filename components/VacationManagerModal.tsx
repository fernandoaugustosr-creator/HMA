'use client'

import { useState } from 'react'
import { assignVacation } from '@/app/actions'

interface Nurse {
  id: string
  name: string
  role?: string
}

interface VacationManagerModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  nurses: Nurse[]
}

export default function VacationManagerModal({ isOpen, onClose, onSuccess, nurses }: VacationManagerModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const result = await assignVacation(null, formData)

    if (result.success) {
      onSuccess()
      onClose()
    } else {
      setError(result.message || 'Erro ao cadastrar férias')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-black">Gerenciar Férias</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Profissional</label>
            <select 
              name="nurseId" 
              required
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
            >
              <option value="">Selecione...</option>
              {nurses.map(nurse => (
                <option key={nurse.id} value={nurse.id}>{nurse.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Data Início</label>
              <input 
                type="date" 
                name="startDate" 
                required 
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Data Fim</label>
              <input 
                type="date" 
                name="endDate" 
                required 
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700"
              disabled={loading}
            >
              {loading ? 'Salvando...' : 'Salvar Férias'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
