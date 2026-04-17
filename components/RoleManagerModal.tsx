'use client'

import { useEffect, useMemo, useState } from 'react'
import { addSystemRole, deleteSystemRole, getSystemRoles, updateSystemRole } from '@/app/actions'
import { Pencil, Trash2, X } from 'lucide-react'

export default function RoleManagerModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [roles, setRoles] = useState<{ id: string, label: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newRoleLabel, setNewRoleLabel] = useState('')
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null)
  const [editingRoleLabel, setEditingRoleLabel] = useState<string>('')

  const protectedRoleIds = useMemo(() => new Set(['ADMIN', 'COORDENACAO_GERAL', 'COORDENADOR', 'ENFERMEIRO', 'TECNICO']), [])

  const fetchRoles = async () => {
    setLoading(true)
    try {
      const data = await getSystemRoles()
      setRoles((data || []).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    fetchRoles()
  }, [isOpen])

  if (!isOpen) return null

  const generateRoleId = (label: string) => label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const label = newRoleLabel.trim()
    if (!label) return

    const id = generateRoleId(label)
    if (!id) return
    if (roles.some(r => r.id === id)) return

    setSaving(true)
    try {
      const res = await addSystemRole(id, label)
      if (!res.success) {
        alert(res.message)
        return
      }
      setNewRoleLabel('')
      await fetchRoles()
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (role: { id: string, label: string }) => {
    if (protectedRoleIds.has(role.id)) return
    setEditingRoleId(role.id)
    setEditingRoleLabel(role.label)
  }

  const cancelEdit = () => {
    setEditingRoleId(null)
    setEditingRoleLabel('')
  }

  const saveEdit = async () => {
    if (!editingRoleId) return
    const label = editingRoleLabel.trim()
    if (!label) return
    setSaving(true)
    try {
      const res = await updateSystemRole(editingRoleId, label)
      if (!res.success) {
        alert(res.message)
        return
      }
      cancelEdit()
      await fetchRoles()
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (roleId: string) => {
    if (protectedRoleIds.has(roleId)) return
    if (!confirm('Tem certeza que deseja remover este cargo?')) return
    setSaving(true)
    try {
      const res = await deleteSystemRole(roleId)
      if (!res.success) {
        alert(res.message)
        return
      }
      await fetchRoles()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white w-full max-w-2xl rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Gerenciar Cargos</h2>
          <button type="button" onClick={onClose} className="p-2 rounded hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <form onSubmit={onAdd} className="flex gap-2">
            <input
              value={newRoleLabel}
              onChange={(e) => setNewRoleLabel(e.target.value)}
              placeholder="Novo cargo (ex: Nutricionista)"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white text-gray-900"
              disabled={saving}
            />
            <button
              type="submit"
              disabled={saving || !newRoleLabel.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              Adicionar
            </button>
          </form>

          {loading ? (
            <div className="text-sm text-gray-500">Carregando cargos...</div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-[360px] overflow-y-auto">
                {roles.map((role) => {
                  const isProtected = protectedRoleIds.has(role.id)
                  const isEditing = editingRoleId === role.id
                  return (
                    <div key={role.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0">
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input
                            value={editingRoleLabel}
                            onChange={(e) => setEditingRoleLabel(e.target.value)}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm bg-white text-gray-900"
                            disabled={saving}
                          />
                        ) : (
                          <div className="font-semibold text-gray-900 truncate">{role.label}</div>
                        )}
                        <div className="text-xs text-gray-400">{role.id}</div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={saveEdit}
                              disabled={saving || !editingRoleLabel.trim()}
                              className="px-3 py-1 rounded bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50"
                            >
                              Salvar
                            </button>
                            <button
                              type="button"
                              onClick={cancelEdit}
                              disabled={saving}
                              className="px-3 py-1 rounded bg-gray-100 text-gray-700 text-xs font-bold hover:bg-gray-200 disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(role)}
                              disabled={saving || isProtected}
                              className="p-2 rounded hover:bg-gray-100 text-gray-600 disabled:opacity-40"
                              title={isProtected ? 'Cargo protegido' : 'Editar'}
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(role.id)}
                              disabled={saving || isProtected}
                              className="p-2 rounded hover:bg-gray-100 text-rose-600 disabled:opacity-40"
                              title={isProtected ? 'Cargo protegido' : 'Remover'}
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

