'use client'

import { useState, useMemo } from 'react'
import { X, Trash2, Calendar, User } from 'lucide-react'
import { assignLeave, deleteTimeOff } from '@/app/actions'

export type LeaveType = 'ferias' | 'licenca_saude' | 'licenca_maternidade' | 'cessao'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  nurses: any[]
  existingLeaves: any[]
  type: LeaveType
  selectedMonth: number
  selectedYear: number
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const TYPE_CONFIG: Record<LeaveType, { title: string, color: string, bg: string, border: string }> = {
  'ferias': { title: 'Gerenciar Férias', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  'licenca_saude': { title: 'Licença Saúde', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  'licenca_maternidade': { title: 'Licença Maternidade', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  'cessao': { title: 'Cessão', color: 'text-cyan-600', bg: 'bg-cyan-50', border: 'border-cyan-200' }
}

export default function LeaveManagerModal({ isOpen, onClose, onSuccess, nurses, existingLeaves = [], type, selectedMonth, selectedYear }: Props) {
  const [loading, setLoading] = useState(false)
  const config = TYPE_CONFIG[type]

  // Filter leaves for this type
  const currentLeaves = useMemo(() => {
    return existingLeaves
      .filter(l => l.type === type)
      .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())
  }, [existingLeaves, type])

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    try {
        formData.append('type', type)
        
        // Calculate start and end date based on selected month/year
        // selectedMonth is 0-indexed (0 = Jan)
        const start = new Date(selectedYear, selectedMonth, 1)
        const end = new Date(selectedYear, selectedMonth + 1, 0) // Last day of month
        
        // Format as YYYY-MM-DD (handling local time offset by using explicit components)
        // Actually, for dates like YYYY-MM-DD, we should be careful with timezones.
        // A simple string construction is safer to avoid UTC shifting issues.
        
        const pad = (n: number) => n.toString().padStart(2, '0')
        const startStr = `${selectedYear}-${pad(selectedMonth + 1)}-01`
        
        // Get last day
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate()
        const endStr = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(lastDay)}`
        
        formData.append('startDate', startStr)
        formData.append('endDate', endStr)

        const res = await assignLeave(null, formData)
        if (res.success) {
            alert('Cadastrado com sucesso!')
            // Reset form? The parent re-renders, so fields might persist if not handled. 
            // Ideally we just call onSuccess which refreshes data.
            onSuccess()
        } else {
            alert(res.message)
        }
    } catch (error) {
        console.error(error)
        alert('Erro ao cadastrar')
    } finally {
        setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja remover este registro?')) return
    setLoading(true)
    try {
        const res = await deleteTimeOff(id)
        if (res.success) {
            onSuccess() // Refresh list
        } else {
            alert(res.message)
        }
    } catch (error) {
        console.error(error)
        alert('Erro ao remover')
    } finally {
        setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className={`flex justify-between items-center p-4 border-b ${config.bg}`}>
          <h2 className={`text-lg font-bold ${config.color}`}>{config.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 grid md:grid-cols-2 gap-6">
            {/* Form Side */}
            <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <PlusIcon /> Novo Registro
                </h3>
                <form action={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Profissional</label>
                        <select 
                        name="nurseId" 
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white text-black text-sm"
                        >
                        <option value="">Selecione...</option>
                        {nurses.map(nurse => (
                            <option key={nurse.id} value={nurse.id}>{nurse.name}</option>
                        ))}
                        </select>
                    </div>

                    <div className="bg-white p-3 rounded border border-gray-200">
                        <p className="text-sm text-gray-600">
                            Registrando para: <span className="font-bold text-gray-900">{MONTHS[selectedMonth]} de {selectedYear}</span>
                        </p>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${config.bg.replace('bg-', 'bg-').replace('50', '600')} hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2`}
                        style={{ backgroundColor: getTypeColor(type) }}
                    >
                        {loading ? 'Salvando...' : 'Salvar Registro'}
                    </button>
                </form>
            </div>

            {/* List Side */}
            <div className="border-l pl-0 md:pl-6 border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <ListIcon /> Registros Ativos ({currentLeaves.length})
                </h3>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {currentLeaves.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">Nenhum registro encontrado.</p>
                    ) : (
                        currentLeaves.map(leave => {
                            const nurse = nurses.find(n => n.id === leave.nurse_id)
                            return (
                                <div key={leave.id} className="flex justify-between items-start p-2 bg-white border border-gray-200 rounded hover:bg-gray-50 text-sm">
                                    <div>
                                        <p className="font-bold text-gray-800">{nurse?.name || 'Profissional Removido'}</p>
                                        <p className="text-gray-500 text-xs">
                                            {formatDate(leave.start_date)} até {formatDate(leave.end_date)}
                                        </p>
                                    </div>
                                    <button 
                                        onClick={() => handleDelete(leave.id)}
                                        className="text-red-500 hover:text-red-700 p-1"
                                        title="Excluir"
                                        disabled={loading}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            )
                        })
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}

function getTypeColor(type: LeaveType) {
    switch(type) {
        case 'ferias': return '#ea580c' // orange-600
        case 'licenca_saude': return '#dc2626' // red-600
        case 'licenca_maternidade': return '#2563eb' // blue-600
        case 'cessao': return '#0891b2' // cyan-600
        default: return '#4b5563'
    }
}

function formatDate(dateStr: string) {
    if (!dateStr) return ''
    const [y, m, d] = dateStr.split('-')
    return `${d}/${m}/${y}`
}

function PlusIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
    )
}

function ListIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
    )
}
