'use client'

import React, { useEffect, useState } from 'react'
import { getMonthlyScheduleData, deleteNurse, reassignNurse, assignNurseToSection, addSection, updateSection, deleteSection, saveShifts, Section, Unit } from '@/app/actions'
import { addUnit } from '@/app/unit-actions'
import { Trash2, Plus, Pencil, Save, X, Check } from 'lucide-react'
import NurseCreationModal from './NurseCreationModal'
import LeaveManagerModal, { LeaveType } from './LeaveManagerModal'

interface Nurse {
  id: string
  name: string
  coren: string
  role: string
  vinculo: string
  section_id?: string
  unit_id?: string
}

interface Shift {
  id: string
  nurse_id: string
  shift_date: string
  shift_type: 'day' | 'night' | 'morning' | 'afternoon'
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
  sections: Section[]
  units: Unit[]
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
  const [data, setData] = useState<ScheduleData>({ nurses: [], shifts: [], timeOffs: [], sections: [], units: [] })
  const [loading, setLoading] = useState(true)
  const [selectedUnitId, setSelectedUnitId] = useState<string>('')
  const [leaveModalType, setLeaveModalType] = useState<LeaveType | null>(null)
  
  // Section Management State
  const [isAddingSection, setIsAddingSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingSectionTitle, setEditingSectionTitle] = useState('')
  
  // Unit Management State
  const [isAddingUnit, setIsAddingUnit] = useState(false)
  const [newUnitTitle, setNewUnitTitle] = useState('')

  // Shift Management State
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
  const [shiftModalData, setShiftModalData] = useState<{nurseId: string, nurseName: string, date: string} | null>(null)
  const [shiftType, setShiftType] = useState<'day' | 'night' | 'morning' | 'afternoon' | 'delete'>('day')
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | '12x36' | '24x72' | 'every3'>('none')

  useEffect(() => {
    fetchData()
  }, [selectedMonth, selectedYear])

