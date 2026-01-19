'use client'

import { useState } from 'react'
import { saveAbsenceSettings } from '@/app/actions'

const ROLES = [
  { id: 'ADMIN', label: 'Administrador' },
  { id: 'COORDENACAO_GERAL', label: 'Coordenação Geral' },
  { id: 'COORDENADOR', label: 'Coordenador' },
  { id: 'ENFERMEIRO', label: 'Enfermeiro' },
  { id: 'TECNICO', label: 'Técnico' }
]

type Props = {
  initialViewRoles: string[]
  initialEditRoles: string[]
  onClose: () => void
}

export default function AbsenceSettings({ initialViewRoles, initialEditRoles, onClose }: Props) {
  const [viewRoles, setViewRoles] = useState<string[]>(initialViewRoles)
  const [editRoles, setEditRoles] = useState<string[]>(initialEditRoles)
  const [saving, setSaving] = useState(false)

  const toggleRole = (role: string, type: 'view' | 'edit') => {
    if (type === 'view') {
      setViewRoles(prev => 
        prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
      )
    } else {
      setEditRoles(prev => 
        prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
      )
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await saveAbsenceSettings(viewRoles, editRoles)
      if (result.success) {
        alert('Configurações salvas com sucesso!')
        onClose()
      } else {
        alert(result.message || 'Erro ao salvar configurações.')
      }
    } catch (error) {
      alert('Erro inesperado ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Configurar Permissões - Faltas</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-2">Quem pode visualizar a caixa de Faltas?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map(role => (
                  <label key={`view-${role.id}`} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={viewRoles.includes(role.id)}
                      onChange={() => toggleRole(role.id, 'view')}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">{role.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-md font-semibold text-gray-700 mb-2">Quem pode registrar/editar Faltas?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map(role => (
                  <label key={`edit-${role.id}`} className="flex items-center space-x-2 p-2 border rounded hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={editRoles.includes(role.id)}
                      onChange={() => toggleRole(role.id, 'edit')}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-700">{role.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
              disabled={saving}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={saving}
            >
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
