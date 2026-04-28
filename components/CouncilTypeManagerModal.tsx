'use client'

import { useEffect, useMemo, useState } from 'react'
import { addCouncilType, deleteCouncilType, getCouncilTypes } from '@/app/actions'
import { Trash2, X } from 'lucide-react'

export default function CouncilTypeManagerModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [types, setTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newType, setNewType] = useState('')

  const protectedTypes = useMemo(() => new Set(['COREN', 'CRM']), [])

  const normalize = (v: string) => v
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .trim()

  const fetchTypes = async () => {
    setLoading(true)
    try {
      const data = await getCouncilTypes()
      const list = (data || []).map((x: any) => String(x || '')).filter(Boolean)
      setTypes(list.sort((a, b) => a.localeCompare(b, 'pt-BR')))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    fetchTypes()
  }, [isOpen])

  if (!isOpen) return null

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = normalize(newType)
    if (!value) return
    if (types.includes(value)) return
    setSaving(true)
    try {
      const res = await addCouncilType(value)
      if (!res.success) {
        alert(res.message)
        return
      }
      setNewType('')
      await fetchTypes()
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (value: string) => {
    if (protectedTypes.has(value)) return
    if (!confirm('Tem certeza que deseja remover este conselho?')) return
    setSaving(true)
    try {
      const res = await deleteCouncilType(value)
      if (!res.success) {
        alert(res.message)
        return
      }
      await fetchTypes()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70] p-4">
      <div className="bg-white w-full max-w-xl rounded-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">Gerenciar Conselhos</h2>
          <button type="button" onClick={onClose} className="p-2 rounded hover:bg-gray-100 text-gray-500">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <form onSubmit={onAdd} className="flex gap-2">
            <input
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              placeholder="Novo conselho (ex: CRO)"
              className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm bg-white text-gray-900"
              disabled={saving}
            />
            <button
              type="submit"
              disabled={saving || !newType.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded text-sm font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              Adicionar
            </button>
          </form>

          {loading ? (
            <div className="text-sm text-gray-500">Carregando conselhos...</div>
          ) : (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="max-h-[360px] overflow-y-auto">
                {types.map((value) => {
                  const isProtected = protectedTypes.has(value)
                  return (
                    <div key={value} className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-b-0">
                      <div className="font-semibold text-gray-900">{value}</div>
                      <button
                        type="button"
                        onClick={() => onDelete(value)}
                        disabled={saving || isProtected}
                        className="p-2 rounded hover:bg-gray-100 text-rose-600 disabled:opacity-40"
                        title={isProtected ? 'Conselho protegido' : 'Remover'}
                      >
                        <Trash2 size={16} />
                      </button>
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
