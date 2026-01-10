'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { getMonthlyScheduleData, deleteNurse, reassignNurse, assignNurseToSection, assignNurseToRoster, removeNurseFromRoster, copyMonthlyRoster, addSection, updateSection, deleteSection, saveShifts, updateRosterObservation, updateRosterSector, uploadLogo, uploadCityLogo, getMonthlyNote, saveMonthlyNote, releaseSchedule, unreleaseSchedule, updateScheduleFooter, Section, Unit } from '@/app/actions'
import { addUnit, updateUnit, deleteUnit } from '@/app/unit-actions'
import { Trash2, Plus, Pencil, Save, X, Check, Copy } from 'lucide-react'
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
  is_rostered?: boolean
  roster_created_at?: string
  observation?: string
  sector?: string
}

interface RosterItem {
  id: string
  nurse_id: string
  section_id: string
  unit_id: string | null
  month: number
  year: number
  observation?: string
  sector?: string
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
  roster: RosterItem[]
  shifts: Shift[]
  timeOffs: TimeOff[]
  sections: Section[]
  units: Unit[]
  releases?: any[]
}

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const YEARS = [2024, 2025, 2026, 2027]

const ObservationCell = ({ 
  initialValue, 
  onSave,
  isAdmin,
  className = ""
}: { 
  initialValue: string | undefined, 
  onSave: (val: string) => void,
  isAdmin: boolean,
  className?: string
}) => {
  const [value, setValue] = useState(initialValue || '')

  useEffect(() => {
    setValue(initialValue || '')
  }, [initialValue])

  const handleBlur = () => {
    if (value !== (initialValue || '')) {
      onSave(value)
    }
  }

  const getColorClass = (val: string | undefined) => {
    const v = (val || '').toUpperCase().trim()
    if (v === '1ED') return 'text-red-600'
    if (v === '1 ED AB') return 'text-blue-600'
    return 'text-blue-800'
  }

  const colorClass = getColorClass(value)

  if (!isAdmin) {
    return <span className={`text-[10px] uppercase block font-bold ${colorClass} ${className}`}>{value}</span>
  }

  return (
    <input 
      type="text" 
      className={`bg-transparent focus:outline-none uppercase text-[10px] font-bold ${colorClass} ${className}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
    />
  )
}

const SectorCell = ({ 
  initialValue, 
  onSave,
  isAdmin,
  className = ""
}: { 
  initialValue: string | undefined, 
  onSave: (val: string) => void,
  isAdmin: boolean,
  className?: string
}) => {
  const [value, setValue] = useState(initialValue || '')

  useEffect(() => {
    setValue(initialValue || '')
  }, [initialValue])

  const handleBlur = () => {
    if (value !== (initialValue || '')) {
      onSave(value)
    }
  }

  if (!isAdmin) {
    return <span className={`text-[10px] uppercase block font-bold text-black ${className}`}>{value}</span>
  }

  return (
    <input 
      type="text" 
      className={`bg-transparent focus:outline-none uppercase text-[10px] font-bold text-black w-full ${className}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
    />
  )
}

export default function Schedule({ 
    isAdmin = false, 
    printOnly = false,
    initialMonth,
    initialYear,
    initialUnitId,
    onLoaded
}: { 
    isAdmin?: boolean, 
    printOnly?: boolean,
    initialMonth?: number,
    initialYear?: number,
    initialUnitId?: string,
    onLoaded?: () => void
}) {
  const [currentDate] = useState(new Date())
  const [selectedMonth, setSelectedMonth] = useState(initialMonth !== undefined ? initialMonth : currentDate.getMonth())
  const [selectedYear, setSelectedYear] = useState(initialYear !== undefined ? initialYear : currentDate.getFullYear())
  const [data, setData] = useState<ScheduleData>({ nurses: [], roster: [], shifts: [], timeOffs: [], sections: [], units: [] })
  const [loading, setLoading] = useState(true)
  const [selectedUnitId, setSelectedUnitId] = useState<string>(initialUnitId || '')
  const [isSectionMenuOpen, setIsSectionMenuOpen] = useState(false)
  const [leaveModalType, setLeaveModalType] = useState<LeaveType | null>(null)
  
  // Section Management State
  const [isAddingSection, setIsAddingSection] = useState(false)
  const [newSectionTitle, setNewSectionTitle] = useState('')
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null)
  const [editingSectionTitle, setEditingSectionTitle] = useState('')
  const [selectedHiddenSectionId, setSelectedHiddenSectionId] = useState<string>('')
  const [isRenamingHiddenSection, setIsRenamingHiddenSection] = useState(false)
  const [renameHiddenSectionTitle, setRenameHiddenSectionTitle] = useState('')
  
  // Double Shift Modal State
  const [doubleShiftModal, setDoubleShiftModal] = useState<{ isOpen: boolean, nurseId: string, sectionId: string } | null>(null)
  
  // Unit Management State
  const [isAddingUnit, setIsAddingUnit] = useState(false)
  const [newUnitTitle, setNewUnitTitle] = useState('')
  const [isEditingUnit, setIsEditingUnit] = useState(false)
  const [editingUnitTitle, setEditingUnitTitle] = useState('')

  // Footer Text State
  const [footerText, setFooterText] = useState<string>('')
  const [isEditingFooter, setIsEditingFooter] = useState(false)
  const [tempFooterText, setTempFooterText] = useState('')

  // Shift Management State
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
  const [shiftModalData, setShiftModalData] = useState<{nurseId: string, nurseName: string, date: string} | null>(null)
  const [shiftType, setShiftType] = useState<'day' | 'night' | 'morning' | 'afternoon' | 'delete'>('day')
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | '12x36' | '24x72' | 'every3' | 'off4' | 'off5' | 'off6'>('none')
  const [limitShifts, setLimitShifts] = useState<string>('')
  const [deleteWholeMonth, setDeleteWholeMonth] = useState(false)
  
  // Sector Title Editing State
  const [editingSectorTitleId, setEditingSectorTitleId] = useState<string | null>(null)
  const [tempSectorTitle, setTempSectorTitle] = useState('')

  // Logo Upload State
  const [logoTimestamp, setLogoTimestamp] = useState(Date.now())
  const [cityLogoTimestamp, setCityLogoTimestamp] = useState(Date.now())

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const formData = new FormData()
      formData.append('file', e.target.files[0])
      const res = await uploadLogo(formData)
      if (res.success) {
        setLogoTimestamp(Date.now())
      } else {
        alert('Erro ao enviar logo: ' + (res.message || 'Erro desconhecido'))
      }
    }
  }

  const handleCityLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const formData = new FormData()
      formData.append('file', e.target.files[0])
      const res = await uploadCityLogo(formData)
      if (res.success) {
        setCityLogoTimestamp(Date.now())
      } else {
        alert('Erro ao enviar logo da prefeitura: ' + (res.message || 'Erro desconhecido'))
      }
    }
  }
  
  // Cache to store fetched data by month-year key
  const scheduleCache = React.useRef<Record<string, ScheduleData>>({})

  const clearCache = () => {
    scheduleCache.current = {}
  }

  const fetchData = React.useCallback(async (forceRefresh = false) => {
    setLoading(true)
    const cacheKey = `${selectedMonth}-${selectedYear}`

    if (!forceRefresh && scheduleCache.current[cacheKey]) {
        const cachedData = scheduleCache.current[cacheKey]
        setData(cachedData)
        if (!selectedUnitId && cachedData.units && cachedData.units.length > 0) {
            setSelectedUnitId(cachedData.units[0].id)
        }
        setLoading(false)
        onLoaded?.()
        return
    }

    try {
      const result = await getMonthlyScheduleData(selectedMonth + 1, selectedYear)
      const newData = result as ScheduleData
      scheduleCache.current[cacheKey] = newData
      setData(newData)
      if (!selectedUnitId && result.units && result.units.length > 0) {
        setSelectedUnitId(result.units[0].id)
      }
    } catch (error) {
      console.error('Error fetching schedule:', error)
    } finally {
      setLoading(false)
      onLoaded?.()
    }
  }, [selectedMonth, selectedYear, selectedUnitId, onLoaded])

  useEffect(() => {
    fetchData()
  }, [fetchData])


  // We need a separate state for "Manually Added" to survive re-renders until saved
  const [manuallyAddedSections, setManuallyAddedSections] = useState<string[]>([])

  // Reset manual sections when context changes
  useEffect(() => {
      setManuallyAddedSections([])
  }, [selectedUnitId, selectedMonth, selectedYear])

  const rosterSections = React.useMemo(() => {
      const sections = new Set<string>()
      if (data.roster) {
          data.roster.forEach(r => {
              if ((!selectedUnitId || r.unit_id === selectedUnitId) && r.month === selectedMonth + 1 && r.year === selectedYear) {
                  sections.add(r.section_id)
              }
          })
      }
      return sections
  }, [data.roster, selectedUnitId, selectedMonth, selectedYear])

  const visibleSections = React.useMemo(() => {
      return data.sections.filter(s => rosterSections.has(s.id) || manuallyAddedSections.includes(s.id))
  }, [data.sections, rosterSections, manuallyAddedSections])


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
            clearCache()
            await fetchData(true)
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

  const startEditingUnit = () => {
      const unit = data.units.find(u => u.id === selectedUnitId)
      if (unit) {
          setEditingUnitTitle(unit.title)
          setIsEditingUnit(true)
      }
  }

  const saveUnitTitle = async () => {
      if (!selectedUnitId || !editingUnitTitle.trim()) return
      setLoading(true)
      try {
          const res = await updateUnit(selectedUnitId, editingUnitTitle)
          if (res.success) {
              setIsEditingUnit(false)
              clearCache()
              await fetchData(true)
          } else {
              alert('Erro ao atualizar setor: ' + res.message)
          }
      } catch (error) {
          console.error(error)
          alert('Erro ao atualizar setor')
      } finally {
          setLoading(false)
      }
  }

  const handleDeleteUnit = async () => {
      if (!selectedUnitId) return
      if (!confirm('Tem certeza que deseja excluir este setor? Esta ação não pode ser desfeita.')) return
      
      setLoading(true)
      try {
          const res = await deleteUnit(selectedUnitId)
          if (res.success) {
              setSelectedUnitId('')
              clearCache()
              await fetchData(true)
          } else {
              alert('Erro ao excluir setor: ' + res.message)
          }
      } catch (error) {
          console.error(error)
          alert('Erro ao excluir setor')
      } finally {
          setLoading(false)
      }
  }



  const handleRelease = async () => {
    if (!selectedUnitId) return alert('Selecione um setor para liberar')
    if (!confirm('Tem certeza que deseja liberar esta escala? Ela ficará disponível para download.')) return
    
    setLoading(true)
    const res = await releaseSchedule(selectedMonth + 1, selectedYear, selectedUnitId)
    if (res.success) {
        alert('Escala liberada com sucesso!')
        clearCache()
        fetchData(true)
    } else {
        alert(res.message)
    }
    setLoading(false)
  }

  const handleUnrelease = async () => {
    if (!selectedUnitId) return
    if (!confirm('Tem certeza que deseja CANCELAR a liberação desta escala? Ela deixará de aparecer na área pública.')) return
    
    setLoading(true)
    const res = await unreleaseSchedule(selectedMonth + 1, selectedYear, selectedUnitId)
    if (res.success) {
        alert('Liberação cancelada com sucesso!')
        clearCache()
        fetchData(true)
    } else {
        alert(res.message)
    }
    setLoading(false)
  }

  async function handleRemoveFromRoster(nurseId: string) {
    if (!confirm('Tem certeza que deseja remover este servidor desta escala mensal?')) return
    setLoading(true)
    const res = await removeNurseFromRoster(nurseId, selectedMonth + 1, selectedYear)
    if (!res.success) alert(res.message)
    clearCache()
    await fetchData(true)
  }

  async function handleReassign(oldId: string, newId: string) {
    // For roster, reassign implies changing the nurse assigned to this slot?
    // Or just swapping? For simplicity, we can remove old and add new.
    // But `reassignNurse` action was for global change. 
    // Here we should probably just remove old from roster and add new to roster.
    
    if (oldId === newId) return
    if (!confirm('Tem certeza que deseja substituir o servidor nesta escala?')) return
    
    setLoading(true)
    // 1. Get current roster item
    const rosterItem = data.roster.find(r => r.nurse_id === oldId && r.month === selectedMonth + 1 && r.year === selectedYear)
    if (!rosterItem) {
        alert('Erro: Servidor não encontrado na escala.')
        setLoading(false)
        return
    }

    // 2. Remove old
    await removeNurseFromRoster(oldId, selectedMonth + 1, selectedYear)
    
    // 3. Add new (using same section and unit), preserving created_at if possible or using old one
    await assignNurseToRoster(newId, rosterItem.section_id, rosterItem.unit_id, selectedMonth + 1, selectedYear, rosterItem.observation, rosterItem.created_at)
    
    clearCache()
    await fetchData(true)
    setLoading(false)
  }

  const handleUpdateObservation = async (nurseId: string, observation: string) => {
    // Optimistic update locally
    setData(prev => ({
        ...prev,
        roster: prev.roster.map(r => 
            r.nurse_id === nurseId && r.month === selectedMonth + 1 && r.year === selectedYear 
            ? { ...r, observation } 
            : r
        )
    }))

    const res = await updateRosterObservation(nurseId, selectedMonth + 1, selectedYear, observation)
    if (!res.success) {
        alert('Erro ao salvar observação')
        // Revert? simpler to just fetch data
        await fetchData(true)
    }
  }

  const handleUpdateSector = async (nurseId: string, sector: string) => {
    // Optimistic update locally
    setData(prev => ({
        ...prev,
        roster: prev.roster.map(r => 
            (r.nurse_id === nurseId && r.month === selectedMonth + 1 && r.year === selectedYear)
            ? { ...r, sector }
            : r
        )
    }))

    const res = await updateRosterSector(nurseId, selectedMonth + 1, selectedYear, sector)
    if (!res.success) {
        alert('Erro ao salvar setor')
        await fetchData(true)
    }
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
            clearCache()
            await fetchData(true)
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
    clearCache()
    await fetchData(true)
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

  const startEditingSectorTitle = (section: Section) => {
    if (!isAdmin) return
    setEditingSectorTitleId(section.id)
    setTempSectorTitle(section.sector_title || 'ENFERMARIAS/LEITOS')
  }

  const saveSectorTitle = async () => {
    if (!editingSectorTitleId) return
    setLoading(true)
    // We only update the sector_title, keeping the existing title
    const section = data.sections.find(s => s.id === editingSectorTitleId)
    if (section) {
        await updateSection(editingSectorTitleId, section.title, tempSectorTitle)
    }
    setEditingSectorTitleId(null)
    await fetchData()
  }

  const handleEditFooter = () => {
      setTempFooterText(footerText || '')
      setIsEditingFooter(true)
  }

  const saveFooterText = async () => {
      setLoading(true)
      const res = await updateScheduleFooter(selectedMonth + 1, selectedYear, selectedUnitId, tempFooterText)
      if (res.success) {
          setIsEditingFooter(false)
          setFooterText(tempFooterText)
          clearCache()
          await fetchData(true)
      } else {
          alert(res.message)
      }
      setLoading(false)
  }

  const handleAddHiddenSectionToRoster = () => {
    if (!selectedHiddenSectionId) return
    setManuallyAddedSections(prev => prev.includes(selectedHiddenSectionId) ? prev : [...prev, selectedHiddenSectionId])
  }

  const startRenameHiddenSection = () => {
    if (!selectedHiddenSectionId) return
    const sec = data.sections.find(s => s.id === selectedHiddenSectionId)
    if (!sec) return
    setRenameHiddenSectionTitle(sec.title)
    setIsRenamingHiddenSection(true)
  }

  const saveRenameHiddenSection = async () => {
    if (!selectedHiddenSectionId || !renameHiddenSectionTitle.trim()) {
      setIsRenamingHiddenSection(false)
      return
    }
    setLoading(true)
    await updateSection(selectedHiddenSectionId, renameHiddenSectionTitle.trim())
    setIsRenamingHiddenSection(false)
    clearCache()
    await fetchData(true)
    setLoading(false)
  }

  const deleteHiddenSection = async () => {
    if (!selectedHiddenSectionId) return
    await handleDeleteSection(selectedHiddenSectionId)
    setSelectedHiddenSectionId('')
    setIsRenamingHiddenSection(false)
    setRenameHiddenSectionTitle('')
  }

  const handleAssignNurse = async (nurseId: string, sectionId: string) => {
    if (!nurseId) return
    setDoubleShiftModal({ isOpen: true, nurseId, sectionId })
  }

  const finalizeAssignNurse = async (observation: string) => {
    if (!doubleShiftModal) return
    const { nurseId, sectionId } = doubleShiftModal
    setDoubleShiftModal(null)
    
    setLoading(true)
    try {
        const res = await assignNurseToRoster(nurseId, sectionId, selectedUnitId, selectedMonth + 1, selectedYear, observation)
        if (res.success) {
            clearCache()
            await fetchData(true)
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
    setLimitShifts('')
    setDeleteWholeMonth(false)
    setIsShiftModalOpen(true)
  }

  const handleSaveShifts = async () => {
    if (!shiftModalData) return
    setLoading(true)
    
    try {
        const shiftsToSave: { nurseId: string, date: string, type: string }[] = []
        
        if (shiftType === 'delete' && deleteWholeMonth) {
            // Delete whole month logic
            const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
            for (let day = 1; day <= lastDayOfMonth; day++) {
                const dateString = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                shiftsToSave.push({
                    nurseId: shiftModalData.nurseId,
                    date: dateString,
                    type: 'DELETE'
                })
            }
        } else {
            // Standard logic
            const startDate = new Date(shiftModalData.date + 'T12:00:00') // Avoid timezone issues
            const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
            
            // Calculate dates based on recurrence
            let currentDateIter = new Date(startDate)
            let count = 0
            const limit = limitShifts ? parseInt(limitShifts) : Infinity

            while (currentDateIter.getMonth() === selectedMonth && currentDateIter.getFullYear() === selectedYear) {
                if (count >= limit) break

                const dateString = `${currentDateIter.getFullYear()}-${String(currentDateIter.getMonth() + 1).padStart(2, '0')}-${String(currentDateIter.getDate()).padStart(2, '0')}`
                
                shiftsToSave.push({
                    nurseId: shiftModalData.nurseId,
                    date: dateString,
                    type: shiftType === 'delete' ? 'DELETE' : shiftType
                })

                count++

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
                } else if (recurrence === 'off4') {
                    currentDateIter.setDate(currentDateIter.getDate() + 5)
                } else if (recurrence === 'off5') {
                    currentDateIter.setDate(currentDateIter.getDate() + 6)
                } else if (recurrence === 'off6') {
                    currentDateIter.setDate(currentDateIter.getDate() + 7)
                }
            }
        }

        const res = await saveShifts(shiftsToSave)

        if (!res.success) {
            alert('Erro ao salvar: ' + (res.message || 'Erro desconhecido'))
            return
        }

        setIsShiftModalOpen(false)
        clearCache()
        await fetchData(true)

    } catch (error) {
        console.error("Error saving shifts:", error)
        alert('Erro ao salvar turno. Verifique o console.')
    } finally {
        setLoading(false)
    }
  }

  const daysInMonth = React.useMemo(() => new Date(selectedYear, selectedMonth + 1, 0).getDate(), [selectedYear, selectedMonth])
  const daysArray = React.useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(selectedYear, selectedMonth, i + 1)
    return {
      day: i + 1,
      weekday: date.toLocaleDateString('pt-BR', { weekday: 'narrow' }).toUpperCase(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    }
  }), [daysInMonth, selectedYear, selectedMonth])

  // Optimize roster lookup for O(1) access
  const rosterLookup = React.useMemo(() => {
      const lookup: Record<string, any> = {}
      if (data.roster) {
          data.roster.forEach(r => {
              if (r.month === selectedMonth + 1 && r.year === selectedYear) {
                  lookup[r.nurse_id] = r
              }
          })
      }
      return lookup
  }, [data.roster, selectedMonth, selectedYear])

  const activeNurses = React.useMemo(() => {
      return data.nurses.map(nurse => {
          const rosterEntry = rosterLookup[nurse.id]
          if (rosterEntry) {
              return { ...nurse, section_id: rosterEntry.section_id, unit_id: rosterEntry.unit_id, is_rostered: true, roster_created_at: rosterEntry.created_at, observation: rosterEntry.observation, sector: rosterEntry.sector }
          }
          return { ...nurse, is_rostered: false }
      })
  }, [data.nurses, rosterLookup])

  // Optimize: Pre-sort nurses to avoid sorting on every render in the dropdown
  const sortedActiveNurses = React.useMemo(() => {
      return [...activeNurses].sort((a, b) => a.name.localeCompare(b.name))
  }, [activeNurses])

  // Optimize: Group nurses by section to avoid filtering on every render
  const nursesBySection = React.useMemo(() => {
      const grouped: Record<string, Nurse[]> = {}
      activeNurses.forEach(n => {
          if (n.section_id && n.is_rostered) {
              if (!grouped[n.section_id]) grouped[n.section_id] = []
              grouped[n.section_id].push(n)
          }
      })
      Object.keys(grouped).forEach(key => {
          grouped[key].sort((a, b) => {
              const aTime = a.roster_created_at ? new Date(a.roster_created_at).getTime() : 0
              const bTime = b.roster_created_at ? new Date(b.roster_created_at).getTime() : 0
              return aTime - bTime
          })
      })
      return grouped
  }, [activeNurses])

  // Optimize data access with lookups
  const shiftsLookup = React.useMemo(() => {
      const lookup: Record<string, Shift> = {} // Key: "nurseId_date"
      const countLookup: Record<string, number> = {} // Key: nurseId
      
      const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
      
      if (data.shifts) {
          data.shifts.forEach(s => {
              if (s.shift_date.startsWith(monthPrefix)) {
                  lookup[`${s.nurse_id}_${s.shift_date}`] = s
                  countLookup[s.nurse_id] = (countLookup[s.nurse_id] || 0) + 1
              }
          })
      }
      return { lookup, countLookup }
  }, [data.shifts, selectedMonth, selectedYear])

  const timeOffsLookup = React.useMemo(() => {
      const lookup: Record<string, TimeOff> = {}
      if (data.timeOffs) {
        const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate()
        const monthEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

        data.timeOffs.forEach(t => {
            if (t.end_date < monthStart || t.start_date > monthEnd) return

            const startStr = t.start_date < monthStart ? monthStart : t.start_date
            const endStr = t.end_date > monthEnd ? monthEnd : t.end_date
            
            // Use T12:00:00 to avoid timezone issues when iterating
            const start = new Date(startStr + 'T12:00:00')
            const end = new Date(endStr + 'T12:00:00')

            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                 const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                 lookup[`${t.nurse_id}_${dateStr}`] = t
            }
        })
      }
      return lookup
  }, [data.timeOffs, selectedMonth, selectedYear])

  const nurseObservations = useMemo(() => {
    const map = new Map<string, string>();
    (data.roster || []).forEach(r => {
        if (r.month === selectedMonth + 1 && r.year === selectedYear && r.observation) {
            map.set(r.nurse_id, r.observation);
        }
    });
    return map;
  }, [data.roster, selectedMonth, selectedYear]);

  const renderGrid = (professionals: Nurse[], section: Section) => {
    // Helper to find the first shift day (1-31) for a nurse in the current month
    const getFirstShiftDay = (nurseId: string) => {
        for (let day = 1; day <= daysInMonth; day++) {
             const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
             if (shiftsLookup.lookup[`${nurseId}_${dateStr}`]) {
                 return day
             }
        }
        return 999 // No shifts found
    }

    // Sort professionals by first shift day then by insertion time (for Tecnicos) or just insertion time (for others)
    const sortedProfessionals = [...professionals].sort((a, b) => {
        const isTecnicoA = (a.role || '').toUpperCase() === 'TECNICO'
        const isTecnicoB = (b.role || '').toUpperCase() === 'TECNICO'

        if (isTecnicoA && isTecnicoB) {
            const dayA = getFirstShiftDay(a.id)
            const dayB = getFirstShiftDay(b.id)
            
            if (dayA !== dayB) {
                return dayA - dayB
            }
        }
        
        const aTime = a.roster_created_at ? new Date(a.roster_created_at).getTime() : 0
        const bTime = b.roster_created_at ? new Date(b.roster_created_at).getTime() : 0
        return aTime - bTime
    })

    let currentCounter = 0
    let lastFirstDay = -1

    return (
      <>
        {sortedProfessionals.map((nurse) => {
          // Calculate Total Shifts
          const totalShifts = shiftsLookup.countLookup[nurse.id] || 0
          
          // Calculate counter group based on first shift day
          const firstDay = getFirstShiftDay(nurse.id)
          const isTecnico = (nurse.role || '').toUpperCase() === 'TECNICO'
          
          if (isTecnico) {
              if (firstDay !== lastFirstDay) {
                  currentCounter = 1
                  lastFirstDay = firstDay
              } else {
                  currentCounter++
              }
          } else {
              currentCounter++
              lastFirstDay = firstDay
          }

          return (
            <tr key={nurse.id} className="hover:bg-gray-50">
              <td className="border border-black px-1 py-1 text-center text-xs font-medium sticky left-0 bg-white z-10 w-8">{currentCounter}</td>
              <td className="border border-black px-2 py-1 text-xs whitespace-nowrap font-medium text-black sticky left-8 bg-white z-10 w-[300px] border-r-2 border-r-black">
                <div className="flex items-center gap-1">
                  {isAdmin && (
                  <button 
                    onClick={() => handleRemoveFromRoster(nurse.id)} 
                    className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50 transition-colors no-print"
                    title="Remover desta escala mensal"
                  >
                    <Trash2 size={12} />
                  </button>
                  )}
                  {isAdmin ? (
                    <select 
                      value={nurse.id} 
                      onChange={(e) => handleReassign(nurse.id, e.target.value)}
                      className={`w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-bold cursor-pointer outline-none uppercase no-print ${
                        (nurse.observation || '').toUpperCase().trim() === '1ED' ? 'text-red-600' :
                        (nurse.observation || '').toUpperCase().trim() === '1 ED AB' ? 'text-blue-600' :
                        (nurse.vinculo && nurse.vinculo.toUpperCase().includes('SELETIVO')) ? 'text-green-600' :
                        'text-black'
                      }`}
                    >
                      {data.nurses.map(n => {
                        const obs = (nurseObservations.get(n.id) || '').toUpperCase().trim()
                        const label = `${n.name} ${obs ? `(${obs})` : ''}`
                        return <option key={n.id} value={n.id}>{label}</option>
                      })}
                    </select>
                  ) : null}
                  {!isAdmin && (() => {
                     const obs = (nurse.observation || '').toUpperCase().trim()
                     let nameColorClass = "text-black"
                     if (obs === '1ED') {
                         nameColorClass = "text-red-600"
                     } else if (obs === '1 ED AB') {
                         nameColorClass = "text-blue-600"
                     } else if (nurse.vinculo && nurse.vinculo.toUpperCase().includes('SELETIVO')) {
                         nameColorClass = "text-green-600"
                     }
                     
                     return <span className={`text-xs font-bold ${nameColorClass} uppercase`}>
                         {nurse.name} {obs ? obs : ''}
                     </span>
                   })()}
                </div>
              </td>
              <td className="border border-black px-1 py-1 text-center text-[10px] uppercase">{nurse.coren || '-'}</td>
              <td className="border border-black px-1 py-1 text-center text-[10px] uppercase">{nurse.vinculo || '-'}</td>
              <td className="border border-black px-1 py-1 text-center text-[10px] uppercase">
                  <SectorCell 
                      initialValue={nurse.sector}
                      onSave={(val) => handleUpdateSector(nurse.id, val)}
                      isAdmin={isAdmin}
                  />
              </td>
              
              {daysArray.map(({ day, weekday, isWeekend }) => {
                const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                
                // Find time off
                const timeOff = timeOffsLookup[`${nurse.id}_${dateStr}`]

                // Find shift
                const shift = shiftsLookup.lookup[`${nurse.id}_${dateStr}`]

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
                  else {
                      // Generic Folga - let it inherit background (white or weekend gray)
                      content = "F"
                  }
                } else if (shift) {
                   if (shift.shift_type === 'day') content = 'D'
                   else if (shift.shift_type === 'night') content = 'N'
                   else if (shift.shift_type === 'morning') content = 'M'
                   else if (shift.shift_type === 'afternoon') content = 'T'
                }
                
                // Highlight weekends (Gray background for entire column, overridden by specific statuses if needed, but image shows gray prevails or mixes)
                // In image, weekend cells are gray. If there is a shift, it's just text on gray.
                if (isWeekend) {
                   // Apply gray if it's NOT a special colored leave
                   const hasSpecialColor = timeOff && ['ferias', 'licenca_saude', 'licenca_maternidade', 'cessao'].includes(timeOff.type)
                   
                   if (!hasSpecialColor) {
                       cellClass += " bg-gray-400"
                   }
                }

                return (
                  <td 
                    key={day} 
                    className={`${cellClass} ${isAdmin ? 'cursor-pointer hover:bg-yellow-100' : ''} transition-colors`}
                    onClick={isAdmin ? () => handleCellClick(nurse, dateStr) : undefined}
                    title={isAdmin ? "Clique para gerenciar plantão" : undefined}
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
        {isAdmin && (
        <tr className="no-print">
          <td className="border border-black px-1 py-1 sticky left-0 bg-white z-10"></td>
          <td className="border border-black px-2 py-1 sticky left-8 bg-white z-10 border-r-2 border-r-black">
             <select 
                onChange={(e) => handleAssignNurse(e.target.value, section.id)}
                className="flex items-center gap-1 text-xs text-blue-600 italic w-full bg-transparent border-none outline-none cursor-pointer hover:text-blue-800"
                value=""
             >
                <option value="" disabled>+ Adicionar Profissional...</option>
                {sortedActiveNurses
                    .map(nurse => {
                        const isInCurrentContext = nurse.is_rostered && nurse.section_id === section.id && (!selectedUnitId || nurse.unit_id === selectedUnitId);
                        
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
          {daysArray.map(({ day, isWeekend }) => (
            <td 
              key={`placeholder-${day}`} 
              className={`border border-black px-0 py-0 ${isWeekend ? 'bg-gray-400' : ''}`}
            ></td>
          ))}
          <td className="border border-black px-1 py-1"></td>
        </tr>
        )}
      </>
    )
  }

  const isLaunched = (data.roster || []).some(r => r.month === selectedMonth + 1 && r.year === selectedYear && (!selectedUnitId || r.unit_id === selectedUnitId))
  
  const isScheduleReleased = useMemo(() => {
      if (!data.releases) return false
      return data.releases.some(r => r.month === selectedMonth + 1 && r.year === selectedYear && r.unit_id === selectedUnitId && r.is_released)
  }, [data.releases, selectedMonth, selectedYear, selectedUnitId])

  // Sync Footer Text
  useEffect(() => {
      const metadata = data.releases?.find(r => r.month === selectedMonth + 1 && r.year === selectedYear && (selectedUnitId ? r.unit_id === selectedUnitId : !r.unit_id))
      setFooterText(metadata?.footer_text || '')
  }, [data.releases, selectedMonth, selectedYear, selectedUnitId])

  return (
    <div className="w-full bg-white p-2 md:p-4">
      {/* Header Filters */}
      <div className="flex flex-col items-center gap-4 mb-6 no-print">
        <div className="flex flex-col md:flex-row gap-4 items-end justify-center">
            <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-black mb-1">Setor</label>
            {isEditingUnit ? (
                <div className="flex items-center gap-2">
                    <input 
                        value={editingUnitTitle}
                        onChange={e => setEditingUnitTitle(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 text-sm w-full md:w-48 bg-white text-black"
                        autoFocus
                    />
                    <button onClick={saveUnitTitle} className="text-green-600 p-2 hover:bg-gray-100 rounded" title="Salvar">
                        <Save size={18} />
                    </button>
                    <button onClick={() => setIsEditingUnit(false)} className="text-red-600 p-2 hover:bg-gray-100 rounded" title="Cancelar">
                        <X size={18} />
                    </button>
                </div>
            ) : (
                <div className="flex items-center gap-2">
                    <select 
                        value={selectedUnitId} 
                        onChange={handleUnitChange}
                        className="border border-gray-300 rounded px-3 py-2 text-sm w-full md:w-48 bg-white text-black"
                    >
                        <option value="">Selecione um setor...</option>
                        {data.units.map(unit => (
                        <option key={unit.id} value={unit.id}>{unit.title}</option>
                        ))}
                        {isAdmin && (
                        <>
                        <option disabled>──────────</option>
                        <option value="new_unit_action">+ Adicionar novo setor...</option>
                        </>
                        )}
                    </select>
                    {selectedUnitId && selectedUnitId !== 'new_unit_action' && isAdmin && (
                        <div className="flex items-center">
                            <button 
                                onClick={startEditingUnit}
                                className="text-blue-600 p-2 hover:bg-gray-100 rounded"
                                title="Editar nome do setor"
                            >
                                <Pencil size={16} />
                            </button>
                            <button 
                                onClick={handleDeleteUnit}
                                className="text-red-600 p-2 hover:bg-gray-100 rounded"
                                title="Excluir setor"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}
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
        </div>
        <div className="flex gap-2 w-full md:w-auto justify-center mt-2">
           {loading ? (
               <button disabled className="bg-gray-300 text-gray-500 px-4 py-2 rounded flex items-center justify-center gap-2 text-sm h-[38px] w-full md:w-48 cursor-not-allowed">
                  <span className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></span>
                  Carregando...
               </button>
           ) : (
             (!isLaunched && !isAdmin) ? (
                <div className="flex items-center justify-center h-[38px] px-4 text-red-600 font-bold bg-red-50 border border-red-200 rounded whitespace-nowrap">
                    Escala ainda não liberada
                </div>
             ) : (
                isScheduleReleased ? (
                    <button 
                        onClick={handleUnrelease}
                        className="group flex items-center justify-center gap-2 text-green-600 font-bold h-[38px] px-4 bg-green-50 border border-green-200 rounded w-full md:w-48 whitespace-nowrap hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
                        title="Clique para cancelar a liberação"
                    >
                        <Check size={18} className="group-hover:hidden" />
                        <X size={18} className="hidden group-hover:block" />
                        <span className="group-hover:hidden">Escala Liberada</span>
                        <span className="hidden group-hover:inline">Cancelar Liberação</span>
                    </button>
                ) : (
                    <button 
                        onClick={handleRelease}
                        className="bg-blue-600 text-white px-4 py-2 rounded flex items-center justify-center gap-2 text-sm hover:bg-blue-700 transition-colors h-[38px] w-full md:w-48"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        Liberar Escala
                    </button>
                )
             )
           )}
        </div>
      </div>

      {/* Report Header */}
      <div className="mb-4">
        {/* Logos Header */}
        <div className={`flex justify-between items-center mb-4 ${printOnly ? 'hidden print:flex' : ''}`}>
            <div className="flex flex-col items-start">
                {/* Section Manager Dropdown (Replacing Logo) */}
                <div className="flex items-center gap-4 relative">


                    <div className="relative group cursor-pointer" onClick={() => document.getElementById('logo-upload')?.click()}>
                        <img 
                            src={`/logo-hma.png?t=${logoTimestamp}`} 
                            alt="HMA Logo" 
                            className="h-16 object-contain" 
                            title="Clique para alterar logo"
                        />
                        <input 
                            type="file" 
                            id="logo-upload" 
                            className="hidden" 
                            accept="image/png,image/jpeg"
                            onChange={handleLogoUpload}
                        />
                    </div>
                </div>
            </div>
            
            <div className="flex flex-col items-end">
                {/* City Hall Logo Placeholder */}
                <div className="flex items-center gap-2">
                     <div className="relative group cursor-pointer" onClick={() => document.getElementById('city-logo-upload')?.click()}>
                        <img 
                            src={`/logo-prefeitura.png?t=${cityLogoTimestamp}`} 
                            alt="City Logo" 
                            className="h-16 object-contain" 
                            title="Clique para alterar logo"
                        />
                        <input 
                            type="file" 
                            id="city-logo-upload" 
                            className="hidden" 
                            accept="image/png,image/jpeg"
                            onChange={handleCityLogoUpload}
                        />
                    </div>
                </div>
            </div>
        </div>
        
        <div className={`bg-gray-200 border border-black p-0.5 text-center mb-1 ${printOnly ? 'hidden print:block' : ''}`}>
          <h3 className="font-bold text-base uppercase text-black">
            {data.units.find(u => u.id === selectedUnitId)?.title || 'OBSERVAÇÃO - INTERNAÇÃO PRONTO-SOCORRO'}
          </h3>
        </div>
        <div className={`bg-gray-200 border border-black p-0.5 text-center ${printOnly ? 'hidden print:block' : ''}`}>
           <h4 className="font-bold text-sm uppercase text-black">{MONTHS[selectedMonth].toUpperCase()} {selectedYear}</h4>
        </div>
      </div>

      {/* Table Container */}
      <div className={`overflow-x-auto border-none shadow-none max-w-full relative ${printOnly ? 'hidden print:block' : ''}`}>
        {loading ? (
             <div className="text-center py-4">Carregando...</div>
        ) : (
             (() => {
               const rosterForContext = (data.roster || []).filter(r => r.month === selectedMonth + 1 && r.year === selectedYear && (!selectedUnitId || r.unit_id === selectedUnitId))
               const baseLaunched = rosterForContext.length > 0
               const isLaunched = baseLaunched
               if (!isLaunched && !isAdmin && !printOnly) {
                 return <div className="text-center py-6 text-sm text-gray-600">Escala em construção</div>
               }
               return (
                 <>
                 {visibleSections.map(section => (
                    <div key={section.id} className="">
                        <table className="min-w-[1200px] w-full border-collapse border border-black text-black text-[11px] table-fixed">
                             <thead>
                             {/* Main Headers Row 1 */}
                            <tr className="bg-blue-100 text-black print:bg-blue-100">
                                <th className="border border-black px-1 py-1 text-center w-8 sticky left-0 bg-blue-100 z-20 font-bold print:bg-blue-100" rowSpan={2}>#</th>
                                <th className="border border-black px-1 py-1 text-center w-[300px] sticky left-8 bg-blue-100 z-20 border-r-2 border-r-black font-bold uppercase text-sm group print:bg-blue-100" rowSpan={2}>
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
                                        </div>
                                    )}
                                </th>
                                <th className="border border-black px-1 py-1 text-center w-24 font-bold bg-blue-100 print:bg-blue-100" rowSpan={2}>COREN</th>
                                <th className="border border-black px-1 py-1 text-center w-24 font-bold bg-blue-100 print:bg-blue-100" rowSpan={2}>VÍNCULO</th>
                                <th className="border border-black px-1 py-1 text-center w-24 font-bold text-[10px] bg-blue-100 print:bg-blue-100" rowSpan={2}>
                                    {editingSectorTitleId === section.id ? (
                                        <div className="flex items-center gap-1">
                                            <input 
                                                value={tempSectorTitle}
                                                onChange={(e) => setTempSectorTitle(e.target.value)}
                                                className="w-full text-[10px] bg-white text-black border border-gray-300 rounded px-1"
                                                autoFocus
                                                onBlur={saveSectorTitle}
                                                onKeyDown={(e) => e.key === 'Enter' && saveSectorTitle()}
                                            />
                                        </div>
                                    ) : (
                                        <span 
                                            onClick={() => startEditingSectorTitle(section)}
                                            className={isAdmin ? "cursor-pointer hover:text-blue-600" : ""}
                                            title={isAdmin ? "Clique para editar" : ""}
                                        >
                                            {section.sector_title || 'ENFERMARIAS/LEITOS'}
                                        </span>
                                    )}
                                </th>
                                {daysArray.map(({ day, weekday, isWeekend }) => (
                                    <th key={`wd-${day}`} className={`border border-black px-0 py-0 text-center w-6 ${isWeekend ? 'bg-gray-400 print:bg-gray-400' : ''}`}>
                                    {weekday}
                                    </th>
                                ))}
                                <th className="border border-black px-1 py-1 text-center w-16 font-bold bg-blue-100 print:bg-blue-100">TOTAL</th>
                            </tr>
                            {/* Main Headers Row 2 */}
                            <tr className="bg-blue-100 text-black print:bg-blue-100">
                                {daysArray.map(({ day, isWeekend }) => (
                                    <th key={`d-${day}`} className={`border border-black px-0 py-0 text-center ${isWeekend ? 'bg-gray-400 print:bg-gray-400' : ''}`}>
                                    {day}
                                    </th>
                                ))}
                                <th className="border border-black px-1 py-1 text-center font-bold bg-blue-100 print:bg-blue-100">PLANTÃO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {renderGrid(
                                (nursesBySection[section.id] || []).filter(n => !selectedUnitId || n.unit_id === selectedUnitId),
                                section
                            )}
                        </tbody>
                    </table>
                 </div>
             ))}
             
             {isAdmin && (
             <div className="mb-8 p-4 border border-dashed border-gray-400 rounded bg-gray-50 text-center no-print">
                 <p className="text-sm text-gray-600 mb-2">Adicionar grupo à escala deste setor:</p>
                 <select 
                    className="border border-blue-300 text-blue-600 rounded px-2 py-1 text-sm bg-white"
                    onChange={(e) => setSelectedHiddenSectionId(e.target.value)}
                    value={selectedHiddenSectionId}
                >
                     <option value="" disabled>+ Selecionar Grupo...</option>
                     {data.sections
                        .filter(s => !visibleSections.find(vs => vs.id === s.id))
                        .map(s => (
                            <option key={s.id} value={s.id}>{s.title}</option>
                        ))
                     }
                 </select>
                 <div className="mt-2 flex items-center justify-center gap-2">
                    <button 
                      onClick={handleAddHiddenSectionToRoster}
                      disabled={!selectedHiddenSectionId}
                      className="px-2 py-1 text-xs border rounded text-blue-600 border-blue-200 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
                    >
                      Adicionar
                    </button>
                    <button 
                      onClick={startRenameHiddenSection}
                      disabled={!selectedHiddenSectionId}
                      className="px-2 py-1 text-xs border rounded text-gray-700 border-gray-200 bg-gray-50 hover:bg-gray-100 disabled:opacity-50"
                    >
                      Editar Nome
                    </button>
                    <button 
                      onClick={deleteHiddenSection}
                      disabled={!selectedHiddenSectionId}
                      className="px-2 py-1 text-xs border rounded text-red-600 border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-50"
                    >
                      Excluir
                    </button>
                 </div>
                 {isRenamingHiddenSection && (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <input 
                      className="border border-gray-300 rounded px-2 py-1 text-xs bg-white text-black w-64"
                      value={renameHiddenSectionTitle}
                      onChange={(e) => setRenameHiddenSectionTitle(e.target.value)}
                      autoFocus
                    />
                    <button 
                      onClick={saveRenameHiddenSection}
                      className="px-2 py-1 text-xs border rounded text-green-600 border-green-200 bg-green-50 hover:bg-green-100"
                    >
                      Salvar
                    </button>
                    <button 
                      onClick={() => { setIsRenamingHiddenSection(false); setRenameHiddenSectionTitle('') }}
                      className="px-2 py-1 text-xs border rounded text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
                    >
                      Cancelar
                    </button>
                  </div>
                 )}
             </div>
             )}
             </>
               )
             })()
        )}
      </div>
      






      <LeaveManagerModal
        isOpen={!!leaveModalType}
        onClose={() => setLeaveModalType(null)}
        onSuccess={() => {
            fetchData(true)
            setLeaveModalType(null)
        }}
        nurses={data.nurses}
        existingLeaves={data.timeOffs}
        type={leaveModalType || 'ferias'}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {/* Footer / Actions */}
      {isAdmin && (
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
      )}

      {/* Footer Legends */}
      <div className="mt-8 space-y-2">
        {isAdmin && (
        <div className="flex flex-col items-end gap-2 mb-2 no-print">
            <div className="flex flex-wrap gap-2 justify-end">
                <button 
                    onClick={handleEditFooter}
                    className="px-2 py-1 text-xs border rounded text-black border-gray-300 hover:bg-gray-50"
                >
                    Editar texto do rodapé
                </button>
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

            {isEditingFooter && (
                <div className="bg-white p-4 border rounded shadow-lg w-full max-w-2xl">
                    <h3 className="font-bold mb-2 text-black">Editar Texto do Rodapé</h3>
                    <textarea
                        className="w-full h-32 border p-2 mb-2 text-sm text-black"
                        value={tempFooterText}
                        onChange={e => setTempFooterText(e.target.value)}
                        placeholder="Digite o texto do rodapé aqui... (Deixe em branco para usar o padrão)"
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setIsEditingFooter(false)} className="px-3 py-1 border rounded hover:bg-gray-100 text-black">Cancelar</button>
                        <button onClick={saveFooterText} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Salvar</button>
                    </div>
                </div>
            )}
        </div>
        )}

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

        {/* Footer Text Display */}
        {footerText && (
            <div className="mt-4 text-xs text-black whitespace-pre-wrap border p-2 rounded bg-gray-50 border-gray-200 print:border-none print:bg-white print:p-0">
                {footerText}
            </div>
        )}


      </div>

      {/* Signatures Footer */}
      <div className={`mt-8 mb-4 grid grid-cols-4 gap-4 text-center break-inside-avoid ${printOnly ? 'hidden print:grid' : ''}`}>
        <div className="flex flex-col items-center">
            <div className="w-full border-b border-black mb-2"></div>
            <p className="font-bold text-[10px] text-black uppercase">Coordenação de Setor</p>
        </div>
        <div className="flex flex-col items-center">
            <div className="w-full border-b border-black mb-2"></div>
            <p className="font-bold text-[10px] text-black uppercase">Coordenação Geral de Enfermagem</p>
        </div>
        <div className="flex flex-col items-center">
            <div className="w-full border-b border-black mb-2"></div>
            <p className="font-bold text-[10px] text-black uppercase">Coordenação do RH/HMA</p>
        </div>
        <div className="flex flex-col items-center">
            <div className="w-full border-b border-black mb-2"></div>
            <p className="font-bold text-[10px] text-black uppercase">Direção Geral do HMA</p>
        </div>
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
            print-color-adjust: exact;
          }
          /* Ensure sticky columns don't mess up print */
          th, td {
            position: static !important;
          }
          /* Reforçar bordas escuras na impressão */
          table, th, td {
            border-color: #000000 !important;
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
                            onClick={() => {
                                setShiftType('delete')
                                setDeleteWholeMonth(false)
                            }}
                            className={`flex-1 min-w-[60px] py-2 px-2 rounded border ${shiftType === 'delete' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}
                        >
                            Limpar
                        </button>
                    </div>
                </div>

                {shiftType === 'delete' && (
                    <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                                type="checkbox"
                                checked={deleteWholeMonth}
                                onChange={e => setDeleteWholeMonth(e.target.checked)}
                                className="w-4 h-4 text-red-600"
                            />
                            <span className="text-sm font-bold text-red-700">LIMPAR TODA A LINHA (MÊS INTEIRO)</span>
                        </label>
                        <p className="text-xs text-red-600 mt-1 ml-6">
                            Se marcado, removerá TODOS os plantões deste profissional neste mês, independente da data selecionada.
                        </p>
                    </div>
                )}

                {shiftModalData.date && shiftType !== 'delete' && (
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
                            <option value="off4">Folga de 4 dias (Trabalha 1, Folga 4)</option>
                            <option value="off5">Folga de 5 dias (Trabalha 1, Folga 5)</option>
                            <option value="off6">Folga de 6 dias (Trabalha 1, Folga 6)</option>
                        </select>
                        
                        <div className="mt-4">
                             <label className="block text-sm font-medium text-black mb-1">Limitar preenchimento (Opcional)</label>
                             <input 
                                type="number"
                                value={limitShifts}
                                onChange={e => setLimitShifts(e.target.value)}
                                placeholder="Ex: 10 primeiros plantões"
                                className="w-full border p-2 rounded text-black bg-white text-sm"
                             />
                             <p className="text-xs text-gray-500 mt-1">
                                Se preenchido, aplicará apenas para a quantidade de plantões informada. Caso contrário, preencherá até o final do mês.
                             </p>
                        </div>
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
      {/* Double Shift Modal */}
      {doubleShiftModal && doubleShiftModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 text-gray-900">Adicionar Profissional</h3>
            <p className="mb-6 text-gray-700">Este vínculo é uma escala dupla?</p>
            
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => finalizeAssignNurse('1ED')}
                className="bg-blue-600 text-white px-4 py-3 rounded hover:bg-blue-700 font-medium text-left flex justify-between items-center"
              >
                <span>Sim, Hospital</span>
                <span className="bg-blue-800 text-xs px-2 py-1 rounded">1ED</span>
              </button>
              
              <button 
                onClick={() => finalizeAssignNurse('1 ED AB')}
                className="bg-green-600 text-white px-4 py-3 rounded hover:bg-green-700 font-medium text-left flex justify-between items-center"
              >
                <span>Sim, Atenção Básica</span>
                <span className="bg-green-800 text-xs px-2 py-1 rounded">1 ED AB</span>
              </button>
              
              <button 
                onClick={() => finalizeAssignNurse('')}
                className="bg-gray-200 text-gray-800 px-4 py-3 rounded hover:bg-gray-300 font-medium text-left"
              >
                Não (Vínculo Normal)
              </button>

              <button 
                onClick={() => setDoubleShiftModal(null)}
                className="mt-2 text-red-500 text-sm hover:underline self-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
