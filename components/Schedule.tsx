'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import Image from 'next/image'
import logoHma from '@/public/logo-hma.png'
import logoPrefeitura from '@/public/logo-prefeitura.png'
import { getMonthlyScheduleData, deleteNurse, reassignNurse, assignNurseToSection, assignNurseToRoster, removeNurseFromRoster, removeRosterEntry, copyMonthlyRoster, addSection, updateSection, deleteSection, saveShifts, updateRosterObservation, updateRosterSector, updateRosterCoren, uploadLogo, uploadCityLogo, getMonthlyNote, saveMonthlyNote, releaseSchedule, unreleaseSchedule, updateScheduleFooter, updateScheduleDynamicField, updateScheduleSetorVisibility, Section, Unit, resetSectionOrder, clearMonthlySchedule, clearSectionRoster, clearAllUnitRosters, updateRosterListOrders, getUnitNumber, saveUnitNumber, getAllUnitNumbers } from '@/app/actions'
import { addUnit, updateUnit, deleteUnit } from '@/app/unit-actions'
import { Trash2, Plus, Pencil, Save, X, Check, Copy, ArrowDown, Printer, Eraser, UserPlus, ArrowUpCircle, ArrowDownCircle, PlusCircle } from 'lucide-react'
import { formatRole } from '@/lib/utils'
import NurseCreationModal from './NurseCreationModal'
import LeaveManagerModal, { LeaveType } from './LeaveManagerModal'
import NurseSelectionModal from './NurseSelectionModal'

interface Nurse {
  id: string
  name: string
  coren: string
  crm?: string
  phone?: string
  cpf?: string
  role: string
  vinculo: string
  section_id?: string
  unit_id?: string
  is_rostered?: boolean
  roster_created_at?: string
  observation?: string
  sector?: string
  list_order?: number | null
  unique_key?: string
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
  created_at?: string
  list_order?: number | null
}

interface Shift {
  id: string
  nurse_id: string
  roster_id?: string
  shift_date: string
  shift_type: 'day' | 'night' | 'morning' | 'afternoon' | 'mt' | 'dn'
  is_red?: boolean
  created_at?: string
}

interface TimeOff {
  id: string
  nurse_id: string
  start_date: string
  end_date: string
  type: string
  unit_id?: string
}

interface Absence {
  id: string
  nurse_id: string
  date: string
  reason: string
}

interface ScheduleData {
  nurses: Nurse[]
  roster: RosterItem[]
  shifts: Shift[]
  timeOffs: TimeOff[]
  absences: Absence[]
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
    <>
      <input 
        type="text" 
        className={`bg-transparent focus:outline-none uppercase text-[10px] font-bold ${colorClass} ${className} print:hidden`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      <span className={`text-[10px] uppercase hidden print:block font-bold ${colorClass} ${className}`}>{value}</span>
    </>
  )
}

