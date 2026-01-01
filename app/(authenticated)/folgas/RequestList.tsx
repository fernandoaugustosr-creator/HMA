'use client'

import { updateTimeOffStatus } from '@/app/actions'
import { useState } from 'react'

export default function RequestList({ requests, isAdmin }: { requests: any[], isAdmin: boolean }) {
  const [loading, setLoading] = useState<string | null>(null)

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Aprovado</span>
      case 'rejected': return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Rejeitado</span>
      default: return <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Pendente</span>
    }
  }

  return (
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
                  <div className="ml-2 flex-shrink-0 flex">
                    {getStatusBadge(request.status)}
                  </div>
                </div>
                <div className="mt-2 sm:flex sm:justify-between">
                  <div className="sm:flex">
                    <p className="flex items-center text-sm text-gray-500">
                      De: {new Date(request.start_date).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                      Até: {new Date(request.end_date).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="mt-2">
                    <p className="text-sm text-gray-600 italic">"{request.reason}"</p>
                </div>
                
                {isAdmin && request.status === 'pending' && (
                  <div className="mt-4 flex space-x-3 justify-end">
                    <button
                      onClick={() => handleStatusUpdate(request.id, 'rejected')}
                      disabled={loading === request.id}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none disabled:opacity-50"
                    >
                      Rejeitar
                    </button>
                    <button
                      onClick={() => handleStatusUpdate(request.id, 'approved')}
                      disabled={loading === request.id}
                      className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none disabled:opacity-50"
                    >
                      Aprovar
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
