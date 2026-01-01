'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'

interface Schedule {
  id: string
  shift_date: string
  shift_type: 'day' | 'night'
  nurses: {
    name: string
  }
}

export default function Schedule() {
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [loading, setLoading] = useState(true)
  // Client será criado apenas quando necessário para evitar erro sem env vars

  useEffect(() => {
    async function fetchSchedules() {
      // Verificar se as variáveis de ambiente estão configuradas
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('sua_url')) {
        console.warn('Supabase não configurado. Usando dados fictícios.')
        setSchedules([
          { id: '1', shift_date: '2026-01-01', shift_type: 'day', nurses: { name: 'Enfermeira Teste (Mock)' } },
          { id: '2', shift_date: '2026-01-01', shift_type: 'night', nurses: { name: 'Enfermeiro Teste (Mock)' } },
        ])
        setLoading(false)
        return
      }

      const supabase = createClient()
      const { data, error } = await supabase
        .from('schedules')
        .select(`
          id,
          shift_date,
          shift_type,
          nurses (
            name
          )
        `)
        .order('shift_date', { ascending: true })

      if (error) {
        console.error('Erro ao buscar escalas:', error)
      } else {
        setSchedules(data as any)
      }
      setLoading(false)
    }

    fetchSchedules()
  }, [])

  if (loading) return <div className="p-4">Carregando escalas...</div>

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Escala de Plantão</h2>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Enfermeiro(a)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Turno</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {schedules.map((schedule) => (
              <tr key={schedule.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(schedule.shift_date).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {schedule.nurses?.name || 'Desconhecido'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    schedule.shift_type === 'day' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                  }`}>
                    {schedule.shift_type === 'day' ? 'Diurno' : 'Noturno'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {schedules.length === 0 && (
          <div className="p-4 text-center text-gray-500">Nenhuma escala encontrada.</div>
        )}
      </div>
    </div>
  )
}
