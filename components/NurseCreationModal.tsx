'use client'

import { useState, useEffect, useMemo } from 'react'
import { createNurse, getCouncilTypes, getSystemRoles, updateNurse, createNurseVinculo, updateNurseVinculo, deleteNurseVinculo, migrateNurseVinculosTable } from '@/app/actions'
import RoleManagerModal from './RoleManagerModal'
import CouncilTypeManagerModal from './CouncilTypeManagerModal'
import { formatRole } from '@/lib/utils'
import { Plus, Trash2, Ban, RotateCcw, Calendar as CalendarIcon } from 'lucide-react'

const NURSE_VINCULO_TYPES = [
  'CONCURSO',
  'CONTRATADO',
  'SELETIVO',
  'CESSÃO',
  'TERCEIRIZADO',
  'ESCALA DESCOBERTA',
  'ESTÁGIO',
  'OUTRO',
]

const maskPtDate = (raw: string): string => {
  const only = String(raw || '').replace(/\D+/g, '').slice(0, 8)
  const d = only.slice(0, 2)
  const m = only.slice(2, 4)
  const y = only.slice(4, 8)
  if (!d) return ''
  if (only.length <= 2) return d
  if (only.length <= 4) return `${d}/${m}`
  return `${d}/${m}/${y}`
}

const parsePtDateToIso = (raw: string): string => {
  const v = String(raw || '').trim()
  if (!v) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.slice(0, 10)
  const m = v.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (!m) return v.slice(0, 10)
  let dd = Number(m[1])
  let mm = Number(m[2])
  let yy = Number(m[3])
  if (yy < 100) yy = yy < 40 ? 2000 + yy : 1900 + yy
  if (!(mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yy >= 1900 && yy <= 2100)) return v.slice(0, 10)
  return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

const formatIsoToPtDate = (iso: string): string => {
  const v = String(iso || '').trim()
  if (!v) return ''
  if (v === 'SEM_DATA') return ''
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}$/.test(v)) return v
  return v
}

interface NurseCreationModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (rosterId?: string) => void
  defaultRole?: string
  defaultSectionId?: string
  defaultUnitId?: string
  selectedMonth?: number
  selectedYear?: number
  nurseToEdit?: any
  sections?: any[]
}

