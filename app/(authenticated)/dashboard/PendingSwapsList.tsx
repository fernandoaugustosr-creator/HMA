'use client'

import { useState } from 'react'
import { approveSwapRequest, rejectSwapRequest } from '@/app/swap-actions'
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

interface Props {
  swaps: Swap[]
  currentUserId: string
}

export default function PendingSwapsList({ swaps, currentUserId }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  // Filter for pending swaps where I am the requested nurse
  const pendingSwaps = swaps.filter(
    s => s.status === 'pending' && s.requested_id === currentUserId
  )

  if (pendingSwaps.length === 0) return null

  const handleApprove = async (id: string) => {
    if (!confirm('Tem certeza que deseja aprovar esta troca?')) return
    setLoadingId(id)
    try {
      const result = await approveSwapRequest(id)
      if (result.success) {
        router.refresh()
      } else {
        alert(result.message)
      }
    } finally {
      setLoadingId(null)
    }
  }

  const handleReject = async (id: string) => {
    if (!confirm('Tem certeza que deseja rejeitar esta troca?')) return
    setLoadingId(id)
    try {
      const result = await rejectSwapRequest(id)
      if (result.success) {
        router.refresh()
      } else {
        alert(result.message)
      }
    } finally {
      setLoadingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-'
    const [year, month, day] = dateString.split('-')
    return `${day}/${month}/${year}`
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6 border-l-4 border-yellow-400">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
          <svg className="w-5 h-5 mr-2 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
          Permutas para Autorizar
        </h2>
        <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full">
          {pendingSwaps.length}
        </span>
      </div>

      <div className="overflow-y-auto max-h-96">
        <ul className="space-y-3">
          {pendingSwaps.map((swap) => (
            <li key={swap.id} className="border-b border-gray-100 pb-3 last:border-0">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">
                    <span className="text-gray-500">Solicitante:</span> {swap.requester_name}
                  </p>
                  <div className="mt-1 text-sm text-gray-600">
                    <p>
                      <span className="font-medium text-indigo-600">Dia dele(a):</span> {formatDate(swap.requester_shift_date)}
                    </p>
                    {swap.requested_shift_date && (
                      <p>
                        <span className="font-medium text-green-600">Seu dia:</span> {formatDate(swap.requested_shift_date)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => handleApprove(swap.id)}
                    disabled={loadingId === swap.id}
                    className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                  >
                    {loadingId === swap.id ? '...' : 'Aprovar'}
                  </button>
                  <button
                    onClick={() => handleReject(swap.id)}
                    disabled={loadingId === swap.id}
                    className="flex-1 sm:flex-none bg-red-100 hover:bg-red-200 text-red-700 text-xs px-3 py-2 rounded-md transition-colors disabled:opacity-50"
                  >
                    Rejeitar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
