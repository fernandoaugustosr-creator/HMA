'use client'

import { useState, useEffect } from 'react'
import { createNurse, updateNurse } from '@/app/actions'

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
  const [cpf, setCpf] = useState(nurseToEdit?.cpf || '')
  const [showSqlModal, setShowSqlModal] = useState(false)

  useEffect(() => {
    if (nurseToEdit) {
        setPhone(nurseToEdit.phone || '')
        // Se o CPF for um valor temporário (gerado automaticamente), exibe como vazio na UI
        const currentCpf = nurseToEdit.cpf || ''
        setCpf(currentCpf.startsWith('TEMP-') ? '' : currentCpf)
    } else {
        setPhone('')
        setCpf('')
    }
  }, [nurseToEdit])

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
             result = await updateNurse(nurseToEdit.id, null, formData)
        } else {
             const firstBond = vinculos[0]
             const firstFd = getFormDataForBond(firstBond)
             result = await updateNurse(nurseToEdit.id, null, firstFd)

             if (result.success && vinculos.length > 1) {
                 for (let i = 1; i < vinculos.length; i++) {
                     const extraBond = vinculos[i]
                     const extraFd = getFormDataForBond(extraBond)
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
            // Se houver múltiplos vínculos, o primeiro cria o registro principal.
            // Os subsequentes apenas criam registros adicionais se não existirem.
            const firstBond = vinculos[0]
            const firstFd = getFormDataForBond(firstBond)
            result = await createNurse(null, firstFd)
            
            if (result.success && vinculos.length > 1) {
                for (let i = 1; i < vinculos.length; i++) {
                    const bond = vinculos[i]
                    const fd = getFormDataForBond(bond)
                    const res = await createNurse(null, fd)
                    if (!res.success && !res.message?.includes('Já existe')) {
                        result = res
                    }
                }
            }
        }
    }

    if (result.success) {
      onSuccess((result as any).rosterId)
      onClose()
    } else {
      setError(result.message || 'Erro ao salvar servidor')
      if (result.message?.includes('V15')) {
          setShowSqlModal(true)
      }
    }
    setLoading(false)
  }

  return (
    <>
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-5 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold mb-3 text-black border-b pb-2">
            {nurseToEdit ? 'Editar Profissional' : 'Adicionar Novo Profissional'}
        </h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-3 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700">Nome Completo</label>
            <input 
              type="text" 
              name="name" 
              defaultValue={nurseToEdit?.name}
              required 
              className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="block text-xs font-semibold text-gray-700">COREN</label>
                <input 
                  type="text" 
                  name="coren" 
                  defaultValue={nurseToEdit?.coren}
                  className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                />
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-700">CRM</label>
                <input 
                  type="text" 
                  name="crm" 
                  defaultValue={nurseToEdit?.crm}
                  placeholder="Apenas para Médicos"
                  className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="block text-xs font-semibold text-gray-700">Telefone</label>
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
            <div>
                <label className="block text-xs font-semibold text-gray-700">Vínculo</label>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-700">
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name="vinculo"
                      value="CONCURSO"
                      defaultChecked={nurseToEdit?.vinculo?.includes('CONCURSO')}
                      className="h-3.5 w-3.5"
                    />
                    <span>CONCURSO</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name="vinculo"
                      value="SELETIVO"
                      defaultChecked={nurseToEdit?.vinculo?.includes('SELETIVO')}
                      className="h-3.5 w-3.5"
                    />
                    <span>SELETIVO</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name="vinculo"
                      value="CESSÃO"
                      defaultChecked={nurseToEdit?.vinculo?.includes('CESSÃO')}
                      className="h-3.5 w-3.5"
                    />
                    <span>CESSÃO</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name="vinculo"
                      value="TERCEIRIZADO"
                      defaultChecked={nurseToEdit?.vinculo?.includes('TERCEIRIZADO') || nurseToEdit?.vinculo?.includes('TERCERIZADO')}
                      className="h-3.5 w-3.5"
                    />
                    <span>TERCEIRIZADO</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name="vinculo"
                      value="ESCALA DESCOBERTA"
                      defaultChecked={nurseToEdit?.vinculo?.includes('ESCALA DESCOBERTA')}
                      className="h-3.5 w-3.5"
                    />
                    <span>ESCALA DESCOBERTA</span>
                  </label>
                </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="block text-xs font-semibold text-gray-700">Cargo</label>
                <select 
                    name="role" 
                    defaultValue={nurseToEdit?.role || ''}
                    className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                >
                    <option value="">Campo Vazio</option>
                    <option value="ENFERMEIRO">Enfermeiro(a)</option>
                    <option value="TECNICO">Téc. de Enfermagem</option>
                    <option value="MEDICO">Médico(a)</option>
                    <option value="MOTORISTA">Motorista</option>
                    <option value="RECEPCAO">Recepção</option>
                    <option value="AGENTE_DE_PORTARIA">Agente de Portaria</option>
                    <option value="COORDENADOR">Coordenador(a)</option>
                    <option value="COORDENACAO_GERAL">Coordenação Geral</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-semibold text-gray-700">Setor Laboral (Histórico)</label>
                <input 
                    type="text"
                    name="sector"
                    defaultValue={nurseToEdit?.sector || ''}
                    placeholder="Ex: UTI, PEDIATRIA..."
                    className="mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 bg-white text-black text-sm"
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="block text-xs font-semibold text-gray-700">CPF</label>
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
            <div>
                <label className="block text-xs font-semibold text-gray-700">Senha (Padrão: 123456)</label>
                <input 
                  type="password" 
                  name="password" 
                  disabled={useDefaultPassword}
                  placeholder={useDefaultPassword ? "123456" : "******"}
                  autoComplete="new-password"
                  className={`mt-0.5 block w-full border border-gray-300 rounded-md shadow-sm p-1.5 text-sm text-black ${useDefaultPassword ? 'bg-gray-100' : 'bg-white'}`}
                />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
                <input
                  id="modalUseDefaultPassword"
                  name="useDefaultPassword"
                  type="checkbox"
                  value="on"
                  className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={useDefaultPassword}
                  onChange={(e) => setUseDefaultPassword(e.target.checked)}
                />
                <label htmlFor="modalUseDefaultPassword" className="ml-2 block text-xs text-gray-700">
                  Usar senha padrão
                </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t mt-4">
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
              className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700 disabled:opacity-50 font-bold"
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
