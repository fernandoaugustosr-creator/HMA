'use client'

import { useState, useMemo, useEffect } from 'react'
import { deleteNurse, getNurseSectorHistory } from '@/app/actions'
import NurseCreationModal from './NurseCreationModal'
import { formatRole } from '@/lib/utils'
import { Pencil, Trash2, Plus, History } from 'lucide-react'

function SectorHistoryCell({ nurseId, currentSector }: { nurseId: string, currentSector: string }) {
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(false)

  const MONTH_NAMES = [
    '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  const fetchHistory = async () => {
    if (showHistory) {
      setShowHistory(false)
      return
    }
    setLoading(true)
    const data = await getNurseSectorHistory(nurseId)
    setHistory(data)
    setShowHistory(true)
    setLoading(false)
  }

  return (
    <div className="relative group">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-blue-600">{currentSector || '-'}</span>
        <button 
          onClick={fetchHistory}
          className="p-1 hover:bg-blue-50 rounded-full text-blue-400 hover:text-blue-600 transition-colors"
          title="Ver histórico de setores"
        >
          <History size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {showHistory && (
        <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3">
          <div className="flex justify-between items-center mb-2 pb-1 border-b">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Histórico</span>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">&times;</button>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-2">
            {history.length > 0 ? history.map((h, i) => (
              <div key={i} className="text-xs flex flex-col border-l-2 border-blue-200 pl-2 py-0.5">
                <span className="text-gray-400 font-medium">{MONTH_NAMES[h.month]} / {h.year}</span>
                <span className="text-gray-700 font-bold">{h.sector}</span>
              </div>
            )) : (
              <div className="text-xs text-gray-400 italic py-2">Sem histórico registrado</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NurseList({ nurses, sections }: { nurses: any[], sections: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [nurseToEdit, setNurseToEdit] = useState<any | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ENFERMEIRO' | 'TECNICO' | 'MEDICO' | 'COORDENADOR'>('ALL')
  const [vinculoFilter, setVinculoFilter] = useState<string>('ALL')
  const [sectionFilter, setSectionFilter] = useState<string>('ALL')
  const [nameFilter, setNameFilter] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const sectionLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    sections.forEach(s => {
      lookup[s.id] = s.title
    })
    return lookup
  }, [sections])

  const handleEdit = (nurse: any) => {
    setNurseToEdit(nurse)
    setIsModalOpen(true)
  }

  const uniqueVinculos = useMemo(
    () =>
      Array.from(
        new Set(
          nurses
            .map((n: any) => (n.vinculo || '').trim())
            .filter((v: string) => v !== '')
        )
      ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [nurses]
  )

  const filteredNurses = useMemo(
    () =>
      nurses.filter((nurse: any) => {
        const roleOk =
          roleFilter === 'ALL'
            ? true
            : (nurse.role || '').toUpperCase() === roleFilter

        const vinculoOk =
          vinculoFilter === 'ALL'
            ? true
            : (nurse.vinculo || '').trim().toLowerCase() === vinculoFilter.toLowerCase()

        const sectionOk =
          sectionFilter === 'ALL'
            ? true
            : nurse.section_id === sectionFilter

        const nameOk = 
          !nameFilter 
            ? true 
            : (nurse.name || '').toLowerCase().includes(nameFilter.toLowerCase())

        return roleOk && vinculoOk && sectionOk && nameOk
      }),
    [nurses, roleFilter, vinculoFilter, sectionFilter, nameFilter]
  )

  const allVisibleSelected =
    filteredNurses.length > 0 &&
    filteredNurses.every((n: any) => selectedIds.includes(n.id))

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const toggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(filteredNurses.map((n: any) => n.id))
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)))
    } else {
      const visibleIds = filteredNurses.map((n: any) => n.id)
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])))
    }
  }

  const handleCreate = () => {
    setNurseToEdit(null)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este servidor? Esta ação não pode ser desfeita e removerá todos os plantões associados.')) return
    
    setLoadingId(id)
    const res = await deleteNurse(id)
    setLoadingId(null)
    
    if (!res.success) {
      alert(res.message)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (
      !confirm(
        `Tem certeza que deseja excluir ${selectedIds.length} servidor(es) de uma só vez? Esta ação não pode ser desfeita e removerá todos os plantões associados.`
      )
    )
      return

    setBulkDeleting(true)
    try {
      for (const id of selectedIds) {
        await deleteNurse(id)
      }
      setSelectedIds([])
    } finally {
      setBulkDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Novo Cadastro</h2>
            <button 
                onClick={handleCreate}
                className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
            >
                <Plus size={18} /> Adicionar
            </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {selectedIds.length > 0 && (
            <div className="px-6 py-2 bg-red-50 border-b border-red-100 flex items-center justify-between text-xs text-red-700">
              <span>{selectedIds.length} servidor(es) selecionado(s)</span>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {bulkDeleting ? 'Excluindo...' : 'Excluir selecionados'}
              </button>
            </div>
          )}
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  className="h-4 w-4"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex flex-col gap-1">
                  <span>Nome</span>
                  <input
                    type="text"
                    placeholder="Filtrar por nome..."
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-1 text-[11px] bg-white text-gray-700 font-normal normal-case"
                  />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Setor Laboral</th>
              <th className="px-6 py-1 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="flex flex-col gap-1">
                  <span>Cargo</span>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    className="mt-1 block border border-gray-300 rounded-md shadow-sm p-1 text-[11px] bg-white text-gray-700"
                  >
                    <option value="ALL">Todos</option>
                    <option value="ENFERMEIRO">Enfermeiro(a)</option>
                    <option value="TECNICO">Técnico</option>
                    <option value="MEDICO">Médico(a)</option>
                    <option value="COORDENADOR">Coordenador(a)</option>
                    <option value="COORDENACAO_GERAL">Coordenação Geral</option>
                  </select>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredNurses.map((nurse: any) => (
              <tr key={nurse.id}>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(nurse.id)}
                    onChange={() => toggleSelect(nurse.id)}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{nurse.name}</span>
                    <button
                      onClick={() => handleDelete(nurse.id)}
                      disabled={loadingId === nurse.id}
                      title="Excluir este servidor"
                      className="text-red-600 hover:text-red-900 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                  <SectorHistoryCell nurseId={nurse.id} currentSector={nurse.sector} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{formatRole(nurse.role)}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex gap-2 justify-center">
                  <button 
                    onClick={() => handleEdit(nurse)}
                    className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
                  >
                    <Pencil size={16} /> Editar
                  </button>
                </td>
              </tr>
            ))}
            {filteredNurses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">Nenhum servidor cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <NurseCreationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
             // Optional: trigger a refresh if needed, but revalidatePath in actions should handle it
        }}
        nurseToEdit={nurseToEdit}
        sections={sections}
      />
    </>
  )
}