  async function fetchData() {
    setLoading(true)
    try {
      // Month is 0-indexed for Date, but action expects 1-indexed (1-12)
      const result = await getMonthlyScheduleData(selectedMonth + 1, selectedYear)
      setData(result as ScheduleData)
      
      // Set default unit if none selected and units exist
      if (!selectedUnitId && result.units && result.units.length > 0) {
        setSelectedUnitId(result.units[0].id)
      }
    } catch (error) {
      console.error('Error fetching schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUnitChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    if (value === 'new_unit_action') {
      setIsAddingUnit(true)
    } else {
      setSelectedUnitId(value)
    }
  }

  const saveNewUnit = async () => {
    if (!newUnitTitle.trim()) return
    setLoading(true)
    try {
        const res = await addUnit(newUnitTitle)
        if (res.success) {
            setNewUnitTitle('')
            setIsAddingUnit(false)
            await fetchData()
            // Try to set the new unit as selected? 
            // Since we don't get the ID back easily without fetching, we rely on user selecting it or auto-select logic.
            // But we can rely on user selecting it from the list after reload.
        } else {
            alert('Erro ao adicionar setor')
        }
    } catch (error) {
        console.error(error)
        alert('Erro inesperado')
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

  // Section Handlers
  const saveNewSection = async () => {
    if (!newSectionTitle.trim()) return
    setLoading(true)
    try {
        const res = await addSection(newSectionTitle)
        if (!res.success) {
            alert(res.message || 'Erro ao criar bloco')
        } else {
            setNewSectionTitle('')
            setIsAddingSection(false)
            await fetchData()
        }
    } catch (error) {
        console.error(error)
        alert('Erro inesperado ao criar bloco')
    } finally {
        setLoading(false)
    }
  }

  const handleDeleteSection = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este bloco? Os profissionais associados não serão excluídos, mas ficarão sem bloco.')) return
    setLoading(true)
    await deleteSection(id)
    await fetchData()
  }

  const startEditingSection = (section: Section) => {
    setEditingSectionId(section.id)
    setEditingSectionTitle(section.title)
  }

  const saveSectionTitle = async () => {
    if (!editingSectionId) return
    setLoading(true)
    await updateSection(editingSectionId, editingSectionTitle)
    setEditingSectionId(null)
    await fetchData()
  }

  const handleAssignNurse = async (nurseId: string, sectionId: string) => {
    if (!nurseId) return
    setLoading(true)
    try {
        const res = await assignNurseToSection(nurseId, sectionId, selectedUnitId)
        if (res.success) {
            await fetchData()
        } else {
            alert('Erro ao adicionar: ' + res.message)
        }
    } catch (error) {
        console.error(error)
        alert('Erro ao adicionar')
    } finally {
        setLoading(false)
    }
  }

  const handleCellClick = (nurse: Nurse, dateStr: string) => {
    setShiftModalData({
        nurseId: nurse.id,
        nurseName: nurse.name,
        date: dateStr
    })
    setShiftType('day')
    setRecurrence('none')
    setIsShiftModalOpen(true)
  }

  const handleSaveShifts = async () => {
    if (!shiftModalData) return
    setLoading(true)
    
    try {
        const shiftsToSave: { nurseId: string, date: string, type: string }[] = []
        const startDate = new Date(shiftModalData.date + 'T12:00:00') // Avoid timezone issues
        const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
        const endOfMonthDate = new Date(selectedYear, selectedMonth, lastDayOfMonth) // Local time
        
        // Calculate dates based on recurrence
        let currentDateIter = new Date(startDate)
        
        while (currentDateIter.getMonth() === selectedMonth && currentDateIter.getFullYear() === selectedYear) {
             const dateString = `${currentDateIter.getFullYear()}-${String(currentDateIter.getMonth() + 1).padStart(2, '0')}-${String(currentDateIter.getDate()).padStart(2, '0')}`
             
             shiftsToSave.push({
                 nurseId: shiftModalData.nurseId,
                 date: dateString,
                 type: shiftType === 'delete' ? 'DELETE' : shiftType
             })

             if (recurrence === 'none') break
             
             // Increment based on recurrence
             if (recurrence === 'daily') {
                 currentDateIter.setDate(currentDateIter.getDate() + 1)
             } else if (recurrence === '12x36') {
                 currentDateIter.setDate(currentDateIter.getDate() + 2)
             } else if (recurrence === 'every3') {
                 currentDateIter.setDate(currentDateIter.getDate() + 3)
             } else if (recurrence === '24x72') {
                 currentDateIter.setDate(currentDateIter.getDate() + 4)
             }
        }

        const res = await saveShifts(shiftsToSave)

        if (!res.success) {
            alert('Erro ao salvar: ' + (res.message || 'Erro desconhecido'))
            return
        }

        setIsShiftModalOpen(false)
        await fetchData()

    } catch (error) {
        console.error("Error saving shifts:", error)
        alert('Erro ao salvar turno. Verifique o console.')
    } finally {
        setLoading(false)
    }
  }

  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(selectedYear, selectedMonth, i + 1)
    return {
      day: i + 1,
      weekday: date.toLocaleDateString('pt-BR', { weekday: 'narrow' }).toUpperCase(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    }
  })

  const renderGrid = (professionals: Nurse[], section: Section) => {
    return (
      <>
        {professionals.map((nurse, index) => {
          // Calculate Total Shifts
          const totalShifts = data.shifts.filter(s => 
            s.nurse_id === nurse.id && 
            s.shift_date.startsWith(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`)
          ).length

          return (
            <tr key={nurse.id} className="hover:bg-gray-50">
              <td className="border border-black px-1 py-1 text-center text-xs font-medium sticky left-0 bg-white z-10 w-8">{index + 1}</td>
              <td className="border border-black px-2 py-1 text-xs whitespace-nowrap font-medium text-black sticky left-8 bg-white z-10 min-w-[250px] border-r-2 border-r-black">
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleDelete(nurse.id)} 
                    className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50 transition-colors no-print"
                    title="Apagar linha"
                  >
                    <Trash2 size={12} />
                  </button>
                  <select 
                    value={nurse.id} 
                    onChange={(e) => handleReassign(nurse.id, e.target.value)}
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-bold text-black cursor-pointer outline-none uppercase"
                  >
                    {data.nurses.map(n => (
                      <option key={n.id} value={n.id}>{n.name}</option>
                    ))}
                  </select>
                </div>
              </td>
              <td className="border border-black px-1 py-1 text-center text-[10px] uppercase">{nurse.coren || '-'}</td>
              <td className="border border-black px-1 py-1 text-center text-[10px] uppercase">{nurse.vinculo || '-'}</td>
              <td className="border border-black px-1 py-1 text-center text-[10px] uppercase"></td>
              
              {daysArray.map(({ day, weekday, isWeekend }) => {
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

                let cellClass = "border border-black px-0 py-0 h-5 w-6 text-center text-[10px] relative text-black font-bold"
                let content = null

                if (timeOff) {
                  if (timeOff.type === 'ferias') {
                       cellClass += " bg-gray-50"
                  }
                  else if (timeOff.type === 'licenca_saude') {
                      cellClass += " bg-green-500 text-white" 
                      content = "LS"
                  }
                  else if (timeOff.type === 'licenca_maternidade') cellClass += " bg-blue-400"
                  else if (timeOff.type === 'cessao') cellClass += " bg-cyan-400"
                  else cellClass += " bg-gray-200" 
                } else if (shift) {
                   if (shift.shift_type === 'day') content = 'D'
                   else if (shift.shift_type === 'night') content = 'N'
                   else if (shift.shift_type === 'morning') content = 'M'
                   else if (shift.shift_type === 'afternoon') content = 'T'
                }
                
                // Highlight weekends (Gray background for entire column, overridden by specific statuses if needed, but image shows gray prevails or mixes)
                // In image, weekend cells are gray. If there is a shift, it's just text on gray.
                if (isWeekend) {
                   if (!timeOff) {
                       cellClass += " bg-gray-400"
                   } else if (timeOff.type === 'ferias') {
                       // Keep gray for weekends even in vacation? Usually vacation overrides.
                       // But user said "OS FINAIS DE SEMANS FICARA COM A COR CINZA MAIS ESCULRA".
                       // I'll prioritize weekend gray unless it's a special colored leave like Health License.
                   }
                }

                return (
                  <td 
                    key={day} 
                    className={`${cellClass} cursor-pointer hover:bg-yellow-100 transition-colors`}
                    onClick={() => handleCellClick(nurse, dateStr)}
                    title="Clique para gerenciar plantão"
                  >
                    {content}
                  </td>
                )
              })}
              <td className="border border-black px-1 py-1 text-center text-xs font-bold">{totalShifts}</td>
            </tr>
          )
        })}
        {/* Add Professional Row Placeholder */}
        <tr className="no-print">
          <td className="border border-black px-1 py-1 sticky left-0 bg-white z-10"></td>
          <td className="border border-black px-2 py-1 sticky left-8 bg-white z-10 border-r-2 border-r-black">
             <select 
                onChange={(e) => handleAssignNurse(e.target.value, section.id)}
                className="flex items-center gap-1 text-xs text-blue-600 italic w-full bg-transparent border-none outline-none cursor-pointer hover:text-blue-800"
                value=""
             >
                <option value="" disabled>+ Adicionar Profissional...</option>
                {data.nurses
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(nurse => {
                        const isInCurrentContext = nurse.section_id === section.id && (!selectedUnitId || nurse.unit_id === selectedUnitId);
                        
                        // Find location info
                        const nurseSection = data.sections.find(s => s.id === nurse.section_id)?.title
                        const nurseUnit = data.units.find(u => u.id === nurse.unit_id)?.title

                        let label = `${nurse.name} ${nurse.coren ? `(${nurse.coren})` : ''}`
                        
                        if (isInCurrentContext) {
                            label += ' (Já nesta lista)'
                        } else {
                            if (nurseSection) label += ` - ${nurseSection}`
                            if (nurseUnit) label += ` (${nurseUnit})`
                        }
                        
                        return (
                            <option 
                                key={nurse.id} 
                                value={nurse.id} 
                                className="text-black not-italic"
                                disabled={isInCurrentContext}
                            >
                                {label}
                            </option>
                        )
                    })
                }
             </select>
          </td>
          <td className="border border-black px-1 py-1"></td>
          <td className="border border-black px-1 py-1"></td>
          <td className="border border-black px-1 py-1"></td>
          {daysArray.map(({ day, isWeekend }) => (
            <td 
              key={`placeholder-${day}`} 
              className={`border border-black px-0 py-0 ${isWeekend ? 'bg-gray-400' : ''}`}
            ></td>
          ))}
          <td className="border border-black px-1 py-1"></td>
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
          <select 
            value={selectedUnitId} 
            onChange={handleUnitChange}
            className="border border-gray-300 rounded px-3 py-2 text-sm w-full md:w-48 bg-white text-black"
          >
            <option value="">Selecione um setor...</option>
            {data.units.map(unit => (
              <option key={unit.id} value={unit.id}>{unit.title}</option>
            ))}
            <option disabled>──────────</option>
            <option value="new_unit_action">+ Adicionar novo setor...</option>
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
        {!loading && (
          <button 
            onClick={handlePrint}
            className="w-full md:w-auto md:ml-auto bg-blue-500 text-white px-4 py-2 rounded flex items-center justify-center gap-2 text-sm hover:bg-blue-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
            Imprimir
          </button>
        )}
      </div>

      {/* Report Header */}
      <div className="mb-4">
        {/* Logos Header */}
        <div className="flex justify-between items-center mb-4 border-b pb-2">
            <div className="flex flex-col items-start">
                {/* HMA Logo Placeholder */}
                <div className="flex items-center gap-2">
                    <div className="bg-blue-900 text-white p-2 rounded font-bold text-2xl flex items-center justify-center h-12 w-12">
                        <Plus size={32} />
                    </div>
                    <div className="flex flex-col">
                         <h1 className="text-3xl font-black text-blue-900 leading-none">HMA</h1>
                         <span className="text-[10px] text-blue-900 font-bold tracking-wider">HOSPITAL MUNICIPAL DE AÇAILÂNDIA</span>
                    </div>
                </div>
            </div>
            
            <div className="flex flex-col items-end">
                {/* City Hall Logo Placeholder */}
                <div className="flex items-center gap-2">
                    <div className="flex flex-col items-end">
                        <h2 className="text-xl font-bold text-blue-800">AÇAILÂNDIA</h2>
                        <p className="text-[10px] text-yellow-600 font-bold uppercase tracking-widest">CIDADE ACOLHEDORA, CIDADE FORTE</p>
                    </div>
                     {/* Replace with actual logo image if available */}
                     <div className="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-blue-800 font-bold text-xs border-2 border-green-600">
                        PREF
                    </div>
                </div>
            </div>
        </div>
        
        <div className="bg-gray-200 border border-black p-1 text-center mb-1">
          <h3 className="font-bold text-lg uppercase text-black">
            {data.units.find(u => u.id === selectedUnitId)?.title || 'OBSERVAÇÃO - INTERNAÇÃO PRONTO-SOCORRO'}
          </h3>
        </div>
        <div className="bg-gray-200 border border-black p-1 text-center">
           <h4 className="font-bold text-md uppercase text-black">{MONTHS[selectedMonth].toUpperCase()} {selectedYear}</h4>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border-none shadow-none max-w-full relative">
        {loading ? (
             <div className="text-center py-4">Carregando...</div>
        ) : (
             <>
             {data.sections.map(section => (
                 <div key={section.id} className="mb-8 border border-black">
                     <table className="min-w-[1200px] w-full border-collapse border border-black text-black text-[11px]">
                         <thead>
                            {/* Main Headers Row 1 */}
                            <tr className="bg-blue-100 text-black">
                                <th className="border border-black px-1 py-1 text-center w-8 sticky left-0 bg-blue-100 z-20 font-bold" rowSpan={2}>#</th>
                                <th className="border border-black px-1 py-1 text-center min-w-[250px] sticky left-8 bg-blue-100 z-20 border-r-2 border-r-black font-bold uppercase text-sm group" rowSpan={2}>
                                     {editingSectionId === section.id ? (
                                        <div className="flex items-center gap-1 w-full justify-center">
                                            <input 
                                                value={editingSectionTitle}
                                                onChange={e => setEditingSectionTitle(e.target.value)}
                                                className="text-xs border rounded px-1 py-0.5 w-full bg-white text-black"
                                                autoFocus
                                            />
                                            <button onClick={saveSectionTitle} className="text-green-600 p-1 hover:bg-gray-200 rounded"><Save size={14} /></button>
                                            <button onClick={() => setEditingSectionId(null)} className="text-red-600 p-1 hover:bg-gray-200 rounded"><X size={14} /></button>
                                        </div>
                                    ) : (
                                        <div className="flex justify-between items-center w-full">
                                            <span className="flex-1 text-center">{section.title}</span>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                                                <button 
                                                    onClick={() => startEditingSection(section)} 
                                                    className="text-blue-500 hover:text-blue-700 p-1 rounded hover:bg-gray-200"
                                                    title="Editar nome do bloco"
                                                >
                                                    <Pencil size={12} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteSection(section.id)} 
                                                    className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-gray-200"
                                                    title="Excluir bloco"
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </th>
                                <th className="border border-black px-1 py-1 text-center w-24 font-bold" rowSpan={2}>COREN</th>
                                <th className="border border-black px-1 py-1 text-center w-24 font-bold" rowSpan={2}>VÍNCULO</th>
                                <th className="border border-black px-1 py-1 text-center w-24 font-bold">D. SEMANA</th>
                                {daysArray.map(({ day, weekday, isWeekend }) => (
                                    <th key={`wd-${day}`} className={`border border-black px-0 py-0 text-center w-6 ${isWeekend ? 'bg-gray-400' : ''}`}>
                                    {weekday}
                                    </th>
                                ))}
                                <th className="border border-black px-1 py-1 text-center w-16 font-bold">TOTAL</th>
                            </tr>
                            {/* Main Headers Row 2 */}
                            <tr className="bg-blue-100 text-black">
                                <th className="border border-black px-1 py-1 text-center font-bold uppercase">OBSERVAÇÃO</th>
                                {daysArray.map(({ day, isWeekend }) => (
                                    <th key={`d-${day}`} className={`border border-black px-0 py-0 text-center ${isWeekend ? 'bg-gray-400' : ''}`}>
                                    {day}
                                    </th>
                                ))}
                                <th className="border border-black px-1 py-1 text-center font-bold">PLANTÃO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {renderGrid(data.nurses.filter(n => n.section_id === section.id && (!selectedUnitId || n.unit_id === selectedUnitId)), section)}
                        </tbody>
                    </table>
                 </div>
             ))}
             </>
        )}
      </div>
      
      {/* Signatures Footer */}
      <div className="mt-8 mb-4 grid grid-cols-2 gap-8 text-center break-inside-avoid">
        <div className="flex flex-col items-center">
            <div className="w-64 border-b border-black mb-2"></div>
            <p className="font-bold text-sm text-black">COORDENADOR(A) DE ENFERMAGEM</p>
        </div>
        <div className="flex flex-col items-center">
            <div className="w-64 border-b border-black mb-2"></div>
            <p className="font-bold text-sm text-black">DIRETOR(A) ADMINISTRATIVO(A)</p>
        </div>
      </div>

      {/* Static Legend */}
      <div className="mt-4 border border-black p-2 text-[10px] text-black bg-white break-inside-avoid">
        <p className="font-bold mb-1">LEGENDA:</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
            <span><strong>D</strong> - DIURNO (07:00 às 19:00)</span>
            <span><strong>N</strong> - NOTURNO (19:00 às 07:00)</span>
            <span><strong>CH</strong> - CARGA HORÁRIA</span>
            <span><strong>LM</strong> - LICENÇA MATERNIDADE</span>
            <span><strong>LS</strong> - LICENÇA SAÚDE</span>
            <span><strong>FE</strong> - FÉRIAS</span>
            <span><strong>F</strong> - FOLGA</span>
        </div>
      </div>



      <LeaveManagerModal
        isOpen={!!leaveModalType}
        onClose={() => setLeaveModalType(null)}
        onSuccess={() => {
            fetchData()
            setLeaveModalType(null)
        }}
        nurses={data.nurses}
        existingLeaves={data.timeOffs}
        type={leaveModalType || 'ferias'}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {/* Footer / Actions */}
      <div className="mt-4 flex justify-end gap-2 no-print">
         {isAddingSection ? (
            <div className="flex items-center gap-2">
                <input 
                    value={newSectionTitle}
                    onChange={e => setNewSectionTitle(e.target.value)}
                    className="border rounded px-2 py-1 text-sm bg-white text-black"
                    placeholder="Nome do novo bloco..."
                    autoFocus
                />
                <button onClick={saveNewSection} className="text-green-600 hover:text-green-800"><Check /></button>
                <button onClick={() => setIsAddingSection(false)} className="text-red-600 hover:text-red-800"><X /></button>
            </div>
         ) : (
            <button 
                onClick={() => setIsAddingSection(true)}
                className="px-3 py-1 border border-blue-500 text-blue-500 text-xs rounded hover:bg-blue-50 flex items-center gap-1"
            >
              <Plus size={14} />
              Novo Bloco de Profissionais
            </button>
         )}
      </div>

      {/* Footer Legends */}
      <div className="mt-8 space-y-2">
        <div className="flex flex-wrap gap-2 justify-end mb-2 no-print">
            <button className="px-2 py-1 text-xs border rounded text-black border-gray-300 hover:bg-gray-50">Editar texto do rodapé</button>
            <button 
              onClick={() => setLeaveModalType('ferias')}
              className="px-2 py-1 text-xs border rounded text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100"
            >
              Gerenciar Férias
            </button>
            <button 
              onClick={() => setLeaveModalType('licenca_saude')}
              className="px-2 py-1 text-xs border rounded text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
            >
              Licença Saúde
            </button>
            <button 
              onClick={() => setLeaveModalType('licenca_maternidade')}
              className="px-2 py-1 text-xs border rounded text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100"
            >
              Licença Maternidade
            </button>
            <button 
              onClick={() => setLeaveModalType('cessao')}
              className="px-2 py-1 text-xs border rounded text-cyan-600 border-cyan-200 bg-cyan-50 hover:bg-cyan-100"
            >
              Cessão
            </button>
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
      
      {/* Unit Creation Modal */}
      {isAddingUnit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-4 rounded shadow-lg w-full max-w-sm">
                <h3 className="font-bold text-lg mb-4 text-black">Adicionar Novo Setor</h3>
                <input 
                    value={newUnitTitle}
                    onChange={e => setNewUnitTitle(e.target.value)}
                    className="w-full border p-2 mb-4 rounded text-black"
                    placeholder="Nome do setor (ex: POSTO 3)"
                    autoFocus
                />
                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => setIsAddingUnit(false)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={saveNewUnit}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    >
                        Salvar
                    </button>
                </div>
            </div>
        </div>
      )}

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
      {/* Shift Management Modal */}
      {isShiftModalOpen && shiftModalData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
                <h3 className="font-bold text-lg mb-4 text-black border-b pb-2">
                    Gerenciar Plantão
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    <strong>Profissional:</strong> {shiftModalData.nurseName}<br/>
                    <strong>Data Inicial:</strong> {shiftModalData.date.split('-').reverse().join('/')}
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-black mb-2">Tipo de Plantão</label>
                    <div className="flex gap-2 flex-wrap">
                        <button 
                            onClick={() => setShiftType('day')}
                            className={`flex-1 min-w-[60px] py-2 px-2 rounded border ${shiftType === 'day' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}
                        >
                            Dia (D)
                        </button>
                        <button 
                            onClick={() => setShiftType('night')}
                            className={`flex-1 min-w-[60px] py-2 px-2 rounded border ${shiftType === 'night' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}
                        >
                            Noite (N)
                        </button>
                        <button 
                            onClick={() => setShiftType('morning')}
                            className={`flex-1 min-w-[60px] py-2 px-2 rounded border ${shiftType === 'morning' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}
                        >
                            Manhã (M)
                        </button>
                        <button 
                            onClick={() => setShiftType('afternoon')}
                            className={`flex-1 min-w-[60px] py-2 px-2 rounded border ${shiftType === 'afternoon' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}
                        >
                            Tarde (T)
                        </button>
                        <button 
                            onClick={() => setShiftType('delete')}
                            className={`flex-1 min-w-[60px] py-2 px-2 rounded border ${shiftType === 'delete' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}
                        >
                            Limpar
                        </button>
                    </div>
                </div>

                {shiftModalData.date.endsWith('-01') && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-black mb-2">Frequência (Preenchimento Automático)</label>
                        <select 
                            value={recurrence} 
                            onChange={(e) => setRecurrence(e.target.value as any)}
                            className="w-full border p-2 rounded text-black bg-white"
                        >
                            <option value="none">Apenas este dia</option>
                            <option value="daily">Todos os dias (Diário)</option>
                            <option value="12x36">A cada 2 dias (12x36 - Dia sim, dia não)</option>
                            <option value="every3">A cada 3 dias</option>
                            <option value="24x72">A cada 4 dias (24x72)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            O preenchimento será aplicado desta data até o final do mês.
                        </p>
                    </div>
                )}

                <div className="flex justify-end gap-2 border-t pt-4">
                    <button 
                        onClick={() => setIsShiftModalOpen(false)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSaveShifts}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  )
}
