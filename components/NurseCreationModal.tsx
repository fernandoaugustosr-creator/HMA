'use client'

import { useState } from 'react'
import { createNurse } from '@/app/actions'

interface NurseCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  defaultRole?: string
  defaultSectionId?: string
}

export default function NurseCreationModal({ isOpen, onClose, onSuccess, defaultRole = 'ENFERMEIRO', defaultSectionId }: NurseCreationModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    // Add role if missing or ensure it's set
    if (!formData.get('role')) {
        formData.set('role', defaultRole)
    }
    if (defaultSectionId) {
        formData.set('sectionId', defaultSectionId)
    }

    const result = await createNurse(null, formData)

    if (result.success) {
      onSuccess()
      onClose()
    } else {
      setError(result.message || 'Erro ao criar servidor')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-black">Adicionar Novo Profissional</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
            <input 
              type="text" 
              name="name" 
              required 
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">COREN</label>
                <input 
                type="text" 
                name="coren" 
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Vínculo</label>
                <select name="vinculo" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black">
                    <option value="CONCURSO">CONCURSO</option>
                    <option value="SELETIVO">SELETIVO</option>
                    <option value="COOPERATIVA">COOPERATIVA</option>
                </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Cargo</label>
            <select 
                name="role" 
                defaultValue={defaultRole}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
            >
                <option value="ENFERMEIRO">ENFERMEIRO</option>
                <option value="TECNICO">TÉCNICO DE ENFERMAGEM</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">CPF (Opcional - Login)</label>
            <input 
              type="text" 
              name="cpf" 
              placeholder="Apenas números"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
