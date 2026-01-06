'use client'

import { useState } from 'react'
import { createSwapRequest, approveSwapRequest, rejectSwapRequest } from '@/app/swap-actions'
import { useRouter } from 'next/navigation'

interface Swap {
  id: string
  requester_id: string
  requested_id: string
  requester_shift_date: string
  requested_shift_date: string | null
  status: string
  requester_name?: string
  requested_name?: string
  created_at: string
}

interface SwapSectionProps {
  swaps: Swap[]
  nurses: any[]
  userShifts: any[]
  currentUserId: string
}

export default function SwapSection({ swaps, nurses, userShifts, currentUserId }: SwapSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  
  // Form State
  const [selectedNurseId, setSelectedNurseId] = useState('')
  const [myShiftDate, setMyShiftDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [error, setError] = useState('')

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const formData = new FormData()
    formData.append('requested_id', selectedNurseId)
    formData.append('requester_shift_date', myShiftDate)
    if (targetDate) formData.append('requested_shift_date', targetDate)

    const result = await createSwapRequest(formData)
    
    setIsLoading(false)
    if (result.success) {
      setIsModalOpen(false)
      setSelectedNurseId('')
      setMyShiftDate('')
      setTargetDate('')
      router.refresh()
    } else {
      setError(result.message || 'Erro ao criar solicitação')
    }
  }

  const handleApprove = async (id: string) => {
    if (!confirm('Tem certeza que deseja aprovar esta troca?')) return
    const result = await approveSwapRequest(id)
    if (result.success) router.refresh()
    else alert(result.message)
  }

  const handleReject = async (id: string) => {
    if (!confirm('Tem certeza que deseja rejeitar esta troca?')) return
    const result = await rejectSwapRequest(id)
    if (result.success) router.refresh()
    else alert(result.message)
  }

  const pendingSwaps = swaps.filter(s => s.status === 'pending')
  const historySwaps = swaps.filter(s => s.status !== 'pending')

  return (
    <div className="bg-white shadow rounded-lg p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
          <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Minhas Trocas
        </h2>
        <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">{pendingSwaps.length}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto max-h-96">
        <div className="mb-4">
            <button 
                onClick={() => setIsModalOpen(true)}
                className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            >
                Nova Solicitação
            </button>
        </div>

        {swaps.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-4">Nenhuma troca registrada.</p>
        ) : (
          <ul className="space-y-3">
            {swaps.map((swap) => {
               const isIncoming = swap.requested_id === currentUserId
               const otherName = isIncoming ? swap.requester_name : swap.requested_name
               
               return (
              <li key={swap.id} className="border-b border-gray-100 pb-2 last:border-0">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {isIncoming ? 'Solicitação de: ' : 'Enviado para: '}
                      <span className="font-bold">{otherName}</span>
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                       Trocar meu dia: <strong>{formatDate(isIncoming ? swap.requested_shift_date || '?' : swap.requester_shift_date)}</strong>
                    </p>
                    <p className="text-xs text-gray-600">
                       Pelo dia: <strong>{formatDate(isIncoming ? swap.requester_shift_date : swap.requested_shift_date || '?')}</strong>
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-1">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium 
                        ${swap.status === 'approved' ? 'bg-green-100 text-green-800' : 
                          swap.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                          'bg-yellow-100 text-yellow-800'}`}>
                      {swap.status === 'approved' ? 'Aprovado' : 
                       swap.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                    </span>
                    
                    {swap.status === 'pending' && isIncoming && (
                        <div className="flex space-x-1 mt-1">
                            <button 
                                onClick={() => handleApprove(swap.id)}
                                className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600"
                            >
                                Aceitar
                            </button>
                            <button 
                                onClick={() => handleReject(swap.id)}
                                className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                            >
                                Recusar
                            </button>
                        </div>
                    )}
                     {swap.status === 'pending' && !isIncoming && (
                         <span className="text-xs text-gray-400 italic">Aguardando</span>
                     )}
                  </div>
                </div>
              </li>
            )})}
          </ul>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="bg-white p-5 rounded-lg shadow-xl w-96">
                <h3 className="text-lg font-bold mb-4">Nova Troca</h3>
                
                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Com quem?</label>
                        <select 
                            value={selectedNurseId}
                            onChange={(e) => setSelectedNurseId(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2"
                            required
                        >
                            <option value="">Selecione...</option>
                            {nurses.filter(n => n.id !== currentUserId).map(n => (
                                <option key={n.id} value={n.id}>{n.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Meu Plantão (Dar)</label>
                        <select 
                            value={myShiftDate}
                            onChange={(e) => setMyShiftDate(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2"
                            required
                        >
                            <option value="">Selecione...</option>
                            {userShifts.filter(s => new Date(s.date || s.shift_date) >= new Date()).map(s => (
                                <option key={s.id || s.date} value={s.date || s.shift_date}>
                                    {formatDate(s.date || s.shift_date)} ({s.type === 'day' ? 'D' : 'N'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Plantão Desejado (Receber)</label>
                        <input 
                            type="date"
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm border p-2"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-1">Data que você quer trabalhar no lugar do colega.</p>
                    </div>

                    <div className="flex justify-end space-x-2 mt-4">
                        <button 
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50"
                        >
                            {isLoading ? 'Enviando...' : 'Solicitar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  )
}
