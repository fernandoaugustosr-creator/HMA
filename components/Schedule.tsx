'use client'

import { useEffect, useState } from 'react'
import { getMonthlyScheduleData, deleteNurse, reassignNurse } from '@/app/actions'
import { Trash2, Plus } from 'lucide-react'
import NurseCreationModal from './NurseCreationModal'
import VacationManagerModal from './VacationManagerModal'

interface Nurse {
  id: string
  name: string
  coren: string
  role: string
  vinculo: string
}

interface Shift {
  id: string
  nurse_id: string
  shift_date: string
  shift_type: 'day' | 'night'
}

interface TimeOff {
  id: string
  nurse_id: string
  start_date: string
  end_date: string
  type: string
}

interface ScheduleData {
  nurses: Nurse[]
  shifts: Shift[]
  timeOffs: TimeOff[]
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const YEARS = [2024, 2025, 2026, 2027]

export default function Schedule() {
  const [currentDate] = useState(new Date())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth())
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [data, setData] = useState<ScheduleData>({ nurses: [], shifts: [], timeOffs: [] })
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isVacationModalOpen, setIsVacationModalOpen] = useState(false)
  const [modalRole, setModalRole] = useState('ENFERMEIRO')

  useEffect(() => {
    fetchData()
  }, [selectedMonth, selectedYear])

  async function fetchData() {
    setLoading(true)
    try {
      // Month is 0-indexed for Date, but action expects 1-indexed (1-12)
      const result = await getMonthlyScheduleData(selectedMonth + 1, selectedYear)
      setData(result as ScheduleData)
    } catch (error) {
      console.error('Error fetching schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja remover este servidor? Isso apagará o cadastro e os dados associados.')) return
    setLoading(true)
    const res = await deleteNurse(id)
    if (!res.success) alert(res.message)
    await fetchData()
  }

  async function handleReassign(oldId: string, newId: string) {
    if (oldId === newId) return
    if (!confirm('Tem certeza que deseja transferir os dados para outro servidor?')) return
    setLoading(true)
    const res = await reassignNurse(oldId, newId)
    if (!res.success) alert(res.message)
    await fetchData()
  }

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(selectedYear, selectedMonth, i + 1)
    return {
      day: i + 1,
      weekday: date.toLocaleDateString('pt-BR', { weekday: 'narrow' }).toUpperCase()
    }
  })

  // Filter nurses by role
  const nurses = data.nurses.filter(n => !n.role || n.role.toUpperCase() === 'ENFERMEIRO' || n.role.toUpperCase() === 'ENFERMEIRA')
  const technicians = data.nurses.filter(n => n.role && (n.role.toUpperCase() === 'TECNICO' || n.role.toUpperCase() === 'TÉCNICO'))

  const openModal = (role: string) => {
    setModalRole(role)
    setIsModalOpen(true)
  }

  const renderGrid = (professionals: Nurse[], roleType: string) => {
    return (
      <>
        {professionals.map((nurse, index) => (
          <tr key={nurse.id} className="hover:bg-gray-50">
            <td className="border border-gray-400 px-1 py-1 text-center text-xs font-medium sticky left-0 bg-white z-10 w-8">{index + 1}</td>
            <td className="border border-gray-400 px-2 py-1 text-xs whitespace-nowrap font-medium text-black sticky left-8 bg-white z-10 min-w-[200px] border-r-2 border-r-gray-300">
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handleDelete(nurse.id)} 
                  className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50 transition-colors"
                  title="Apagar linha"
                >
                  <Trash2 size={14} />
                </button>
                <select 
                  value={nurse.id} 
                  onChange={(e) => handleReassign(nurse.id, e.target.value)}
                  className="w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-medium text-black cursor-pointer outline-none"
                >
                  {data.nurses.map(n => (
                    <option key={n.id} value={n.id}>{n.name}</option>
                  ))}
                </select>
              </div>
            </td>
            <td className="border border-gray-400 px-1 py-1 text-center text-[10px]">{nurse.coren || '-'}</td>
            <td className="border border-gray-400 px-1 py-1 text-center text-[10px]">{nurse.vinculo || '-'}</td>
            <td className="border border-gray-400 px-1 py-1 text-center text-[10px]"></td>
            
            {daysArray.map(({ day }) => {
              const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              
              // Find time off
              const timeOff = data.timeOffs.find(t => 
                t.nurse_id === nurse.id && 
                t.start_date <= dateStr && 
                t.end_date >= dateStr
              )

              // Find shift
              const shift = data.shifts.find(s => 
                s.nurse_id === nurse.id && 
                s.shift_date === dateStr
              )

              let cellClass = "border border-gray-400 px-0 py-0 h-6 w-6 text-center text-[10px] relative text-black"
              let content = null

              if (timeOff) {
                if (timeOff.type === 'ferias') cellClass += " bg-yellow-400"
                else if (timeOff.type === 'licenca_saude') cellClass += " bg-red-400"
                else if (timeOff.type === 'licenca_maternidade') cellClass += " bg-blue-400"
                else if (timeOff.type === 'cessao') cellClass += " bg-cyan-400"
                else cellClass += " bg-gray-200" // Default folga
              } else if (shift) {
                 content = shift.shift_type === 'day' ? 'D' : 'N'
              }
              
              // Highlight weekends
              const date = new Date(selectedYear, selectedMonth, day)
              const isWeekend = date.getDay() === 0 || date.getDay() === 6
              if (isWeekend && !timeOff) {
                cellClass += " bg-gray-100"
              }

              return (
                <td key={day} className={cellClass}>
                  {content}
                </td>
              )
            })}
            <td className="border border-gray-400 px-1 py-1 text-center text-xs">0</td>
          </tr>
        ))}
        {/* Add Professional Row Placeholder */}
        <tr>
          <td className="border border-gray-400 px-1 py-1 sticky left-0 bg-white z-10"></td>
          <td className="border border-gray-400 px-2 py-1 sticky left-8 bg-white z-10 border-r-2 border-r-gray-300">
             <button 
                onClick={() => openModal(roleType)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 italic w-full text-left"
             >
                <Plus size={14} />
                Adicionar novo...
             </button>
          </td>
          <td colSpan={3 + daysInMonth + 1} className="border border-gray-400 px-2 py-1 bg-gray-50"></td>
        </tr>
      </>
    )
  }

  return (
    <div className="w-full bg-white p-2 md:p-4">
      {/* Header Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-start md:items-end no-print">
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-black mb-1">Setor</label>
          <select className="border border-gray-300 rounded px-3 py-2 text-sm w-full md:w-48 bg-white text-black">
            <option>POSTO 1</option>
            <option>POSTO 2</option>
          </select>
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-black mb-1">Mês</label>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-full md:w-40 bg-white text-black"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
        </div>
        <div className="w-full md:w-auto">
          <label className="block text-sm font-medium text-black mb-1">Ano</label>
          <select 
            value={selectedYear} 
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-full md:w-32 bg-white text-black"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button 
          onClick={handlePrint}
          className="w-full md:w-auto md:ml-auto bg-blue-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2 text-sm hover:bg-blue-600 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Imprimir
        </button>
      </div>

      {/* Report Header */}
      <div className="mb-4">
        <div className="flex flex-col md:flex-row justify-between items-start mb-2 gap-2">
          <h1 className="text-xl font-bold text-blue-600">HMA</h1>
          <div className="text-left md:text-right">
            <h2 className="text-lg font-bold text-green-700">AÇAILÂNDIA</h2>
            <p className="text-xs text-gray-500 uppercase">Prefeitura Municipal</p>
          </div>
        </div>
        <p className="text-sm text-gray-500 mb-4">HOSPITAL MUNICIPAL DE AÇAILÂNDIA</p>
        
        <div className="bg-gray-200 border border-gray-400 p-2 text-center">
          <h3 className="font-bold text-sm uppercase text-black">POSTO 1</h3>
          <h4 className="font-bold text-sm uppercase text-black">ESCALA DE ENFERMEIROS E TÉCNICOS - {selectedMonth + 1}/{selectedYear}</h4>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border border-gray-300 rounded shadow-sm max-w-full relative">
        <table className="min-w-[1200px] w-full border-collapse border border-gray-400 text-black">
          <thead>
            {/* Main Headers */}
            <tr className="bg-gray-100 text-black">
              <th className="border border-gray-400 px-2 py-1 text-left text-xs w-8 sticky left-0 bg-gray-100 z-20">#</th>
              <th className="border border-gray-400 px-2 py-1 text-left text-xs min-w-[200px] sticky left-8 bg-gray-100 z-20 border-r-2 border-r-gray-300">ENFERMEIROS</th>
              <th className="border border-gray-400 px-2 py-1 text-center text-xs w-20"></th>
              <th className="border border-gray-400 px-2 py-1 text-center text-xs w-24">COREN</th>
              <th className="border border-gray-400 px-2 py-1 text-center text-xs w-24">VINCULO</th>
              <th className="border border-gray-400 px-2 py-1 text-center text-xs w-32">OBSERVAÇÕES</th>
              {daysArray.map(({ day, weekday }) => (
                <th key={day} className={`border border-gray-400 px-0 py-1 text-center text-[10px] w-6 ${['S', 'D'].includes(weekday) ? 'bg-gray-200' : ''}`}>
                  {weekday}
                </th>
              ))}
              <th className="border border-gray-400 px-1 py-1 text-center text-xs w-12">TOTAL</th>
            </tr>
            {/* Days Numbers */}
            <tr className="bg-gray-100 text-black">
              <th className="border border-gray-400 px-2 py-1 text-right text-[10px] sticky left-0 bg-gray-100 z-20"></th>
              <th className="border border-gray-400 px-2 py-1 text-right text-[10px] sticky left-8 bg-gray-100 z-20 border-r-2 border-r-gray-300">DIAS DO MÊS →</th>
              <th colSpan={4} className="border border-gray-400 px-2 py-1"></th>
              {daysArray.map(({ day }) => (
                <th key={day} className="border border-gray-400 px-0 py-1 text-center text-[10px]">
                  {day}
                </th>
              ))}
              <th className="border border-gray-400"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={100} className="text-center py-4">Carregando...</td></tr>
            ) : (
              <>
                {renderGrid(nurses, 'ENFERMEIRO')}
                
                {/* Section Separator */}
                <tr className="bg-gray-100 text-black">
                  <td className="border border-gray-400 px-1 py-1 text-center text-xs font-medium sticky left-0 bg-gray-100 z-20">#</td>
                  <td className="border border-gray-400 px-2 py-1 text-left text-xs font-bold sticky left-8 bg-gray-100 z-20 border-r-2 border-r-gray-300 flex justify-between items-center group">
                    <span>TÉCNICOS DE ENFERMAGEM</span>
                    <button 
                      className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" 
                      title="Excluir subgrupo (Apenas visual)"
                      onClick={() => alert('Para excluir o subgrupo, remova todos os técnicos associados.')}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                  <td colSpan={4} className="border border-gray-400 px-1 py-1"></td>
                  {daysArray.map(({ day, weekday }) => (
                    <td key={day} className={`border border-gray-400 px-0 py-1 text-center text-[10px] ${['S', 'D'].includes(weekday) ? 'bg-gray-200' : ''}`}>
                      {weekday}
                    </td>
                  ))}
                  <td className="border border-gray-400 px-1 py-1 text-center text-xs font-medium">TOTAL</td>
                </tr>
                 <tr className="bg-gray-100 text-black">
                  <td className="border border-gray-400 px-2 py-1 sticky left-0 bg-gray-100 z-20"></td>
                  <td className="border border-gray-400 px-2 py-1 text-right text-[10px] sticky left-8 bg-gray-100 z-20 border-r-2 border-r-gray-300">DIAS DO MÊS →</td>
                  <td colSpan={4} className="border border-gray-400"></td>
                  {daysArray.map(({ day }) => (
                    <td key={day} className="border border-gray-400 px-0 py-1 text-center text-[10px]">
                      {day}
                    </td>
                  ))}
                  <td className="border border-gray-400"></td>
                </tr>

                {renderGrid(technicians, 'TECNICO')}
              </>
            )}
          </tbody>
        </table>
      </div>
      
      <NurseCreationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
            fetchData()
            setIsModalOpen(false)
        }}
        defaultRole={modalRole}
      />

      <VacationManagerModal
        isOpen={isVacationModalOpen}
        onClose={() => setIsVacationModalOpen(false)}
        onSuccess={() => {
            fetchData()
            setIsVacationModalOpen(false)
        }}
        nurses={data.nurses}
      />

      {/* Footer / Actions */}
      <div className="mt-4 flex justify-end gap-2 no-print">
        <button className="px-3 py-1 border border-blue-500 text-blue-500 text-xs rounded hover:bg-blue-50">
          + Nova Categoria
        </button>
      </div>

      {/* Footer Legends */}
      <div className="mt-8 space-y-2">
        <div className="flex flex-wrap gap-2 justify-end mb-2 no-print">
            <button className="px-2 py-1 text-xs border rounded text-black border-gray-300 hover:bg-gray-50">Editar texto do rodapé</button>
            <button 
              onClick={() => setIsVacationModalOpen(true)}
              className="px-2 py-1 text-xs border rounded text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100"
            >
              Gerenciar Férias
            </button>
            <button className="px-2 py-1 text-xs border rounded text-red-600 border-red-200 bg-red-50">Licença Saúde</button>
            <button className="px-2 py-1 text-xs border rounded text-blue-600 border-blue-200 bg-blue-50">Licença Maternidade</button>
            <button className="px-2 py-1 text-xs border rounded text-cyan-600 border-cyan-200 bg-cyan-50">Cessão</button>
        </div>

        {/* Dynamic Legend List - Shows who is on leave */}
        {['ferias', 'licenca_saude', 'licenca_maternidade', 'cessao'].map(type => {
            const label = type === 'ferias' ? 'FÉRIAS' : 
                         type === 'licenca_saude' ? 'LICENÇA SAÚDE' :
                         type === 'licenca_maternidade' ? 'LICENÇA MATERNIDADE' : 'CESSÃO'
            
            const colorClass = type === 'ferias' ? 'bg-yellow-500' : 
                              type === 'licenca_saude' ? 'bg-red-500' :
                              type === 'licenca_maternidade' ? 'bg-blue-500' : 'bg-cyan-500'
            
            // Find nurses with this leave type in this month
            const activeLeaves = data.timeOffs
                .filter(t => t.type === type)
                .map(t => {
                    const nurse = data.nurses.find(n => n.id === t.nurse_id)
                    return nurse ? nurse.name : ''
                })
                .filter(Boolean)
                .join(', ')
            
            if (!activeLeaves) return null

            return (
                <div key={type} className={`${colorClass} text-white px-2 py-1 text-xs font-bold uppercase flex items-center`}>
                    <span className="mr-2 whitespace-nowrap">{label}:</span>
                    <span className="font-normal truncate">{activeLeaves}</span>
                </div>
            )
        })}
      </div>
      
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            -webkit-print-color-adjust: exact;
          }
          /* Ensure sticky columns don't mess up print */
          th, td {
            position: static !important;
          }
        }
      `}</style>
    </div>
  )
}
