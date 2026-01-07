'use client'

import { updateTimeOffStatus, deleteTimeOffRequest, updateTimeOffRequest } from '@/app/actions'
import { useState } from 'react'

export default function RequestList({ requests, isAdmin }: { requests: any[], isAdmin: boolean }) {
  const [loading, setLoading] = useState<string | null>(null)
  const [editingRequest, setEditingRequest] = useState<any | null>(null)

  async function handleStatusUpdate(id: string, status: 'approved' | 'rejected') {
    if (!confirm(`Tem certeza que deseja ${status === 'approved' ? 'aprovar' : 'rejeitar'} esta solicitação?`)) return

    setLoading(id)
    try {
      await updateTimeOffStatus(id, status)
    } catch (error) {
      alert('Erro ao atualizar status')
    } finally {
      setLoading(null)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir esta solicitação permanentemente?')) return
    
    setLoading(id)
    try {
        const res = await deleteTimeOffRequest(id)
        if (!res.success) alert(res.message)
    } catch (error) {
        alert('Erro ao excluir')
    } finally {
        setLoading(null)
    }
  }

  async function handleUpdateSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingRequest) return

    const formData = new FormData(e.currentTarget)
    const data = {
        startDate: formData.get('startDate') as string,
        endDate: formData.get('endDate') as string,
        reason: formData.get('reason') as string
    }

    setLoading('editing')
    try {
        const res = await updateTimeOffRequest(editingRequest.id, data)
        if (res.success) {
            setEditingRequest(null)
        } else {
            alert(res.message)
        }
    } catch (error) {
        alert('Erro ao atualizar')
    } finally {
        setLoading(null)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Aprovado</span>
      case 'rejected': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Rejeitado</span>
      default: return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendente</span>
    }
  }

  return (
    <>
    <div className="overflow-hidden bg-white shadow sm:rounded-md">
      <ul className="divide-y divide-gray-200">
        {requests.length === 0 ? (
           <li className="px-4 py-4 sm:px-6 text-center text-gray-500">Nenhuma solicitação encontrada.</li>
        ) : (
          requests.map((request) => (
            <li key={request.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-indigo-600 truncate">
                    {request.nurses?.name || 'Desconhecido'}
                  </p>
                  <div className="ml-2 flex-shrink-0 flex items-center space-x-2">
                    {getStatusBadge(request.status)}
                    {isAdmin && (
                        <>
                            <button 
                                onClick={() => setEditingRequest(request)}
                                className="text-gray-400 hover:text-indigo-600 transition-colors p-1"
                                title="Editar"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                            </button>
                            <button 
                                onClick={() => handleDelete(request.id)}
                                className="text-gray-400 hover:text-red-600 transition-colors p-1"
                                title="Excluir"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                            </button>
                        </>
                    )}
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-sm text-gray-500">
                      De: {new Date(request.start_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </p>
                    <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                      Até: {new Date(request.end_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                    <p className="text-sm text-gray-600 italic">&quot;{request.reason}&quot;</p>
                </div>
                
                {isAdmin && request.status === 'pending' && (
                  <div className="mt-4 flex space-x-3 justify-end border-t pt-4 border-gray-100">
                    <button
                      onClick={() => handleStatusUpdate(request.id, 'rejected')}
                      disabled={loading === request.id}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none disabled:opacity-50"
                    >
                      Rejeitar Solicitação
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(request.id, 'approved')}
                      disabled={loading === request.id}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-50"
                    >
                      Aprovar Solicitação
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>

    {/* Edit Modal */}
    {editingRequest && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="relative p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Editar Solicitação</h3>
                <form onSubmit={handleUpdateSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Data Início</label>
                        <input 
                            type="date" 
                            name="startDate" 
                            defaultValue={editingRequest.start_date}
                            required 
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Data Fim</label>
                        <input 
                            type="date" 
                            name="endDate" 
                            defaultValue={editingRequest.end_date}
                            required 
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Motivo</label>
                        <textarea 
                            name="reason" 
                            defaultValue={editingRequest.reason}
                            rows={3}
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                        />
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                        <button 
                            type="button" 
                            onClick={() => setEditingRequest(null)}
                            className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded hover:bg-gray-300"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={loading === 'editing'}
                            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {loading === 'editing' ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )}
    </>
  )
}
