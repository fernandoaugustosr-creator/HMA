'use client'

import { useState, useEffect } from 'react'
import { createSwapRequest, approveSwapRequest, rejectSwapRequest, cancelSwapRequest, getAvailableShiftsForNurse, deleteAllHistorySwaps } from '@/app/swap-actions'
import { useRouter } from 'next/navigation'
import SearchableSelect from './SearchableSelect'

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
  isAdmin?: boolean
}

export default function SwapSection({ swaps, nurses, userShifts, currentUserId, isAdmin = false }: SwapSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  
  // Form State
  const [selectedNurseId, setSelectedNurseId] = useState('')
  const [myShiftDate, setMyShiftDate] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [isShiftLocked, setIsShiftLocked] = useState(false)
  const [error, setError] = useState('')
  const [targetNurseShifts, setTargetNurseShifts] = useState<{date: string, type: string}[]>([])
  const isAdminView = isAdmin

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
    formData.append('requested_shift_date', targetDate)
    
    const myDateValid = futureShifts.some((s: any) => (s.date || s.shift_date) === myShiftDate)
    const targetDateValid = targetNurseShifts.some(s => s.date === targetDate)
    if (!myDateValid || !targetDateValid) {
      setIsLoading(false)
      setError('Selecione datas válidas conforme a escala de ambos')
      return
    }

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

  const handleCancel = async (id: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta solicitação?')) return
    const result = await cancelSwapRequest(id)
    if (result.success) router.refresh()
    else alert(result.message)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta permulta?')) return
    const result = await cancelSwapRequest(id)
    if (result.success) router.refresh()
    else alert(result.message)
  }
  const handleDeleteAllHistory = async () => {
    if (!confirm('Tem certeza que deseja apagar TODAS as permultas do histórico?')) return
    const result = await deleteAllHistorySwaps()
    if (result.success) router.refresh()
    else alert(result.message || 'Erro ao apagar histórico de permultas')
  }

  const openModalForShift = (date: string) => {
    setMyShiftDate(date)
    setIsShiftLocked(true)
    setSelectedNurseId('')
    setTargetDate('')
    setIsModalOpen(true)
  }

  useEffect(() => {
    let isCancelled = false
    async function loadTargetShifts() {
      setTargetDate('')
      setTargetNurseShifts([])
      if (!selectedNurseId) return
      const shifts = await getAvailableShiftsForNurse(selectedNurseId)
      if (!isCancelled) {
        setTargetNurseShifts(shifts)
      }
    }
    loadTargetShifts()
    return () => { isCancelled = true }
  }, [selectedNurseId])

  const pendingSwaps = isAdminView
    ? swaps.filter(s => s.status === 'pending')
    : swaps.filter(s => {
        if (s.status !== 'pending') return false
        
        if (s.requester_id !== currentUserId && s.requested_id !== currentUserId) return false

        const myDate = s.requester_id === currentUserId 
            ? s.requester_shift_date 
            : s.requested_shift_date

        const myShift = userShifts.find(shift => 
            (shift.date === myDate || shift.shift_date === myDate)
        )
        
        return !!myShift
      })
  const historySwaps = isAdminView
    ? swaps.filter(s => s.status !== 'pending')
    : swaps.filter(s => s.status !== 'pending' && (s.requester_id === currentUserId || s.requested_id === currentUserId))
  
  const futureShifts = userShifts
    .filter(s => s.nurse_id === currentUserId)
    .sort((a, b) => {
      const da = a.date || a.shift_date
      const db = b.date || b.shift_date
      return da.localeCompare(db)
    })

  return (
    <div className="bg-white shadow rounded-lg p-6 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
          <svg className="w-5 h-5 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          {isAdminView ? 'Permultas de Servidores' : 'Minhas Permultas'}
        </h2>
        <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">{pendingSwaps.length}</span>
      </div>
      
      <div className="flex-1 min-h-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
          
          {/* Left Column: Permutas para Solicitar (User) or Pendentes (Admin) */}
          <div className="overflow-y-auto h-full pr-2 custom-scrollbar">
            {isAdminView ? (
               <>
                <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide sticky top-0 bg-white py-2 z-10">Solicitações Pendentes</h3>
                {pendingSwaps.length === 0 ? (
                    <p className="text-gray-500 text-sm py-4 text-center">Nenhuma solicitação pendente.</p>
                ) : (
                    <ul className="space-y-3">
                        {pendingSwaps.map((swap) => (
                            <li key={swap.id} className="bg-orange-50 border border-orange-100 rounded-md p-3">
                                <div className="flex justify-between items-start">
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-800">
                                    <span className="font-bold">{swap.requester_name}</span> →{' '}
                                    <span className="font-bold">{swap.requested_name}</span>
                                    </p>
                                    <p className="text-xs text-gray-600 mt-1">
                                    Dar: <strong>{formatDate(swap.requester_shift_date)}</strong>
                                    </p>
                                    <p className="text-xs text-gray-600">
                                    Receber: <strong>{formatDate(swap.requested_shift_date || '')}</strong>
                                    </p>
                                </div>
                                <div className="flex flex-col items-end space-y-1">
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
                                    <button 
                                        onClick={() => handleCancel(swap.id)}
                                        className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                                    >
                                        Cancelar
                                    </button>
                                    </div>
                                </div>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
               </>
            ) : (
               <>
                <div className="flex justify-between items-center mb-2 sticky top-0 bg-white py-2 z-10">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Permutas para Solicitar</h3>
                    <button 
                        onClick={() => {
                            setMyShiftDate('')
                            setIsShiftLocked(false)
                            setIsModalOpen(true)
                        }}
                        className="text-xs text-orange-600 hover:text-orange-800 underline"
                    >
                        Nova Solicitação Avulsa
                    </button>
                </div>
                
                {futureShifts.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">Nenhum plantão disponível para troca.</p>
                ) : (
                    <ul className="space-y-2">
                        {futureShifts.map((shift: any) => {
                            const date = shift.date || shift.shift_date
                            const activeSwap = swaps.find(s => 
                              s.status === 'pending' && (
                                  (s.requester_id === currentUserId && s.requester_shift_date === date) ||
                                  (s.requested_id === currentUserId && s.requested_shift_date === date)
                              )
                          )

                          const approvedSwap = swaps.find(s => 
                              s.status === 'approved' && (
                                  (s.requested_id === currentUserId && s.requester_shift_date === date) ||
                                  (s.requester_id === currentUserId && s.requested_shift_date === date)
                              )
                          )

                          return (
                              <li key={shift.id || `${date}_${shift.nurse_id}`} className="border border-gray-100 rounded-md p-3 hover:bg-gray-50 transition-colors">
                                  <div className="flex justify-between items-center">
                                      <div>
                                          <div className="font-medium text-gray-800">{formatDate(date)}</div>
                                          <div className="text-xs text-gray-500 capitalize">{shift.type === 'day' ? 'Diurno' : 'Noturno'}</div>
                                          {activeSwap && (
                                              <div className="mt-1 text-xs text-orange-600 flex items-center">
                                                  <span className="w-2 h-2 bg-orange-500 rounded-full mr-1"></span>
                                                  {activeSwap.requester_id === currentUserId 
                                                      ? `Solicitado a ${activeSwap.requested_name}`
                                                      : `Interesse de ${activeSwap.requester_name}`
                                                  }
                                              </div>
                                          )}
                                          {approvedSwap && (
                                              <div className="mt-1 text-xs text-green-600 flex items-center">
                                                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>
                                                  {approvedSwap.requested_id === currentUserId 
                                                      ? `Permuta com ${approvedSwap.requester_name}`
                                                      : `Permuta com ${approvedSwap.requested_name}`
                                                  }
                                              </div>
                                          )}
                                      </div>
                                      
                                      {!activeSwap && (
                                            <button 
                                                onClick={() => openModalForShift(date)}
                                                className="text-xs border border-orange-500 text-orange-500 px-3 py-1 rounded hover:bg-orange-50"
                                            >
                                                Permutar
                                            </button>
                                        )}
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                )}
               </>
            )}
          </div>

          {/* Right Column: Solicitadas (User) or Histórico (Admin) */}
          <div className="overflow-y-auto h-full pl-2 md:border-l md:border-gray-100 custom-scrollbar">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide sticky top-0 bg-white py-2 z-10">
                {isAdminView ? 'Histórico' : 'Solicitadas'}
            </h3>

            {isAdminView ? (
                <>
                 <div className="flex justify-end mb-2">
                    <button
                      onClick={handleDeleteAllHistory}
                      className="text-xs text-red-600 hover:text-red-800 underline"
                    >
                      Apagar todas
                    </button>
                 </div>
                 <ul className="space-y-2">
                  {historySwaps.map((swap) => {
                     // Admin History Item Rendering
                     const statusLabel =
                       swap.status === 'approved'
                         ? 'Aprovada'
                         : swap.status === 'rejected'
                         ? 'Rejeitada'
                         : 'Cancelada'
                     const statusColor =
                       swap.status === 'approved'
                         ? 'bg-green-100 text-green-800'
                         : swap.status === 'rejected'
                         ? 'bg-red-100 text-red-800'
                         : 'bg-gray-100 text-gray-800'
     
                     return (
                       <li key={swap.id} className="border border-gray-100 rounded-md p-3 bg-gray-50">
                         <div className="flex justify-between items-start">
                           <div className="flex-1">
                             <p className="text-sm font-medium text-gray-800">
                               <span className="font-bold">{swap.requester_name}</span> →{' '}
                               <span className="font-bold">{swap.requested_name}</span>
                             </p>
                             <p className="text-xs text-gray-600 mt-1">
                               Dia dado: <strong>{formatDate(swap.requester_shift_date)}</strong>
                             </p>
                             <p className="text-xs text-gray-600">
                               Dia recebido: <strong>{formatDate(swap.requested_shift_date || '')}</strong>
                             </p>
                           </div>
                           <div className="flex flex-col items-end space-y-1">
                             <span className={`text-xs px-2 py-1 rounded-full ${statusColor}`}>
                               {statusLabel}
                             </span>
                             <button
                               onClick={() => handleDelete(swap.id)}
                               className="text-[10px] text-red-500 hover:text-red-700 underline"
                             >
                               Excluir
                             </button>
                           </div>
                         </div>
                       </li>
                     )
                  })}
                 </ul>
                </>
            ) : (
                <div className="space-y-6">
                    {/* User Pending Swaps */}
                    {pendingSwaps.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Em Análise</h4>
                            <ul className="space-y-3">
                                {pendingSwaps.map((swap) => {
                                  const isIncoming = swap.requested_id === currentUserId
                                  const otherName = isIncoming ? swap.requester_name : swap.requested_name
                                  
                                  return (
                                    <li key={swap.id} className="bg-orange-50 border border-orange-100 rounded-md p-3">
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
                                          {isIncoming ? (
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
                                          ) : (
                                            <div className="flex flex-col items-end space-y-1">
                                              <span className="text-xs text-orange-600 font-medium italic">Aguardando aprovação</span>
                                              <button 
                                                onClick={() => handleCancel(swap.id)}
                                                className="text-xs text-red-500 hover:text-red-700 underline"
                                              >
                                                Cancelar
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </li>
                                  )
                                })}
                            </ul>
                        </div>
                    )}
                    
                    {/* User History Swaps */}
                    {historySwaps.length > 0 && (
                        <div>
                            <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Histórico</h4>
                            <ul className="space-y-2">
                                {historySwaps.map((swap) => {
                                    const isRequester = swap.requester_id === currentUserId
                                    const otherName = isRequester ? swap.requested_name : swap.requester_name
                                    const statusLabel =
                                      swap.status === 'approved'
                                        ? 'Aprovada'
                                        : swap.status === 'rejected'
                                        ? 'Rejeitada'
                                        : 'Cancelada'
                                    const statusColor =
                                      swap.status === 'approved'
                                        ? 'bg-green-100 text-green-800'
                                        : swap.status === 'rejected'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-gray-100 text-gray-800'
                    
                                    return (
                                      <li key={swap.id} className="border border-gray-100 rounded-md p-3 bg-gray-50">
                                        <div className="flex justify-between items-start">
                                          <div className="flex-1">
                                            <p className="text-sm font-medium text-gray-800">
                                              <>
                                                Com:{' '}
                                                <span className="font-bold">{otherName}</span>
                                              </>
                                            </p>
                                            <p className="text-xs text-gray-600 mt-1">
                                              Dia dado: <strong>{formatDate(swap.requester_shift_date)}</strong>
                                            </p>
                                            <p className="text-xs text-gray-600">
                                              Dia recebido: <strong>{formatDate(swap.requested_shift_date || '')}</strong>
                                            </p>
                                          </div>
                                          <div className="flex flex-col items-end space-y-1">
                                            <span className={`text-xs px-2 py-1 rounded-full ${statusColor}`}>
                                              {statusLabel}
                                            </span>
                                            <button
                                              onClick={() => handleDelete(swap.id)}
                                              className="text-[10px] text-red-500 hover:text-red-700 underline"
                                            >
                                              Excluir
                                            </button>
                                          </div>
                                        </div>
                                      </li>
                                    )
                                })}
                            </ul>
                        </div>
                    )}

                    {pendingSwaps.length === 0 && historySwaps.length === 0 && (
                        <p className="text-gray-500 text-sm text-center py-4">Nenhuma solicitação encontrada.</p>
                    )}
                </div>
            )}
          </div>
          
        </div>
      </div>


      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
            <div className="bg-white p-5 rounded-lg shadow-xl w-96">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold">Nova Troca</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

                <form onSubmit={handleCreate} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Meu Plantão (Dar)</label>
                        <select 
                            value={myShiftDate}
                            onChange={(e) => setMyShiftDate(e.target.value)}
                            disabled={isShiftLocked}
                            className={`mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm border p-2 ${isShiftLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                            required
                        >
                            <option value="">Selecione...</option>
                            {futureShifts.map(s => (
                                <option key={s.date || s.shift_date} value={s.date || s.shift_date}>
                                    {formatDate(s.date || s.shift_date)} - {(s.type || s.shift_type) === 'day' ? 'Diurno' : (s.type || s.shift_type) === 'night' ? 'Noturno' : (s.type || s.shift_type || 'N/A')}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Com quem?</label>
                        <SearchableSelect
                            options={nurses.filter(n => {
                                if (n.id === currentUserId) return false
                                
                                const currentUser = nurses.find(u => u.id === currentUserId)
                                if (!currentUser) return true // Fallback if user not found in list (shouldn't happen)
                                
                                const isUserNurse = currentUser.role === 'ENFERMEIRO' || currentUser.role === 'COORDENADOR' || currentUser.role === 'COORDENACAO_GERAL'
                                const isTargetNurse = n.role === 'ENFERMEIRO' || n.role === 'COORDENADOR' || n.role === 'COORDENACAO_GERAL'
                                
                                const isUserTech = currentUser.role === 'TECNICO'
                                const isTargetTech = n.role === 'TECNICO'

                                if (isUserNurse && isTargetNurse) return true
                                if (isUserTech && isTargetTech) return true
                                
                                return false
                            }).map(n => ({ value: n.id, label: n.name }))}
                            value={selectedNurseId}
                            onChange={setSelectedNurseId}
                            placeholder="Selecione um colega..."
                            required
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Dia Disponível (Receber)</label>
                        <select
                            value={targetDate}
                            onChange={(e) => setTargetDate(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm border p-2"
                            required
                            disabled={!selectedNurseId}
                        >
                            <option value="">{selectedNurseId ? 'Selecione...' : 'Selecione um servidor acima'}</option>
                            {targetNurseShifts.map(s => (
                                <option key={s.date} value={s.date}>
                                    {formatDate(s.date)} - {s.type === 'day' ? 'Diurno' : s.type === 'night' ? 'Noturno' : (s.type || 'N/A')}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Apenas datas com plantão cadastrado para o servidor selecionado.</p>
                    </div>

                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(false)}
                            className="mr-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
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
