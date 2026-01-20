'use client'

import { useState, useEffect } from 'react'
import { getSystemRoles, addSystemRole } from '@/app/actions'

export default function RoleManagement({ userRole }: { userRole: string }) {
  const [roles, setRoles] = useState<{ id: string, label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [newRoleLabel, setNewRoleLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    fetchRoles()
  }, [])

  const fetchRoles = async () => {
    try {
      const data = await getSystemRoles()
      setRoles(data)
    } catch (error) {
      console.error('Failed to fetch roles', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newRoleLabel.trim()) return

    const label = newRoleLabel.trim()
    // Generate ID: remove accents, uppercase, replace spaces with underscores
    const id = label
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '_')
      .replace(/_+/g, '_')

    if (roles.some(r => r.id === id)) {
      alert('Este cargo já existe!')
      return
    }

    setSaving(true)
    try {
      const res = await addSystemRole(id, label)
      if (res.success) {
        setNewRoleLabel('')
        setShowAddForm(false)
        fetchRoles()
      } else {
        alert(res.message)
      }
    } catch (error) {
      alert('Erro ao adicionar cargo.')
    } finally {
      setSaving(false)
    }
  }

  // Only Admin and General Coordination can manage roles
  const canEdit = userRole === 'ADMIN' || userRole === 'COORDENACAO_GERAL'

  if (loading) return <div className="p-4 text-center text-gray-500">Carregando cargos...</div>

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">Cargos do Sistema</h2>
        {canEdit && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-sm bg-blue-50 text-blue-600 px-3 py-1 rounded hover:bg-blue-100"
          >
            {showAddForm ? 'Cancelar' : '+ Adicionar Cargo'}
          </button>
        )}
      </div>

      {showAddForm && (
        <form onSubmit={handleAddRole} className="mb-6 p-4 bg-gray-50 rounded border border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nome do Novo Cargo
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newRoleLabel}
              onChange={(e) => setNewRoleLabel(e.target.value)}
              placeholder="Ex: Nutricionista"
              className="flex-1 border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
              disabled={saving}
            />
            <button
              type="submit"
              disabled={saving || !newRoleLabel.trim()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            O código interno será gerado automaticamente (ex: NUTRICIONISTA).
          </p>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {roles.map((role) => (
          <div key={role.id} className="flex items-center p-3 bg-gray-50 rounded border border-gray-100">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            <div>
              <p className="font-medium text-gray-800">{role.label}</p>
              {/* <p className="text-xs text-gray-400">{role.id}</p> */}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
