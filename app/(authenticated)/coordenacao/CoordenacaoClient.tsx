'use client'

import { useState, useRef, useEffect } from 'react'
import { useFormState } from 'react-dom'
import { registerAbsence, requestPayment, createGeneralRequest, deleteAbsence, deletePaymentRequest, deleteGeneralRequest } from '@/app/actions'

const initialState = {
  message: '',
  success: false
}

type CoordenacaoClientProps = {
  nurses: any[]
  sectionTitle?: string
  isAdmin?: boolean
  absences?: any[]
  paymentRequests?: any[]
  generalRequests?: any[]
  initialTab?: 'falta' | 'pagamento' | 'outros'
}

export default function CoordenacaoClient({
  nurses,
  sectionTitle,
  isAdmin = false,
  absences = [],
  paymentRequests = [],
   generalRequests = [],
  initialTab = 'falta',
}: CoordenacaoClientProps) {
  const activeTab = initialTab
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [location, setLocation] = useState(sectionTitle || '')

  const [absenceState, absenceAction] = useFormState(registerAbsence, initialState)
  const [paymentState, paymentAction] = useFormState(requestPayment, initialState)
  const [generalState, generalAction] = useFormState(createGeneralRequest, initialState)

  const absenceFormRef = useRef<HTMLFormElement>(null)
  const paymentFormRef = useRef<HTMLFormElement>(null)
  const generalFormRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (absenceState.success && absenceFormRef.current) {
      absenceFormRef.current.reset()
    }
  }, [absenceState.success])

  useEffect(() => {
    if (paymentState.success && paymentFormRef.current) {
      paymentFormRef.current.reset()
    }
  }, [paymentState.success])

  useEffect(() => {
    if (generalState.success && generalFormRef.current) {
      generalFormRef.current.reset()
    }
  }, [generalState.success])

  useEffect(() => {
    if (sectionTitle) {
      setLocation(sectionTitle)
    }
  }, [sectionTitle])

  const findNurseName = (id: string | null | undefined) => {
    if (!id) return '—'
    const nurse = nurses.find(n => n.id === id)
    return nurse ? nurse.name : 'Servidor não encontrado'
  }

  const handleDeleteAbsence = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta falta?')) return
    setLoadingId(id)
    try {
      const res = await deleteAbsence(id)
      if (!res.success) alert(res.message)
    } catch (e) {
      alert('Erro ao excluir falta')
    } finally {
      setLoadingId(null)
    }
  }

  const handleDeletePayment = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta solicitação de pagamento?')) return
    setLoadingId(id)
    try {
      const res = await deletePaymentRequest(id)
      if (!res.success) alert(res.message)
    } catch (e) {
      alert('Erro ao excluir solicitação de pagamento')
    } finally {
      setLoadingId(null)
    }
  }

  const handleDeleteGeneral = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta solicitação?')) return
    setLoadingId(id)
    try {
      const res = await deleteGeneralRequest(id)
      if (!res.success) alert(res.message)
    } catch (e) {
      alert('Erro ao excluir solicitação')
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">
        Painel do Coordenador {sectionTitle ? `- ${sectionTitle}` : ''}
      </h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        {activeTab === 'falta' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Registro de Falta</h3>
            <p className="text-gray-500 mb-4">Funcionalidade para lançar faltas de servidores.</p>
            <form ref={absenceFormRef} action={absenceAction} className="space-y-4 max-w-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Servidor</label>
                    <select
                      name="nurseId"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                      required
                    >
                        <option value="">Selecione um servidor...</option>
                        {nurses.map((nurse) => (
                            <option key={nurse.id} value={nurse.id}>{nurse.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Data</label>
                    <input
                      type="date"
                      name="date"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                      required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Motivo</label>
                    <textarea
                      name="reason"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                      rows={3}
                    ></textarea>
                </div>
                {absenceState.message && (
                  <div className={`text-sm ${absenceState.success ? 'text-green-600' : 'text-red-600'}`}>
                    {absenceState.message}
                  </div>
                )}
                <button
                  type="submit"
                  className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                >
                  Registrar Falta
                </button>
            </form>
          </div>
        )}

        {activeTab === 'pagamento' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Solicitação de Pagamento</h3>
            <p className="text-gray-500 mb-4">Funcionalidade para solicitar pagamento de plantões extras.</p>
            <form ref={paymentFormRef} action={paymentAction} className="space-y-4 max-w-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Servidor</label>
                    <select
                      name="nurseId"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                    >
                        <option value="">Selecione um servidor...</option>
                        {nurses.map((nurse) => (
                            <option key={nurse.id} value={nurse.id}>{nurse.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Data do Plantão</label>
                    <input
                      type="date"
                      name="shiftDate"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                      required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Carga Horária</label>
                    <select
                      name="shiftHours"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                      required
                    >
                        <option value="12">12 horas</option>
                        <option value="24">24 horas</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Setor/Unidade</label>
                    <input
                      type="text"
                      name="location"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                      required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Observações</label>
                    <textarea
                      name="observation"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                      rows={3}
                    ></textarea>
                </div>
                {paymentState.message && (
                  <div className={`text-sm ${paymentState.success ? 'text-green-600' : 'text-red-600'}`}>
                    {paymentState.message}
                  </div>
                )}
                <button
                  type="submit"
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700"
                >
                  Solicitar Pagamento
                </button>
            </form>
          </div>
        )}

        {activeTab === 'outros' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Outras Solicitações</h3>
            <p className="text-gray-500 mb-4">Canal para demandas diversas da coordenação.</p>
             <form ref={generalFormRef} action={generalAction} className="space-y-4 max-w-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo de Solicitação</label>
                    <select
                      name="requestType"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                    >
                        <option value="Material">Material</option>
                        <option value="Manutenção">Manutenção</option>
                        <option value="Administrativo">Administrativo</option>
                        <option value="Outros">Outros</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Descrição</label>
                    <textarea
                      name="description"
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black"
                      rows={4}
                      required
                    ></textarea>
                </div>
                {generalState.message && (
                  <div className={`text-sm ${generalState.success ? 'text-green-600' : 'text-red-600'}`}>
                    {generalState.message}
                  </div>
                )}
                <button
                  type="submit"
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700"
                >
                  Enviar Solicitação
                </button>
            </form>
          </div>
        )}
      </div>

      {activeTab === 'falta' && (
        <div className="bg-white shadow rounded-lg p-4 border border-gray-200">
          <h3 className="text-md font-semibold mb-3 text-gray-900">Faltas lançadas</h3>
          {absences.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma falta registrada para este setor.</p>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Servidor</th>
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Data</th>
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Motivo</th>
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Registrou</th>
                    {isAdmin && <th className="px-2 py-1 text-right font-medium text-gray-700">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {absences.map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 py-1 text-gray-900">
                        {findNurseName(item.nurse_id)}
                      </td>
                      <td className="px-2 py-1 text-gray-700">
                        {item.date ? new Date(item.date).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-2 py-1 text-gray-500 truncate max-w-xs" title={item.reason || ''}>
                        {item.reason || '—'}
                      </td>
                      <td className="px-2 py-1 text-gray-700">
                        {findNurseName(item.created_by)}
                      </td>
                      {isAdmin && (
                        <td className="px-2 py-1 text-right">
                          <button
                            onClick={() => handleDeleteAbsence(item.id)}
                            disabled={loadingId === item.id}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1 disabled:opacity-50"
                            title="Excluir falta"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'pagamento' && (
        <div className="bg-white shadow rounded-lg p-4 border border-gray-200">
          <h3 className="text-md font-semibold mb-3 text-gray-900">Pagamentos extras solicitados</h3>
          {paymentRequests.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum pagamento extra lançado para este setor.</p>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Servidor</th>
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Data</th>
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Horas</th>
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Local</th>
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Solicitou</th>
                    {isAdmin && <th className="px-2 py-1 text-right font-medium text-gray-700">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paymentRequests.map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 py-1 text-gray-900">
                        {findNurseName(item.nurse_id)}
                      </td>
                      <td className="px-2 py-1 text-gray-700">
                        {item.shift_date ? new Date(item.shift_date).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-2 py-1 text-gray-700">
                        {item.shift_hours ? `${item.shift_hours}h` : '—'}
                      </td>
                      <td className="px-2 py-1 text-gray-500 truncate max-w-xs" title={item.location || ''}>
                        {item.location || '—'}
                      </td>
                      <td className="px-2 py-1 text-gray-700">
                        {findNurseName(item.coordinator_id || item.nurse_id)}
                      </td>
                      {isAdmin && (
                        <td className="px-2 py-1 text-right">
                          <button
                            onClick={() => handleDeletePayment(item.id)}
                            disabled={loadingId === item.id}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1 disabled:opacity-50"
                            title="Excluir solicitação"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'outros' && (
        <div className="bg-white shadow rounded-lg p-4 border border-gray-200">
          <h3 className="text-md font-semibold mb-3 text-gray-900">Outras solicitações registradas</h3>
          {generalRequests.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhuma outra solicitação registrada.</p>
          ) : (
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Descrição</th>
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Servidor</th>
                    <th className="px-2 py-1 text-left font-medium text-gray-700">Data</th>
                    {isAdmin && <th className="px-2 py-1 text-right font-medium text-gray-700">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {generalRequests.map((item) => (
                    <tr key={item.id}>
                      <td className="px-2 py-1 text-gray-900">
                        {item.content}
                      </td>
                      <td className="px-2 py-1 text-gray-700">
                        {findNurseName(item.nurse_id)}
                      </td>
                      <td className="px-2 py-1 text-gray-700">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      {isAdmin && (
                        <td className="px-2 py-1 text-right">
                          <button
                            onClick={() => handleDeleteGeneral(item.id)}
                            disabled={loadingId === item.id}
                            className="text-gray-400 hover:text-red-600 transition-colors p-1 disabled:opacity-50"
                            title="Excluir solicitação"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
