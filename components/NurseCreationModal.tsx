'use client'

import { useState, useEffect } from 'react'
import { createNurse, updateNurse } from '@/app/actions'

interface NurseCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  defaultRole?: string
  defaultSectionId?: string
  defaultUnitId?: string
  nurseToEdit?: any
  sections?: any[]
}

export default function NurseCreationModal({ isOpen, onClose, onSuccess, defaultRole = 'ENFERMEIRO', defaultSectionId, defaultUnitId, nurseToEdit, sections = [] }: NurseCreationModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useDefaultPassword, setUseDefaultPassword] = useState(false)

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    if (!formData.get('role')) {
        formData.set('role', defaultRole)
    }
    if (defaultSectionId && !formData.get('sectionId')) {
        formData.set('sectionId', defaultSectionId)
    }
    if (defaultUnitId) {
        formData.set('unitId', defaultUnitId)
    }

    const vinculos = formData.getAll('vinculo').filter(Boolean) as string[]

    // Helper to prepare formData for a specific bond
    const getFormDataForBond = (bond: string) => {
        const fd = new FormData()
        formData.forEach((value, key) => {
            if (key === 'vinculo') return
            fd.append(key, value)
        })
        fd.append('vinculo', bond)
        return fd
    }

    let result = { success: true, message: '' }

    if (nurseToEdit) {
        if (vinculos.length === 0) {
             // If no bond selected, just update with original formData (which might have empty vinculo)
             result = await updateNurse(nurseToEdit.id, null, formData)
        } else {
             // 1. Update the main record with the first bond
             const firstBond = vinculos[0]
             const firstFd = getFormDataForBond(firstBond)
             result = await updateNurse(nurseToEdit.id, null, firstFd)

             // 2. Create new records for additional bonds
             if (result.success && vinculos.length > 1) {
                 for (let i = 1; i < vinculos.length; i++) {
                     const extraBond = vinculos[i]
                     const extraFd = getFormDataForBond(extraBond)
                     // Try to create additional records. Ignore "Already exists" errors.
                     const res = await createNurse(null, extraFd)
                     if (!res.success && !res.message?.includes('Já existe')) {
                         result = res
                     }
                 }
             }
        }
    } else {
        if (vinculos.length === 0) {
            result = await createNurse(null, formData)
        } else {
            for (let i = 0; i < vinculos.length; i++) {
                const bond = vinculos[i]
                const fd = getFormDataForBond(bond)
                const res = await createNurse(null, fd)
                
                // If it fails with something other than "already exists", we consider it a failure
                if (!res.success) {
                     if (!res.message?.includes('Já existe')) {
                         result = res
                         break
                     }
                } else {
                    result = res
                }
            }
        }
    }

    if (result.success) {
      onSuccess()
      onClose()
    } else {
      setError(result.message || 'Erro ao salvar servidor')
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-xl font-bold mb-4 text-black">
            {nurseToEdit ? 'Editar Profissional' : 'Adicionar Novo Profissional'}
        </h2>
        
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
              defaultValue={nurseToEdit?.name}
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
                  defaultValue={nurseToEdit?.coren}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Vínculo (pode marcar mais de um)</label>
                <div className="mt-1 flex flex-col gap-1 text-sm text-gray-700">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="vinculo"
                      value="CONCURSO"
                      defaultChecked={nurseToEdit?.vinculo?.includes('CONCURSO')}
                      className="h-4 w-4"
                    />
                    <span>CONCURSO</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="vinculo"
                      value="ESCALA DUPLA"
                      defaultChecked={nurseToEdit?.vinculo?.includes('ESCALA DUPLA') || (nurseToEdit?.observation || '').includes('1ED')}
                      className="h-4 w-4"
                    />
                    <span>ESCALA DUPLA</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="vinculo"
                      value="SELETIVO"
                      defaultChecked={nurseToEdit?.vinculo?.includes('SELETIVO')}
                      className="h-4 w-4"
                    />
                    <span>SELETIVO</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="vinculo"
                      value="COOPERATIVA"
                      defaultChecked={nurseToEdit?.vinculo?.includes('COOPERATIVA')}
                      className="h-4 w-4"
                    />
                    <span>COOPERATIVA</span>
                  </label>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Cargo</label>
                <select 
                    name="role" 
                    defaultValue={nurseToEdit?.role || defaultRole}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                >
                    <option value="ENFERMEIRO">Enfermeiro(a)</option>
                    <option value="TECNICO">Técnico de Enfermagem</option>
                    <option value="MEDICO">Médico(a)</option>
                    <option value="COORDENADOR">Coordenador(a)</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Setor Laboral (Histórico)</label>
                <input 
                    type="text"
                    name="sector"
                    defaultValue={nurseToEdit?.sector || ''}
                    placeholder="Ex: UTI, PEDIATRIA..."
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                />
            </div>
          </div>

          <div>
                <label className="block text-sm font-medium text-gray-700">Grupo da Escala (Localização)</label>
                <select 
                    name="sectionId" 
                    defaultValue={nurseToEdit?.section_id || defaultSectionId || ''}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                >
                    <option value="">Selecione o grupo...</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>{section.title}</option>
                    ))}
                </select>
            </div>

          <div>
             <label className="block text-sm font-medium text-gray-700">CPF</label>
             <input 
               type="text" 
               name="cpf" 
               defaultValue={nurseToEdit?.cpf}
               placeholder="Apenas números (opcional)"
               className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
             />
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700">Senha (Opcional - Padrão: 123456)</label>
             <input 
               type="password" 
               name="password" 
               disabled={useDefaultPassword}
               placeholder={useDefaultPassword ? "Usando senha padrão (123456)" : "******"}
               className={`mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black ${useDefaultPassword ? 'bg-gray-100' : 'bg-white'}`}
             />
             <div className="mt-2 flex items-center">
                <input
                  id="modalUseDefaultPassword"
                  name="useDefaultPassword"
                  type="checkbox"
                  value="on"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={useDefaultPassword}
                  onChange={(e) => setUseDefaultPassword(e.target.checked)}
                />
                <label htmlFor="modalUseDefaultPassword" className="ml-2 block text-sm text-gray-900">
                  Usar senha padrão (123456)
                </label>
              </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
