'use client'

import { useState, useMemo, useEffect } from 'react'
import { deleteNurse, getNurseSectorHistory, getSystemRoles, findDuplicateNurses, mergeNurses } from '@/app/actions'
import NurseCreationModal from './NurseCreationModal'
import { formatRole } from '@/lib/utils'
import RoleManagerModal from './RoleManagerModal'
import { Pencil, Trash2, Plus, History, Merge, Users } from 'lucide-react'

const VINCULO_COLORS: Record<string, string> = {
  'CONCURSO': 'bg-blue-100 text-blue-800 border-blue-200',
  'SELETIVO': 'bg-green-100 text-green-800 border-green-200',
  'CONTRATADO': 'bg-purple-100 text-purple-800 border-purple-200',
  'CESSÃO': 'bg-orange-100 text-orange-800 border-orange-200',
  'CESSÃO CEDIDO': 'bg-orange-100 text-orange-800 border-orange-200',
  'TERCEIRIZADO': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'ESCALA DESCOBERTA': 'bg-pink-100 text-pink-800 border-pink-200',
  'ESTAGIO': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'ESTÁGIO': 'bg-cyan-100 text-cyan-800 border-cyan-200',
  'RESIDENTE': 'bg-indigo-100 text-indigo-800 border-indigo-200',
}

function formatDatePt(raw: any): string {
  if (!raw) return '-'
  if (String(raw) === 'SEM_DATA') return 'Baixado (sem data informada)'
  const s = String(raw).slice(0, 10)
  const [y, m, d] = s.split('-')
  if (y && m && d) return `${d}/${m}/${y}`
  return s
}

function VinculoBadges({ raw, vinculos }: { raw?: string; vinculos?: any[] }) {
  const { ativos, baixadosCount, baixadosSemDataCount } = useMemo(() => {
    type Item = { tipo: string; data_admissao: string; data_baixa: string }
    const list: Item[] = []
    if (Array.isArray(vinculos) && vinculos.length > 0) {
      for (const v of vinculos) {
        const tipo = String(v?.tipo_vinculo || '').trim().toUpperCase()
        if (!tipo) continue
        list.push({
          tipo,
          data_admissao: String(v?.data_admissao || '').slice(0, 10),
          data_baixa: String(v?.data_baixa || '').slice(0, 10),
        })
      }
    }
    if (list.length === 0 && raw) {
      const partes = String(raw)
        .split(/[;,\/\s]+/)
        .map(s => s.trim())
        .filter(s => s && s.toUpperCase() !== 'E' && s.toUpperCase() !== 'OU' && s.toUpperCase() !== 'E/OU')
      for (const p of partes) {
        list.push({ tipo: p.toUpperCase(), data_admissao: '', data_baixa: '' })
      }
    }
    const atv = list.filter(x => !x.data_baixa)
    const baiTodos = list.filter(x => !!x.data_baixa)
    const baiSemData = baiTodos.filter(x => x.data_baixa === 'SEM_DATA').length
    return { ativos: atv, baixadosCount: baiTodos.length, baixadosSemDataCount: baiSemData }
  }, [raw, vinculos])

  if (ativos.length === 0 && baixadosCount === 0) return null
  const tooltipBaixados = (() => {
    if (baixadosCount <= 0) return ''
    const comData = baixadosCount - baixadosSemDataCount
    const parts: string[] = [`${baixadosCount} vínculo(s) com baixa (inativos)`]
    if (baixadosSemDataCount > 0) parts.push(`${baixadosSemDataCount} sem data informada`)
    if (comData > 0) parts.push(`${comData} com data`)
    return parts.join(' — ')
  })()

  return (
    <div className="flex flex-wrap gap-1 mt-1 items-center">
      {ativos.map((v, i) => {
        const cls = VINCULO_COLORS[v.tipo] || 'bg-gray-100 text-gray-700 border-gray-200'
        const tooltipAdm = v.data_admissao ? `Admissão: ${formatDatePt(v.data_admissao)}` : ''
        return (
          <span
            key={i}
            title={tooltipAdm}
            className={`inline-flex text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${cls}`}
          >
            {v.tipo}
          </span>
        )
      })}
      {baixadosCount > 0 && (
        <span
          title={tooltipBaixados}
          className={[
            'inline-flex text-[9px] font-bold px-1.5 py-0.5 rounded border',
            baixadosSemDataCount > 0
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-slate-300 bg-slate-100 text-slate-500'
          ].join(' ')}
        >
          +{baixadosCount} baixado{baixadosCount !== 1 ? 's' : ''}
          {baixadosSemDataCount > 0 && <span className="ml-1 opacity-75">⚠{baixadosSemDataCount}</span>}
        </span>
      )}
    </div>
  )
}

