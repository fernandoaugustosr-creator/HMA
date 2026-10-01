'use client'

import { useState, useMemo } from 'react'
import { formatRole } from '@/lib/utils'
import { Search } from 'lucide-react'

interface NurseVinculoLight {
  id?: string | number
  tipo_vinculo?: string | null
  vinculo?: string | null
  data_admissao?: string | null
  data_baixa?: string | null
  active?: boolean
}

interface Nurse {
  id: string
  name: string
  name_star?: boolean
  coren: string
  role: string
  vinculo: string
  section_id?: string
  vinculos?: NurseVinculoLight[] | null
}

interface NurseSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (nurseId: string, vinculoId?: string | null, tipoVinculo?: string | null) => void
  nurses: Nurse[]
  isFetching?: boolean
  sectionTitle?: string
  existingNurseIds?: string[]
}

/* ========= HELPRES DE TIPO DE VINCULO LEGIVEIS ========= */
function _limpaTipoVinculo(s: any): string {
  if (!s) return ''
  return String(s)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '')
    .trim()
}

function tipoVinculoBadge(raw: any): { short: string; label: string; cls: string } {
  const t = _limpaTipoVinculo(raw)
  if (!t) return { short: 'OUT', label: 'Outro', cls: 'bg-gray-100 text-gray-700 border-gray-200' }

  if (t.includes('CONCURSO') || t.includes('CONCURSADO') || t.includes('ESTAVEL') || t === 'CON')
    return { short: 'CON', label: 'Concurso / Efetivo', cls: 'bg-blue-50 text-blue-700 border-blue-200' }

  if (t.includes('SELETIVO') || t.includes('PROCESSOSELETIVO') || t.includes('CELETISTA') || t === 'SEL')
    return { short: 'SEL', label: 'Processo Seletivo / Celetista', cls: 'bg-green-50 text-green-700 border-green-200' }

  if (t.includes('CONTRATADO') || t.includes('CONTRATO') || t.includes('CLT') || t === 'CT')
    return { short: 'CT', label: 'Contratado / CLT', cls: 'bg-purple-50 text-purple-700 border-purple-200' }

  if (t.includes('TERCEIRIZADO') || t.includes('TERCERIZADO') || t.includes('OUTSOURCE') || t === 'TER')
    return { short: 'TER', label: 'Terceirizado', cls: 'bg-orange-50 text-orange-700 border-orange-200' }

  if (t.includes('ESTAGIO') || t.includes('ESTAGIARIO') || t === 'EST')
    return { short: 'EST', label: 'Estágio', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' }

  if (t.includes('RESIDENCIA') || t.includes('RESIDENTE') || t === 'RES')
    return { short: 'RES', label: 'Residência', cls: 'bg-pink-50 text-pink-700 border-pink-200' }

  return { short: 'OUT', label: String(raw || 'Outro').slice(0, 20), cls: 'bg-gray-100 text-gray-700 border-gray-200' }
}

type FlatVinculoItem = {
  key: string
  nurseId: string
  vinculoId: string | null
  tipoVinculoRaw: string | null
  badge: { short: string; label: string; cls: string }
  nurse: Nurse
}

export default function NurseSelectionModal({ isOpen, onClose, onSelect, nurses, isFetching = false, sectionTitle, existingNurseIds = [] }: NurseSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  /* ==============================================================
     FLATTEN: 1 ENFERMEIRO COM N VINCULOS -> N LINHAS NA LISTA
     Ex: Rosa + vínculos [SELETIVO, CONCURSO] => 2 cards separados.
     Se não tiver array vinculos (dados antigos / coluna antiga vinculo string),
       cria 1 linha única usando a coluna antiga como fallback.
  ================================================================== */
  const flatVinculos = useMemo<FlatVinculoItem[]>(() => {
    const out: FlatVinculoItem[] = []
    const list = Array.isArray(nurses) ? nurses : []
    list.forEach(nurse => {
      if (existingNurseIds.includes(String(nurse.id))) return

      const temVinculos1N = nurse.vinculos && Array.isArray(nurse.vinculos) && nurse.vinculos.length > 0
      if (temVinculos1N) {
        nurse.vinculos!.forEach(v => {
          const rawTipo = (v.tipo_vinculo ?? v.vinculo ?? '') as string
          const badge = tipoVinculoBadge(rawTipo)
          const vinId = v.id ? String(v.id) : null
          out.push({
            key: `n${nurse.id}_v${vinId || badge.short}_${rawTipo}`,
            nurseId: String(nurse.id),
            vinculoId: vinId,
            tipoVinculoRaw: rawTipo || badge.label,
            badge,
            nurse,
          })
        })
      } else {
        // Fallback coluna antiga "vinculo" (string simples) -> 1 linha só
        const rawTipo = String(nurse.vinculo || '')
        const badge = tipoVinculoBadge(rawTipo)
        out.push({
          key: `n${nurse.id}_fallback_${badge.short}`,
          nurseId: String(nurse.id),
          vinculoId: null,
          tipoVinculoRaw: rawTipo || badge.label,
          badge,
          nurse,
        })
      }
    })

    return out.sort((a, b) => {
      const nomeCmp = a.nurse.name.localeCompare(b.nurse.name)
      if (nomeCmp !== 0) return nomeCmp
      return a.badge.short.localeCompare(b.badge.short)
    })
  }, [nurses, existingNurseIds])

  const filteredVinculos = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return flatVinculos
    return flatVinculos.filter(item => {
      const nomeOk = item.nurse.name.toLowerCase().includes(q)
      const corenOk = String(item.nurse.coren || '').toLowerCase().includes(q)
      const tipoOk = String(item.tipoVinculoRaw || '').toLowerCase().includes(q) ||
        String(item.badge.label || '').toLowerCase().includes(q) ||
        String(item.badge.short || '').toLowerCase().includes(q)
      return nomeOk || corenOk || tipoOk
    })
  }, [flatVinculos, searchTerm])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
          <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-gray-800">Adicionar ao bloco {sectionTitle}</h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {flatVinculos.length > 0
                  ? `${flatVinculos.length} vínculo(s) disponíveis — profissionais com 2+ vínculos aparecem em linhas separadas`
                  : 'Selecione um profissional e o vínculo correspondente'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>

          <div className="p-4 space-y-3 flex-1 overflow-hidden flex flex-col">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Buscar por nome, COREN ou tipo de vínculo (SELETIVO, CONCURSO, etc)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm bg-white text-black focus:ring-2 focus:ring-blue-500 outline-none"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto border rounded-md">
              {isFetching ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  <span className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full inline-block mr-2 mb-2"></span>
                  <p>Carregando todos os servidores...</p>
                </div>
              ) : filteredVinculos.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  <p>Nenhum profissional / vínculo encontrado.</p>
                  {searchTerm && <p className="text-xs mt-1">Tente outro termo de busca.</p>}
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {filteredVinculos.map(item => {
                    const { nurse, badge, tipoVinculoRaw, vinculoId, nurseId, key } = item
                    const tipoDisplay = String(tipoVinculoRaw || badge.label || '').toUpperCase()
                    return (
                      <li
                        key={key}
                        className="p-3 hover:bg-blue-50 flex justify-between items-start gap-2 transition-colors cursor-pointer"
                        onClick={() => onSelect(nurseId, vinculoId, tipoVinculoRaw)}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 text-sm flex items-center flex-wrap gap-1.5">
                            <span className="truncate">{nurse.name}</span>
                            {nurse.name_star && <span className="text-red-600 font-black shrink-0">*</span>}
                            <span
                              className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${badge.cls}`}
                              title={badge.label}
                            >
                              {badge.short}
                            </span>
                            <span className="shrink-0 text-xs font-normal text-gray-500">({badge.short})</span>
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 break-words">
                            {nurse.role ? `${formatRole(nurse.role)} • ` : ''}
                            COREN: {nurse.coren || '-'}
                            {tipoDisplay && ` • ${tipoDisplay}`}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1 rounded hover:bg-blue-100"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelect(nurseId, vinculoId, tipoVinculoRaw)
                          }}
                        >
                          Adicionar
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
