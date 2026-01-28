'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { logCurrentSessionLogin } from '@/app/actions'

interface LogsClientProps {
  loginLogs: any[]
  isDirector: boolean
}

export default function LogsClient({ loginLogs, isDirector }: LogsClientProps) {
  const router = useRouter()
  const [logCreateLoading, setLogCreateLoading] = useState(false)
  const [logCreateError, setLogCreateError] = useState('')

  const handleCreateLoginLog = async () => {
    setLogCreateLoading(true)
    setLogCreateError('')
    try {
      const res = await logCurrentSessionLogin()
      if (!res.success) throw new Error(res.message)
      router.refresh()
    } catch (e: any) {
      setLogCreateError(e.message)
    } finally {
      setLogCreateLoading(false)
    }
  }

  const findNurseName = (id: string) => {
     // Since we don't have the full nurses list here easily without fetching it, 
     // we rely on the backend provided user_name if available. 
     // The original code used findNurseName from a list passed as prop.
     // However, the loginLogs query selects user_name.
     return ''
  }

  // Helper to display name. The logs usually have user_name stored.
  // If user_name is null in DB, we might show ID or 'Unknown'.
  // In the original code, it tried user_name || findNurseName(id).
  // We will trust user_name is populated or use ID.

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Logs de Login</h1>
        <button
          type="button"
          onClick={handleCreateLoginLog}
          disabled={logCreateLoading}
          className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {logCreateLoading ? 'Registrando...' : 'Registrar acesso agora'}
        </button>
      </div>

      {logCreateError && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{logCreateError}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-4 border border-gray-200">
        <div className="mb-3 flex justify-between items-center">
          <p className="text-sm text-gray-700 font-medium">Últimos 30 acessos</p>
        </div>
        
        {loginLogs.length === 0 ? (
           <p className="text-sm text-gray-500">Nenhum acesso registrado.</p>
        ) : (
          <div className="max-h-[600px] overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left font-medium text-gray-700">Servidor</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-700">Cargo</th>
                  <th className="px-2 py-1 text-left font-medium text-gray-700">Data/Hora</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loginLogs.slice(0, 30).map((item) => (
                  <tr key={item.id}>
                    <td className="px-2 py-1 text-gray-900">
                      {item.user_name || item.user_id}
                    </td>
                    <td className="px-2 py-1 text-gray-700">
                      {item.user_role || '—'}
                    </td>
                    <td className="px-2 py-1 text-gray-700">
                      {item.login_at ? new Date(item.login_at).toLocaleString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
