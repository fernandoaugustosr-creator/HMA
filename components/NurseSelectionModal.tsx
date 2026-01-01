'use client'

import { useState, useMemo } from 'react'
import { assignNurseToSection } from '@/app/actions'
import { Search, UserPlus, Plus } from 'lucide-react'
import NurseCreationModal from './NurseCreationModal'

interface Nurse {
  id: string
  name: string
  coren: string
  role: string
  section_id?: string
}

interface NurseSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  nurses: Nurse[]
  sectionId: string
  sectionTitle?: string
}

export default function NurseSelectionModal({ isOpen, onClose, onSuccess, nurses, sectionId, sectionTitle }: NurseSelectionModalProps) {
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false)

  const filteredNurses = useMemo(() => {
    return nurses
      .filter(n => n.name.toLowerCase().includes(searchTerm.toLowerCase()) || n.coren?.includes(searchTerm))
      .filter(n => n.section_id !== sectionId) // Exclude nurses already in this section
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [nurses, searchTerm, sectionId])

  if (!isOpen) return null

  async function handleAssign(nurseId: string) {
    setLoading(true)
    try {
        const res = await assignNurseToSection(nurseId, sectionId)
        if (res.success) {
            onSuccess()
            onClose()
        } else {
            alert('Erro ao adicionar: ' + res.message)
        }
    } catch (error) {
        console.error(error)
        alert('Erro ao adicionar')
    } finally {
        setLoading(false)
    }
  }

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
                    />
                </div>

                <div className="flex-1 overflow-y-auto border rounded-md">
                    {filteredNurses.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">
                            <p>Nenhum profissional encontrado.</p>
                            {searchTerm && <p className="text-xs mt-1">Tente outro termo de busca.</p>}
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {filteredNurses.map(nurse => (
                                <li key={nurse.id} className="p-3 hover:bg-blue-50 flex justify-between items-center transition-colors">
                                    <div>
                                        <p className="font-medium text-gray-800 text-sm">{nurse.name}</p>
                                        <p className="text-xs text-gray-500">
                                            {nurse.role} • COREN: {nurse.coren || '-'}
                                        </p>
                                        {nurse.section_id && (
                                            <p className="text-[10px] text-orange-600 bg-orange-50 inline-block px-1 rounded mt-0.5 border border-orange-100">
                                                Já em outro bloco
                                            </p>
                                        )}
                                    </div>
                                    <button 
                                        onClick={() => handleAssign(nurse.id)}
                                        disabled={loading}
                                        className="text-blue-600 hover:bg-blue-100 p-2 rounded-full transition-colors"
                                        title="Adicionar a este bloco"
                                    >
                                        <Plus size={20} />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="pt-2 border-t">
                    <button 
                        onClick={() => setIsCreationModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 text-sm text-gray-600 hover:text-blue-600 py-2 hover:bg-gray-50 rounded transition-colors"
                    >
                        <UserPlus size={16} />
                        Não encontrou? Cadastrar Novo
                    </button>
                </div>
            </div>
        </div>
        </div>

        <NurseCreationModal 
            isOpen={isCreationModalOpen}
            onClose={() => setIsCreationModalOpen(false)}
            onSuccess={() => {
                onSuccess()
                setIsCreationModalOpen(false)
                onClose()
            }}
            defaultSectionId={sectionId}
        />
    </>
  )
}
