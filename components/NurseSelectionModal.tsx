'use client'

import { useState, useMemo } from 'react'
import { formatRole } from '@/lib/utils'
import { Search } from 'lucide-react'

interface Nurse {
  id: string
  name: string
  name_star?: boolean
  coren: string
  role: string
  vinculo: string
  section_id?: string
}

interface NurseSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (nurseId: string) => void
  nurses: Nurse[]
  isFetching?: boolean
  sectionTitle?: string
  existingNurseIds?: string[]
}

export default function NurseSelectionModal({ isOpen, onClose, onSelect, nurses, isFetching = false, sectionTitle, existingNurseIds = [] }: NurseSelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState('')

  const filteredNurses = useMemo(() => {
    return nurses
      .filter(n => n.name.toLowerCase().includes(searchTerm.toLowerCase()) || n.coren?.includes(searchTerm))
      .filter(n => !existingNurseIds.includes(n.id)) // Exclude nurses already in the list (if provided)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [nurses, searchTerm, existingNurseIds])

  if (!isOpen) return null

  return (
    <>
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                <h2 className="text-lg font-bold text-gray-800">Adicionar ao bloco {sectionTitle}</h2>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>
            
            <div className="p-4 space-y-4 flex-1 overflow-hidden flex flex-col">
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por nome ou COREN..." 
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
                    ) : filteredNurses.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            <p>Nenhum profissional encontrado.</p>
                            {searchTerm && <p className="text-xs mt-1">Tente outro termo de busca.</p>}
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {filteredNurses.map(nurse => {
                                const vinculo = (nurse.vinculo || '').toUpperCase().trim()
                                const isSeletivo = vinculo.includes('SELETIVO') || vinculo.includes('CELETISTA')
                                const isTerceirizado = vinculo.includes('TERCEIRIZADO') || vinculo.includes('TERCERIZADO')
                                return (
                                <li key={nurse.id} className="p-3 hover:bg-blue-50 flex justify-between items-center transition-colors cursor-pointer" onClick={() => onSelect(nurse.id)}>
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">
                                            {nurse.name}
                                            {nurse.name_star ? <span className="text-red-600 font-black ml-1">*</span> : null}
                                            {isSeletivo && <span className="text-xs font-normal text-gray-500 ml-1">(SEL)</span>}
                                            {isTerceirizado && <span className="text-xs font-normal text-gray-500 ml-1">(TER)</span>}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {nurse.role ? `${formatRole(nurse.role)} • ` : ''}COREN: {nurse.coren || '-'}
                                            {nurse.vinculo && ` • ${nurse.vinculo}`}
                                        </p>
                                    </div>
                                    <button 
                                        className="text-blue-600 hover:text-blue-800 text-sm font-medium px-2 py-1 rounded hover:bg-blue-100"
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
