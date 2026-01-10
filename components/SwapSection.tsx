'use client'

import { useState, useEffect } from 'react'
import { createSwapRequest, approveSwapRequest, rejectSwapRequest, cancelSwapRequest, getAvailableShiftsForNurse } from '@/app/swap-actions'
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
  const [targetNurseShifts, setTargetNurseShifts] = useState<{date: string, type: string}[]>([])

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

  const openModalForShift = (date: string) => {
    setMyShiftDate(date)
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

  const pendingSwaps = swaps.filter(s => {
    if (s.status !== 'pending') return false
    
    // Check if swap belongs to current user
    if (s.requester_id !== currentUserId && s.requested_id !== currentUserId) return false

    // Identify user's shift date involved in this swap
    const myDate = s.requester_id === currentUserId 
        ? s.requester_shift_date 
        : s.requested_shift_date

    // Check if this date corresponds to a valid rostered shift for the user
    // Note: userShifts contains all shifts from cutoff date, enriched with is_in_roster
    const myShift = userShifts.find(shift => 
        (shift.date === myDate || shift.shift_date === myDate) &&
        shift.is_in_roster
    )
    
    // Only show if the user's shift is still valid and in roster
    return !!myShift
  })
  const historySwaps = swaps.filter(s => s.status !== 'pending' && (s.requester_id === currentUserId || s.requested_id === currentUserId))
  
  // Filter future shifts
    const futureShifts = userShifts
      .filter(s => s.nurse_id === currentUserId)
      // Only show shifts that are part of the roster (escala)
      .filter(s => s.is_in_roster)
      .filter(s => {
          const d = s.date || s.shift_date
          return d && new Date(d) >= new Date(new Date().setHours(0,0,0,0))
      })
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
          Minhas Trocas
        </h2>
        <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full">{pendingSwaps.length}</span>
      </div>
      
      <div className="flex-1 overflow-y-auto max-h-96">
        
        {/* Pending Swaps Section */}
        {pendingSwaps.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wide">Solicitações Pendentes</h3>
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
                )})}
            </ul>
          </div>
        )}

        {/* My Shifts List */}
        <div>
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Meus Plantões</h3>
                <button 
                    onClick={() => {
                        setMyShiftDate('')
                        setIsModalOpen(true)
                    }}
                    className="text-xs text-orange-600 hover:text-orange-800 underline"
                >
                    Nova Solicitação Avulsa
                </button>
            </div>
            
            {futureShifts.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">Nenhum plantão futuro agendado.</p>
            ) : (
                <ul className="space-y-2">
                    {futureShifts.map((shift: any) => {
                        const date = shift.date || shift.shift_date
                        // Check if involved in any pending swap
                        const activeSwap = swaps.find(s => 
                            s.status === 'pending' && (
                                (s.requester_id === currentUserId && s.requester_shift_date === date) ||
                                (s.requested_id === currentUserId && s.requested_shift_date === date)
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
                        <label className="block text-sm font-medium text-gray-700">Com quem?</label>
                        <SearchableSelect
                            options={nurses.filter(n => n.id !== currentUserId).map(n => ({ value: n.id, label: n.name }))}
                            value={selectedNurseId}
                            onChange={setSelectedNurseId}
                            placeholder="Selecione um colega..."
                            required
                            className="mt-1"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Meu Plantão (Dar)</label>
                        <select 
                            value={myShiftDate}
                            onChange={(e) => setMyShiftDate(e.target.value)}
                            className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-orange-500 focus:border-orange-500 sm:text-sm border p-2"
                            required
                        >
                            <option value="">Selecione...</option>
                            {futureShifts.map(s => (
                                <option key={s.date || s.shift_date} value={s.date || s.shift_date}>
                                    {formatDate(s.date || s.shift_date)} - {(s.type || s.shift_type) === 'day' ? 'Dia' : (s.type || s.shift_type) === 'night' ? 'Noite' : (s.type || s.shift_type || 'N/A')}
                                </option>
                            ))}
                        </select>
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
                                    {formatDate(s.date)} - {s.type === 'day' ? 'Dia' : s.type === 'night' ? 'Noite' : (s.type || 'N/A')}
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