const SectorCell = ({ 
  initialValue, 
  onSave,
  onCopyDown,
  isAdmin,
  className = ""
}: { 
  initialValue: string | undefined, 
  onSave: (val: string) => void,
  onCopyDown?: (val: string) => void,
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
        e.preventDefault()
        if (value !== (initialValue || '')) {
            onSave(value)
        }
        (e.target as HTMLInputElement).blur()
    }
  }

  if (!isAdmin) {
    return <span className={`text-[10px] uppercase block font-bold text-black text-center ${className}`}>{value}</span>
  }

  return (
    <div className="relative group w-full h-full">
        <input 
          type="text" 
          className={`bg-transparent focus:outline-none uppercase text-[10px] font-bold text-black w-full h-full text-center ${className} print:hidden`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        <span className={`text-[10px] uppercase hidden print:block font-bold text-black w-full h-full text-center ${className}`}>{value}</span>
        {onCopyDown && value && (
            <button
                onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    onCopyDown(value)
                }}
                className="absolute right-0 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full w-4 h-4 z-20 shadow-sm border border-blue-200 no-print"
                title="Replicar para todos abaixo"
                tabIndex={-1}
            >
                <ArrowDown size={10} />
            </button>
        )}
    </div>
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
  const [selectedMonth, setSelectedMonth] = useState(() => {
    if (initialMonth !== undefined) return initialMonth
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return nextMonth.getMonth()
  })
  const [selectedYear, setSelectedYear] = useState(() => {
    if (initialYear !== undefined) return initialYear
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    return nextMonth.getFullYear()
  })
  const [data, setData] = useState<ScheduleData>({ nurses: [], roster: [], shifts: [], timeOffs: [], absences: [], sections: [], units: [] })
  const [allNurses, setAllNurses] = useState<Nurse[]>([])
  const [isFetchingAllNurses, setIsFetchingAllNurses] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
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
  const [doubleShiftModal, setDoubleShiftModal] = useState<{ isOpen: boolean, nurseId: string, sectionId: string, rosterId?: string } | null>(null)
  
  // Unit Management State
  const [isAddingUnit, setIsAddingUnit] = useState(false)
  const [newUnitTitle, setNewUnitTitle] = useState('')
  const [newUnitNumber, setNewUnitNumber] = useState('')
  const [isEditingUnit, setIsEditingUnit] = useState(false)
  const [editingUnitTitle, setEditingUnitTitle] = useState('')

  // Footer Text State
  const [footerText, setFooterText] = useState<string>('')
  const [isEditingFooter, setIsEditingFooter] = useState(false)
  const [tempFooterText, setTempFooterText] = useState('')

  // Shift Management State
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
  const [shiftModalData, setShiftModalData] = useState<{nurseId: string, rosterId?: string, nurseName: string, date: string} | null>(null)
  const [shiftType, setShiftType] = useState<'day' | 'night' | 'morning' | 'afternoon' | 'mt' | 'dn' | 'delete'>('day')
  const [shiftIsRed, setShiftIsRed] = useState(false)
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'mon_fri' | '12x36' | '24x72' | 'every3' | 'off4' | 'off5' | 'off6' | 'custom'>('off4')
  const [customRecurrenceDays, setCustomRecurrenceDays] = useState<string>('')
  const [limitShifts, setLimitShifts] = useState<string>('')
  const [deleteWholeMonth, setDeleteWholeMonth] = useState(false)
  
  // Sector Title Editing State
  const [editingSectorTitleId, setEditingSectorTitleId] = useState<string | null>(null)
  const [tempSectorTitle, setTempSectorTitle] = useState('')

  // Logo Upload State
  const [logoTimestamp, setLogoTimestamp] = useState(Date.now())
  const [cityLogoTimestamp, setCityLogoTimestamp] = useState(Date.now())

  // Copy Schedule State
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false)
  const [copyTargetMonth, setCopyTargetMonth] = useState(selectedMonth)
  const [copyTargetYear, setCopyTargetYear] = useState(selectedYear)

  // Dynamic Column Field State
  const [dynamicField, setDynamicField] = useState<'coren' | 'crm' | 'phone' | 'cpf' | 'vinculo' | 'role'>('coren')
  const [isSetorHidden, setIsSetorHidden] = useState(false)

  // Insertion State
  const [isNurseModalOpen, setIsNurseModalOpen] = useState(false)
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false)
  const [insertionData, setInsertionData] = useState<{ sectionId: string, position: number, rosterId?: string, orderedIds: string[] } | null>(null)

  // Replication State
  const [replicationModalOpen, setReplicationModalOpen] = useState(false)
  const [replicationData, setReplicationData] = useState<{
      value: string,
      targets: { id: string, group: number, index: number }[],
      startIndex: number
  } | null>(null)

  // SQL Instruction Modal
  const [showSqlModal, setShowSqlModal] = useState(false)
  const [sqlModalType, setSqlModalType] = useState<'V11' | 'V14' | 'V15' | 'V16'>('V11')
  const [headerLine1, setHeaderLine1] = useState('Prefeitura Municipal de Açailândia')
  const [headerLine2, setHeaderLine2] = useState('Secretaria Municipal de Saúde / SEMUS')
  const [headerLine3, setHeaderLine3] = useState('Hospital Municipal de Açailândia - HMA')
  const [headerPage, setHeaderPage] = useState('1')
  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [unitNumber, setUnitNumber] = useState<string>('')
  const [unitNumbersMap, setUnitNumbersMap] = useState<Record<string, string>>({})
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'ALL' | 'ENFERMEIRO' | 'TECNICO' | 'MEDICO'>('ALL')

  const applyReplicationToTargets = async (targetsToUpdate: { id: string }[]) => {
      if (!replicationData) return

      if (targetsToUpdate.length === 0) {
          alert('Nenhum profissional encontrado para este critério.')
          return
      }

      setLoading(true)
      
      // Optimistic Update
      setData(prev => ({
          ...prev,
          roster: prev.roster.map(r => {
              const isTarget = targetsToUpdate.some(t => t.id === r.id)
              if (isTarget) {
                  return { ...r, sector: replicationData.value }
              }
              return r
          })
      }))

      // Server Update
      try {
          await Promise.all(targetsToUpdate.map(t => updateRosterSector(t.id, replicationData.value)))
          clearCache() // Clear cache to ensure fresh data
          await fetchData(true) // Force refresh
          setReplicationModalOpen(false)
          setReplicationData(null)
      } catch (e) {
          console.error('Error copying sectors', e)
          alert('Erro ao salvar alguns setores.')
          fetchData(true)
      } finally {
          setLoading(false)
      }
  }

  const handleExecuteReplication = async (targetGroup: number) => {
      if (!replicationData) return
      const targetsToUpdate = replicationData.targets.filter(t => t.group === targetGroup)
      await applyReplicationToTargets(targetsToUpdate)
  }

  const handleExecuteReplicationAllBelow = async () => {
      if (!replicationData) return
      const start = replicationData.startIndex ?? 0
      const targetsToUpdate = replicationData.targets.filter(t => t.index >= start)
      await applyReplicationToTargets(targetsToUpdate)
  }

  const handleDynamicFieldChange = async (field: 'coren' | 'crm' | 'phone' | 'cpf' | 'vinculo' | 'role') => {
      setDynamicField(field)
      setLoading(true)
      const res = await updateScheduleDynamicField(selectedMonth + 1, selectedYear, selectedUnitId, field)
      if (!res.success) {
          alert(res.message || 'Erro ao salvar campo dinâmico')
          if (res.message?.includes('V14')) {
              setSqlModalType('V14')
              setShowSqlModal(true)
          }
      } else {
          clearCache()
          await fetchData(true)
      }
      setLoading(false)
  }

  const handleToggleSetorVisibility = async (isHidden: boolean) => {
      setIsSetorHidden(isHidden)
      setLoading(true)
      const res = await updateScheduleSetorVisibility(selectedMonth + 1, selectedYear, selectedUnitId, isHidden)
      if (!res.success) {
          alert(res.message || 'Erro ao salvar visibilidade do setor')
          if (res.message?.includes('V16')) {
              setSqlModalType('V16')
              setShowSqlModal(true)
          }
      } else {
          clearCache()
          await fetchData(true)
      }
      setLoading(false)
  }

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
  const scheduleCache = useRef<Record<string, ScheduleData>>({})

  const clearCache = () => {
    scheduleCache.current = {}
  }

  const fetchAllNursesList = useCallback(async (force = false) => {
    // If we already have nurses and aren't forcing, skip
    if (!force && allNurses.length > 50) return 
    
    setIsFetchingAllNurses(true)
    try {
        const nurses = await getAllNurses()
        console.log('fetchAllNursesList: received', nurses?.length, 'nurses')
        if (nurses && nurses.length > 0) {
            setAllNurses(nurses as Nurse[])
        }
    } catch (e) {
        console.error('Error fetching all nurses', e)
    } finally {
        setIsFetchingAllNurses(false)
    }
  }, [allNurses.length])

  useEffect(() => {
    // When opening modals that need the full nurse list, ensure we fetch it
    if (isNurseModalOpen || !!leaveModalType) {
        fetchAllNursesList(true) // Force fetch to be sure we have the latest and complete list
    }
  }, [isNurseModalOpen, leaveModalType, fetchAllNursesList])

  const fetchData = useCallback(async (forceRefresh = false, showLoading = true) => {
    // PROTECT LOCAL EDITS: If saving is in progress, skip fetching to avoid overwriting state
    if (saveQueue.current.length > 0 || isSaving) {
        console.log('Fetch skipped: Save in progress to protect local data.')
        return
    }

    if (showLoading) setLoading(true)
    const cacheKey = `${selectedMonth}-${selectedYear}-${selectedUnitId}`

    if (!forceRefresh && scheduleCache.current[cacheKey]) {
        const cachedData = scheduleCache.current[cacheKey]
        setData(cachedData)
        
        // Ensure dynamic field and footer are also set from cache
        const meta = cachedData.releases && cachedData.releases.length > 0 ? cachedData.releases[0] : null
        if (meta) {
            setFooterText(meta.footer_text || '')
            setDynamicField(meta.dynamic_field || 'coren')
            setIsSetorHidden(!!meta.is_setor_hidden)
        } else {
            setFooterText('')
            setDynamicField('coren')
            setIsSetorHidden(false)
        }

        if (showLoading) setLoading(false)
        onLoaded?.()
        return
    }

    try {
      const result = await getMonthlyScheduleData(selectedMonth + 1, selectedYear, selectedUnitId)
      
      // DOUBLE PROTECTION: If a save started while we were waiting for the server, 
      // DO NOT overwrite the local optimistic state with stale data from server.
      if (saveQueue.current.length > 0 || isSaving) {
          console.log('Fetch completed but skipped state update: Save in progress.')
          return
      }

      const newData = result as ScheduleData
      scheduleCache.current[cacheKey] = newData
      setData(newData)

      // Set metadata fields
      const meta = newData.releases && newData.releases.length > 0 ? newData.releases[0] : null
      if (meta) {
          setFooterText(meta.footer_text || '')
          setDynamicField(meta.dynamic_field || 'coren')
          setIsSetorHidden(!!meta.is_setor_hidden)
      } else {
          setFooterText('')
          setDynamicField('coren')
          setIsSetorHidden(false)
      }
    } catch (error) {
      console.error('Error fetching schedule:', error)
    } finally {
      if (showLoading) setLoading(false)
      onLoaded?.()
    }
  }, [selectedMonth, selectedYear, selectedUnitId, onLoaded])

  const saveQueue = useRef<{ nurseId: string, rosterId?: string, date: string, type: string, isRed?: boolean }[]>([])
  const saveTimeout = useRef<NodeJS.Timeout | null>(null)

  const processQueue = async () => {
    if (saveQueue.current.length === 0) {
        setIsSaving(false)
        return
    }
    
    setIsSaving(true)
    const shiftsToSave = [...saveQueue.current]
    saveQueue.current = []
    
    try {
        // PRESERVE 'DELETE' in uppercase, lowercase others
        const sanitizedShifts = shiftsToSave.map(s => ({
            ...s,
            type: s.type === 'DELETE' ? 'DELETE' : s.type.toLowerCase()
        }))

        const res = await saveShifts(sanitizedShifts as any)
        if (res.success) {
            // After successful save, clear cache and FORCE REFRESH from server
            clearCache()
            await fetchData(true, false) // force refresh, don't show loading overlay
            
            // Give extra time for the "Saving..." indicator to show success
            setTimeout(() => {
                setIsSaving(false)
            }, 500)
        } else {
            alert('Erro ao salvar no servidor: ' + res.message)
            setIsSaving(false)
            await fetchData(true, true) // force refresh with loading to recover state
        }
    } catch (e) {
        console.error('Background save failed:', e)
        setIsSaving(false)
        await fetchData(true, true)
    }
  }

  const optimisticSaveShifts = (shiftsToSave: { nurseId: string, rosterId?: string, date: string, type: string, isRed?: boolean }[]) => {
    setIsSaving(true)
    // 1. Update local state immediately for instant feedback
    setData(prev => {
        const currentShifts = prev.shifts || []
        const newShifts = [...currentShifts]
        
        shiftsToSave.forEach(update => {
            const shiftTypeFormatted = (update.type === 'DELETE' ? 'DELETE' : update.type.toLowerCase()) as any;
            
            // Find existing shift for this nurse/roster on this date
            // Match EXACTLY by rosterId if provided, or by nurseId if rosterId is null (legacy)
            const index = newShifts.findIndex(s => 
                s.shift_date === update.date && 
                (update.rosterId ? s.roster_id === update.rosterId : (!s.roster_id && s.nurse_id === update.nurseId))
            )
            
            if (shiftTypeFormatted === 'DELETE') {
                if (index !== -1) newShifts.splice(index, 1)
            } else {
                if (index !== -1) {
                    newShifts[index] = { 
                        ...newShifts[index], 
                        shift_type: shiftTypeFormatted, 
                        is_red: !!update.isRed 
                    }
                } else {
                    newShifts.push({
                        id: `temp-${Date.now()}-${Math.random()}`,
                        nurse_id: update.nurseId,
                        roster_id: update.rosterId,
                        shift_date: update.date,
                        shift_type: shiftTypeFormatted,
                        is_red: !!update.isRed
                    })
                }
            }
        })
        return { ...prev, shifts: newShifts }
    })

    // 2. Add to queue for background processing
    // Filter out duplicates in the queue - keep only the latest update for each cell
    shiftsToSave.forEach(update => {
        const existingIdx = saveQueue.current.findIndex(q => 
            q.date === update.date && 
            (update.rosterId ? q.rosterId === update.rosterId : q.nurseId === update.nurseId)
        )
        if (existingIdx !== -1) {
            saveQueue.current[existingIdx] = update
        } else {
            saveQueue.current.push(update)
        }
    })

    // 3. Debounce the actual server call
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(processQueue, 2000) // Wait 2s of inactivity
  }

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto-select first unit if none selected and units are available
  useEffect(() => {
    if (!selectedUnitId && data.units.length > 0) {
      setSelectedUnitId(data.units[0].id)
    }
  }, [data.units, selectedUnitId])
  
  useEffect(() => {
    const l1 = typeof window !== 'undefined' ? localStorage.getItem('enf_hma_header_line_1') : null
    const l2 = typeof window !== 'undefined' ? localStorage.getItem('enf_hma_header_line_2') : null
    const l3 = typeof window !== 'undefined' ? localStorage.getItem('enf_hma_header_line_3') : null
    const pg = typeof window !== 'undefined' ? localStorage.getItem('enf_hma_header_page') : null
    if (l1) setHeaderLine1(l1)
    if (l2) setHeaderLine2(l2)
    if (l3) setHeaderLine3(l3)
    if (pg) setHeaderPage(pg)
  }, [])
  
  useEffect(() => {
    async function refreshUnitNumber() {
      if (!selectedUnitId) {
        setUnitNumber('')
        return
      }
      const n = await getUnitNumber(selectedUnitId)
      setUnitNumber(n || '')
    }
    refreshUnitNumber()
  }, [selectedUnitId])
  
  useEffect(() => {
    async function loadAllNumbers() {
      const map = await getAllUnitNumbers()
      setUnitNumbersMap(map || {})
    }
    loadAllNumbers()
  }, [data.units])
  
  const handleSaveHeader = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('enf_hma_header_line_1', headerLine1)
      localStorage.setItem('enf_hma_header_line_2', headerLine2)
      localStorage.setItem('enf_hma_header_line_3', headerLine3)
      localStorage.setItem('enf_hma_header_page', headerPage)
    }
    setIsEditingHeader(false)
  }
  
  const handleSaveUnitNumber = async () => {
    if (!selectedUnitId) return
    const res = await saveUnitNumber(selectedUnitId, unitNumber || '')
    if (!res.success) {
      alert(res.message || 'Erro ao salvar número do setor')
      return
    }
    const map = await getAllUnitNumbers()
    setUnitNumbersMap(map || {})
    alert('Número do setor salvo')
  }

 
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
              // Allow showing roster entries that match the unit
              // This prevents "lost data" for entries created before unit strictness
              if ((!selectedUnitId || r.unit_id === selectedUnitId) && r.month === selectedMonth + 1 && r.year === selectedYear) {
                  sections.add(r.section_id)
              }
          })
      }
      return sections
  }, [data.roster, selectedUnitId, selectedMonth, selectedYear])

  const visibleSections = React.useMemo(() => {
      // Identify sections that are in manuallyAddedSections
      const manualIds = new Set(manuallyAddedSections)

      // 1. Sections that are in roster BUT NOT manually added in this session
      const standardSections = data.sections
        .filter(s => rosterSections.has(s.id) && !manualIds.has(s.id))
      
      // 2. Sections that are manually added (whether in roster or not)
      const manualSections = manuallyAddedSections
          .map(id => data.sections.find(s => s.id === id))
          .filter((s): s is typeof data.sections[0] => !!s)
          
      const combined = [...standardSections, ...manualSections]

      // Final Sort: Enforce ENFERMEIROS first, preserve others order
      return combined.sort((a, b) => {
             const titleA = a.title.toUpperCase()
             const titleB = b.title.toUpperCase()
             
             // Enforce ENFERMEIROS before TÉCNICOS (and others)
             if (titleA.includes('ENFERMEIRO') && !titleB.includes('ENFERMEIRO')) return -1
             if (titleB.includes('ENFERMEIRO') && !titleA.includes('ENFERMEIRO')) return 1
             
             return 0 // Keep existing order for others
      })
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
        const res = await addUnit(newUnitTitle, newUnitNumber || undefined)
        if (res.success) {
            setNewUnitTitle('')
            setNewUnitNumber('')
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

  const handleClearAllUnitRosters = async () => {
    if (!selectedUnitId) return
    const unitName = data.units.find(u => u.id === selectedUnitId)?.title
    if (!confirm(`ATENÇÃO: Deseja EXCLUIR TODO O HISTÓRICO DE ESCALAS do setor "${unitName}"?\n\nIsso apagará TODAS as escalas (passadas, presentes e futuras) deste setor.\n\nO setor em si NÃO será excluído.`)) return
    
    // Double confirmation
    const confirmName = prompt(`Para confirmar, digite o nome do setor: ${unitName}`)
    if (confirmName !== unitName) {
        alert('Nome incorreto. Ação cancelada.')
        return
    }

    setLoading(true)
    const res = await clearAllUnitRosters(selectedUnitId)
    if (res.success) {
        alert('Histórico de escalas excluído com sucesso!')
        clearCache()
        fetchData(true)
    } else {
        alert(res.message || 'Erro ao limpar histórico')
    }
    setLoading(false)
  }

  const handleDeleteUnit = async () => {
      if (!selectedUnitId) return
      const unitName = data.units.find(u => u.id === selectedUnitId)?.title
      if (!confirm(`ATENÇÃO CRÍTICA: Deseja EXCLUIR O SETOR "${unitName}"?\n\nIsso apagará o setor E TODO O SEU HISTÓRICO de escalas e plantões.\n\nEsta ação é IRREVERSÍVEL.`)) return
      
      const confirmName = prompt(`Para confirmar a exclusão do setor, digite o nome do setor: ${unitName}`)
      if (confirmName !== unitName) {
          alert('Nome incorreto. Ação cancelada.')
          return
      }

      setLoading(true)
      try {
          const res = await deleteUnit(selectedUnitId)
          if (res.success) {
              alert('Setor excluído com sucesso!')
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

  const handlePrintCurrent = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const handleClearSchedule = async () => {
    if (!selectedUnitId) return alert('Selecione um setor para excluir a escala')
    if (!confirm('Tem certeza que deseja EXCLUIR TODA a escala deste mês para este setor? Esta ação removerá todos os profissionais e plantões deste mês e não poderá ser desfeita.')) return
    
    setLoading(true)
    const res = await clearMonthlySchedule(selectedMonth + 1, selectedYear, selectedUnitId)
    if (res.success) {
        alert('Escala do mês excluída com sucesso!')
        clearCache()
        fetchData(true)
    } else {
        alert(res.message || 'Erro ao excluir escala')
    }
    setLoading(false)
  }

  async function handleRemoveFromRoster(rosterId: string) {
    if (!confirm('Tem certeza que deseja remover este servidor desta escala mensal?')) return
    setLoading(true)
    const res = await removeRosterEntry(rosterId)
    if (!res.success) alert(res.message)
    clearCache()
    await fetchData(true)
  }

  const handleReassign = (rosterId: string, newId: string) => {
    const rosterItem = data.roster.find(r => r.id === rosterId)
    if (!rosterItem) {
        alert('Erro: Servidor não encontrado na escala.')
        return
    }

    if (rosterItem.nurse_id === newId) return
    
    // Open Modal to confirm bond type
    setDoubleShiftModal({ 
        isOpen: true, 
        nurseId: newId, 
        sectionId: rosterItem.section_id,
        rosterId: rosterId 
    })
  }

  const handleUpdateObservation = async (rosterId: string, observation: string) => {
    // Optimistic update locally
    setData(prev => ({
        ...prev,
        roster: prev.roster.map(r => 
            r.id === rosterId 
            ? { ...r, observation } 
            : r
        )
    }))

    const res = await updateRosterObservation(rosterId, observation)
    if (!res.success) {
        alert('Erro ao salvar observação')
        await fetchData(true)
    } else {
        // Clear cache but no need for immediate full refresh if UI is correct
        clearCache()
    }
  }

  const handleUpdateSector = async (rosterId: string, sector: string) => {
    // Optimistic update locally
    setData(prev => ({
        ...prev,
        roster: prev.roster.map(r => 
            r.id === rosterId
            ? { ...r, sector }
            : r
        )
    }))

    const res = await updateRosterSector(rosterId, sector)
    if (!res.success) {
        alert('Erro ao salvar setor')
        await fetchData(true)
    } else {
        // Clear cache but no need for immediate full refresh if UI is correct
        clearCache()
    }
  }

  const handleUpdateOrder = async (rosterId: string, listOrder: number | null) => {
    setData(prev => ({
      ...prev,
      roster: prev.roster.map(r =>
        r.id === rosterId
          ? { ...r, list_order: listOrder }
          : r
      )
    }))

    const res = await updateRosterOrder(rosterId, listOrder)
    if (!res.success) {
      alert('Erro ao salvar numeração')
      await fetchData(true)
    } else {
        clearCache()
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
    
    // Optimistic local update for instant UI feedback
    setData(prev => ({
        ...prev,
        sections: prev.sections.map(s => 
            s.id === editingSectorTitleId ? { ...s, sector_title: tempSectorTitle } : s
        )
    }))

    const sectionId = editingSectorTitleId
    const newTitle = tempSectorTitle
    setEditingSectorTitleId(null)

    // Background server update
    try {
        const section = data.sections.find(s => s.id === sectionId)
        if (section) {
            await updateSection(sectionId, section.title, newTitle)
        }
        // No need to full fetchData() here if successful as state is already updated
        // Just clear cache for future reloads
        clearCache()
    } catch (error) {
        console.error('Error saving sector title:', error)
        fetchData(true) // Revert to server state on error
    }
  }

  const handleEditFooter = () => {
      setTempFooterText(footerText || '')
      setIsEditingFooter(true)
  }

  const saveFooterText = async () => {
      // Optimistic Update
      const newText = tempFooterText
      setFooterText(newText)
      setIsEditingFooter(false)

      try {
          const res = await updateScheduleFooter(selectedMonth + 1, selectedYear, selectedUnitId, newText)
          if (res.success) {
              clearCache()
          } else {
              alert(res.message)
              fetchData(true) // Revert on error
          }
      } catch (e) {
          console.error('Error saving footer text:', e)
          fetchData(true)
      }
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

  const handleInsertProfessional = (sectionId: string, index: number, direction: 'above' | 'below', currentOrderedIds: string[]) => {
    const position = direction === 'above' ? index : index + 1
    setInsertionData({ sectionId, position, orderedIds: currentOrderedIds })
    setIsNurseModalOpen(true)
  }

  const handleCreateNewAndInsert = (sectionId: string, index: number, direction: 'above' | 'below', currentOrderedIds: string[]) => {
    const position = direction === 'above' ? index : index + 1
    setInsertionData({ sectionId, position, orderedIds: currentOrderedIds })
    setIsCreationModalOpen(true)
  }

  const onNurseCreated = async (rosterId?: string) => {
    if (!insertionData) return
    setIsCreationModalOpen(false)
    
    const { sectionId, position, orderedIds: previousOrderedIds } = insertionData
    setLoading(true)
    
    try {
        if (rosterId) {
            // Construct the NEW ordered list of roster IDs
            const orderedIds = [...previousOrderedIds]
            
            // Insert the new ID at the target position
            orderedIds.splice(position, 0, rosterId)
            
            // Update the list_order for the entire section (this revalidates)
            const orderRes = await resetSectionOrder(
                sectionId, 
                selectedUnitId || 'ALL', 
                selectedMonth + 1, 
                selectedYear, 
                undefined, 
                orderedIds,
                1 
            )
            
            if (orderRes.success) {
                clearCache()
                await fetchData(true)
            } else {
                alert('Erro ao ordenar: ' + orderRes.message)
            }
        } else {
            // Fallback for when rosterId isn't returned (e.g. legacy update mode)
            clearCache()
            await fetchData(true)
        }
    } catch (error) {
        console.error(error)
        alert('Erro ao processar inserção.')
    } finally {
        setLoading(false)
        setInsertionData(null)
    }
  }

  const onNurseSelected = async (nurseId: string) => {
    if (!insertionData) return
    setIsNurseModalOpen(false)
    
    // Open the DoubleShiftModal to choose the bond type (1ED, AB, or Normal)
    setDoubleShiftModal({
      isOpen: true,
      nurseId,
      sectionId: insertionData.sectionId,
      // We'll pass the position info in a way that finalizeAssignNurse can use it
      isInsertion: true,
      insertionPosition: insertionData.position,
      insertionOrderedIds: insertionData.orderedIds
    })
  }

  const finalizeAssignNurse = async (observation: string) => {
    if (!doubleShiftModal) return
    const { nurseId, sectionId, rosterId, isInsertion, insertionPosition, insertionOrderedIds } = doubleShiftModal as any
    setDoubleShiftModal(null)
    setInsertionData(null)
    
    setLoading(true)
    try {
        if (isInsertion) {
            // INSERTION LOGIC (using the new buttons)
            const res = await assignNurseToRoster(
                nurseId, 
                sectionId, 
                selectedUnitId, 
                selectedMonth + 1, 
                selectedYear, 
                observation, 
                undefined, 
                true, // allow duplicate
                null, // listOrder (initially null)
                true  // skipRevalidate
            )
            
            if (res.success && res.rosterId) {
                const orderedIds = [...(insertionOrderedIds || [])]
                orderedIds.splice(insertionPosition || 0, 0, res.rosterId)
                
                await resetSectionOrder(sectionId, selectedUnitId || 'ALL', selectedMonth + 1, selectedYear, undefined, orderedIds, 1)
                
                clearCache()
                await fetchData(true)
            } else {
                alert('Erro ao adicionar: ' + res.message)
            }
        } else if (rosterId) {
             // REASSIGN (REPLACE) LOGIC
             // Goal: Replace the nurse in this specific roster entry while keeping its position
             const rosterItem = data.roster.find(r => r.id === rosterId)
             if (!rosterItem) {
                 alert('Erro: Registro original não encontrado na escala.')
                 setLoading(false)
                 return
             }

             // Step 1: Capture the current order of IDs in this section
             const currentSectionRoster = data.roster
                .filter(r => r.section_id === sectionId && r.month === selectedMonth + 1 && r.year === selectedYear && (!selectedUnitId || r.unit_id === selectedUnitId))
                .sort((a, b) => (a.list_order || 0) - (b.list_order || 0))
             
             const orderedIds = currentSectionRoster.map(r => r.id)
             const positionIndex = orderedIds.indexOf(rosterId)

             // Step 2: Remove the old entry
             const removeRes = await removeRosterEntry(rosterId)
             if (!removeRes.success) {
                 alert('Erro ao remover servidor anterior: ' + removeRes.message)
                 setLoading(false)
                 return
             }

             // Step 3: Add the new nurse (this puts them at the end initially)
             const allowDuplicate = observation.includes('ED')
             const addRes = await assignNurseToRoster(
                 nurseId, 
                 sectionId, 
                 selectedUnitId, 
                 selectedMonth + 1, 
                 selectedYear, 
                 observation, 
                 rosterItem.created_at, 
                 allowDuplicate,
                 null, // listOrder
                 true  // skipRevalidate
             )
             
             if (addRes.success && (addRes as any).rosterId) {
                const newRosterId = (addRes as any).rosterId

                if (positionIndex !== -1) {
                    // Step 4: Construct the final order replacing the old ID with the new one at the EXACT SAME POSITION
                    const finalOrderedIds = [...orderedIds]
                    finalOrderedIds[positionIndex] = newRosterId
                    
                    await resetSectionOrder(sectionId, selectedUnitId || 'ALL', selectedMonth + 1, selectedYear, undefined, finalOrderedIds, 1)
                }
                
                clearCache()
                await fetchData(true)
             } else {
                 alert('Erro ao adicionar novo servidor: ' + addRes.message)
             }
        } else {
            // ADD TO END LOGIC (from bottom button)
            const isAlreadyInThisSection = data.roster.some(r => 
                r.nurse_id === nurseId && 
                r.section_id === sectionId && 
                r.month === selectedMonth + 1 && 
                r.year === selectedYear &&
                (!selectedUnitId || r.unit_id === selectedUnitId)
            )

            const allowDuplicate = observation.includes('ED') || isAlreadyInThisSection

            const res = await assignNurseToRoster(nurseId, sectionId, selectedUnitId, selectedMonth + 1, selectedYear, observation, undefined, allowDuplicate)
            if (res.success) {
                if ((res as any).warning) alert((res as any).warning)
                clearCache()
                await fetchData(true)
            } else {
                alert('Erro ao adicionar: ' + res.message)
            }
        }
    } catch (error: any) {
        console.error(error)
        alert('Erro ao processar: ' + (error.message || 'Erro desconhecido'))
    } finally {
        setLoading(false)
    }
  }

  const handleCellClick = (nurse: Nurse, dateStr: string, explicitRosterId?: string) => {
    // If saving is in progress, block new manual edits to prevent race conditions
    if (saveQueue.current.length > 0 || isSaving) {
        // Optional: show a small toast or just ignore
        console.warn('Save in progress, blocking edit')
        return
    }

    // Robust rosterId resolution
    // Priority: Explicit ID (from clicked row) > Nurse Property > Fallback Search
    let rosterId = explicitRosterId || (nurse.is_rostered ? nurse.unique_key : undefined)
    
    // Fallback: If rosterId is missing but nurse is in roster, try to find it
    if (!rosterId && data.roster) {
        const entry = data.roster.find(r => 
            r.nurse_id === nurse.id && 
            r.month === selectedMonth + 1 && 
            r.year === selectedYear &&
            (!selectedUnitId || r.unit_id === selectedUnitId)
        )
        if (entry) rosterId = entry.id
    }

    setShiftModalData({
        nurseId: nurse.id,
        rosterId: rosterId,
        nurseName: nurse.name,
        date: dateStr
    })
    
    // Find current shift if exists to restore state
    const currentShift = shiftsLookup.lookup[`${rosterId || nurse.id}_${dateStr}`]
    if (currentShift) {
        setShiftType(currentShift.shift_type)
        setShiftIsRed(!!currentShift.is_red)
    } else {
        setShiftType('day')
        setShiftIsRed(false)
    }

    // Restore last recurrence preference
    const savedRecurrence = typeof window !== 'undefined' ? (localStorage.getItem('enf_hma_last_recurrence') as any || 'none') : 'none'
    setRecurrence(savedRecurrence)
    setLimitShifts('')
    const savedCustomDays = typeof window !== 'undefined' ? (localStorage.getItem('enf_hma_last_custom_days') || '') : ''
    setCustomRecurrenceDays(savedCustomDays)
    setDeleteWholeMonth(false)
    setIsShiftModalOpen(true)
  }

  const handleSaveShifts = async () => {
    if (!shiftModalData) return
    
    // Save recurrence preference
    if (typeof window !== 'undefined') {
        localStorage.setItem('enf_hma_last_recurrence', recurrence)
        localStorage.setItem('enf_hma_last_custom_days', customRecurrenceDays)
    }

    // Close modal immediately for better UX
    setIsShiftModalOpen(false)
    
    try {
        const shiftsToSave: { nurseId: string, rosterId?: string, date: string, type: string, isRed?: boolean }[] = []
        let stopReason = '' // Track why generation stopped
        
        if (shiftType === 'delete' && deleteWholeMonth) {
            // Delete whole month logic
            const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
            for (let day = 1; day <= lastDayOfMonth; day++) {
                const dateString = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                shiftsToSave.push({
                    nurseId: shiftModalData.nurseId,
                    rosterId: shiftModalData.rosterId,
                    date: dateString,
                    type: 'DELETE'
                })
            }
            stopReason = 'delete_whole_month'
        } else {
            // Standard logic
            const startDate = new Date(shiftModalData.date + 'T12:00:00') // Avoid timezone issues
            const startMonth = startDate.getMonth()
            const startYear = startDate.getFullYear()
            
            // Calculate dates based on recurrence
            let currentDateIter = new Date(startDate)
            let count = 0
            
            // Robust limit handling
            let limit = 1000 
            const limitStr = String(limitShifts || '').trim()
            if (limitStr !== '') {
                const parsed = parseInt(limitStr)
                if (!isNaN(parsed) && parsed > 0) {
                    limit = parsed
                }
            }

            // Safety break to prevent infinite loops
            let safetyCounter = 0
            const MAX_ITERATIONS = 500
            
            // Loop while in the same month as start date
            console.log('Starting shift generation loop', { startDate, startMonth, recurrence, limit })
            while (currentDateIter.getMonth() === startMonth && currentDateIter.getFullYear() === startYear) {
                if (safetyCounter >= MAX_ITERATIONS) {
                    console.error('Safety limit reached in shift generation loop')
                    stopReason = 'safety_limit'
                    break
                }
                safetyCounter++
                
                // Special handling for Mon-Fri recurrence
                if (recurrence === 'mon_fri') {
                    const dayOfWeek = currentDateIter.getDay()
                    if (dayOfWeek === 0 || dayOfWeek === 6) { // 0=Sun, 6=Sat
                        currentDateIter.setDate(currentDateIter.getDate() + 1)
                        continue
                    }
                }

                if (limitShifts && count >= limit) {
                     stopReason = 'user_limit'
                     break
                }

                const dateString = `${currentDateIter.getFullYear()}-${String(currentDateIter.getMonth() + 1).padStart(2, '0')}-${String(currentDateIter.getDate()).padStart(2, '0')}`
                
                shiftsToSave.push({
                    nurseId: shiftModalData.nurseId,
                    rosterId: shiftModalData.rosterId,
                    date: dateString,
                    type: shiftType === 'delete' ? 'DELETE' : shiftType, // USE RAW LOWERCASE TYPE
                    isRed: shiftIsRed
                })

                count++

                if (recurrence === 'none') {
                    stopReason = 'single_shift'
                    break
                }
                
                // Safe date increment
                currentDateIter.setDate(currentDateIter.getDate() + 1)
                
                // For non-daily recurrence, we skip more days
                if (recurrence === '12x36') currentDateIter.setDate(currentDateIter.getDate() + 1)
                else if (recurrence === 'every3') currentDateIter.setDate(currentDateIter.getDate() + 2)
                else if (recurrence === '24x72') currentDateIter.setDate(currentDateIter.getDate() + 3)
                else if (recurrence === 'off4') currentDateIter.setDate(currentDateIter.getDate() + 4)
                else if (recurrence === 'off5') currentDateIter.setDate(currentDateIter.getDate() + 5)
                else if (recurrence === 'off6') currentDateIter.setDate(currentDateIter.getDate() + 6)
                else if (recurrence === 'custom') {
                    const days = parseInt(customRecurrenceDays)
                    if (!isNaN(days) && days > 1) {
                        currentDateIter.setDate(currentDateIter.getDate() + (days - 1))
                    }
                }
            }
            stopReason = stopReason || 'month_end'
        }

        console.log(`Generated ${shiftsToSave.length} shifts to save. Reason: ${stopReason}`)
        
        // CONFLICT DETECTION & CONFIRMATION
        // Only if adding/updating (not deleting)
        if (shiftType !== 'delete') {
            // Bulk Confirmation with Details
            if (shiftsToSave.length > 1) {
                 const lastShift = shiftsToSave[shiftsToSave.length - 1]
                 const lastDate = lastShift.date.split('-').reverse().join('/')
                 
                 let reasonText = ''
                 switch (stopReason) {
                     case 'month_change': reasonText = 'Fim do mês alcançado'; break;
                     case 'user_limit': reasonText = `Limite de ${limitShifts} plantões definido pelo usuário`; break;
                     case 'safety_limit': reasonText = 'Limite de segurança do sistema atingido (500 iterações)'; break;
                     case 'single_shift': reasonText = 'Plantão único'; break;
                     default: reasonText = stopReason;
                 }

                 const confirmMsg = `Serão gerados ${shiftsToSave.length} plantões.\n` + 
                                    `Início: ${shiftsToSave[0].date.split('-').reverse().join('/')}\n` + 
                                    `Fim: ${lastDate}\n` +
                                    `Motivo da parada: ${reasonText}\n` +
                                    `\nDeseja confirmar a inclusão?`
                 
                 if (!confirm(confirmMsg)) {
                     setLoading(false)
                     return
                 }
            }
            
            const conflictingDates: string[] = []
            
            shiftsToSave.forEach(newShift => {
                const conflict = data.shifts?.some(s => 
                    s.nurse_id === newShift.nurseId && 
                    s.shift_date === newShift.date && 
                    (s.roster_id && s.roster_id !== newShift.rosterId)
                )
                if (conflict) {
                    conflictingDates.push(newShift.date.split('-').reverse().join('/'))
                }
            })

            if (conflictingDates.length > 0) {
                const uniqueDates = Array.from(new Set(conflictingDates))
                const message = `ATENÇÃO: O profissional já possui plantão em OUTRA ESCALA nas seguintes datas:\n\n${uniqueDates.join(', ')}\n\nDeseja realmente inserir duplicidade?`
                if (!confirm(message)) return
            }
        }

        // USE OUR NEW OPTIMISTIC SAVER
        optimisticSaveShifts(shiftsToSave as any);

    } catch (error) {
        console.error("Error saving shifts:", error)
        alert('Erro ao salvar turno.')
    }
  }

  const daysInMonth = useMemo(() => new Date(selectedYear, selectedMonth + 1, 0).getDate(), [selectedYear, selectedMonth])
  const daysArray = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => {
    const date = new Date(selectedYear, selectedMonth, i + 1)
    return {
      day: i + 1,
      weekday: date.toLocaleDateString('pt-BR', { weekday: 'narrow' }).toUpperCase(),
      isWeekend: date.getDay() === 0 || date.getDay() === 6
    }
  }), [daysInMonth, selectedYear, selectedMonth])

  // Optimize roster lookup for O(1) access
  const rosterMap = useMemo(() => {
      const map: Record<string, any[]> = {}
      if (data.roster) {
          data.roster.forEach(r => {
              if (r.month === selectedMonth + 1 && r.year === selectedYear) {
                  if (!map[r.nurse_id]) map[r.nurse_id] = []
                  map[r.nurse_id].push(r)
              }
          })
      }
      return map
  }, [data.roster, selectedMonth, selectedYear])

  // Identify valid roster IDs for the current unit context
  const currentUnitRosterIds = useMemo(() => {
      const set = new Set<string>()
      if (data.roster) {
          data.roster.forEach(r => {
              if (r.month === selectedMonth + 1 && r.year === selectedYear && (!selectedUnitId || r.unit_id === selectedUnitId)) {
                  set.add(r.id)
              }
          })
      }
      return set
  }, [data.roster, selectedMonth, selectedYear, selectedUnitId])

  const activeNurses = useMemo(() => {
      return data.nurses.flatMap(nurse => {
          const rosterEntries = rosterMap[nurse.id]
          if (rosterEntries && rosterEntries.length > 0) {
              return rosterEntries.map(entry => ({
                  ...nurse,
                  unique_key: entry.id, // Use roster entry ID as unique key
                  section_id: entry.section_id,
                  unit_id: entry.unit_id,
                  is_rostered: true,
                  roster_created_at: entry.created_at,
                  observation: entry.observation,
                  sector: entry.sector,
                  list_order: entry.list_order
              }))
          }
          return [{ ...nurse, unique_key: nurse.id, is_rostered: false }]
      })
  }, [data.nurses, rosterMap])

  // Optimize: Pre-sort nurses to avoid sorting on every render in the dropdown
  // Use allNurses if available, otherwise fallback to rostered nurses
  const sortedUniqueNurses = useMemo(() => {
      const source = allNurses.length > 0 ? allNurses : data.nurses
      return [...source].sort((a, b) => a.name.localeCompare(b.name))
  }, [data.nurses, allNurses])

  // Optimize: Group nurses by section to avoid filtering on every render
  const nursesBySection = useMemo(() => {
      const grouped: Record<string, Nurse[]> = {}
      activeNurses.forEach(n => {
          if (n.section_id && n.is_rostered) {
              if (!grouped[n.section_id]) grouped[n.section_id] = []
              grouped[n.section_id].push(n)
          }
      })
      Object.keys(grouped).forEach(key => {
          grouped[key].sort((a, b) => {
              // Primary sort: List Order (if available)
              if (a.list_order != null && b.list_order != null) {
                  return a.list_order - b.list_order
              }
              if (a.list_order != null) return -1
              if (b.list_order != null) return 1

              // Secondary sort: created_at (to maintain stability regardless of numbering)
              const aTime = a.roster_created_at ? new Date(a.roster_created_at).getTime() : 0
              const bTime = b.roster_created_at ? new Date(b.roster_created_at).getTime() : 0
              if (aTime !== bTime) {
                  return aTime - bTime
              }

              // Tertiary sort: name
              const nameCompare = a.name.localeCompare(b.name)
              if (nameCompare !== 0) return nameCompare

              // Quaternary sort: unique_key (Roster ID) for absolute stability
              return (a.unique_key || '').localeCompare(b.unique_key || '')
          })
      })
      return grouped
  }, [activeNurses])

  // Optimize data access with lookups
  const shiftsLookup = useMemo(() => {
      const lookup: Record<string, Shift> = {} // Key: "rosterId_date" (or nurseId for unrostered)
      const countLookup: Record<string, number> = {} // Key: rosterId
      const weekendCountLookup: Record<string, number> = {} // Key: rosterId
      
      const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`
      
      if (data.shifts) {
          data.shifts.forEach(s => {
              if (s.shift_date.startsWith(monthPrefix)) {
                  let rosterKey = s.roster_id

                  // Strict Isolation: Only include shifts that belong to the current unit context
                  if (s.roster_id && !currentUnitRosterIds.has(s.roster_id)) {
                      return // Skip shifts from other units
                  }

                  if (!rosterKey) {
                      // Legacy shift (no roster_id)
                      // Logic: Assign legacy shifts to the FIRST roster entry found for this nurse IN THIS UNIT.
                      const rosterEntries = rosterMap[s.nurse_id]
                      if (rosterEntries && rosterEntries.length > 0) {
                          // Find "True Home" (Oldest roster entry for this nurse in this month globally)
                          // Legacy shifts should only attach to the oldest roster entry to prevent leakage to new units
                          const sortedAll = [...rosterEntries].sort((a, b) => {
                              const tA = new Date(a.created_at || 0).getTime()
                              const tB = new Date(b.created_at || 0).getTime()
                              if (tA !== tB) return tA - tB
                              return (a.id || '').localeCompare(b.id || '')
                          })
                          const trueHomeId = sortedAll[0].id

                          // Filter entries to match current unit
                          const unitEntries = rosterEntries.filter(r => currentUnitRosterIds.has(r.id))
                          
                          if (unitEntries.length > 0) {
                              const sortedEntries = [...unitEntries].sort((a, b) => {
                                  const tA = new Date(a.created_at || 0).getTime()
                                  const tB = new Date(b.created_at || 0).getTime()
                                  return tA - tB
                              })
                              
                              // Strict Isolation: Only bind legacy shift if this unit holds the "True Home" roster entry
                              if (sortedEntries[0].id === trueHomeId) {
                                  rosterKey = sortedEntries[0].id
                              } else {
                                  return // Skip legacy shift for this secondary unit
                              }
                          } else {
                              // Nurse has roster entries but NONE in this unit.
                              // Skip this shift for this view.
                              return
                          }
                      } else {
                           // Fallback if not rostered anywhere? 
                           // If not rostered, currentUnitRosterIds won't have the nurse_id either (it has roster IDs).
                           // If we want to show "unassigned" shifts in a global view, we keep them.
                           // If selectedUnitId is set, we skip.
                           if (selectedUnitId) return
                           rosterKey = s.nurse_id
                      }
                  }

                  // Populate lookup
                  const key = `${rosterKey}_${s.shift_date}`
                  const existing = lookup[key]

                  // Priority Logic:
                  // 1. Roster-Specific Shift (s.roster_id defined) ALWAYS overwrites Legacy Shift (existing.roster_id undefined)
                  // 2. If both are Roster-Specific or both Legacy, last one wins (or based on created_at if we had it, but simple overwrite is standard)
                  // 3. If existing is Roster-Specific and new is Legacy, IGNORE new.
                  
                  if (existing) {
                      if (existing.roster_id && !s.roster_id) {
                          // Keep existing roster-specific shift, ignore legacy
                      } else {
                          // Overwrite (New is roster-specific OR both are same type)
                          lookup[key] = s
                      }
                  } else {
                      lookup[key] = s
                  }
              }
          })

          // Second pass: Calculate counts based on "Winning" shifts only
          Object.values(lookup).forEach(s => {
              // Re-resolve rosterKey for the winning shift (same logic as above)
              let rosterKey = s.roster_id
              if (!rosterKey) {
                  const rosterEntries = rosterMap[s.nurse_id]
                  if (rosterEntries && rosterEntries.length > 0) {
                       // Sort by created_at to be consistent
                      const sortedEntries = [...rosterEntries].sort((a, b) => {
                          const tA = new Date(a.created_at).getTime()
                          const tB = new Date(b.created_at).getTime()
                          return tA - tB
                      })
                      rosterKey = sortedEntries[0].id
                  } else {
                      rosterKey = s.nurse_id
                  }
              }

              // Populate counts by rosterKey (Line-specific counts)
              // Fix: Ignore FOLGA_VAZIA and other non-working types in counts
              const isWorkingShift = ['day', 'night', 'morning', 'afternoon', 'mt', 'dn'].includes(s.shift_type)
              const weight = !isWorkingShift ? 0 : (s.shift_type === 'dn' ? 2 : 1)
              
              countLookup[rosterKey] = (countLookup[rosterKey] || 0) + weight

              // Check if weekend
              const date = new Date(s.shift_date + 'T12:00:00')
              const day = date.getDay()
              if (day === 0 || day === 6) { // 0=Sun, 6=Sat
                  weekendCountLookup[rosterKey] = (weekendCountLookup[rosterKey] || 0) + weight
              }
          })
      }
      return { lookup, countLookup, weekendCountLookup }
  }, [data.shifts, selectedMonth, selectedYear, rosterMap, currentUnitRosterIds, selectedUnitId])

  const timeOffsLookup = React.useMemo(() => {
      const lookup: Record<string, TimeOff> = {}
      if (data.timeOffs) {
        const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate()
        const monthEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

        data.timeOffs.forEach(t => {
            if (t.end_date < monthStart || t.start_date > monthEnd) return
            // Filter by unit if selected (Strict isolation: only show leaves for this unit)
            // If unit is selected, show leaves with that unit_id.
            // If global leaves (unit_id null) should be shown everywhere, keep them. 
            // But user said "NOMENTE NESSA ESCALA". So if I am in Unit A, I only see Unit A leaves?
            // What if a leave was created before this feature (unit_id null)? It should probably show.
            // So: show if t.unit_id matches OR t.unit_id is null/undefined.
            // BUT user said "NAO VAI APARECER NAS OUTRAS". This implies strictness.
            // If I create in Unit A, it has Unit A ID.
            // If I create in Global, it has Null ID.
            // If I am in Unit B, I should NOT see Unit A.
            // So: if (selectedUnitId && t.unit_id && t.unit_id !== selectedUnitId) return.
            if (selectedUnitId && t.unit_id && t.unit_id !== selectedUnitId) return

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
  }, [data.timeOffs, selectedMonth, selectedYear, selectedUnitId])

  const absencesLookup = React.useMemo(() => {
      const lookup: Record<string, Absence> = {}
      if (data.absences) {
          data.absences.forEach(a => {
             lookup[`${a.nurse_id}_${a.date}`] = a
          })
      }
      return lookup
  }, [data.absences])


  const nurseOrderMap = useMemo(() => {
    const map = new Map<string, number>();
    (data.roster || []).forEach(r => {
      if (r.month === selectedMonth + 1 && r.year === selectedYear && r.list_order !== null && r.list_order !== undefined) {
        map.set(r.id, r.list_order);
      }
    });
    return map;
  }, [data.roster, selectedMonth, selectedYear]);

  const renderGrid = (professionals: Nurse[], section: Section) => {
    const getFirstShiftDay = (nurseId: string) => {
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const shift = shiftsLookup.lookup[`${nurseId}_${dateStr}`]
        if (shift && (shift.shift_type === 'day' || shift.shift_type === 'mt' || shift.shift_type === 'dn')) return day
      }
      return 999
    }

    const sortedProfessionals = professionals.map((p, i) => ({
        nurse: p,
        index: i,
        firstDay: getFirstShiftDay(p.unique_key || p.id),
        isTecnico: (p.role || '').toUpperCase() === 'TECNICO',
        listOrder: nurseOrderMap.get(p.unique_key || '')
    }))

    const professionalsWithRowNumber = sortedProfessionals.map((p, index) => {
      const rawOrder = p.listOrder
      let displayOrder = rawOrder
      if (rawOrder && rawOrder > 10000) {
          displayOrder = rawOrder % 10000
          if (displayOrder === 0) displayOrder = 10000
      }

      const rowNumber =
        displayOrder !== undefined && displayOrder !== null && displayOrder > 0
          ? displayOrder
          : index + 1
          
      const group = rowNumber
      return {
        ...p,
        rowNumber,
        group
      }
    })

    // FIX: A ordem das linhas deve ser baseada no ID da escala (roster item id) ou na data de criação (created_at)
    // Isso garante que a linha NÃO mude de posição ao alterar apenas o número (#).
    // A única forma de mudar a ordem é através do handleMoveRow (setas), que altera o listOrder.
    const orderedProfessionals = [...professionalsWithRowNumber].sort((a, b) => {
        // Se ambos tiverem listOrder, usa o listOrder (que é alterado pelas setas)
        if (a.listOrder !== undefined && a.listOrder !== null && b.listOrder !== undefined && b.listOrder !== null) {
            return a.listOrder - b.listOrder
        }
        
        // Se apenas um tiver listOrder, ele vem primeiro
        if (a.listOrder !== undefined && a.listOrder !== null) return -1
        if (b.listOrder !== undefined && b.listOrder !== null) return 1

        // Fallback: Ordem cronológica de entrada na escala (usando o index original do fetch)
        return a.index - b.index
    })
    
    const handleCopySectorDown = async (startIndex: number, value: string) => {
      const targets = orderedProfessionals.map((x, idx) => ({
          id: x.nurse.unique_key || x.nurse.id, // Use unique_key (roster ID) if available
          group: x.group,
          index: idx
      }))
      
      if (targets.length === 0) return

      setReplicationData({
          value,
          targets,
          startIndex
      })
      setReplicationModalOpen(true)
    }

    return (
      <>
        {orderedProfessionals.map(({ nurse, firstDay, isTecnico, rowNumber }, index) => {
          const totalShifts = shiftsLookup.countLookup[nurse.unique_key || nurse.id] || 0
          const weekendShifts = shiftsLookup.weekendCountLookup[nurse.unique_key || nurse.id] || 0
          
          // Logic: If someone has > 15 shifts but ZERO weekend shifts, they are likely a "Diarista" (Mon-Fri)
          // Diaristas are not paid by shift (Plantão), so their count should be blank.
          const isDiarista = totalShifts >= 15 && weekendShifts === 0
          
          const displayTotal = isDiarista ? '' : totalShifts

          return (
            <tr key={nurse.unique_key || `${nurse.id}-${index}`} className="bg-white hover:bg-gray-50 group">
              <td
                className={`border border-black px-0.5 py-0.5 text-center text-xs font-medium sticky left-0 bg-yellow-400 z-10 w-8 print:w-6 ${isAdmin ? '' : ''}`}
                title={isAdmin ? 'Edite para reiniciar numeração a partir daqui' : undefined}
              >
                {isAdmin ? (
                  <input
                    type="number"
                    defaultValue={rowNumber}
                    className="w-full h-full text-center bg-transparent border-none outline-none focus:bg-gray-100 appearance-none m-0 p-0 text-black font-bold print:text-[12px]"
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        const input = e.target as HTMLInputElement
                        input.blur()
                      }
                    }}
                    onBlur={async (e) => {
                      const newValue = parseInt(e.target.value, 10)
                      if (isNaN(newValue) || newValue < 1) {
                         e.target.value = String(rowNumber)
                         return
                      }
                      
                      if (newValue === rowNumber) return

                      const ok = confirm(`Ao mudar para ${newValue}, este profissional e todos os abaixo dele serão renumerados sequencialmente (${newValue}, ${newValue + 1}, ${newValue + 2}...). A ordem da lista não será alterada. Deseja continuar?`)
                      if (!ok) {
                        e.target.value = String(rowNumber)
                        return
                      }

                      setLoading(true)
                      
                      // FIX: Use the FULL list of professionals in this section to preserve order of non-filtered items
                      const allProfessionalsInSection = (nursesBySection[section.id] || [])
                          .filter(n => !selectedUnitId || n.unit_id === selectedUnitId)
                      
                      const orderedRosterIds = allProfessionalsInSection.map(p => p.unique_key || '')
                      
                      const res = await resetSectionOrder(section.id, selectedUnitId || 'ALL', selectedMonth + 1, selectedYear, nurse.unique_key, orderedRosterIds, newValue)
                      if (!res.success) {
                        alert(res.message || 'Erro ao reiniciar numeração')
                        e.target.value = String(rowNumber)
                      } else {
                        clearCache()
                        await fetchData(true)
                      }
                      setLoading(false)
                    }}
                  />
                ) : (
                  <span className="text-black font-bold print:text-[12px]">{rowNumber}</span>
                )}
              </td>
              <td className="border border-black px-1 py-0.5 text-xs font-medium text-black sticky left-8 bg-white z-10 w-[180px] print:w-[120px] border-r-2 border-r-black text-center">
                <div className="flex items-center justify-center gap-1">
                  {isAdmin && (
                    <div className="flex flex-col gap-1 mr-2 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                       <button 
                           onClick={() => handleInsertProfessional(section.id, index, 'above', orderedProfessionals.map(p => p.nurse.unique_key || ''))}
                           className="text-blue-600 hover:text-blue-800 hover:scale-125 transition-all p-0.5 bg-blue-50 rounded"
                           title="Inserir profissional JÁ CADASTRADO acima desta linha"
                       >
                           <ArrowUpCircle size={16} />
                       </button>
                       <button 
                           onClick={() => handleInsertProfessional(section.id, index, 'below', orderedProfessionals.map(p => p.nurse.unique_key || ''))}
                           className="text-blue-600 hover:text-blue-800 hover:scale-125 transition-all p-0.5 bg-blue-50 rounded"
                           title="Inserir profissional JÁ CADASTRADO abaixo desta linha"
                       >
                           <ArrowDownCircle size={16} />
                       </button>
                    </div>
                  )}
                  {isAdmin && (
                  <button 
                    onClick={() => handleRemoveFromRoster(nurse.unique_key || '')} 
                    className="text-red-500 hover:text-red-700 p-0.5 rounded hover:bg-red-50 transition-colors no-print"
                    title="Remover desta escala mensal"
                  >
                    <Trash2 size={12} />
                  </button>
                  )}
                  {isAdmin ? (
                    <select 
                      value={nurse.id} 
                      onChange={(e) => handleReassign(nurse.unique_key || '', e.target.value)}
                      className={`w-full bg-transparent border-none focus:ring-0 p-0 text-xs font-bold cursor-pointer outline-none uppercase no-print appearance-none text-center ${
                        ((nurse.vinculo || '').toUpperCase().includes('SELETIVO') || (nurse.vinculo || '').toUpperCase().includes('CELETISTA')) ? 'text-green-600' :
                        (nurse.observation || '').toUpperCase().trim() === '1ED' ? 'text-red-600' :
                        (nurse.observation || '').toUpperCase().trim() === '1 ED AB' ? 'text-blue-600' :
                        'text-black'
                      }`}
                    >
                      {/* Option for current nurse to ensure header displays correctly */}
                      {(() => {
                          const vinculo = (nurse.vinculo || '').toUpperCase().trim()
                          let suffix = ''
                          if (vinculo.includes('SELETIVO') || vinculo.includes('CELETISTA')) suffix = ' (SEL)'
                          if ((nurse.observation || '').toUpperCase().includes('AB') || vinculo.includes('ATENÇÃO BÁSICA') || vinculo.includes('ATENCAO BASICA')) suffix += ' (AB)'
                          return (
                            <option value={nurse.id} className="text-black font-bold">
                                {nurse.name}{suffix}
                            </option>
                          )
                      })()}

                      {sortedUniqueNurses.filter(n => n.id !== nurse.id).map(n => {
                        const rosterEntries = rosterMap[n.id] || []
                        const isInCurrentContext = rosterEntries.some(r => r.section_id === section.id && (!selectedUnitId || r.unit_id === selectedUnitId))

                        // Construct label with location info
                        const locations = rosterEntries.map(r => {
                             const sTitle = data.sections.find(s => s.id === r.section_id)?.title
                             const uTitle = data.units.find(u => u.id === r.unit_id)?.title
                             return `${sTitle}${uTitle ? ` (${uTitle})` : ''}`
                        }).filter(Boolean).join(', ')

                        const vinculo = (n.vinculo || '').toUpperCase().trim()
                        let suffix = ''
                        if (vinculo.includes('SELETIVO') || vinculo.includes('CELETISTA')) suffix = ' (SEL)'
                        if (rosterEntries.some(r => r.observation?.includes('AB')) || vinculo.includes('ATENÇÃO BÁSICA') || vinculo.includes('ATENCAO BASICA')) suffix += ' (AB)'

                        let label = `${n.name}${suffix}`

                        if (isInCurrentContext) {
                            // label += ' (Já nesta lista)'
                        } else if (locations) {
                            label += ` - ${locations}`
                        }

                        return (
                            <option 
                                key={n.id} 
                                value={n.id}
                                className={`text-black not-italic normal-case ${isInCurrentContext ? 'font-bold text-blue-600' : 'font-normal'}`}
                                style={{ color: isInCurrentContext ? undefined : 'black' }}
                            >
                                {label}
                            </option>
                        )
                      })}
                    </select>
                  ) : null}
                  <div className={`${isAdmin ? 'hidden print:block' : 'block'} text-center w-full`}>
                  {(() => {
                     const obs = (nurse.observation || '').toUpperCase().trim()
                     const vinculo = (nurse.vinculo || '').toUpperCase().trim()
                     const isSeletivo = vinculo.includes('SELETIVO') || vinculo.includes('CELETISTA')
                     
                     let nameColorClass = "text-black"
                     if (isSeletivo) {
                         nameColorClass = "text-green-600"
                     } else if (obs === '1ED') {
                         nameColorClass = "text-red-600"
                     } else if (obs === '1 ED AB') {
                         nameColorClass = "text-blue-600"
                     }

                     const prefixes = []
                     
                     let displayObs = obs
                     if (displayObs === '1ED') displayObs = ''
                     if (displayObs === '1 ED AB') displayObs = ''
                     if (displayObs === 'AB') displayObs = ''
                     
                     return <span className={`text-xs font-bold ${nameColorClass} uppercase print:text-[12px]`}>
                         {prefixes.map(p => <span key={p} className="mr-1">{p}</span>)}
                         {nurse.name}
                         {(vinculo.includes('SELETIVO') || vinculo.includes('CELETISTA')) && <span className="ml-1">(SEL)</span>}
                         {/* {obs.includes('1ED') && !isSeletivo && <span className="ml-1">(1ED)</span>} */}
                        {(obs.includes('AB') || vinculo.includes('ATENÇÃO BÁSICA') || vinculo.includes('ATENCAO BASICA')) && <span className="ml-1">(AB)</span>}
                        {displayObs ? displayObs : ''}
                     </span>
                   })()}
                   </div>
                </div>
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center text-[10px] print:text-[7.5px] uppercase">{formatRole(nurse.role)}</td>
              <td className="border border-black px-0.5 py-0.5 text-center text-[10px] print:text-[7.5px] uppercase">
                {((nurse.observation || '').includes('1ED') && !(nurse.vinculo || '').toUpperCase().includes('SELETIVO')) ? 'ESCALA DUPLA' : (nurse.vinculo || '-')}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center text-[10px] print:text-[7.5px] uppercase">
                {isAdmin && dynamicField === 'coren' ? (
                  <select
                    value={nurse.coren || ''}
                    onChange={async (e) => {
                      const newCoren = e.target.value
                      setLoading(true)
                      const res = await updateRosterCoren(nurse.unique_key || nurse.id, newCoren)
                      if (res.success) {
                        clearCache()
                        await fetchData(true)
                      } else {
                        alert(res.message || 'Erro ao atualizar COREN')
                      }
                      setLoading(false)
                    }}
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-[10px] print:text-[7.5px] cursor-pointer outline-none text-center appearance-none"
                  >
                    <option value="">-</option>
                    {(() => {
                        // Get all unique CORENs from the nurse database
                        const allCorens = Array.from(new Set(data.nurses.map(n => n.coren).filter(Boolean))).sort()
                        return allCorens.map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))
                    })()}
                  </select>
                ) : (
                  (() => {
                    // Try to find the nurse in the base data.nurses to get the most up-to-date fields
                    const baseNurse = data.nurses.find(n => n.id === nurse.id)
                    const source = baseNurse || nurse
                    const val = source[dynamicField as keyof Nurse]
                    
                    if (dynamicField === 'role') return formatRole(val as string)
                    
                    const displayVal = val || '-'
                    if (dynamicField === 'phone' && displayVal !== '-') {
                        const digits = String(displayVal).replace(/\D/g, '')
                        if (digits.length === 11) {
                            return `(${digits.slice(0, 2)})${digits.slice(2, 7)}-${digits.slice(7)}`
                        } else if (digits.length === 10) {
                            return `(${digits.slice(0, 2)})${digits.slice(2, 6)}-${digits.slice(6)}`
                        }
                    }
                    return String(val)
                  })()
                )}
              </td>
              {!isSetorHidden && (
              <td className="border border-black px-0.5 py-0.5 text-center text-[10px] print:text-[7.5px] uppercase">
                  <SectorCell 
                      initialValue={nurse.sector}
                      onSave={(val) => handleUpdateSector(nurse.unique_key || nurse.id, val)}
                      onCopyDown={(val) => handleCopySectorDown(index, val)}
                      isAdmin={isAdmin}
                  />
              </td>
              )}
              
              {daysArray.map(({ day, weekday, isWeekend }) => {
                const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                
                // Find time off
                const timeOff = timeOffsLookup[`${nurse.id}_${dateStr}`]
                
                // Find absence
                const absence = absencesLookup[`${nurse.id}_${dateStr}`]

                // Find shift
                // Use STRICT lookup by unique_key only. 
                      // Fallback to nurse.id causes shifts from other rosters (same nurse) to leak into this one.
                      const shift = shiftsLookup.lookup[`${nurse.unique_key}_${dateStr}`]

                let cellClass = "border border-black px-0 py-0 h-5 w-6 print:h-5 print:w-5 text-center text-[10px] print:text-[12px] leading-none relative text-black font-bold"
                let content = null

                // Priority: Special Leaves > Shift > Absence > Generic Folga (implicit)
                 const isSpecialLeave = timeOff && ['ferias', 'licenca_saude', 'licenca_maternidade', 'cessao', 'folga'].includes(timeOff.type)

                 if (isSpecialLeave) {
                   const isPending = timeOff.status === 'pending'
                   const pendingClass = isPending ? " opacity-70 border-2 border-dashed border-gray-400" : ""
                   const pendingSuffix = isPending ? "*" : ""

                   if (timeOff.type === 'ferias') {
                        cellClass += " bg-yellow-100 font-bold text-yellow-800" + pendingClass
                        content = "FE" + pendingSuffix
                   }
                   else if (timeOff.type === 'licenca_saude') {
                       cellClass += " bg-green-100 font-bold text-green-800" + pendingClass
                       content = "LS" + pendingSuffix
                   }
                   else if (timeOff.type === 'licenca_maternidade') {
                       cellClass += " bg-pink-100 font-bold text-pink-800" + pendingClass
                       content = "LM" + pendingSuffix
                   }
                   else if (timeOff.type === 'cessao') {
                       cellClass += " bg-cyan-100 font-bold text-cyan-800" + pendingClass
                       content = "CED" + pendingSuffix
                   }
                   else if (timeOff.type === 'folga') {
                       cellClass += " bg-blue-100 font-bold text-blue-800" + pendingClass
                       content = "FO" + pendingSuffix
                   }
                 }
                 else if (shift) {
                   if (shift.shift_type === 'day') content = 'D'
                   else if (shift.shift_type === 'night') content = 'N'
                   else if (shift.shift_type === 'morning') content = 'M'
                   else if (shift.shift_type === 'afternoon') content = 'T'
                   else if (shift.shift_type === 'mt') content = 'MT'
                   else if (shift.shift_type === 'dn') content = 'DN'
                   
                   if (shift.is_red) {
                       cellClass = cellClass.replace('text-black', 'text-red-600 font-extrabold').replace('text-white', 'text-red-400 font-extrabold')
                   }
                }
                else if (absence) {
                   // content = "FT"
                   cellClass += " text-red-600 font-extrabold"
                }
                
                // Highlight weekends (Gray background for entire column, overridden by specific statuses if needed, but image shows gray prevails or mixes)
                // In image, weekend cells are gray. If there is a shift, it's just text on gray.
                if (isWeekend) {
                   // Apply gray if it's NOT a special colored leave
                   const hasSpecialColor = timeOff && ['ferias', 'licenca_saude', 'licenca_maternidade', 'cessao', 'folga'].includes(timeOff.type)
                   
                   if (!hasSpecialColor) {
                       cellClass += " bg-[#3b5998] text-white"
                   }
                }

                return (
                  <td 
                    key={day} 
                    className={`${cellClass} ${isAdmin ? 'cursor-pointer hover:bg-yellow-100 hover:scale-110 hover:shadow-lg hover:z-50 transition-all duration-200' : ''}`}
                    onClick={isAdmin ? () => handleCellClick(nurse, dateStr, nurse.unique_key) : undefined}
                    id={`cell-${nurse.unique_key}-${dateStr}`}
                    tabIndex={isAdmin ? 0 : -1}
                    onKeyDown={isAdmin ? async (e) => {
                      // Block keyboard edits if saving is in progress
                      if (saveQueue.current.length > 0 || isSaving) return

                      const k = e.key.toLowerCase()
                      if (isSpecialLeave) return
                      if (['d','n','m','t','delete','backspace','arrowright','arrowleft'].includes(k)) {
                        e.preventDefault()
                      }
                      if (k === 'arrowright' || k === 'arrowleft') {
                        const delta = k === 'arrowright' ? 1 : -1
                        const targetDay = day + delta
                        if (targetDay >= 1) {
                          const targetDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
                          const el = document.getElementById(`cell-${nurse.unique_key}-${targetDate}`)
                          el?.focus()
                        }
                        return
                      }
                      let type: 'day' | 'night' | 'morning' | 'afternoon' | 'DELETE' | null = null
                      if (k === 'd') type = 'day'
                      else if (k === 'n') type = 'night'
                      else if (k === 'm') type = 'morning'
                      else if (k === 't') type = 'afternoon'
                      else if (k === 'delete' || k === 'backspace') type = 'DELETE'
                      if (!type) return
                      
                      // USE OPTIMISTIC SAVE FOR INSTANT FEEDBACK
                      optimisticSaveShifts([{
                        nurseId: nurse.id,
                        rosterId: nurse.unique_key,
                        date: dateStr,
                        type
                      } as any])
                    } : undefined}
                    title={isAdmin ? "Clique para gerenciar plantão" : undefined}
                  >
                    {content}
                  </td>
                )
              })}
              <td className="border border-black px-0.5 py-0.5 text-center w-16 text-xs print:text-[12px] font-bold">{displayTotal}</td>
            </tr>
          )
        })}
        {/* Add Professional Row Placeholder */}
        {isAdmin && (
        <tr className="no-print bg-white">
          <td className="border border-black px-1 py-1 sticky left-0 bg-yellow-400 z-10"></td>
          <td className="border border-black px-2 py-1 sticky left-8 bg-white z-10 border-r-2 border-r-black w-[180px]">
             <button 
                onClick={() => {
                    const currentRosterIds = (nursesBySection[section.id] || [])
                        .filter(n => !selectedUnitId || n.unit_id === selectedUnitId)
                        .map(n => n.unique_key || '')
                    
                    handleInsertProfessional(section.id, currentRosterIds.length, 'below', currentRosterIds)
                }}
                className="flex items-center gap-2 text-xs text-blue-600 font-bold w-full hover:text-blue-800 transition-colors py-1 px-2"
             >
                <PlusCircle size={14} />
                <span>Adicionar Profissional ao final</span>
             </button>
          </td>
          <td className="border border-black px-1 py-1" colSpan={(isSetorHidden ? 3 : 4) + daysInMonth + 1}></td>
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

  const handleCopySchedule = async () => {
    if (loading) return
    if (!confirm(`Deseja copiar a escala atual (${MONTHS[selectedMonth]}/${selectedYear}) para ${MONTHS[copyTargetMonth]}/${copyTargetYear}?`)) return
    
    setLoading(true)
    try {
        const res = await copyMonthlyRoster(selectedMonth + 1, selectedYear, copyTargetMonth + 1, copyTargetYear, selectedUnitId)
        if (res.success) {
            alert('Escala copiada com sucesso!')
            setIsCopyModalOpen(false)
            // Navigate to the new schedule
            setSelectedMonth(copyTargetMonth)
            setSelectedYear(copyTargetYear)
        } else {
            alert('Erro ao copiar escala: ' + res.message)
        }
    } catch (error) {
        console.error(error)
        alert('Erro interno ao copiar escala.')
    } finally {
        setLoading(false)
        clearCache()
    }
  }

  return (
    <div 
      className={`w-full bg-white ${printOnly ? 'p-0' : 'p-1'} schedule-root`}
    >
      <div className="w-full flex items-center justify-between mb-2 px-2 print:mb-4 print:px-0">
        <div className="flex items-center gap-4">
          <Image 
            src={logoPrefeitura} 
            alt="Prefeitura de Açailândia" 
            width={140} 
            height={48} 
            className="h-12 w-auto object-contain print:h-16"
            priority
          />
          <Image 
            src={logoHma} 
            alt="HMA" 
            width={140} 
            height={48} 
            className="h-12 w-auto object-contain print:h-16" 
            priority
          />
          <div className="print-header-text flex flex-col leading-tight text-[13px] uppercase text-gray-800 print:text-[16px] print:ml-4">
            {!isEditingHeader ? (
              <>
                <span className="font-bold">{headerLine1}</span>
                <span>{headerLine2}</span>
                <span>{headerLine3}</span>
              </>
            ) : (
              <div className="flex flex-col gap-1">
                <input value={headerLine1} onChange={e => setHeaderLine1(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-[13px] bg-white text-black" />
                <input value={headerLine2} onChange={e => setHeaderLine2(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-[13px] bg-white text-black" />
                <input value={headerLine3} onChange={e => setHeaderLine3(e.target.value)} className="border border-gray-300 rounded px-2 py-1 text-[13px] bg-white text-black" />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="print-header-number flex items-center justify-center w-10 h-10 bg-gray-800 text-white font-bold rounded print:w-24 print:h-24 print:text-[48px] print:rounded-xl print:bg-[#1f2933] print:text-white print:border-0">
            {(unitNumber || headerPage) || '1'}
          </div>
          {isAdmin && !printOnly && (
            !isEditingHeader ? (
              <button onClick={() => setIsEditingHeader(true)} className="px-3 py-2 text-xs rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                Editar cabeçalho
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input value={headerPage} onChange={e => setHeaderPage(e.target.value)} className="w-12 border border-gray-300 rounded px-2 py-1 text-xs bg-white text-black" />
                <input value={unitNumber} onChange={e => setUnitNumber(e.target.value)} placeholder="Número do setor" className="w-24 border border-gray-300 rounded px-2 py-1 text-xs bg-white text-black" />
                <button onClick={handleSaveHeader} className="px-3 py-2 text-xs rounded bg-green-600 text-white hover:bg-green-700">
                  Salvar
                </button>
                <button onClick={handleSaveUnitNumber} className="px-3 py-2 text-xs rounded bg-blue-600 text-white hover:bg-blue-700" title="Salvar número do setor">
                  Salvar nº setor
                </button>
                <button onClick={() => setIsEditingHeader(false)} className="px-3 py-2 text-xs rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100">
                  Cancelar
                </button>
              </div>
            )
          )}
        </div>
      </div>

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
                        {[...data.units].sort((a, b) => {
                          const na = parseInt(unitNumbersMap[a.id] || '9999', 10)
                          const nb = parseInt(unitNumbersMap[b.id] || '9999', 10)
                          if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb
                          return a.title.localeCompare(b.title)
                        }).map(unit => {
                          const isReleased = data.releases?.some(r => r.unit_id === unit.id && r.month === selectedMonth + 1 && r.year === selectedYear && r.is_released)
                          const num = unitNumbersMap[unit.id]
                          return (
                            <option key={unit.id} value={unit.id}>
                                {num ? `${num} - ${unit.title}` : unit.title} {isReleased ? '(Laçada)' : ''}
                            </option>
                          )
                        })}
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
                            <input 
                              value={unitNumber} 
                              onChange={e => setUnitNumber(e.target.value)} 
                              placeholder="Nº" 
                              className="ml-2 w-16 border border-gray-300 rounded px-2 py-1 text-xs bg-white text-black"
                            />
                            <button 
                              onClick={handleSaveUnitNumber}
                              className="text-green-600 p-2 hover:bg-gray-100 rounded"
                              title="Salvar número do setor"
                            >
                              <Save size={16} />
                            </button>
                            <button 
                                onClick={handleClearAllUnitRosters}
                                className="text-orange-600 p-2 hover:bg-gray-100 rounded"
                                title="Limpar todo o histórico de escalas deste setor"
                            >
                                <Eraser size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}
            </div>
            <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-black mb-1">Profissão</label>
            <select
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value as any)}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full md:w-48 bg-white text-black"
            >
                <option value="ALL">Todas</option>
                <option value="ENFERMEIRO">Enfermeiro(a)</option>
                <option value="TECNICO">Téc. de Enfermagem</option>
                <option value="MEDICO">Médico(a)</option>
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
            <div className="flex gap-1 items-center">
                <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="border border-gray-300 rounded px-3 py-2 text-sm w-full md:w-32 bg-white text-black"
                >
                    {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                    ))}
                </select>
                {isAdmin && isSetorHidden && (
                    <button 
                        onClick={() => handleToggleSetorVisibility(false)}
                        className="px-2 py-2 bg-gray-600 text-white rounded text-[10px] hover:bg-gray-700 flex items-center gap-1 no-print h-[38px] whitespace-nowrap"
                        title="Reexibir coluna SETOR"
                    >
                        <Plus size={14} /> EXIBIR SETOR
                    </button>
                )}
            </div>
            </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto justify-center mt-2">
           {isSaving && (
                <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded animate-pulse no-print h-[38px]">
                    <span className="animate-spin h-3 w-3 border-2 border-indigo-700 border-t-transparent rounded-full"></span>
                    <span className="text-xs font-medium">Salvando...</span>
                </div>
           )}
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
                <>
                <button 
                    onClick={() => { clearCache(); fetchData(true) }}
                    className="bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded flex items-center justify-center gap-2 text-sm hover:bg-gray-50 transition-colors h-[38px]"
                    title="Recarregar dados da escala"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                    <span className="hidden md:inline">Recarregar</span>
                </button>
                {isAdmin && (
                    <button 
                        onClick={() => {
                            setCopyTargetMonth(selectedMonth === 11 ? 0 : selectedMonth + 1)
                            setCopyTargetYear(selectedMonth === 11 ? selectedYear + 1 : selectedYear)
                            setIsCopyModalOpen(true)
                        }}
                        className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded flex items-center justify-center gap-2 text-sm hover:bg-gray-50 transition-colors h-[38px]"
                        title="Copiar modelo desta escala"
                    >
                        <Copy size={16} />
                        <span className="hidden md:inline">Copiar Modelo</span>
                    </button>
                )}
                {selectedUnitId && (
                    <button 
                        onClick={handlePrintCurrent}
                        className="bg-white text-gray-700 border border-gray-300 px-4 py-2 rounded flex items-center justify-center gap-2 text-sm hover:bg-gray-50 transition-colors h-[38px]"
                        title="Imprimir escala atual"
                    >
                        <Printer size={16} />
                        <span className="hidden md:inline">Imprimir Escala</span>
                    </button>
                )}
                {isAdmin && selectedUnitId && (
                    <button 
                        onClick={handleClearSchedule}
                        className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded flex items-center justify-center gap-2 text-sm hover:bg-red-100 transition-colors h-[38px] w-full md:w-56"
                        title="Excluir toda a escala deste mês para o setor selecionado"
                    >
                        <Trash2 size={16} />
                        <span className="hidden md:inline">Excluir Escala do Mês</span>
                        <span className="md:hidden">Excluir Escala</span>
                    </button>
                )}
                {isScheduleReleased ? (
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
                }
                </>
             )
           )}
        </div>
      </div>

      {/* Logo Inputs - Hidden but accessible via ID */}
      <div className="hidden">
        <input 
            type="file" 
            id="logo-upload" 
            className="hidden" 
            accept="image/png,image/jpeg"
            onChange={handleLogoUpload}
        />
        <input 
            type="file" 
            id="city-logo-upload" 
            className="hidden" 
            accept="image/png,image/jpeg"
            onChange={handleCityLogoUpload}
        />
      </div>

      <div className="print:bg-white bg-white">
      <div className={`overflow-x-visible w-full border-none shadow-none relative schedule-root ${printOnly ? 'print:overflow-visible' : ''}`}>
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
                

                 {visibleSections.map((section, index) => (
                    <div key={section.id}>
                       <table className="w-full table-fixed border-collapse border border-black text-black text-[9px] print:text-[7px]">
                             <colgroup>
                                <col className="w-8 print:w-6" />
                                <col className="w-[180px] print:w-[224px]" />
                                <col className="w-20 print:w-24" />
                                <col className="w-20 print:w-24" />
                                <col className="w-16 print:w-20" />
                                {!isSetorHidden && <col className="w-20 print:w-24" />}
                                {daysArray.map(d => <col key={d.day} className="w-4 print:w-5" />)}
                                <col className="w-12 print:w-16" />
                             </colgroup>
                             <thead>
                                {/* Header Row 1: Unit Title - Only for first section */}
                                {index === 0 && selectedUnitId && (
                                <tr className="bg-[#1e3a5f] text-white">
                                    <th colSpan={(isSetorHidden ? 5 : 6) + daysInMonth + 1} className="border border-black px-0.5 py-0.5 text-center font-bold uppercase text-lg print:text-[12px]">
                                        {data.units.find(u => u.id === selectedUnitId)?.title || 'UNIDADE'}
                                    </th>
                                </tr>
                                )}
                                {/* Header Row 2: Section Title + Month/Year */}
                                <tr className="bg-[#1e3a5f] text-white">
                                    <th colSpan={(isSetorHidden ? 5 : 6) + daysInMonth + 1} className="border border-black px-0.5 py-0.5 text-center font-bold uppercase text-lg print:text-[12px] relative group">
                                        ESCALA {section.title} - {MONTHS[selectedMonth]} {selectedYear}
                                        {isAdmin && (
                                            <button 
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    const ok = confirm(`AVISO: Isso irá remover TODOS os profissionais e plantões do grupo "${section.title}" desta escala de ${MONTHS[selectedMonth]}/${selectedYear}. Deseja continuar?`);
                                                    if (!ok) return;
                                                    setLoading(true);
                                                    const res = await clearSectionRoster(selectedMonth + 1, selectedYear, selectedUnitId || null, section.id);
                                                    if (res.success) {
                                                        clearCache();
                                                        await fetchData(true);
                                                    } else {
                                                        alert(res.message || 'Erro ao remover grupo');
                                                    }
                                                    setLoading(false);
                                                }}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-red-400 hover:text-red-200 opacity-0 group-hover:opacity-100 transition-opacity no-print"
                                                title="Remover este grupo inteiro desta escala mensal"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}
                                    </th>
                                </tr>
                                {/* Main Headers Row 3 (Columns) */}
                                <tr className="bg-[#85b1e2] text-black">
                                    <th 
                                      className="border border-black px-0.5 py-0.5 text-center sticky left-0 bg-[#85b1e2] z-20 font-bold cursor-pointer select-none text-sm print:text-[14px] print:w-6"
                                      rowSpan={2}
                                  onClick={async () => {
                                    if (!isAdmin) return
                                    const ok = confirm('Deseja reiniciar toda a numeração deste grupo começando em 1? A ordem visual de TODOS os profissionais deste grupo (mesmo os ocultos por filtro) será preservada.')
                                    if (!ok) return
                                    setLoading(true)
                                    
                                    // FIX: Use the FULL list of professionals in this section to preserve order of non-filtered items
                                    const allProfessionalsInSection = (nursesBySection[section.id] || [])
                                        .filter(n => !selectedUnitId || n.unit_id === selectedUnitId)
                                    
                                    const orderedIds = allProfessionalsInSection.map(p => p.unique_key || '')
                                    
                                    const res = await resetSectionOrder(section.id, selectedUnitId || 'ALL', selectedMonth + 1, selectedYear, undefined, orderedIds)
                                    if (!res.success) {
                                      alert(res.message || 'Erro ao reiniciar numeração')
                                    } else {
                                      clearCache()
                                      await fetchData(true)
                                    }
                                    setLoading(false)
                                  }}
                                  title={isAdmin ? 'Clique para reiniciar numeração deste grupo' : undefined}
                                >
                                  #
                                </th>
                                <th className="border border-black px-0.5 py-0.5 text-center w-[180px] print:w-[224px] sticky left-8 bg-[#85b1e2] z-20 border-r-2 border-r-black font-bold uppercase text-sm print:text-[14px] group" rowSpan={2}>
                                     {editingSectionId === section.id ? (
                                        <div className="flex items-center gap-1 w-full justify-center text-black">
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
                                            <span className="flex-1 text-center">NOME COMPLETO</span>
                                        </div>
                                    )}
                                </th>
                                <th className="border border-black px-0.5 py-0.5 text-center w-20 print:w-24 font-bold text-sm print:text-[14px] bg-[#85b1e2]" rowSpan={2}>CATEGORIA</th>
                                <th className="border border-black px-0.5 py-0.5 text-center w-20 print:w-24 font-bold text-sm print:text-[14px] bg-[#85b1e2]" rowSpan={2}>VÍNCULO</th>
                                <th className="border border-black px-0.5 py-0.5 text-center w-16 print:w-20 font-bold text-sm print:text-[14px] bg-[#85b1e2]" rowSpan={2}>
                                    <span className="uppercase">{dynamicField === 'role' ? 'CATEGORIA' : dynamicField}</span>
                                </th>
                                {!isSetorHidden && (
                                <th className="border border-black px-0.5 py-0.5 text-center w-20 print:w-24 font-bold text-sm print:text-[14px] bg-[#85b1e2] group relative" rowSpan={2}>
                                    {isAdmin && (
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleToggleSetorVisibility(true);
                                            }}
                                            className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity z-10 no-print"
                                            title="Ocultar coluna SETOR nesta escala"
                                        >
                                            <X size={10} />
                                        </button>
                                    )}
                                    {editingSectorTitleId === section.id ? (
                                        <div className="flex items-center gap-1 w-full h-full text-black">
                                            <input 
                                                value={tempSectorTitle}
                                                onChange={(e) => setTempSectorTitle(e.target.value)}
                                                className="w-full text-[10px] bg-white text-black border border-gray-300 rounded px-1 h-full min-h-[20px]"
                                                autoFocus
                                                onBlur={saveSectorTitle}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveSectorTitle();
                                                    if (e.key === 'Escape') setEditingSectorTitleId(null);
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </div>
                                    ) : (
                                        <div 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                startEditingSectorTitle(section);
                                            }}
                                            className={`w-full h-full flex items-center justify-center min-h-[20px] break-words leading-tight ${isAdmin ? "cursor-pointer hover:text-blue-200" : ""}`}
                                            title={isAdmin ? "Clique para editar (salva automaticamente ao sair)" : ""}
                                        >
                                            {section.sector_title || 'SETOR LABORAL'}
                                        </div>
                                    )}
                                </th>
                                )}
                                {daysArray.map(({ day, weekday, isWeekend }) => (
                                    <th key={`wd-${day}`} className={`border border-black px-0 py-0 text-center w-4 print:w-5 text-[10px] print:text-[12px] font-bold ${isWeekend ? 'bg-[#3b5998] text-white' : 'bg-[#85b1e2] text-black'}`}>
                                    {weekday}
                                    </th>
                                ))}
                                <th className="border border-black px-0.5 py-0.5 text-center w-12 print:w-16 font-bold text-sm print:text-[14px] bg-[#85b1e2]">TOTAL</th>
                            </tr>
                            {/* Main Headers Row 2 */}
                            <tr className="bg-[#85b1e2] text-black">
                                {daysArray.map(({ day, isWeekend }) => (
                                    <th key={`d-${day}`} className={`border border-black px-0 py-0 text-center w-4 print:w-5 text-[10px] print:text-[12px] font-bold ${isWeekend ? 'bg-[#3b5998] text-white' : 'bg-[#85b1e2] text-black'}`}>
                                      {day}
                                    </th>
                                ))}
                                <th className="border border-black px-0.5 py-0.5 text-center w-12 print:w-16 font-bold text-sm print:text-[14px] bg-[#85b1e2]">PLANTÃO</th>
                            </tr>
                        </thead>
                        <tbody>
                            {renderGrid(
                                (nursesBySection[section.id] || [])
                                  .filter(n => !selectedUnitId || n.unit_id === selectedUnitId)
                                  .filter(n => selectedRoleFilter === 'ALL' ? true : (n.role || '').toUpperCase() === selectedRoleFilter),
                                section
                            )}
                        </tbody>
                        <tfoot>
                        </tfoot>
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
                    {data.sections.map(s => {
                      const alreadyVisible = !!visibleSections.find(vs => vs.id === s.id)
                      return (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      )
                    })}
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
      </div>

      <LeaveManagerModal
        isOpen={!!leaveModalType}
        onClose={() => setLeaveModalType(null)}
        onSuccess={() => {
            fetchData(true)
            setLeaveModalType(null)
        }}
        nurses={allNurses.length > 0 ? allNurses : data.nurses}
        isFetchingNurses={isFetchingAllNurses || (allNurses.length === 0 && data.nurses.length === 0)}
        existingLeaves={data.timeOffs}
        type={leaveModalType || 'ferias'}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        unitId={selectedUnitId}
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
      <div className="mt-0 space-y-2 print:mt-0 bg-white print-footer-legend">
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
        <div className="flex flex-col gap-1 mt-4 no-print-break">
        {['ferias', 'licenca_saude', 'licenca_maternidade', 'cessao', 'folga'].map(type => {
            const label = type === 'ferias' ? 'FÉRIAS' : 
                         type === 'licenca_saude' ? 'LICENÇA SAÚDE' :
                         type === 'licenca_maternidade' ? 'LICENÇA MATERNIDADE' : 
                         type === 'folga' ? 'FOLGA' : 'CESSÃO'
            
            // Find nurses with this leave type in this month
            const pad = (n: number) => n.toString().padStart(2, '0')
            const monthStartStr = `${selectedYear}-${pad(selectedMonth + 1)}-01`
            const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
            const monthEndStr = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(lastDayOfMonth)}`

            const activeLeaves = data.timeOffs
                .filter(t => {
                    if (t.type !== type) return false
                    if (!t.start_date || !t.end_date) return false
                    
                    // Simple month overlap check
                    if (t.end_date < monthStartStr || t.start_date > monthEndStr) return false

                    // If unit is selected, filter by unit_id
                    if (selectedUnitId && t.unit_id && t.unit_id !== selectedUnitId) return false

                    return true
                })
                .map(t => {
                    const nurse = data.nurses.find(n => n.id === t.nurse_id)
                    return nurse ? `${nurse.name}${t.status === 'pending' ? '*' : ''}` : ''
                })
                .filter(Boolean)
                .join(', ')
            
            if (!activeLeaves) return null

            return (
                <div key={type} className="bg-white text-black border border-black px-1 py-0.5 text-xs print:text-[10px] font-bold uppercase flex items-center">
                    <span className="mr-2 whitespace-nowrap">{label}:</span>
                    <span className="font-normal truncate">{activeLeaves}</span>
                </div>
            )
        })}
        </div>

        {/* Footer Text Display */}
        {footerText && (
            <div className="mt-1 text-xs print:text-[10px] print:font-bold text-black whitespace-pre-wrap border p-2 rounded bg-gray-50 border-gray-200 print:border-none print:bg-white print:p-0">
                {footerText}
            </div>
        )}


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
                <input 
                    value={newUnitNumber}
                    onChange={e => setNewUnitNumber(e.target.value)}
                    className="w-full border p-2 mb-4 rounded text-black"
                    placeholder="Número do setor (ex: 12)"
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

      {/* Copy Schedule Modal */}
      {isCopyModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-sm">
                <h3 className="font-bold text-lg mb-4 text-black">Copiar Escala (Modelo)</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Selecione o mês e ano de destino para copiar a escala atual.
                    <br/>
                    <span className="text-red-500 font-bold">Atenção:</span> Se já houver escala no destino, os profissionais serão mesclados (duplicatas ignoradas).
                </p>
                
                <div className="mb-4">
                    <label className="block text-sm font-medium text-black mb-1">Mês de Destino</label>
                    <select 
                        value={copyTargetMonth} 
                        onChange={(e) => setCopyTargetMonth(parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white text-black"
                    >
                        {MONTHS.map((m, i) => (
                            <option key={i} value={i}>{m}</option>
                        ))}
                    </select>
                </div>
                
                <div className="mb-6">
                    <label className="block text-sm font-medium text-black mb-1">Ano de Destino</label>
                    <select 
                        value={copyTargetYear} 
                        onChange={(e) => setCopyTargetYear(parseInt(e.target.value))}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white text-black"
                    >
                        {YEARS.map((y) => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => setIsCopyModalOpen(false)}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleCopySchedule}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
                        disabled={loading}
                    >
                        {loading && <span className="animate-spin h-3 w-3 border-2 border-white border-t-transparent rounded-full"></span>}
                        Copiar
                    </button>
                </div>
            </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 5mm 15mm !important;
          }
          .no-print {
            display: none !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background-color: #ffffff !important;
          }
          th, td {
            position: static !important;
          }
          table, th, td {
            border-color: #000000 !important;
          }
          .schedule-root {
            margin: 0 !important;
            padding: 0 !important;
            padding-left: 5mm !important; /* Safety margin for paper edges */
            background-color: #ffffff !important;
            width: 100% !important;
            zoom: 0.85; /* Better for print, doesn't leave gaps */
            text-rendering: optimizeLegibility !important;
            -webkit-print-color-adjust: exact !important;
          }
          /* Fallback for browsers that don't support zoom (like Firefox) */
          @supports not (zoom: 1) {
            .schedule-root {
              width: 117.65% !important;
              transform: scale(0.85) !important;
              transform-origin: top left !important;
              margin-bottom: -15% !important;
            }
          }
          .schedule-root * {
            font-size: 12px !important;
            color: inherit;
            border-color: black !important;
          }
          .print-footer-legend {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          .schedule-root .print-header-number, 
          .schedule-root .print-header-number * {
            font-size: 48px !important;
            color: white !important;
          }
          .schedule-root .print-header-text, 
          .schedule-root .print-header-text * {
            font-size: 16px !important;
          }
          .schedule-root .whitespace-pre-wrap {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            font-weight: bold !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .schedule-root th {
            font-size: 14px !important;
          }
          .schedule-root td, .schedule-root th {
            color: black;
          }
          .schedule-root thead tr, 
          .schedule-root thead th,
          .schedule-root thead td,
          .schedule-root .bg-\[\#1e3a5f\], 
          .schedule-root .bg-\[\#1e3a5f\] *,
          .schedule-root .bg-\[\#3b5998\],
          .schedule-root .bg-\[\#3b5998\] *,
          .schedule-root .bg-\[\#5072a7\],
          .schedule-root .bg-\[\#5072a7\] * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color: white !important;
          }
          .schedule-root .bg-\[\#1e3a5f\], 
          .schedule-root .bg-\[\#1e3a5f\] * {
            background-color: #1e3a5f !important;
          }
          .schedule-root .bg-\[\#3b5998\], 
          .schedule-root .bg-\[\#3b5998\] * {
            background-color: #3b5998 !important;
          }
          .schedule-root .bg-\[\#5072a7\], 
          .schedule-root .bg-\[\#5072a7\] * {
            background-color: #5072a7 !important;
          }
          .schedule-root .text-white { color: white !important; }
          .schedule-root .text-red-600 { color: #dc2626 !important; }
          .schedule-root .text-green-600 { color: #16a34a !important; }
          .schedule-root .text-blue-600 { color: #2563eb !important; }
          .schedule-root .bg-yellow-400 { 
            background-color: #facc15 !important; 
            color: black !important;
          }
          /* Special Leaves Colors for Print */
          .schedule-root .bg-yellow-100 { background-color: #fef9c3 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .schedule-root .bg-green-100 { background-color: #dcfce7 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .schedule-root .bg-pink-100 { background-color: #fce7f3 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .schedule-root .bg-cyan-100 { background-color: #cffafe !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          .schedule-root .bg-blue-100 { background-color: #dbeafe !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          
          .schedule-root .text-yellow-800 { color: #854d0e !important; }
          .schedule-root .text-green-800 { color: #166534 !important; }
          .schedule-root .text-pink-800 { color: #9d174d !important; }
          .schedule-root .text-cyan-800 { color: #155e75 !important; }
          .schedule-root .text-blue-800 { color: #1e40af !important; }
          .schedule-root .bg-yellow-400 * {
            color: black !important;
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
                            onClick={() => setShiftType('mt')}
                            className={`flex-1 min-w-[60px] py-2 px-2 rounded border ${shiftType === 'mt' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}
                        >
                            MT
                        </button>
                        <button 
                            onClick={() => setShiftType('dn')}
                            className={`flex-1 min-w-[60px] py-2 px-2 rounded border ${shiftType === 'dn' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}
                        >
                            DN
                        </button>
                        <button 
                            onClick={() => {
                                setShiftType('delete')
                                setDeleteWholeMonth(false)
                                setRecurrence('none') // Force single day deletion by default
                            }}
                            className={`flex-1 min-w-[60px] py-2 px-2 rounded border ${shiftType === 'delete' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-black border-gray-300 hover:bg-gray-50'}`}
                        >
                            Limpar
                        </button>
                    </div>
                </div>

                {/* Red Color Toggle */}
                {shiftType !== 'delete' && (
                    <div className="mb-6 bg-red-50 p-3 rounded-lg border border-red-100">
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input 
                                type="checkbox" 
                                checked={shiftIsRed} 
                                onChange={(e) => setShiftIsRed(e.target.checked)}
                                className="w-4 h-4 text-red-600 rounded border-gray-300 focus:ring-red-500"
                            />
                            <div>
                                <p className="text-sm font-bold text-red-700">Cor da Letra: Vermelho</p>
                                <p className="text-xs text-red-600/70">A letra do turno ficará vermelha para este registro.</p>
                            </div>
                        </label>
                    </div>
                )}

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
                            onChange={(e) => {
                                const val = e.target.value as any
                                setRecurrence(val)
                                setLimitShifts('') // Reset limit when changing recurrence to prevent confusion
                                if (typeof window !== 'undefined') localStorage.setItem('enf_hma_last_recurrence', val)
                            }}
                            className="w-full border p-2 rounded text-black bg-white"
                        >
                            <option value="none">Apenas este dia</option>
                            <option value="daily">Todos os dias (Diário)</option>
                            <option value="mon_fri">De Segunda a Sexta</option>
                            <option value="12x36">A cada 2 dias (12x36 - Dia sim, dia não)</option>
                            <option value="every3">A cada 3 dias</option>
                            <option value="24x72">A cada 4 dias (24x72)</option>
                            <option value="off4">Folga de 4 dias (Trabalha 1, Folga 4)</option>
                            <option value="off5">Folga de 5 dias (Trabalha 1, Folga 5)</option>
                            <option value="off6">Folga de 6 dias (Trabalha 1, Folga 6)</option>
                            <option value="custom">Personalizado (Repetir a cada X dias)</option>
                        </select>
                        
                        {recurrence === 'custom' && (
                            <div className="mt-2">
                                <label className="block text-sm font-medium text-black mb-1">Repetir a cada (dias)</label>
                                <input 
                                    type="number"
                                    value={customRecurrenceDays}
                                    onChange={e => {
                                        const val = e.target.value
                                        setCustomRecurrenceDays(val)
                                        if (typeof window !== 'undefined') localStorage.setItem('enf_hma_last_custom_days', val)
                                    }}
                                    placeholder="Ex: 8 para folga de 7 dias"
                                    className="w-full border p-2 rounded text-black bg-white text-sm"
                                    min="1"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Ex: Coloque 2 para dia sim/dia não (12x36). Coloque 5 para Trabalha 1/Folga 4.
                                </p>
                            </div>
                        )}

                        <div className="mt-4">
                             <label className="block text-sm font-medium text-black mb-1">Limitar preenchimento (Opcional)</label>
                             <input 
                                type="number"
                                value={limitShifts}
                                onChange={e => setLimitShifts(e.target.value)}
                                placeholder="Deixe vazio para preencher até o fim do mês"
                                className="w-full border p-2 rounded text-black bg-white text-sm"
                                autoComplete="off"
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
            {(() => {
                const targetNurse = data.nurses.find(n => n.id === doubleShiftModal.nurseId)
                // Check directly in roster to handle multiple entries correctly
                const isAlreadyInThisSection = data.roster.some(r => 
                    r.nurse_id === doubleShiftModal.nurseId && 
                    r.section_id === doubleShiftModal.sectionId && 
                    r.month === selectedMonth + 1 && 
                    r.year === selectedYear &&
                    (!selectedUnitId || r.unit_id === selectedUnitId)
                )
                
                return (
                    <>
                        <h3 className="text-lg font-bold mb-4 text-gray-900">
                            {doubleShiftModal.rosterId ? 'Substituir Profissional' : 'Adicionar Profissional'}
                        </h3>
                        <p className="mb-6 text-gray-700">
                            {isAlreadyInThisSection 
                                ? <span className="text-red-600 font-bold">Este profissional já está na lista. Escolha o tipo de vínculo para a nova entrada:</span>
                                : (doubleShiftModal.rosterId 
                                    ? 'Escolha o tipo de vínculo para o novo profissional:' 
                                    : 'Este vínculo é uma escala dupla?')}
                        </p>
                        
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
                    </>
                )
            })()}
          </div>
        </div>
      )}
      {/* Replication Modal */}
      {replicationModalOpen && replicationData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-sm">
                <h3 className="font-bold text-lg mb-4 text-black">Replicar Setor</h3>
                <p className="text-sm text-gray-600 mb-4">
                    Você deseja replicar <strong>&quot;{replicationData.value}&quot;</strong> para quem?
                </p>

                <div className="flex flex-col gap-2">
                    <button 
                        onClick={handleExecuteReplicationAllBelow}
                        className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-black w-full text-left flex justify-between"
                    >
                        <span>Repetir em todos os campos abaixo</span>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                            {replicationData.targets.filter(t => t.index >= replicationData.startIndex).length} prof.
                        </span>
                    </button>
                    {[1, 2, 3, 4, 5].map(num => (
                        <button 
                            key={num}
                            onClick={() => handleExecuteReplication(num)}
                            className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-black w-full text-left flex justify-between"
                        >
                            <span>Repetir em todos que são número {num} na lista</span>
                            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
                                {replicationData.targets.filter(t => t.group === num).length} prof.
                            </span>
                        </button>
                    ))}
                </div>

                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={() => {
                            setReplicationModalOpen(false)
                            setReplicationData(null)
                        }}
                        className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
      )}
      {/* SQL Instruction Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-2xl">
                <h3 className="font-bold text-lg mb-4 text-red-600">Atenção: Atualização de Banco de Dados Necessária</h3>
                <p className="text-sm text-gray-700 mb-4">
                    {sqlModalType === 'V11' 
                        ? 'Para permitir a duplicidade de servidores (Escala Dupla), é necessário executar um comando no banco de dados.'
                        : sqlModalType === 'V14' 
                            ? 'Para permitir a troca de campos dinâmicos no cabeçalho, é necessário adicionar uma nova coluna ao banco de dados.'
                            : sqlModalType === 'V15'
                                ? 'Para permitir o cadastro de CRM e Telefone, é necessário adicionar novas colunas à tabela de profissionais.'
                                : 'Para permitir ocultar a coluna SETOR, é necessário adicionar uma nova coluna à tabela de metadados.'}
                    Como esta é uma operação de segurança, você precisa rodar manualmente no Supabase.
                </p>
                
                <div className="bg-gray-100 p-4 rounded mb-4 overflow-auto max-h-60">
                    <pre className="text-xs text-black whitespace-pre-wrap font-mono">
{sqlModalType === 'V11' ? `-- Execute este código FINAL no SQL Editor do Supabase:
-- Este script remove TODAS as restrições e índices únicos (exceto chave primária).

DO $$ 
DECLARE 
  r RECORD;
BEGIN 
  -- 1. Remove constraints UNIQUE (exceto chave primária)
  FOR r IN (SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'monthly_rosters' AND constraint_type = 'UNIQUE') LOOP 
    EXECUTE 'ALTER TABLE monthly_rosters DROP CONSTRAINT ' || quote_ident(r.constraint_name); 
  END LOOP; 
  
  -- 2. Remove índices UNIQUE soltos (exceto chave primária)
  FOR r IN (
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'monthly_rosters' 
    AND indexdef LIKE '%UNIQUE%'
    AND indexname NOT LIKE '%pkey'
    AND indexname != 'monthly_rosters_pkey'
  ) LOOP
    EXECUTE 'DROP INDEX IF EXISTS ' || quote_ident(r.indexname);
  END LOOP;
END $$;
` : sqlModalType === 'V14' ? `-- Execute este código no SQL Editor do Supabase (V14):
-- Este script adiciona a coluna dynamic_field na tabela de metadados.

ALTER TABLE monthly_schedule_metadata 
ADD COLUMN IF NOT EXISTS dynamic_field TEXT DEFAULT 'coren';
` : sqlModalType === 'V15' ? `-- Execute este código no SQL Editor do Supabase (V15):
-- Este script adiciona as colunas crm e phone na tabela nurses.

ALTER TABLE nurses 
ADD COLUMN IF NOT EXISTS crm TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
` : `-- Execute este código no SQL Editor do Supabase (V16):
-- Este script adiciona a coluna is_setor_hidden na tabela de metadados.

ALTER TABLE monthly_schedule_metadata 
ADD COLUMN IF NOT EXISTS is_setor_hidden BOOLEAN DEFAULT FALSE;
`}
                    </pre>
                </div>

                <div className="flex justify-end gap-2">
                    <a 
                        href="https://supabase.com/dashboard/project/umvjzgurzkldqyxzkkaq/sql/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold flex items-center"
                    >
                        1. Abrir Supabase SQL
                    </a>
                    <button 
                        onClick={() => setShowSqlModal(false)}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
                    >
                        2. Já executei, fechar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Nurse Selection Modal for Insertion */}
      {isNurseModalOpen && (
          <NurseSelectionModal 
              isOpen={isNurseModalOpen}
              onClose={() => setIsNurseModalOpen(false)}
              onSelect={onNurseSelected}
              nurses={allNurses.length > 0 ? allNurses : data.nurses}
              isFetching={isFetchingAllNurses}
              sectionTitle={data.sections.find(s => s.id === insertionData?.sectionId)?.title}
              existingNurseIds={[]} // Allow adding someone already in the list for double scale
          />
      )}

      {/* Nurse Creation Modal for Insertion */}
      {isCreationModalOpen && (
          <NurseCreationModal 
              isOpen={isCreationModalOpen}
              onClose={() => setIsCreationModalOpen(false)}
              onSuccess={onNurseCreated}
              defaultSectionId={insertionData?.sectionId}
              defaultUnitId={selectedUnitId}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              sections={data.sections}
          />
      )}
    </div>
  )
}
