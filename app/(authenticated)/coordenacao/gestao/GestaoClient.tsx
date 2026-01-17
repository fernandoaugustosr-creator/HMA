'use client'

import { useFormState } from 'react-dom'
import { createSection, updateSectionForm, deleteSectionForm } from '@/app/actions'
import { useState, useEffect } from 'react'

const initialState = {
  success: false,
  message: '',
}

export default function GestaoClient({ sections = [], nurses = [] }: { sections?: any[], nurses?: any[] }) {
  const [createState, createAction] = useFormState(createSection, initialState)
  const [updateState, updateAction] = useFormState(updateSectionForm, initialState)
  const [deleteState, deleteAction] = useFormState(deleteSectionForm, initialState)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState<string>('')
  const [editingCoordinator, setEditingCoordinator] = useState<string>('')

  useEffect(() => {
    if (deleteState?.message && !deleteState.success) {
      alert(deleteState.message)
    }
  }, [deleteState])

  useEffect(() => {
     if (updateState?.message && !updateState.success) {
       alert(updateState.message)
     }
  }, [updateState])

  useEffect(() => {
    if (createState?.message && !createState.success) {
      alert(createState.message)
    }
 }, [createState])

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Novo Local de Coordenação</h2>
          <form action={createAction} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Nome do Setor
              </label>
              <input
                type="text"
                name="title"
                id="title"
                required
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ex: UTI Adulto"
              />
            </div>
            
            <div>
              <label htmlFor="coordinatorId" className="block text-sm font-medium text-gray-700">
                Atribuir Coordenador (Opcional)
              </label>
              <select
                id="coordinatorId"
                name="coordinatorId"
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">Selecione um servidor...</option>
                {nurses.map((nurse) => (
                  <option key={nurse.id} value={nurse.id}>
                    {nurse.name} - {nurse.cpf}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Criar Setor e Atribuir Coordenador
            </button>
            {createState?.message && (
              <div className={`text-sm text-center ${createState.success ? 'text-green-600' : 'text-red-600'}`}>
                {createState.message}
              </div>
            )}
          </form>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Setores Atuais</h3>
        <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
          <ul className="divide-y divide-gray-200">
            {sections.map((section) => {
              const coordinator = nurses.find(n => n.section_id === section.id && n.role === 'COORDENADOR')
              return (
                <li key={section.id} className="p-4 flex justify-between items-center">
                  <div className="flex-1">
                    {editingId === section.id ? (
                      <form
                        action={updateAction}
                        className="flex flex-col gap-2"
                        onSubmit={() => setEditingId(null)}
                      >
                        <input
                          type="hidden"
                          name="id"
                          value={section.id}
                        />
                        <input
                          type="text"
                          name="title"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                          required
                          placeholder="Nome do Setor"
                        />
                         <select
                            name="coordinatorId"
                            value={editingCoordinator}
                            onChange={(e) => setEditingCoordinator(e.target.value)}
                            className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500"
                          >
                            <option value="">Sem coordenador / Manter atual se não alterar</option>
                            {nurses.map((nurse) => (
                              <option key={nurse.id} value={nurse.id}>
                                {nurse.name} - {nurse.cpf}
                              </option>
                            ))}
                          </select>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="px-3 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                          >
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="font-medium text-gray-900">{section.title}</p>
                        {coordinator ? (
                          <p className="text-sm text-gray-500">Coordenador: {coordinator.name}</p>
                        ) : (
                          <p className="text-sm text-red-500">Sem coordenador</p>
                        )}
                      </>
                    )}
                  </div>
                  {editingId !== section.id && (
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(section.id)
                          setEditingTitle(section.title)
                          setEditingCoordinator(coordinator ? coordinator.id : '')
                        }}
                        className="px-3 py-2 text-xs font-medium text-indigo-600 border border-indigo-200 rounded-md hover:bg-indigo-50"
                      >
                        Alterar
                      </button>
                      <form
                        action={deleteAction}
                        onSubmit={(e) => {
                          if (!confirm('Tem certeza que deseja excluir este setor?')) {
                            e.preventDefault()
                          }
                        }}
                      >
                        <input type="hidden" name="id" value={section.id} />
                        <button
                          type="submit"
                          className="px-3 py-2 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              )
            })}
            {sections.length === 0 && (
              <li className="p-4 text-center text-gray-500">Nenhum setor cadastrado.</li>
            )}
          </ul>
        </div>
        {(updateState?.message || deleteState?.message) && (
          <div className="mt-4 text-sm text-center">
            {updateState?.message && (
              <p className={updateState.success ? 'text-green-600' : 'text-red-600'}>
                {updateState.message}
              </p>
            )}
            {deleteState?.message && (
              <p className={deleteState.success ? 'text-green-600' : 'text-red-600'}>
                {deleteState.message}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