export default function NurseCreationModal({ isOpen, onClose, onSuccess, defaultRole = 'ENFERMEIRO', defaultSectionId, defaultUnitId, selectedMonth, selectedYear, nurseToEdit, sections = [] }: NurseCreationModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useDefaultPassword, setUseDefaultPassword] = useState(false)
  const [phone, setPhone] = useState(nurseToEdit?.phone || '')
  const [address, setAddress] = useState(nurseToEdit?.address || '')
  const [houseNumber, setHouseNumber] = useState(nurseToEdit?.house_number || '')
  const [city, setCity] = useState(nurseToEdit?.city || '')
  const [email, setEmail] = useState(nurseToEdit?.email || '')
  const [cpf, setCpf] = useState(nurseToEdit?.cpf || '')
  const [birthDate, setBirthDate] = useState(nurseToEdit?.birth_date || '')
  const [certidaoNegativaDate, setCertidaoNegativaDate] = useState(nurseToEdit?.certidao_negativa_date || '')
  const [corenExpiryDate, setCorenExpiryDate] = useState(nurseToEdit?.coren_expiry_date || '')
  const [showSqlModal, setShowSqlModal] = useState(false)
  const [roles, setRoles] = useState<{ id: string, label: string }[]>([])
  const [showRoleManager, setShowRoleManager] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [councilTypes, setCouncilTypes] = useState<string[]>(['COREN', 'CRM'])
  const [showCouncilManager, setShowCouncilManager] = useState(false)
  const [councilType, setCouncilType] = useState<string>('')
  const [councilNumber, setCouncilNumber] = useState<string>('')

  type NurseVinculoRow = {
    id: string
    nurse_id: string
    tipo_vinculo: string
    data_admissao: string
    data_baixa: string
    _isNew?: boolean
    _pendingDelete?: boolean
    _dirty?: boolean
  }

  const [nurseVinculos, setNurseVinculos] = useState<NurseVinculoRow[]>([])
  const [activeVinculoId, setActiveVinculoId] = useState<string>('')
  const [newTipoVinculo, setNewTipoVinculo] = useState<string>('')
  const [newDataAdmissao, setNewDataAdmissao] = useState<string>('')
  const [newDataBaixa, setNewDataBaixa] = useState<string>('')
  const [vinculoSaving, setVinculoSaving] = useState<boolean>(false)

  const activeVinculo = useMemo(
    () => nurseVinculos.find(v => v.id === activeVinculoId && !v._pendingDelete),
    [nurseVinculos, activeVinculoId]
  )

  const _today = () => new Date().toISOString().slice(0, 10)
  const SEM_DATA = 'SEM_DATA'
  const isVinculoBaixado = (v: NurseVinculoRow) => !!v?.data_baixa
  const isBaixaSemData = (v: NurseVinculoRow) => v?.data_baixa === SEM_DATA
  const formatPtDate = (s?: string) => {
    if (!s) return ''
    if (s === SEM_DATA) return 'Baixado (sem data informada)'
    const [y, m, d] = String(s).slice(0, 10).split('-')
    if (y && m && d) return `${d}/${m}/${y}`
    return s
  }

  const addNewVinculo = () => {
    const tipo = String(newTipoVinculo || '').trim().toUpperCase()
    if (!tipo) return
    const novo: NurseVinculoRow = {
      id: `NEW-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      nurse_id: nurseToEdit?.id || '',
      tipo_vinculo: tipo,
      data_admissao: parsePtDateToIso(newDataAdmissao),
      data_baixa: parsePtDateToIso(newDataBaixa),
      _isNew: true,
      _dirty: true,
    }
    const updated = [...nurseVinculos, novo]
    setNurseVinculos(updated)
    setActiveVinculoId(novo.id)
    setNewTipoVinculo('')
    setNewDataAdmissao('')
    setNewDataBaixa('')
  }

  const updateVinculoField = (id: string, field: keyof NurseVinculoRow, value: any) => {
    setNurseVinculos(prev => prev.map(v => {
      if (v.id !== id) return v
      if (field === 'data_admissao' || field === 'data_baixa') {
        if (String(value || '').trim().toUpperCase() === 'SEM_DATA') {
          return { ...v, data_baixa: 'SEM_DATA' as any, _dirty: true }
        }
        const iso = parsePtDateToIso(value)
        return { ...v, [field]: iso, _dirty: true }
      }
      return { ...v, [field]: value, _dirty: true }
    }))
  }

  const darBaixaHoje = (id: string) => {
    updateVinculoField(id, 'data_baixa', _today())
  }

  const darBaixaSemData = (id: string) => {
    updateVinculoField(id, 'data_baixa', SEM_DATA)
  }

  const reativarVinculo = (id: string) => {
    updateVinculoField(id, 'data_baixa', '')
  }

  const marcarExcluirVinculo = (id: string) => {
    setNurseVinculos(prev => prev.map(v => v.id === id ? { ...v, _pendingDelete: !v._pendingDelete, _dirty: true } : v))
    if (activeVinculoId === id) {
      const next = nurseVinculos.find(v => v.id !== id && !v._pendingDelete)
      setActiveVinculoId(next?.id || '')
    }
  }

  useEffect(() => {
    if (!isOpen) return
    // Garante que a tabela nurse_vinculos existe no Supabase / local db.json
    migrateNurseVinculosTable().catch(() => {})

    if (nurseToEdit) {
        setPhone(nurseToEdit.phone || '')
        setAddress(nurseToEdit.address || '')
        setHouseNumber(nurseToEdit.house_number || '')
        setCity(nurseToEdit.city || '')
        setEmail(nurseToEdit.email || '')
        const currentCpf = nurseToEdit.cpf || ''
        setCpf(currentCpf.startsWith('TEMP-') ? '' : currentCpf)
        setBirthDate(nurseToEdit.birth_date || '')
        setCertidaoNegativaDate(nurseToEdit.certidao_negativa_date || '')
        setCorenExpiryDate(nurseToEdit.coren_expiry_date || '')
        setSelectedRole(nurseToEdit.role || '')

        // Carrega vinculos: prioriza nurseToEdit.vinculos (tabela nova), senao split do campo legado vinculo
        let inicial: NurseVinculoRow[] = []
        if (Array.isArray(nurseToEdit.vinculos) && nurseToEdit.vinculos.length > 0) {
          inicial = (nurseToEdit.vinculos as any[]).map(v => ({
            id: String(v.id || ''),
            nurse_id: String(v.nurse_id || nurseToEdit.id || ''),
            tipo_vinculo: String(v.tipo_vinculo || '').trim().toUpperCase(),
            data_admissao: String(v.data_admissao || '').slice(0, 10),
            data_baixa: String(v.data_baixa || '').slice(0, 10),
          })).filter(v => v.tipo_vinculo)
        }
        if (inicial.length === 0 && nurseToEdit.vinculo) {
          const partes = String(nurseToEdit.vinculo)
            .split(/[\/,;]+|\s+E\s+|\s+OU\s+/gi)
            .map(s => s.trim().toUpperCase())
            .filter(Boolean)
          inicial = partes.map((tipo, idx) => ({
            id: `LEGADO-${nurseToEdit.id}-${idx}`,
            nurse_id: nurseToEdit.id || '',
            tipo_vinculo: tipo,
            data_admissao: '',
            data_baixa: '',
          }))
        }
        setNurseVinculos(inicial)
        setActiveVinculoId(inicial[0]?.id || '')
    } else {
        setPhone('')
        setAddress('')
        setHouseNumber('')
        setCity('')
        setEmail('')
        setCpf('')
        setBirthDate('')
        setCertidaoNegativaDate('')
        setCorenExpiryDate('')
        setSelectedRole('')
        setCouncilType('')
        setCouncilNumber('')
        setError(null)
        setNurseVinculos([])
        setActiveVinculoId('')
    }
    setNewTipoVinculo('')
    setNewDataAdmissao('')
    setNewDataBaixa('')
  }, [isOpen, nurseToEdit, defaultRole])

  useEffect(() => {
    if (!isOpen) return
    getSystemRoles()
      .then((data: any) => {
        setRoles((data || []).sort((a: any, b: any) => String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR')))
      })
      .catch(() => setRoles([]))
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    getCouncilTypes()
      .then((data: any) => {
        const list = (data || []).map((x: any) => String(x || '').trim().toUpperCase()).filter(Boolean)
        setCouncilTypes(list.length ? list.sort((a: string, b: string) => a.localeCompare(b, 'pt-BR')) : ['COREN', 'CRM'])
      })
      .catch(() => setCouncilTypes(['COREN', 'CRM']))
  }, [isOpen])

  useEffect(() => {
    if (!nurseToEdit) {
      return
    }

    const coren = String(nurseToEdit?.coren || '').trim()
    if (coren) {
      setCouncilType('COREN')
      setCouncilNumber(coren)
      return
    }

    const raw = String(nurseToEdit?.crm || '').trim()
    if (!raw) {
      setCouncilType('COREN')
      setCouncilNumber('')
      return
    }
    const first = raw.split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z0-9]/g, '') || ''
    const known = councilTypes.map(v => String(v || '').toUpperCase())
    if (first && known.includes(first)) {
      const rest = raw.slice(raw.toUpperCase().indexOf(first) + first.length).trim().replace(/^[-–—:]\s*/, '')
      setCouncilType(first)
      setCouncilNumber(rest)
      return
    }
    setCouncilType('COREN')
    setCouncilNumber(raw)
  }, [nurseToEdit, councilTypes])

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '')
    if (digits.length <= 2) return digits ? `(${digits}` : ''
    if (digits.length <= 6) return `(${digits.slice(0, 2)})${digits.slice(2)}`
    if (digits.length <= 10) return `(${digits.slice(0, 2)})${digits.slice(2, 6)}-${digits.slice(6)}`
    return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7, 11)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value)
    setPhone(formatted)
  }
  const roleOptions = useMemo(() => {
    const map = new Map<string, string>()
    roles.forEach((r) => map.set(String(r.id), String(r.label)))
    if (selectedRole && !map.has(String(selectedRole))) {
      map.set(String(selectedRole), formatRole(selectedRole) || String(selectedRole))
    }
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
  }, [roles, selectedRole])

  useEffect(() => {
    if (!isOpen || nurseToEdit) return
    if (councilType) return
    const roleUp = String(selectedRole || '').toUpperCase()
    if (roleUp.includes('MEDIC')) {
      setCouncilType('CRM')
    } else if (
      roleUp.includes('ENFERM') ||
      roleUp.includes('TECNIC') ||
      roleUp.includes('TÉCNIC') ||
      roleUp.includes('AUXILIAR') ||
      roleUp.includes('AUX.') ||
      roleUp === 'ENFERMEIRO' ||
      roleUp === 'TECNICO' ||
      roleUp === 'AUXILIAR' ||
      roleUp === 'HIGIENIZADOR'
    ) {
      setCouncilType('COREN')
    }
  }, [selectedRole, isOpen, nurseToEdit, councilType])

  const isCorenExpiryApplicable = useMemo(() => {
    if (!selectedRole) return false
    const id = String(selectedRole).toUpperCase().trim()
    if (id === 'ENFERMEIRO' || id === 'TECNICO') return true
    const label = roleOptions.find(r => r.id === selectedRole)?.label || ''
    const normalized = String(label).toUpperCase()
    return normalized.includes('ENFERMEIR') || normalized.includes('TÉC') || normalized.includes('TEC')
  }, [selectedRole, roleOptions])

  if (!isOpen) return null

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    
    if (defaultSectionId && !formData.get('sectionId')) {
        formData.set('sectionId', defaultSectionId)
    }
    if (defaultUnitId) {
        formData.set('unitId', defaultUnitId)
    }
    if (selectedMonth !== undefined) {
        formData.set('month', String(selectedMonth + 1))
    }
    if (selectedYear !== undefined) {
        formData.set('year', String(selectedYear))
    }

    const vinculosAtivos = nurseVinculos
      .filter(v => !v._pendingDelete && v.tipo_vinculo && !v.data_baixa)
      .map(v => v.tipo_vinculo)
      .filter(Boolean)
    if (vinculosAtivos.length > 0) {
      formData.set('vinculo', Array.from(new Set(vinculosAtivos)).join(' / '))
    } else {
      formData.delete('vinculo')
    }

    let result = { success: true, message: '' }
    let savedNurseId = nurseToEdit?.id || ''

    try {
      if (nurseToEdit) {
        result = await updateNurse(nurseToEdit.id, null, formData)
        savedNurseId = nurseToEdit.id
      } else {
        result = await createNurse(null, formData)
        savedNurseId = (result as any).id || (result as any).nurseId || ''
      }

      if (result.success && savedNurseId) {
        setVinculoSaving(true)
        let vinculoFailures = 0
        for (const v of nurseVinculos) {
          try {
            if (v._pendingDelete && v.id && !v.id.startsWith('LEGADO-') && !v.id.startsWith('NEW-')) {
              const r = await deleteNurseVinculo(v.id)
              if (!r.success) { console.error('[NurseCreationModal] delete falhou', r); vinculoFailures++ }
              continue
            }
            if (v._pendingDelete) continue
            if (v.id.startsWith('NEW-') || v.id.startsWith('LEGADO-') || !v.id) {
              const r = await createNurseVinculo(savedNurseId, {
                tipo_vinculo: v.tipo_vinculo,
                data_admissao: v.data_admissao,
                data_baixa: v.data_baixa,
              })
              if (!r.success) {
                console.error('[NurseCreationModal] create vinculo falhou', v, r)
                vinculoFailures++
              } else {
                console.log('[NurseCreationModal] create vinculo OK', r.id)
              }
              continue
            }
            if (v._dirty) {
              const r = await updateNurseVinculo(v.id, {
                tipo_vinculo: v.tipo_vinculo,
                data_admissao: v.data_admissao,
                data_baixa: v.data_baixa,
              })
              if (!r.success) {
                console.error('[NurseCreationModal] update vinculo falhou', v, r)
                vinculoFailures++
              } else {
                console.log('[NurseCreationModal] update vinculo OK')
              }
            }
          } catch (e) {
            console.error('[NurseCreationModal] exceção em vínculo:', v, e)
            vinculoFailures++
          }
        }
        if (vinculoFailures > 0) {
          result = { success: false, message: `Falhou ${vinculoFailures} vínculo(s) ao salvar. Ver console (F12). Abra SQL Editor e rode o HMA_FULL_SCHEMA_CREATE_FROM_SCRATCH.sql se tabela nurse_vinculos não existir.` }
        }
      }
    } catch (e: any) {
      console.error('[NurseCreationModal] handleSubmit exceção:', e)
      if (!result || !result.success) {
        // keep original result
      } else {
        result = { success: false, message: e?.message || 'Erro ao salvar vínculos.' }
      }
    } finally {
      setVinculoSaving(false)
    }

    if (result.success) {
      onSuccess((result as any).rosterId)
      onClose()
    } else {
      setError(result.message || 'Erro ao salvar servidor')
      if (result.message?.includes('V15')) {
          setShowSqlModal(true)
      }
      if (result.message?.includes('V18')) {
          setShowSqlModal(true)
      }
      if (result.message?.includes('V19')) {
          setShowSqlModal(true)
      }
      if (result.message?.includes('V21')) {
          setShowSqlModal(true)
      }
    }
    setLoading(false)
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
    <CouncilTypeManagerModal
      isOpen={showCouncilManager}
      onClose={() => {
        setShowCouncilManager(false)
        getCouncilTypes()
          .then((data: any) => {
            const list = (data || []).map((x: any) => String(x || '').trim().toUpperCase()).filter(Boolean)
            setCouncilTypes(list.length ? list.sort((a: string, b: string) => a.localeCompare(b, 'pt-BR')) : ['COREN', 'CRM'])
          })
          .catch(() => setCouncilTypes(['COREN', 'CRM']))
      }}
    />
    {showSqlModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-2xl">
                <h3 className="font-bold text-lg mb-4 text-red-600">Atenção: Atualização de Banco de Dados Necessária</h3>
                <p className="text-sm text-gray-700 mb-4">
                    Para permitir o cadastro de CRM e Telefone, é necessário adicionar novas colunas à tabela de profissionais no banco de dados.
                    Como esta é uma operação de segurança, você precisa rodar manualmente no Supabase.
                </p>
                
                <div className="bg-gray-100 p-4 rounded mb-4 overflow-auto max-h-60">
                    <pre className="text-xs text-black whitespace-pre-wrap font-mono">
{`-- Execute este código no SQL Editor do Supabase (V15):
-- Este script adiciona as colunas crm e phone na tabela nurses.

ALTER TABLE nurses 
ADD COLUMN IF NOT EXISTS crm TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

-- V18 (Data de Nascimento)
ALTER TABLE nurses
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- V19 (Certidão Negativa / Vencimento COREN)
ALTER TABLE nurses
ADD COLUMN IF NOT EXISTS certidao_negativa_date DATE,
ADD COLUMN IF NOT EXISTS coren_expiry_date DATE;

-- V21 (Marcar nome com *)
ALTER TABLE nurses
ADD COLUMN IF NOT EXISTS name_star BOOLEAN DEFAULT FALSE;

-- V22 (Endereço e Número da Casa)
ALTER TABLE nurses
ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS house_number TEXT DEFAULT '';

-- V23 (E-mail)
ALTER TABLE nurses
ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '';

-- V24 (Cidade)
ALTER TABLE nurses
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '';

-- V25 (Tabela de Vínculos 1:N)
CREATE TABLE IF NOT EXISTS nurse_vinculos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nurse_id UUID NOT NULL REFERENCES nurses(id) ON DELETE CASCADE,
    tipo_vinculo TEXT NOT NULL DEFAULT 'OUTRO',
    data_admissao TEXT DEFAULT '',
    data_baixa TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nurse_vinculos_nurse_id ON nurse_vinculos(nurse_id);

-- V26 (Snapshot Histórico nas Escalas)
ALTER TABLE monthly_rosters
ADD COLUMN IF NOT EXISTS snapshot_name TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS snapshot_role TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS snapshot_vinculo TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS snapshot_vinculos_json TEXT DEFAULT '';

ALTER TABLE shifts
ADD COLUMN IF NOT EXISTS snapshot_name TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS snapshot_role TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS snapshot_vinculo TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS snapshot_vinculos_json TEXT DEFAULT '';
`}
                    </pre>
                </div>

                <div className="flex justify-end gap-2">
                    <a 
                        href="https://supabase.com/dashboard/project/umvjzgurzkldqyxzkkaq/sql/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold flex items-center"
                    >
                        1. Abrir Supabase SQL
                    </a>
                    <button 
                        onClick={() => setShowSqlModal(false)}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                        2. Já executei, fechar
                    </button>
                </div>
            </div>
        </div>
    )}
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
      <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <h2 className="text-base font-bold mb-2 text-black border-b pb-1.5">
            {nurseToEdit ? 'Editar Profissional' : 'Adicionar Novo Profissional'}
        </h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-1.5 rounded mb-2 text-[11px]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="block text-[11px] font-semibold text-gray-700">Nome Completo</label>
            <input 
              type="text" 
              name="name" 
              defaultValue={nurseToEdit?.name}
              required 
              className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
            />
          </div>

          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-5">
                <label className="block text-[11px] font-semibold text-gray-700">Conselho</label>
                <div className="mt-0.5 flex gap-1.5">
                  <select
                    name="council_type"
                    value={councilType}
                    onChange={(e) => setCouncilType(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                  >
                    <option value="">Selecione...</option>
                    {Array.from(new Set([councilType, ...councilTypes])).filter(Boolean).map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCouncilManager(true)}
                    className="px-2 py-1 text-[10px] border rounded text-black border-gray-300 hover:bg-gray-50 whitespace-nowrap"
                  >
                    +
                  </button>
                </div>
            </div>
            <div className="col-span-7">
                <label className="block text-[11px] font-semibold text-gray-700">Nº Inscrição</label>
                <input
                  type="text"
                  name="council_number"
                  value={councilNumber}
                  onChange={(e) => setCouncilNumber(e.target.value)}
                  placeholder="Número do conselho"
                  className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-3">
                <label className="block text-[11px] font-semibold text-gray-700">Telefone</label>
                <input 
                  type="text" 
                  name="phone" 
                  value={phone}
                  onChange={handlePhoneChange}
                  placeholder="(00)00000-0000"
                  maxLength={14}
                  className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                />
            </div>
            <div className="col-span-9">
                <label className="block text-[11px] font-semibold text-gray-700">E-mail</label>
                <input 
                  type="email" 
                  name="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@empresa.com"
                  className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                />
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-6">
                <label className="block text-[11px] font-semibold text-gray-700">Endereço (Rua / Av. / Trav.)</label>
                <input 
                  type="text" 
                  name="address" 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Rua das Flores, Centro"
                  className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                />
            </div>
            <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-gray-700">Número</label>
                <input 
                  type="text" 
                  name="house_number" 
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  placeholder="123"
                  className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                />
            </div>
            <div className="col-span-4">
                <label className="block text-[11px] font-semibold text-gray-700">Cidade</label>
                <input 
                  type="text" 
                  name="city" 
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Ex: Açailândia"
                  className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-gray-700 mb-1">Vínculos (cada vínculo com sua data de admissão e baixa)</label>
            <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
              {nurseVinculos.filter(v => !v._pendingDelete).length > 0 && (
                <>
                  <div className="flex flex-wrap gap-1 p-2 bg-gray-50/60 border-b border-gray-200">
                    {nurseVinculos.filter(v => !v._pendingDelete).map((v) => {
                      const isActive = !v.data_baixa
                      const isSelected = activeVinculoId === v.id
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setActiveVinculoId(v.id)}
                          className={[
                            'px-3 py-1.5 rounded-lg text-[11px] font-black transition-colors border',
                            isSelected
                              ? isActive
                                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                                : 'bg-slate-500 text-white border-slate-600 shadow-sm'
                              : isActive
                                ? 'bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 line-through decoration-slate-400/70'
                          ].join(' ')}
                        >
                          {v.tipo_vinculo}
                          {!isActive && <span className="ml-1.5 opacity-80">●</span>}
                        </button>
                      )
                    })}
                  </div>

                  {activeVinculo && (
                    <div className="p-3 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={[
                          'px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider',
                          activeVinculo.data_baixa
                            ? 'bg-slate-100 text-slate-600 border border-slate-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        ].join(' ')}>
                          {!activeVinculo.data_baixa ? 'Ativo' : isBaixaSemData(activeVinculo) ? 'Inativo (baixa sem data)' : 'Inativo (com baixa)'}
                        </span>
                        {isBaixaSemData(activeVinculo) && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-wider">
                            ⚠ Data ainda não informada
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-4">
                          <label className="block text-[10px] font-bold text-gray-600 mb-0.5 uppercase tracking-wide">Tipo</label>
                          <select
                            value={activeVinculo.tipo_vinculo}
                            onChange={(e) => updateVinculoField(activeVinculo.id, 'tipo_vinculo', e.target.value.toUpperCase())}
                            className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-xs font-bold"
                          >
                            {NURSE_VINCULO_TYPES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-4">
                          <label className="block text-[10px] font-bold text-gray-600 mb-0.5 uppercase tracking-wide">
                            Data Admissão
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="dd/mm/aaaa"
                            maxLength={10}
                            value={formatIsoToPtDate(activeVinculo.data_admissao)}
                            onInput={(e: any) => {
                              const target = e.target
                              const pos = target.selectionStart
                              const masked = maskPtDate(target.value)
                              target.value = masked
                              updateVinculoField(activeVinculo.id, 'data_admissao', masked)
                              requestAnimationFrame(() => {
                                try { target.setSelectionRange(pos, pos) } catch {}
                              })
                            }}
                            onChange={(e) => updateVinculoField(activeVinculo.id, 'data_admissao', e.target.value)}
                            className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-xs font-semibold placeholder:text-gray-400"
                          />
                        </div>
                        <div className="col-span-4">
                          <label className="block text-[10px] font-bold text-gray-600 mb-0.5 uppercase tracking-wide">
                            Data Baixa
                          </label>
                          {isBaixaSemData(activeVinculo) ? (
                            <div className="mt-0.5 flex gap-1.5 items-center">
                              <span className="flex-1 inline-flex items-center gap-1 px-2 py-1.5 border-2 border-dashed border-amber-300 bg-amber-50/60 text-amber-800 text-[10px] font-black rounded-md shadow-sm">
                                Sem data informada
                              </span>
                              <button
                                type="button"
                                onClick={() => darBaixaHoje(activeVinculo.id)}
                                title="Preencher com data de hoje"
                                className="inline-flex items-center gap-1 px-2 py-1.5 text-[10px] font-black bg-red-50 text-red-700 rounded-md border border-red-200 hover:bg-red-100 whitespace-nowrap"
                              >
                                <Ban size={12} /> Hoje
                              </button>
                            </div>
                          ) : (
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="dd/mm/aaaa"
                              maxLength={10}
                              value={formatIsoToPtDate(activeVinculo.data_baixa)}
                              onInput={(e: any) => {
                                const target = e.target
                                const pos = target.selectionStart
                                const masked = maskPtDate(target.value)
                                target.value = masked
                                updateVinculoField(activeVinculo.id, 'data_baixa', masked)
                                requestAnimationFrame(() => {
                                  try { target.setSelectionRange(pos, pos) } catch {}
                                })
                              }}
                              onChange={(e) => updateVinculoField(activeVinculo.id, 'data_baixa', e.target.value)}
                              className={[
                                'mt-0.5 block w-full border rounded-md shadow-sm p-1.5 bg-white text-black text-xs font-semibold placeholder:text-gray-400',
                                activeVinculo.data_baixa ? 'border-red-300 bg-red-50/50' : 'border-gray-300'
                              ].join(' ')}
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
                        {!activeVinculo.data_baixa ? (
                          <>
                            <button
                              type="button"
                              onClick={() => darBaixaHoje(activeVinculo.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black bg-red-50 text-red-700 rounded-lg border border-red-200 hover:bg-red-100"
                            >
                              <Ban size={13} /> Dar baixa hoje
                            </button>
                            <button
                              type="button"
                              onClick={() => darBaixaSemData(activeVinculo.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black bg-amber-50 text-amber-700 rounded-lg border border-amber-200 hover:bg-amber-100"
                              title="Marcar como baixado sem preencher data (você pode informar depois)"
                            >
                              <Ban size={13} /> Dar baixa (sem data)
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => reativarVinculo(activeVinculo.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200 hover:bg-emerald-100"
                          >
                            <RotateCcw size={13} /> Reativar (remover baixa)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => marcarExcluirVinculo(activeVinculo.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black bg-slate-50 text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-100"
                        >
                          <Trash2 size={13} /> Excluir este vínculo
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div className={[
                'p-3 bg-gray-50/40 border-t border-dashed',
                nurseVinculos.filter(v => !v._pendingDelete).length > 0 ? 'border-gray-200' : 'border-transparent'
              ].join(' ')}>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-wider mb-1.5">+ Adicionar novo vínculo</p>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-4">
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5 uppercase tracking-wide">Tipo</label>
                    <select
                      value={newTipoVinculo}
                      onChange={(e) => setNewTipoVinculo(e.target.value)}
                      className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-xs font-bold"
                    >
                      <option value="">Selecione...</option>
                      {NURSE_VINCULO_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <label className="block text-[10px] font-bold text-gray-600 mb-0.5 uppercase tracking-wide">
                      Data Admissão
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="dd/mm/aaaa"
                      maxLength={10}
                      value={maskPtDate(newDataAdmissao)}
                      onInput={(e: any) => {
                        const target = e.target
                        const pos = target.selectionStart
                        const masked = maskPtDate(target.value)
                        setNewDataAdmissao(masked)
                        requestAnimationFrame(() => {
                          try { target.setSelectionRange(pos, pos) } catch {}
                        })
                      }}
                      onChange={(e) => setNewDataAdmissao(e.target.value)}
                      className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-xs font-semibold placeholder:text-gray-400"
                    />
                  </div>
                  <div className="col-span-4 flex items-end gap-1.5">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-bold text-gray-600 mb-0.5 uppercase tracking-wide">
                        Data Baixa (opcional)
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="dd/mm/aaaa"
                        maxLength={10}
                        value={maskPtDate(newDataBaixa)}
                        onInput={(e: any) => {
                          const target = e.target
                          const pos = target.selectionStart
                          const masked = maskPtDate(target.value)
                          setNewDataBaixa(masked)
                          requestAnimationFrame(() => {
                            try { target.setSelectionRange(pos, pos) } catch {}
                          })
                        }}
                        onChange={(e) => setNewDataBaixa(e.target.value)}
                        className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-xs font-semibold placeholder:text-gray-400"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addNewVinculo}
                      disabled={!newTipoVinculo}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-black bg-indigo-600 text-white rounded-lg border border-indigo-700 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm whitespace-nowrap mb-0.5"
                    >
                      <Plus size={14} /> Adicionar
                    </button>
                  </div>
                </div>
              </div>

              {nurseVinculos.filter(v => v._pendingDelete).length > 0 && (
                <div className="px-3 py-2 bg-red-50/60 border-t border-red-100">
                  <p className="text-[10px] font-black text-red-700 uppercase tracking-wide mb-1">
                    ⚠️ Vínculos marcados para excluir ao salvar:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {nurseVinculos.filter(v => v._pendingDelete).map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => marcarExcluirVinculo(v.id)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-white text-red-600 rounded-md border border-red-200 line-through hover:bg-red-50"
                      >
                        <Trash2 size={11} /> {v.tipo_vinculo} — cancelar exclusão
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12">
                <label className="block text-[11px] font-semibold text-gray-700">Cargo</label>
                <div className="flex gap-1.5">
                  <select 
                      name="role" 
                      value={selectedRole}
                      onChange={(e) => setSelectedRole(e.target.value)}
                      className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                  >
                      <option value="">Selecione o cargo...</option>
                      {roleOptions.map((r) => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowRoleManager(true)}
                    className="mt-0.5 px-2 py-1 text-[10px] border rounded text-black border-gray-300 hover:bg-gray-50 whitespace-nowrap"
                  >
                    +
                  </button>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700">Data Nasc.</label>
              <input
                type="date"
                name="birth_date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-700">Certidão Neg.</label>
              <input
                type="date"
                name="certidao_negativa_date"
                value={certidaoNegativaDate}
                onChange={(e) => setCertidaoNegativaDate(e.target.value)}
                className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
              />
            </div>
            <div>
              {isCorenExpiryApplicable ? (
                <>
                  <label className="block text-[11px] font-semibold text-gray-700">Venc. Carteira</label>
                  <input
                    type="date"
                    name="coren_expiry_date"
                    value={corenExpiryDate}
                    onChange={(e) => setCorenExpiryDate(e.target.value)}
                    className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                  />
                </>
              ) : (
                <div className="block text-[11px] font-semibold text-gray-700">
                  <label className="block text-[11px] font-semibold text-gray-400">Venc. Carteira</label>
                  <div className="mt-0.5 block w-full border border-dashed border-gray-200 rounded-md p-1.5 bg-gray-50 text-gray-400 text-xs text-center flex items-center justify-center" style={{ minHeight: '34px' }}>
                    Selecione cargo de enfermagem
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-2 items-center pt-0.5">
            <div className="col-span-4">
                <label className="block text-[11px] font-semibold text-gray-700">CPF</label>
                <input 
                  type="text" 
                  name="cpf" 
                  value={cpf}
                  onChange={(e) => setCpf(e.target.value)}
                  placeholder="Apenas números"
                  autoComplete="none"
                  className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                />
            </div>
            <div className="col-span-5">
                <label className="block text-[11px] font-semibold text-gray-700">Senha (Padrão: 123456)</label>
                <input 
                  type="password" 
                  name="password" 
                  disabled={useDefaultPassword}
                  placeholder={useDefaultPassword ? "123456" : "******"}
                  autoComplete="new-password"
                  className={`mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 text-sm text-black ${useDefaultPassword ? 'bg-gray-100' : 'bg-white'}`}
                />
            </div>
            <div className="col-span-3 flex items-center h-full pt-4">
                <input
                  id="modalUseDefaultPassword"
                  name="useDefaultPassword"
                  type="checkbox"
                  value="on"
                  className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={useDefaultPassword}
                  onChange={(e) => setUseDefaultPassword(e.target.checked)}
                />
                <label htmlFor="modalUseDefaultPassword" className="ml-2 block text-[11px] text-gray-700 font-semibold whitespace-nowrap">
                  Usar senha padrão
                </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t mt-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-100 text-gray-700 px-4 py-1.5 rounded text-sm hover:bg-gray-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white px-5 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50 font-bold"
            >
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  )
}
