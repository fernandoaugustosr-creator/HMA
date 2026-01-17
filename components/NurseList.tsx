'use client'

import { useState } from 'react'
import { deleteNurse } from '@/app/actions'
import NurseCreationModal from './NurseCreationModal'
import { Pencil, Trash2, Plus } from 'lucide-react'

export default function NurseList({ nurses, sections }: { nurses: any[], sections: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [nurseToEdit, setNurseToEdit] = useState<any | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const handleEdit = (nurse: any) => {
    setNurseToEdit(nurse)
    setIsModalOpen(true)
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
          <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPF</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cargo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {nurses.map((nurse: any) => (
              <tr key={nurse.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{nurse.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{nurse.cpf}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{nurse.role}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex gap-2">
                  <button 
                    onClick={() => handleEdit(nurse)}
                    className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
                  >
                    <Pencil size={16} /> Editar
                  </button>
                  <button 
                    onClick={() => handleDelete(nurse.id)}
                    disabled={loadingId === nurse.id}
                    className="text-red-600 hover:text-red-900 flex items-center gap-1 disabled:opacity-50"
                  >
                    <Trash2 size={16} /> {loadingId === nurse.id ? '...' : 'Excluir'}
                  </button>
                </td>
              </tr>
            ))}
            {nurses.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">Nenhum servidor cadastrado.</td>
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