const MONTH_NAMES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function SectorHistoryModal({
  open,
  onClose,
  history,
  currentSector,
  nurseName
}: {
  open: boolean
  onClose: () => void
  history: any[]
  currentSector: string
  nurseName: string
}) {
  if (!open) return null

  const groupedByYear: Record<number, any[]> = {}
  history.forEach((h) => {
    if (!groupedByYear[h.year]) groupedByYear[h.year] = []
    groupedByYear[h.year].push(h)
  })
  const sortedYears = Object.keys(groupedByYear)
    .map(Number)
    .sort((a, b) => b - a)

  const groupedByMonth = (items: any[]) => {
    const byMonth: Record<number, any[]> = {}
    items.forEach((h) => {
      if (!byMonth[h.month]) byMonth[h.month] = []
      byMonth[h.month].push(h)
    })
    return Object.keys(byMonth)
      .map(Number)
      .sort((a, b) => b - a)
      .map((m) => ({ month: m, sectors: byMonth[m] }))
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col border border-gray-100">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-gray-50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center">
              <History size={20} className="text-blue-600" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-base font-bold text-gray-800">
                Histórico de Escalas
              </h3>
              <p className="text-sm text-gray-500 font-medium truncate max-w-[20rem]">
                {nurseName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Setor atual:
            </span>
            <span className="text-sm font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
              {currentSector || 'Não definido'}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {history.length > 0 ? (
            <div className="space-y-5">
              {sortedYears.map((year) => (
                <div key={year} className="space-y-3">
                  <div className="flex items-center gap-2 sticky top-0 bg-white py-1 z-10">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs font-black text-gray-600 uppercase tracking-widest px-3 py-1 bg-gray-50 border border-gray-200 rounded-full">
                      {year}
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  {groupedByMonth(groupedByYear[year]).map(({ month, sectors }) => (
                    <div
                      key={`${year}-${month}`}
                      className="rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden"
                    >
                      <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                        <span className="text-sm font-bold text-blue-800">
                          {MONTH_NAMES[month]}
                        </span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                            <th className="px-4 py-2 text-left w-[30%]">Mês / Ano</th>
                            <th className="px-4 py-2 text-left">Setor de Atuação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {sectors.map((h: any, idx: number) => (
                            <tr key={idx}>
                              <td className="px-4 py-2.5 text-gray-500 font-medium whitespace-nowrap">
                                {MONTH_NAMES[h.month]} / {h.year}
                              </td>
                              <td className="px-4 py-2.5 text-gray-800 font-semibold">
                                {h.sector}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mb-3">
                <History size={28} className="text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-500">
                Sem histórico de escalas registrado
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Assim que as escalas forem lançadas, aparecerão aqui organizadas por mês.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end items-center gap-2 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 shadow-sm transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  )
}

function SectorHistoryCell({ nurseId, nurseName, currentSector }: { nurseId: string, nurseName: string, currentSector: string }) {
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [loading, setLoading] = useState(false)

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
    <>
      <div className="flex items-center justify-center gap-2">
        <span className="font-semibold text-blue-600">{currentSector || '-'}</span>
        <button
          onClick={fetchHistory}
          className="p-1.5 hover:bg-blue-50 rounded-full text-blue-400 hover:text-blue-600 transition-colors border border-transparent hover:border-blue-100"
          title="Ver histórico de escalas"
        >
          <History size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <SectorHistoryModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
        currentSector={currentSector}
        nurseName={nurseName}
      />
    </>
  )
}

export default function NurseList({ nurses, sections }: { nurses: any[], sections: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [nurseToEdit, setNurseToEdit] = useState<any | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [vinculoFilter, setVinculoFilter] = useState<string>('ALL')
  const [sectionFilter, setSectionFilter] = useState<string>('ALL')
  const [nameFilter, setNameFilter] = useState<string>('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [roles, setRoles] = useState<{ id: string, label: string }[]>([])
  const [showRoleManager, setShowRoleManager] = useState(false)
  const [isDuplicatesOpen, setIsDuplicatesOpen] = useState(false)
  const [duplicateData, setDuplicateData] = useState<any>(null)
  const [duplicateLoading, setDuplicateLoading] = useState(false)
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null)
  const [mergeSourceIds, setMergeSourceIds] = useState<string[]>([])
  const [mergeLoading, setMergeLoading] = useState(false)

  const loadDuplicates = async () => {
    setDuplicateLoading(true)
    setMergeTargetId(null)
    setMergeSourceIds([])
    try {
      const res = await findDuplicateNurses()
      if (res && res.success) setDuplicateData(res)
      else setDuplicateData({ totalGroups: 0, totalDuplicates: 0, groups: [] })
    } finally {
      setDuplicateLoading(false)
      setIsDuplicatesOpen(true)
    }
  }

  const toggleMergeSource = (id: string) => {
    if (id === mergeTargetId) return
    setMergeSourceIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const setAsTarget = (id: string) => {
    setMergeTargetId(id)
    setMergeSourceIds((prev) => prev.filter(x => x !== id))
  }

  const runMerge = async () => {
    if (!mergeTargetId || mergeSourceIds.length === 0) return
    if (!confirm(`Tem certeza que deseja UNIFICAR ${mergeSourceIds.length + 1} cadastro(s)?\n\nOs plantões e dados do(s) cadastro(s) selecionado(s) serão movidos para o cadastro principal, e os vínculos serão combinados.`)) return
    setMergeLoading(true)
    try {
      const res = await mergeNurses(mergeTargetId, mergeSourceIds)
      if (!res || !res.success) {
        alert(res?.message || 'Erro ao unificar')
        return
      }
      alert(res.message)
      setMergeTargetId(null)
      setMergeSourceIds([])
      await loadDuplicates()
    } finally {
      setMergeLoading(false)
    }
  }

  useEffect(() => {
    getSystemRoles()
      .then((data: any) => setRoles((data || []).sort((a: any, b: any) => String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR'))))
      .catch(() => setRoles([]))
  }, [])

  const sectionLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    sections.forEach(s => {
      lookup[s.id] = s.title
    })
    return lookup
  }, [sections])

  const roleLabelLookup = useMemo(() => {
    const lookup: Record<string, string> = {}
    roles.forEach((r) => {
      lookup[String(r.id)] = String(r.label)
    })
    return lookup
  }, [roles])

  const roleOptions = useMemo(() => {
    const ids = new Set<string>()
    roles.forEach(r => ids.add(String(r.id)))
    ;(nurses || []).forEach((n: any) => {
      const id = String(n.role || '').trim()
      if (!id) return
      ids.add(id)
    })

    const options = Array.from(ids).map((id) => ({
      id,
      label: roleLabelLookup[id] || formatRole(id) || id
    }))

    return options.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [roles, nurses, roleLabelLookup])

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
            : roleFilter === 'BLANK'
              ? !nurse.role || nurse.role.trim() === ''
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

  const birthdayPeople = useMemo(() => {
    const now = new Date()
    const month = now.getMonth() + 1
    const list = (nurses || [])
      .map((n: any) => {
        const raw = n.birth_date
        if (!raw) return null
        const parts = String(raw).split('-')
        if (parts.length < 3) return null
        const m = Number(parts[1])
        const day = Number(parts[2].slice(0, 2))
        if (Number.isNaN(m) || Number.isNaN(day)) return null
        if (m !== month) return null
        return {
          id: String(n.id),
          name: String(n.name || ''),
          day
        }
      })
      .filter(Boolean) as { id: string, name: string, day: number }[]

    return list.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name, 'pt-BR'))
  }, [nurses])

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
      <RoleManagerModal
        isOpen={showRoleManager}
        onClose={() => {
          setShowRoleManager(false)
          getSystemRoles()
            .then((data: any) => setRoles((data || []).sort((a: any, b: any) => String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR'))))
            .catch(() => setRoles([]))
        }}
      />
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Novo Cadastro</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={loadDuplicates}
                disabled={duplicateLoading}
                className="bg-amber-50 text-amber-800 px-4 py-2 rounded border border-amber-200 flex items-center gap-2 hover:bg-amber-100 disabled:opacity-50"
              >
                <Users size={18} />
                {duplicateLoading ? 'Verificando...' : 'Duplicatas'}
              </button>
              <button
                onClick={() => setShowRoleManager(true)}
                className="bg-white text-gray-700 px-4 py-2 rounded border border-gray-300 flex items-center gap-2 hover:bg-gray-50"
              >
                Cargos
              </button>
              <button 
                  onClick={handleCreate}
                  className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
              >
                  <Plus size={18} /> Adicionar
              </button>
            </div>
        </div>
      </div>

      {isDuplicatesOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[88vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10">
              <div className="flex flex-col">
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Merge className="text-amber-600" size={22} />
                  Cadastros Duplicados
                </h3>
                <div className="text-xs text-gray-500 mt-0.5 font-medium">
                  {duplicateData?.totalGroups > 0 ? (
                    <>Encontrados <span className="font-bold text-amber-700">{duplicateData.totalGroups}</span> grupos com <span className="font-bold text-amber-700">{duplicateData.totalDuplicates}</span> cadastros no total</>
                  ) : duplicateLoading ? 'Analisando cadastros...' : 'Nenhum duplicado encontrado!'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {mergeTargetId && mergeSourceIds.length > 0 && (
                  <button
                    onClick={runMerge}
                    disabled={mergeLoading}
                    className="bg-emerald-600 text-white px-4 py-2 rounded-md font-bold text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Merge size={16} />
                    {mergeLoading ? 'Unificando...' : `Unificar ${mergeSourceIds.length + 1} cadastros`}
                  </button>
                )}
                <button
                  onClick={() => setIsDuplicatesOpen(false)}
                  className="text-gray-500 hover:text-gray-800 bg-gray-100 hover:bg-gray-200 rounded-md px-3 py-2 text-sm font-medium"
                >
                  Fechar
                </button>
              </div>
            </div>

            {duplicateLoading ? (
              <div className="p-16 text-center text-gray-500 font-medium">
                <div className="animate-pulse text-sm">Verificando duplicatas por nome...</div>
              </div>
            ) : (duplicateData?.groups?.length || 0) === 0 ? (
              <div className="p-16 text-center">
                <div className="text-5xl mb-3">🎉</div>
                <div className="font-bold text-gray-700 text-lg mb-1">Nenhum cadastro duplicado encontrado</div>
                <div className="text-sm text-gray-500">Todos os nomes são únicos</div>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {duplicateData.groups.map((group: any, gi: number) => (
                  <div key={gi} className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                    <div className="bg-amber-100 px-4 py-2 border-b border-amber-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold">{group.count}</span>
                        <span className="font-bold text-gray-900 truncate">{group.name}</span>
                      </div>
                      <div className="text-[11px] text-amber-800 font-medium uppercase tracking-wide">
                        {group.count}x duplicado
                      </div>
                    </div>

                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.nurses.map((n: any) => {
                        const isTarget = mergeTargetId === n.id
                        const isSource = mergeSourceIds.includes(n.id)
                        return (
                          <label
                            key={n.id}
                            className={`border rounded-lg p-3 cursor-pointer transition-all ${
                              isTarget
                                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300'
                                : isSource
                                  ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200'
                                  : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                            onClick={(e) => {
                              const tg = (e.target as HTMLElement).tagName
                              if (tg === 'BUTTON' || tg === 'A') return
                            }}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <div>
                                  <input
                                    type="radio"
                                    name={`target-${gi}`}
                                    checked={isTarget}
                                    onChange={() => setAsTarget(n.id)}
                                    className="h-4 w-4 text-emerald-600"
                                  />
                                  <span className="text-[10px] font-bold uppercase text-emerald-700 ml-1">Principal</span>
                                </div>
                                <div className="ml-1">
                                  <input
                                    type="checkbox"
                                    checked={isSource}
                                    onChange={() => toggleMergeSource(n.id)}
                                    disabled={isTarget}
                                    className="h-4 w-4 text-blue-600 disabled:opacity-30"
                                  />
                                  <span className="text-[10px] font-bold uppercase text-blue-700 ml-1">Unir</span>
                                </div>
                              </div>
                              <div className="text-[9px] text-gray-400 font-mono">{String(n.id || '').slice(0, 8)}...</div>
                            </div>

                            <div className="space-y-1.5">
                              <div>
                                <div className="font-semibold text-gray-900 truncate">{n.displayName}</div>
                                <VinculoBadges raw={n.vinculo} vinculos={n.vinculos} />
                              </div>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] text-gray-600">
                                <div><span className="text-gray-400">Cargo:</span> {n.role || '-'}</div>
                                <div><span className="text-gray-400">CPF:</span> {n.cpf || '-'}</div>
                                <div><span className="text-gray-400">Tel:</span> {n.phone || '-'}</div>
                                <div><span className="text-gray-400">Nasc:</span> {formatDatePt(n.birth_date)}</div>
                                <div className="col-span-2 truncate"><span className="text-gray-400">Email:</span> {n.email || '-'}</div>
                                <div className="col-span-2 truncate"><span className="text-gray-400">Endereço:</span> {[n.address, n.house_number, n.city].filter(Boolean).join(', ') || '-'}</div>
                              </div>
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
                <div className="pt-2">
                  <p className="text-[11px] text-gray-500 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="font-bold text-gray-700">Como unificar:</span> marque em <span className="text-emerald-700 font-bold">1 cadastro como PRINCIPAL</span> (o que vai ficar no sistema) e marque <span className="text-blue-700 font-bold">UNIR</span> nos demais. Clique em "Unificar X cadastros". Os vínculos serão combinados (ex: CONCURSO / SELETIVO) e todos os plantões são movidos para o principal.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th style={{ width: '3%' }} className="w-[3%] px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  className="h-4 w-4"
                />
              </th>
              <th style={{ width: '22%' }} className="w-[22%] px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-top">
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
              <th style={{ width: '18%' }} className="w-[18%] px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Setor Laboral</th>
              <th style={{ width: '22%' }} className="w-[22%] px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider align-top">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <span>Cargo</span>
                    <button
                      type="button"
                      onClick={() => setShowRoleManager(true)}
                      className="normal-case text-[11px] font-bold text-indigo-600 hover:text-indigo-800 whitespace-nowrap"
                    >
                      Gerenciar
                    </button>
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as any)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-1 text-[11px] bg-white text-gray-700"
                  >
                    <option value="ALL">Todos</option>
                    <option value="BLANK">Vazio (Sem Cargo)</option>
                    {roleOptions.map((r) => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </th>
              <th style={{ width: '6%' }} className="w-[6%] px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredNurses.map((nurse: any) => (
              <tr key={nurse.id}>
                <td className="px-2 py-4 whitespace-nowrap text-sm text-gray-500 text-center align-middle">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(nurse.id)}
                    onChange={() => toggleSelect(nurse.id)}
                    className="h-4 w-4"
                  />
                </td>
                <td className="px-4 py-4 text-sm font-medium text-gray-900 align-middle">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate">{nurse.name}</div>
                      <div className="text-[10px] text-gray-500 font-semibold truncate">
                        {roleLabelLookup[String(nurse.role || '')] || formatRole(nurse.role) || 'Sem cargo'}
                      </div>
                      <VinculoBadges raw={nurse.vinculo} vinculos={nurse.vinculos} />
                    </div>
                    <button
                      onClick={() => handleDelete(nurse.id)}
                      disabled={loadingId === nurse.id}
                      title="Excluir este servidor"
                      className="text-red-600 hover:text-red-900 disabled:opacity-50 flex-shrink-0 mt-0.5"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-center align-middle">
                  <SectorHistoryCell nurseId={nurse.id} nurseName={nurse.name} currentSector={nurse.sector} />
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-600 text-center align-middle font-semibold">{roleLabelLookup[String(nurse.role || '')] || formatRole(nurse.role) || '-'}</td>
                <td className="px-3 py-4 whitespace-nowrap text-sm align-middle">
                  <div className="flex gap-1 justify-center">
                    <button 
                      onClick={() => handleEdit(nurse)}
                      className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 text-xs font-bold"
                    >
                      <Pencil size={15} /> Editar
                    </button>
                  </div>
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

      <div className="mt-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-700">Aniversariantes do mês</h2>
          <span className="text-xs text-gray-400 font-semibold">{birthdayPeople.length}</span>
        </div>
        {birthdayPeople.length === 0 ? (
          <div className="text-sm text-gray-400">Nenhum aniversariante cadastrado neste mês.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {birthdayPeople.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded border border-gray-100 bg-gray-50">
                <span className="font-bold text-indigo-700">{String(p.day).padStart(2, '0')}</span>
                <span className="text-sm text-gray-800 font-semibold truncate ml-3 flex-1">{String(p.name || '').split(' ').slice(0, 2).join(' ')}</span>
              </div>
            ))}
          </div>
        )}
        <div className="text-xs text-gray-400 mt-3">Exibe somente o dia do mês (sem o ano).</div>
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
