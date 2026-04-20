'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import Image from 'next/image'
import logoHma from '@/public/logo-hma.png'
import logoPrefeitura from '@/public/logo-prefeitura.png'
import { QRCodeSVG } from 'qrcode.react'
import { getMonthlyScheduleData, deleteNurse, reassignNurse, assignNurseToSection, assignNurseToRoster, removeNurseFromRoster, removeRosterEntry, copyMonthlyRoster, addSection, updateSection, deleteSection, saveShifts, updateRosterObservation, updateRosterSector, updateRosterCoren, uploadLogo, uploadCityLogo, getMonthlyNote, saveMonthlyNote, releaseSchedule, unreleaseSchedule, updateScheduleFooter, updateScheduleDynamicField, updateScheduleSetorVisibility, Section, Unit, resetSectionOrder, clearMonthlySchedule, clearSectionRoster, clearAllUnitRosters, updateRosterListOrders, saveUnitNumber, getAllUnitNumbers, getAllNurses, updateRosterOrder, exportMonthlySchedule, importMonthlySchedule, clearAllDatabaseShifts, getScalePermissions, getMyScalePermissionUnitIds, addScalePermission, addScalePermissions, removeScalePermission, getUnitMonthStatuses, getEditableUnits, setRosterNameStar } from '@/app/actions'
import { addUnit, updateUnit, deleteUnit } from '@/app/unit-actions'
import { Trash2, Plus, Pencil, Save, X, Check, Copy, ArrowDown, Printer, Eraser, UserPlus, ArrowUpCircle, ArrowDownCircle, PlusCircle, EyeOff } from 'lucide-react'
import { formatRole } from '@/lib/utils'
import NurseCreationModal from './NurseCreationModal'
import LeaveManagerModal, { LeaveType } from './LeaveManagerModal'
import NurseSelectionModal from './NurseSelectionModal'

interface Nurse {
  id: string
  name: string
  name_star?: boolean
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
  status?: string
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
  printValue,
  onSave,
  onCopyDown,
  isAdmin,
  className = ""
}: { 
  initialValue: string | undefined, 
  printValue?: string,
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
    return <span className={`text-[10px] print:text-[8px] uppercase block font-bold print:font-normal text-black text-center ${className}`}>{printValue ?? value}</span>
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
        <span className={`text-[10px] print:text-[8px] uppercase hidden print:block font-bold print:font-normal text-black w-full h-full text-center ${className}`}>{printValue ?? value}</span>
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
  const [hasHydrated, setHasHydrated] = useState(false)
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
  const [isUnitManagerOpen, setIsUnitManagerOpen] = useState(false)

  // Footer Text State
  const [footerText, setFooterText] = useState<string>('')
  const [isEditingFooter, setIsEditingFooter] = useState(false)
  const [tempFooterText, setTempFooterText] = useState('')
  const footerEditorRef = useRef<HTMLDivElement>(null)

  // Shift Management State
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false)
  const [shiftModalData, setShiftModalData] = useState<{nurseId: string, rosterId?: string, nurseName: string, date: string} | null>(null)
  const [manualRed, setManualRed] = useState(false)
  const [manualBaseType, setManualBaseType] = useState<Shift['shift_type'] | null>(null)
  const [shiftType, setShiftType] = useState<'day' | 'night' | 'morning' | 'afternoon' | 'mt' | 'dn' | 'dn4' | 'nd4' | 'delete'>('day')
  const [recurrence, setRecurrence] = useState<'none' | 'daily' | 'mon_fri' | '12x36' | '24x72' | 'every3' | 'd_off2' | 'off4' | 'off5' | 'off6' | 'dn_off3' | 'dn_off4' | 'nd_off4' | 'dn_off5' | 'dn_off6' | 'dn_off7' | 'dn_off8' | 'custom'>('none')
  const [customRecurrenceDays, setCustomRecurrenceDays] = useState<string>('')
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
  const [displayDynamicField, setDisplayDynamicField] = useState<'coren' | 'crm' | 'phone' | 'cpf' | 'vinculo' | 'role'>('coren')
  const [isSetorHidden, setIsSetorHidden] = useState(false)

  // Insertion State
  const [isNurseModalOpen, setIsNurseModalOpen] = useState(false)
  const [isCreationModalOpen, setIsCreationModalOpen] = useState(false)
  const [insertionData, setInsertionData] = useState<{ sectionId: string, position: number, rosterId?: string, orderedIds: string[] } | null>(null)
  const [reassignData, setReassignData] = useState<{ rosterId: string, sectionId: string } | null>(null)
  const [isReassignModalOpen, setIsReassignModalOpen] = useState(false)

  // Replication State
  const [replicationModalOpen, setReplicationModalOpen] = useState(false)
  const [replicationData, setReplicationData] = useState<{
      value: string,
      targets: { id: string, group: number, index: number }[],
      startIndex: number
  } | null>(null)

  // SQL Instruction Modal
  const [showSqlModal, setShowSqlModal] = useState(false)
  const [sqlModalType, setSqlModalType] = useState<'V11' | 'V14' | 'V15' | 'V16' | 'V17'>('V11')
  const [headerLine1, setHeaderLine1] = useState('Prefeitura Municipal de Açailândia')
  const [headerLine2, setHeaderLine2] = useState('Secretaria Municipal de Saúde / SEMUS')
  const [headerLine3, setHeaderLine3] = useState('Hospital Municipal de Açailândia - HMA')
  const [headerPage, setHeaderPage] = useState('1')
  const [isEditingHeader, setIsEditingHeader] = useState(false)
  const [unitNumber, setUnitNumber] = useState<string>('')
  const [unitNumbersMap, setUnitNumbersMap] = useState<Record<string, string>>({})
  const [unitMonthStatuses, setUnitMonthStatuses] = useState<Record<string, { launched: boolean, released: boolean }>>({})
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'ALL' | 'ENFERMEIRO' | 'TECNICO' | 'MEDICO' | 'MOTORISTA' | 'RECEPCAO' | 'AGENTE_DE_PORTARIA' | 'ASSISTENTE_SOCIAL'>('ALL')
  
  // Permission Management State
  const [isPermissionManagerOpen, setIsPermissionManagerOpen] = useState(false)
  const [permissions, setPermissions] = useState<any[]>([])
  const [permissionNurseId, setPermissionNurseId] = useState('')
  const [permissionUnitIds, setPermissionUnitIds] = useState<string[]>([])
  const [permissionSelectAllUnits, setPermissionSelectAllUnits] = useState(false)
  const [permissionUnitSearch, setPermissionUnitSearch] = useState('')
  const [myScalePermissionUnitIds, setMyScalePermissionUnitIds] = useState<string[]>([])

  useEffect(() => {
    setHasHydrated(true)
    if (typeof window === 'undefined') return

    if (initialMonth === undefined) {
      const storedMonth = localStorage.getItem('enf_hma_last_month')
      if (storedMonth !== null && storedMonth !== '') {
        const parsed = parseInt(storedMonth, 10)
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 11) {
          setSelectedMonth(parsed)
        }
      }
    }

    if (initialYear === undefined) {
      const storedYear = localStorage.getItem('enf_hma_last_year')
      if (storedYear !== null && storedYear !== '') {
        const parsed = parseInt(storedYear, 10)
        if (!isNaN(parsed)) {
          setSelectedYear(parsed)
        }
      }
    }

  }, [initialMonth, initialYear, initialUnitId])

  const selectedPermissionNurse = useMemo(() => {
    const source = allNurses.length > 0 ? allNurses : data.nurses
    return source.find(n => n.id === permissionNurseId) || null
  }, [allNurses, data.nurses, permissionNurseId])

  const selectedPermissionUnitIds = useMemo(
    () => Array.from(new Set(
      permissions
        .filter((p: any) => String(p.nurse_id) === String(permissionNurseId))
        .map((p: any) => String(p.unit_id))
        .filter(Boolean)
    )),
    [permissions, permissionNurseId]
  )

  const selectedPermissionUnits = useMemo(
    () => selectedPermissionUnitIds
      .map(id => data.units.find(u => String(u.id) === String(id)))
      .filter((u): u is Unit => !!u)
      .sort((a, b) => a.title.localeCompare(b.title)),
    [selectedPermissionUnitIds, data.units]
  )

  useEffect(() => {
    if (!permissionNurseId) {
      setPermissionUnitIds([])
      setPermissionSelectAllUnits(false)
      return
    }
    setPermissionUnitIds(selectedPermissionUnitIds)
    setPermissionSelectAllUnits(
      selectedPermissionUnitIds.length > 0 &&
      selectedPermissionUnitIds.length === data.units.length
    )
  }, [permissionNurseId, selectedPermissionUnitIds, data.units.length])

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
      if (isScheduleReleased) return
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

  const handleDisplayDynamicFieldChange = async (field: 'coren' | 'crm' | 'phone' | 'cpf' | 'vinculo' | 'role') => {
    setDisplayDynamicField(field)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`enf_hma_display_field_${selectedUnitId || 'ALL'}_${selectedMonth}_${selectedYear}`, field)
    }

    if (isAdmin && !isScheduleReleased) {
      await handleDynamicFieldChange(field)
    }
  }

  const handleToggleSetorVisibility = async (isHidden: boolean) => {
      if (isScheduleReleased) return
      setIsSetorHidden(isHidden)
      setLoading(true)
      const res = await updateScheduleSetorVisibility(selectedMonth + 1, selectedYear, selectedUnitId, isHidden)
      if (!res.success) {
          // Manter a visibilidade alterada localmente mesmo com erro no banco
          setIsSetorHidden(isHidden)
          
          if (res.message?.includes('V16')) {
              setSqlModalType('V16')
              setShowSqlModal(true)
          } else {
              alert(res.message || 'Erro ao salvar visibilidade do setor')
          }
      } else {
          clearCache()
          await fetchData(true)
      }
      setLoading(false)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isScheduleReleased) return
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
    if (isScheduleReleased) return
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
  const scheduleInFlight = useRef<Record<string, Promise<void>>>({})

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
    if (isNurseModalOpen || isReassignModalOpen || !!leaveModalType || isPermissionManagerOpen) {
        fetchAllNursesList(true) // Force fetch to be sure we have the latest and complete list
    }
  }, [isNurseModalOpen, isReassignModalOpen, leaveModalType, isPermissionManagerOpen, fetchAllNursesList])

  const fetchData = useCallback(async (forceRefresh = false, showLoading = true) => {
    // Skip fetching if a manual save is already in progress to avoid race conditions
    // BUT allow if it's a forced refresh (e.g. after a save)
    if (!forceRefresh && isSaving) return
    if (!selectedUnitId) return

    const cacheKey = `${selectedMonth}-${selectedYear}-${selectedUnitId}`
    if (!forceRefresh && scheduleInFlight.current[cacheKey]) {
        await scheduleInFlight.current[cacheKey]
        return
    }

    const run = (async () => {
        if (!forceRefresh && scheduleCache.current[cacheKey]) {
            const cachedData = scheduleCache.current[cacheKey]
            setData(cachedData)
            
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
            
            onLoaded?.()
            return
        }

        if (showLoading) setLoading(true)

        try {
          const result = await getMonthlyScheduleData(selectedMonth + 1, selectedYear, selectedUnitId)
          const newData = result as ScheduleData
          
          scheduleCache.current[cacheKey] = newData
          setData(newData)

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
    })()

    scheduleInFlight.current[cacheKey] = run
    try {
        await run
    } finally {
        delete scheduleInFlight.current[cacheKey]
    }
  }, [selectedMonth, selectedYear, selectedUnitId, onLoaded, isSaving])

  const handleDirectSaveShifts = async (shiftsToSave: { nurseId: string, rosterId?: string, date: string, type: string }[]) => {
    if (shiftsToSave.length === 0) return
    
    console.log('Sending shifts to save:', shiftsToSave)
    setIsSaving(true)
    try {
        const res = await saveShifts(shiftsToSave as any)
        console.log('Save result:', res)
        if (res.success) {
            clearCache()
            // Success! Set isSaving to false BEFORE fetching to avoid blocking the refresh
            setIsSaving(false)
            
            // Small delay to account for DB replication lag
            await new Promise(resolve => setTimeout(resolve, 500))
            await fetchData(true, true)
        } else {
            alert('Erro ao salvar plantões: ' + res.message)
            setIsSaving(false)
            await fetchData(true, true)
        }
    } catch (e) {
        console.error('Save failed:', e)
        alert('Erro técnico ao salvar. Tente novamente.')
        setIsSaving(false)
        await fetchData(true, true)
    } finally {
        setIsSaving(false)
    }
  }

  const optimisticSaveShifts = async (shifts: any[]) => {
      // Optimistic local update
      setData(prev => ({
          ...prev,
          shifts: [...prev.shifts, ...shifts.map(s => ({
              ...s,
              id: Math.random().toString(),
              shift_type: s.type
          }))]
      }))
      
      // Save in background
      await handleDirectSaveShifts(shifts)
  }

  useEffect(() => {
    if (!selectedUnitId) return
    fetchData()
  }, [fetchData, selectedUnitId])

  useEffect(() => {
    getMyScalePermissionUnitIds()
      .then(setMyScalePermissionUnitIds)
      .catch(() => setMyScalePermissionUnitIds([]))
  }, [])

  useEffect(() => {
    let cancelled = false
    getEditableUnits()
      .then((units: any[]) => {
        if (cancelled) return
        const mapped = (units || []).map(u => ({ id: String(u.id), title: String(u.title || '') })) as any
        setData(prev => ({ ...prev, units: mapped }))
        if (selectedUnitId && mapped.length > 0) {
          const stillAllowed = mapped.some((u: any) => String(u.id) === String(selectedUnitId))
          if (!stillAllowed && !printOnly) setSelectedUnitId('')
        }
      })
      .catch(() => {
        if (cancelled) return
        setData(prev => ({ ...prev, units: [] }))
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Fetch permissions if admin
  useEffect(() => {
    if (isAdmin) {
      getScalePermissions().then(setPermissions).catch(err => {
          if (err.message === 'DATABASE_V17_REQUIRED') {
              setSqlModalType('V17')
              setShowSqlModal(true)
          }
      })
    }
  }, [isAdmin])

  // Não auto-selecionar: só carrega quando o usuário escolher
  useEffect(() => {
    const allUnits = data.units || []
    const availableUnits = (isAdmin || myScalePermissionUnitIds.includes('*'))
      ? allUnits
      : allUnits.filter(u => myScalePermissionUnitIds.some(id => String(id) === String(u.id)))

    if (!selectedUnitId) return
    const stillAllowed = availableUnits.some(u => String(u.id) === String(selectedUnitId))
    if (!stillAllowed && !printOnly) setSelectedUnitId('')
  }, [data.units, selectedUnitId, isAdmin, myScalePermissionUnitIds])
  
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
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem(`enf_hma_display_field_${selectedUnitId || 'ALL'}_${selectedMonth}_${selectedYear}`)

    if (stored === 'coren' || stored === 'crm' || stored === 'phone' || stored === 'cpf' || stored === 'vinculo' || stored === 'role') {
      setDisplayDynamicField(stored)
      return
    }

    setDisplayDynamicField(dynamicField)
  }, [dynamicField, selectedUnitId, selectedMonth, selectedYear])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hasHydrated) return
    localStorage.setItem('enf_hma_last_month', String(selectedMonth))
    localStorage.setItem('enf_hma_last_year', String(selectedYear))
    if (selectedUnitId) localStorage.setItem('enf_hma_last_unit', String(selectedUnitId))
  }, [selectedMonth, selectedYear, selectedUnitId, hasHydrated])
  
  useEffect(() => {
    if (!selectedUnitId) {
      setUnitNumber('')
      return
    }
    setUnitNumber(unitNumbersMap[selectedUnitId] || '')
  }, [selectedUnitId, unitNumbersMap])
  
  useEffect(() => {
    async function loadAllNumbers() {
      const map = await getAllUnitNumbers()
      setUnitNumbersMap(map || {})
    }
    loadAllNumbers()
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    getUnitMonthStatuses(selectedMonth + 1, selectedYear)
      .then((m: any) => setUnitMonthStatuses(m || {}))
      .catch(() => setUnitMonthStatuses({}))
  }, [selectedMonth, selectedYear, isAdmin])
  
  const handleSaveHeader = () => {
    if (isScheduleReleased) return
    if (typeof window !== 'undefined') {
      localStorage.setItem('enf_hma_header_line_1', headerLine1)
      localStorage.setItem('enf_hma_header_line_2', headerLine2)
      localStorage.setItem('enf_hma_header_line_3', headerLine3)
      localStorage.setItem('enf_hma_header_page', headerPage)
    }
    setIsEditingHeader(false)
  }
  
  const handleSaveUnitNumber = async () => {
    if (isScheduleReleased) return
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
    if (isScheduleReleased) return
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
      if (isScheduleReleased) return
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
    if (isScheduleReleased) return
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
      if (isScheduleReleased) return
      if (!selectedUnitId) return
      const unitName = data.units.find(u => u.id === selectedUnitId)?.title
      if (!confirm(`ATENÇÃO CRÍTICA: Deseja EXCLUIR O SETOR "${unitName}"?\n\nIsso apagará o setor E TODO O SEU HISTÓRICO de escalas e plantões.\n\nEsta ação é IRREVERSÍVEL.`)) return
      
      const confirmName = prompt(`Para confirmar a exclusão do setor, digite EXCLUIR ou o nome do setor (${unitName}):`)
      if (!confirmName || (confirmName.toUpperCase().trim() !== 'EXCLUIR' && confirmName.toUpperCase().trim() !== (unitName || '').toUpperCase().trim())) {
          alert('Confirmação incorreta. Ação cancelada.')
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

  const handleExportBackup = async () => {
      setLoading(true)
      const res = await exportMonthlySchedule(selectedMonth + 1, selectedYear, selectedUnitId)
      if (res.success) {
          const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          const unitName = data.units.find(u => u.id === selectedUnitId)?.title || 'Geral'
          a.href = url
          a.download = `backup_escala_${unitName}_${MONTHS[selectedMonth]}_${selectedYear}.json`
          a.click()
          alert('Backup baixado com sucesso! Guarde este arquivo em local seguro.')
      } else {
          alert('Erro ao gerar backup: ' + res.message)
      }
      setLoading(false)
  }

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!confirm('ATENÇÃO: A importação irá sobrescrever os dados atuais desta escala com os dados do arquivo de backup. Deseja continuar?')) {
          e.target.value = ''
          return
      }

      const reader = new FileReader()
      reader.onload = async (event) => {
          try {
              const backupData = JSON.parse(event.target?.result as string)
              setLoading(true)
              const res = await importMonthlySchedule(selectedMonth + 1, selectedYear, selectedUnitId, backupData)
              if (res.success) {
                  alert(res.message)
                  clearCache()
                  await fetchData(true)
              } else {
                  alert(res.message)
              }
          } catch (err) {
              alert('Erro ao ler arquivo de backup. Verifique se o arquivo está correto.')
          } finally {
              setLoading(false)
              e.target.value = ''
          }
      }
      reader.readAsText(file)
  }

  const handlePrintCurrent = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const handleClearSchedule = async () => {
    if (isScheduleReleased) return
    if (!selectedUnitId) return alert('Selecione um setor para excluir a escala')
    const unitName = data.units.find(u => String(u.id) === String(selectedUnitId))?.title || 'SETOR'
    if (!confirm(`Tem certeza que deseja EXCLUIR TODA a escala de ${MONTHS[selectedMonth]} / ${selectedYear} para o setor "${unitName}"?\n\nEsta ação removerá todos os profissionais e plantões deste mês e não poderá ser desfeita.`)) return
    const code = prompt(`Para confirmar, digite: EXCLUIR ${MONTHS[selectedMonth].toUpperCase()} ${selectedYear}`)
    if (!code || code.trim().toUpperCase() !== `EXCLUIR ${MONTHS[selectedMonth].toUpperCase()} ${selectedYear}`) {
      alert('Operação cancelada. Código de confirmação incorreto.')
      return
    }
    
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

  const handleClearAllDatabase = async () => {
    if (isScheduleReleased) return
    if (!confirm('ATENÇÃO: Você está prestes a EXCLUIR TODOS OS DADOS de todas as escalas (todos os meses e setores) do banco de dados.')) return
    if (!confirm('TEM CERTEZA ABSOLUTA? Esta ação é irreversível e apagará tudo.')) return
    const code = prompt('Para confirmar a exclusão TOTAL, digite "DELETAR TUDO":')
    if (code !== 'DELETAR TUDO') {
        alert('Operação cancelada. O código de confirmação estava incorreto.')
        return
    }

    setLoading(true)
    const res = await clearAllDatabaseShifts()
    if (res.success) {
        alert(res.message)
        clearCache()
        fetchData(true)
    } else {
        alert(res.message)
    }
    setLoading(false)
  }

  async function handleRemoveFromRoster(rosterId: string) {
    if (isScheduleReleased) return
    if (!confirm('Tem certeza que deseja remover este servidor desta escala mensal?')) return
    setLoading(true)
    const res = await removeRosterEntry(rosterId)
    if (!res.success) alert(res.message)
    clearCache()
    await fetchData(true)
  }

  const handleReassign = (rosterId: string, newId: string) => {
    if (isScheduleReleased) return
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
    if (isScheduleReleased) return
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
        // NÃO LIMPAR CACHE NEM FAZER FETCH DATA PARA NÃO PERDER ESTADO DA TELA
        // clearCache()
    }
  }

  const handleUpdateSector = async (rosterId: string, sector: string) => {
    if (isScheduleReleased) return
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
        // NÃO LIMPAR CACHE NEM FAZER FETCH DATA PARA NÃO PERDER ESTADO DA TELA
        // clearCache()
    }
  }

  const handleUpdateOrder = async (rosterId: string, listOrder: number | null) => {
    if (isScheduleReleased) return
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
    if (isScheduleReleased) return
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
    if (isScheduleReleased) return
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
      // Usar setTimeout para garantir que o ref esteja disponível
      setTimeout(() => {
          if (footerEditorRef.current) {
              footerEditorRef.current.innerHTML = footerText || ''
          }
      }, 0)
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
    if (isScheduleReleased) return
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
    if (isScheduleReleased) return
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
    if (isScheduleReleased) return
    if (!nurseId) return
    setDoubleShiftModal({ isOpen: true, nurseId, sectionId })
  }

  const handleInsertProfessional = (sectionId: string, index: number, direction: 'above' | 'below', currentOrderedIds: string[]) => {
    if (isScheduleReleased) return
    const position = direction === 'above' ? index : index + 1
    setInsertionData({ sectionId, position, orderedIds: currentOrderedIds })
    setIsNurseModalOpen(true)
  }

  const handleCreateNewAndInsert = (sectionId: string, index: number, direction: 'above' | 'below', currentOrderedIds: string[]) => {
    if (isScheduleReleased) return
    const position = direction === 'above' ? index : index + 1
    setInsertionData({ sectionId, position, orderedIds: currentOrderedIds })
    setIsCreationModalOpen(true)
  }

  const onNurseCreated = async (rosterId?: string) => {
    if (isScheduleReleased) return
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

  const openReassignModal = (rosterId: string, sectionId: string) => {
    if (isScheduleReleased) return
    if (!rosterId) return
    setReassignData({ rosterId, sectionId })
    setIsReassignModalOpen(true)
  }

  const onReassignSelected = async (nurseId: string) => {
    if (!reassignData) return
    setIsReassignModalOpen(false)
    await handleReassign(reassignData.rosterId, nurseId)
    setReassignData(null)
  }

  const handleToggleNameStar = async (rosterId: string, nextValue: boolean) => {
    if (isScheduleReleased) return
    if (!rosterId) return
    setLoading(true)
    try {
      const res = await setRosterNameStar(rosterId, nextValue)
      if (!(res as any).success) {
        alert((res as any).message || 'Erro ao atualizar')
        return
      }
      setData(prev => ({
        ...prev,
        roster: (prev.roster || []).map((r: any) => String(r.id) === String(rosterId) ? ({ ...r, name_star: nextValue } as any) : r)
      }))
    } finally {
      setLoading(false)
    }
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

  const handleCellClick = (nurse: Nurse, dateStr: string, explicitRosterId?: string, initialType?: 'day' | 'night' | 'morning' | 'afternoon' | 'DELETE') => {
    if (isScheduleReleased) return
    // Robust rosterId resolution
    // Priority: Explicit ID (from clicked row) > Nurse Property > Fallback Search
    let rosterId = explicitRosterId || (nurse.is_rostered ? nurse.unique_key : undefined)
    
    // Fallback: If rosterId is still missing but nurse is in roster, try to find it
    if (!rosterId && data.roster) {
        const entry = data.roster.find(r => 
            r.nurse_id === nurse.id && 
            r.month === selectedMonth + 1 && 
            r.year === selectedYear &&
            (!selectedUnitId || r.unit_id === selectedUnitId)
        )
        if (entry) rosterId = entry.id
    }

    const existingShiftKey = `${(rosterId || nurse.id)}_${dateStr}`
    const existingShift = shiftsLookup.lookup[existingShiftKey]
    setManualRed(!!existingShift?.is_red)
    setManualBaseType((existingShift?.shift_type as any) || null)

    setShiftModalData({
        nurseId: nurse.id,
        rosterId: rosterId,
        nurseName: nurse.name,
        date: dateStr
    })
    setShiftType(initialType || 'day')
    // VOLTAR PARA 'none' (Manual) POR PADRÃO PARA EVITAR APAGAR O MÊS ACIDENTALMENTE
    // O usuário relatou inconstância e perda de dados, provavelmente por aplicar padrões sem querer
    setRecurrence('none')
    const savedCustomDays = typeof window !== 'undefined' ? (localStorage.getItem('enf_hma_last_custom_days') || '') : ''
    setCustomRecurrenceDays(savedCustomDays)
    setDeleteWholeMonth(false)
    setIsShiftModalOpen(true)
  }

  const handleSaveShifts = async (overrideType?: string, overrideRecurrence?: string, overrideIsRed?: boolean) => {
    if (isScheduleReleased) return
    if (!shiftModalData) return
    
    const targetType = overrideType || shiftType
    const targetRecurrence = overrideRecurrence || recurrence
    const targetIsRed = typeof overrideIsRed === 'boolean' ? overrideIsRed : manualRed

    console.log(`[handleSaveShifts] Início: tipo=${targetType}, recorrência=${targetRecurrence}, profissional=${shiftModalData.nurseName}`)

    if (typeof window !== 'undefined' && !overrideType) {
        localStorage.setItem('enf_hma_last_recurrence', targetRecurrence)
        localStorage.setItem('enf_hma_last_custom_days', customRecurrenceDays)
    }

    setIsSaving(true)
    try {
        const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
        
        // 1. Get ALL current shifts for this professional in the current month
        const currentProfessionalShifts = data.shifts.filter(s => {
            const dateParts = s.shift_date.split('-')
            if (dateParts.length !== 3) return false
            const year = parseInt(dateParts[0])
            const month = parseInt(dateParts[1])
            
            return s.nurse_id === shiftModalData.nurseId &&
                   (shiftModalData.rosterId ? s.roster_id === shiftModalData.rosterId : !s.roster_id) &&
                   month === (selectedMonth + 1) &&
                   year === selectedYear
        })

        console.log(`[handleSaveShifts] Plantões atuais encontrados para limpeza: ${currentProfessionalShifts.length}`)

        // 2. Prepare a map of the month's state
        const shiftsMap = new Map<string, string>()
        
        // Initialize map with EXISTING state
        currentProfessionalShifts.forEach(s => {
            shiftsMap.set(s.shift_date, s.shift_type)
        })

        if (targetType === 'delete') {
            console.log(`[handleSaveShifts] LIMPANDO MÊS INTEIRO para ${shiftModalData.nurseName}`)
            if (targetRecurrence !== 'none') {
                for (let d = 1; d <= lastDayOfMonth; d++) {
                    const dStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                    shiftsMap.set(dStr, 'DELETE')
                }
            } else {
                shiftsMap.set(shiftModalData.date, 'DELETE')
            }
        } else {
            const clickedDate = new Date(shiftModalData.date + 'T12:00:00')
            const clickedDay = clickedDate.getDate()

            if (targetRecurrence === 'none') {
                shiftsMap.set(shiftModalData.date, targetType)
            } else {
                const getPatternInfo = (rec: string) => {
                    if (rec === 'daily') return { period: 1, work: [0] }
                    if (rec === 'mon_fri') return { period: 1, work: [0], skipWeekends: true }
                    if (rec === '12x36') return { period: 2, work: [0] }
                    if (rec === 'd_off2') return { period: 3, work: [0] } // New: D + 2 Folgas
                    if (rec === 'every3') return { period: 3, work: [0] }
                    if (rec === '24x72') return { period: 4, work: [0] }
                    if (rec === 'off4') return { period: 5, work: [0] }
                    if (rec === 'off5') return { period: 6, work: [0] }
                    if (rec === 'off6') return { period: 7, work: [0] }
                    if (rec === 'dn_off3') return { period: 5, work: [0, 1], types: ['day', 'night'] }
                    if (rec === 'dn_off4') return { period: 6, work: [0, 1], types: ['day', 'night'] }
                    if (rec === 'nd_off4') return { period: 6, work: [0, 5], types: ['night', 'day'] } // Night on Day 0, Day on Day 5 (which is Day before next Night)
                    if (rec === 'dn_off5') return { period: 7, work: [0, 1], types: ['day', 'night'] }
                    if (rec === 'dn_off6') return { period: 8, work: [0, 1], types: ['day', 'night'] }
                    if (rec === 'dn_off7') return { period: 9, work: [0, 1], types: ['day', 'night'] }
                    if (rec === 'dn_off8') return { period: 10, work: [0, 1], types: ['day', 'night'] }
                    if (rec === 'custom') return { period: parseInt(customRecurrenceDays) || 1, work: [0] }
                    return null
                }

                const pattern = getPatternInfo(targetRecurrence)
                if (pattern) {
                    console.log(`[handleSaveShifts] Aplicando padrão: period=${pattern.period}, work=${JSON.stringify(pattern.work)}`)
                    
                    // CLEAR ENTIRE MONTH BEFORE APPLYING PATTERN
                    for (let d = 1; d <= lastDayOfMonth; d++) {
                        const dStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                        shiftsMap.set(dStr, 'DELETE')
                    }

                    // Apply pattern from Day 1 to End
                    for (let d = 1; d <= lastDayOfMonth; d++) {
                        const diff = d - clickedDay
                        const mod = ((diff % pattern.period) + pattern.period) % pattern.period
                        
                        if (pattern.work.includes(mod)) {
                            const dDate = new Date(selectedYear, selectedMonth, d)
                            if (pattern.skipWeekends && (dDate.getDay() === 0 || dDate.getDay() === 6)) continue
                            
                            const dStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                            const typeIdx = pattern.work.indexOf(mod)
                            const finalType = pattern.types ? pattern.types[typeIdx] : targetType
                            shiftsMap.set(dStr, finalType)
                        }
                    }
                } else {
                    console.warn(`[handleSaveShifts] Padrão não encontrado para recorrência: ${targetRecurrence}`)
                }
            }
        }

        const shiftsToSave: { nurseId: string, rosterId?: string, date: string, type: string, isRed?: boolean }[] = []
        shiftsMap.forEach((type, date) => {
            const isRed = targetRecurrence === 'none' && type !== 'DELETE' ? targetIsRed : false
            shiftsToSave.push({
                nurseId: shiftModalData.nurseId,
                rosterId: shiftModalData.rosterId,
                date: date,
                type: type,
                isRed
            })
        })

        console.log(`[handleSaveShifts] Total de plantões para atualizar localmente: ${shiftsToSave.length}`)

        // 1. OPTIMISTIC LOCAL UPDATE
        setData(prev => {
            const newShifts = [...prev.shifts]
            
            // Filter out ONLY the dates that are being updated in this batch
            const datesToUpdate = new Set(shiftsToSave.map(s => s.date))
            
            const filteredShifts = newShifts.filter(s => {
                const isTargetProfessional = s.nurse_id === shiftModalData.nurseId &&
                                           (shiftModalData.rosterId ? s.roster_id === shiftModalData.rosterId : !s.roster_id)
                const isTargetDate = datesToUpdate.has(s.shift_date)
                
                return !(isTargetProfessional && isTargetDate)
            })

            // Add new shifts from shiftsToSave
            shiftsToSave.forEach(sToSave => {
                if (sToSave.type !== 'DELETE') {
                    filteredShifts.push({
                        id: `temp-${Math.random()}`,
                        nurse_id: sToSave.nurseId,
                        roster_id: sToSave.rosterId,
                        shift_date: sToSave.date,
                        shift_type: sToSave.type as any,
                        is_red: !!sToSave.isRed,
                        created_at: new Date().toISOString()
                    })
                }
            })
            
            console.log(`[handleSaveShifts] Estado local atualizado. Total de plantões agora: ${filteredShifts.length}`)
            return { ...prev, shifts: filteredShifts }
        })

        const shiftsToPersist = targetRecurrence === 'none'
          ? [{
              nurseId: shiftModalData.nurseId,
              rosterId: shiftModalData.rosterId,
              date: shiftModalData.date,
              type: targetType === 'delete' ? 'DELETE' : targetType,
              isRed: targetType === 'delete' ? false : targetIsRed
            }]
          : shiftsToSave

        const res = await saveShifts(shiftsToPersist as any)
        if (res.success) {
            clearCache()
            await fetchData(true, false)
        } else {
            alert(res.message || 'Erro ao salvar plantões.')
            await fetchData(true, false)
        }

        setIsShiftModalOpen(false)
        console.log(`[handleSaveShifts] Sucesso. Modal fechado.`)

    } catch (error) {
        console.error("[handleSaveShifts] Erro:", error)
        alert('Erro ao atualizar escala.')
    } finally {
        setIsSaving(false)
    }
  }

  const handleSaveAll = async () => {
    if (isScheduleReleased) return
    // 1. First, check if there's anything to save
    const currentMonthShifts = data.shifts.filter(s => {
        const dateParts = s.shift_date.split('-')
        if (dateParts.length !== 3) return false
        const year = parseInt(dateParts[0])
        const month = parseInt(dateParts[1])
        return month === (selectedMonth + 1) && year === selectedYear
    })

    if (currentMonthShifts.length === 0) {
        alert('Não há plantões para salvar neste mês.')
        return
    }

    if (!confirm(`Deseja salvar todos os ${currentMonthShifts.length} plantões preenchidos na tela para o banco de dados?`)) {
        return
    }

    try {
        setIsSaving(true)
        
        // 2. Prepare the complete batch of visible shifts
        const batch = currentMonthShifts.map(s => ({
            nurseId: s.nurse_id,
            rosterId: s.roster_id,
            date: s.shift_date,
            type: s.shift_type,
            isRed: !!(s as any).is_red
        }))

        console.log(`[handleSaveAll] ATOMIC SAVE: Sending ${batch.length} shifts for ${selectedMonth + 1}/${selectedYear}`)
        
        // 3. Perform the server save
        const res = await saveShifts(batch as any)
        
        if (res.success) {
            clearCache()
            alert(`SUCESSO: ${batch.length} plantões foram gravados permanentemente no banco de dados.`)
            console.log(`[handleSaveAll] Atomic save successful.`)
            await fetchData(true, false) // Refresh to sync IDs and ensure persistence
        } else {
            console.error(`[handleSaveAll] Save failed:`, res.message)
            alert('ERRO AO SALVAR: ' + res.message)
        }
    } catch (e) {
        console.error('Save all failed:', e)
        alert('Erro técnico ao salvar tudo. Verifique sua conexão.')
    } finally {
        setIsSaving(false)
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
                  list_order: entry.list_order,
                  name_star: !!entry.name_star
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
  }, [activeNurses, data.roster]) // Add data.roster to ensure re-sort only when roster actually changes

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
                      // Logic: Assign legacy shifts to ALL matching roster entries found for this nurse IN THIS UNIT.
                      const rosterEntries = rosterMap[s.nurse_id]
                      if (rosterEntries && rosterEntries.length > 0) {
                          // Filter entries to match current unit
                          const unitEntries = rosterEntries.filter(r => currentUnitRosterIds.has(r.id))
                          
                          if (unitEntries.length > 0) {
                              // Bind to ALL roster IDs for this nurse in this unit
                              unitEntries.forEach(entry => {
                                  const key = `${entry.id}_${s.shift_date}`
                                  // Only populate if not already occupied by a specific shift
                                  if (!lookup[key]) {
                                      lookup[key] = s
                                  }
                              })
                              return // Finished processing this legacy shift
                          } else {
                              // Nurse has roster entries but NONE in this unit.
                              // Skip this shift for this view.
                              return
                          }
                      } else {
                           // Fallback if not rostered anywhere? 
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
              if (!isWorkingShift) return // Stop processing this shift for counts if it's not a work shift
              
              const weight = (s.shift_type === 'dn' ? 2 : 1)
              
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

  const footerLegendData = React.useMemo(() => {
    const pad = (n: number) => n.toString().padStart(2, '0')
    const monthStart = `${selectedYear}-${pad(selectedMonth + 1)}-01`
    const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate()
    const monthEnd = `${selectedYear}-${pad(selectedMonth + 1)}-${pad(lastDay)}`

    const nurseNameById = new Map<string, string>()
    ;[...(data.nurses || []), ...(allNurses || [])].forEach((n: any) => {
      if (!n?.id) return
      if (!nurseNameById.has(String(n.id))) {
        nurseNameById.set(String(n.id), String(n.name || ''))
      }
    })

    const grouped = new Map<string, Set<string>>()
    const validTypes = new Set(['ferias', 'licenca_saude', 'licenca_maternidade', 'cessao', 'folga'])

    ;(data.timeOffs || []).forEach((t: any) => {
      const type = String(t?.type || '')
      if (!validTypes.has(type)) return
      if (!t?.start_date || !t?.end_date) return
      if (t.end_date < monthStart || t.start_date > monthEnd) return

      // Filtro por unidade: se vier com unit_id preenchido, respeita; se for global (null), também exibe.
      if (selectedUnitId && t.unit_id && String(t.unit_id) !== String(selectedUnitId)) return

      const nurseName = nurseNameById.get(String(t.nurse_id)) || String((t as any).nurse_name || '')
      if (!nurseName) return

      const label = `${nurseName}${t.status === 'pending' ? '*' : ''}`
      if (!grouped.has(type)) grouped.set(type, new Set<string>())
      grouped.get(type)!.add(label)
    })

    const order = ['ferias', 'licenca_saude', 'licenca_maternidade', 'cessao', 'folga']
    return order
      .map((type) => {
        const names = Array.from(grouped.get(type) || [])
        if (names.length === 0) return null
        return {
          type,
          label:
            type === 'ferias' ? 'FÉRIAS' :
            type === 'licenca_saude' ? 'LICENÇA SAÚDE' :
            type === 'licenca_maternidade' ? 'LICENÇA MATERNIDADE' :
            type === 'folga' ? 'FOLGA' :
            'CESSÃO',
          names: names.join(', ')
        }
      })
      .filter(Boolean) as { type: string; label: string; names: string }[]
  }, [data.timeOffs, data.nurses, allNurses, selectedMonth, selectedYear, selectedUnitId])


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
                className={`border border-black px-0 py-0 text-center text-[11px] font-medium sticky left-0 bg-yellow-400 z-10 w-8 h-5 print:w-6 print:h-5 print:static print:left-auto print:z-0 leading-none ${isAdmin ? '' : ''}`}
                title={canEditSelectedUnit && !isScheduleReleased ? 'Edite para reiniciar numeração a partir daqui' : undefined}
              >
                {canEditSelectedUnit && !isScheduleReleased ? (
                  <input
                    type="text"
                    inputMode="numeric"
                    defaultValue={rowNumber}
                    className="w-full h-full text-center bg-transparent border-none outline-none focus:bg-gray-100 m-0 p-0 text-black font-bold text-[11px] print:text-[12px]"
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
                  <span className="text-black font-bold print:text-[14px]">{rowNumber}</span>
                )}
              </td>
              <td className="border border-black px-1 py-0 print:px-2 text-[9px] font-medium text-black sticky left-8 bg-white z-10 w-[320px] h-5 print:w-[200px] print:h-5 border-r-2 border-r-black text-center print:text-left print:static print:left-auto print:z-0 leading-none overflow-hidden">
                <div className="flex items-center justify-center gap-1 h-5 overflow-hidden">
                  {canEditSelectedUnit && !isScheduleReleased && (
                    <div className="flex flex-col gap-0.5 mr-1 no-print opacity-0 group-hover:opacity-100 transition-opacity">
                       <button 
                           onClick={() => handleInsertProfessional(section.id, index, 'above', orderedProfessionals.map(p => p.nurse.unique_key || ''))}
                           className="text-blue-600 hover:text-blue-800 hover:scale-125 transition-all p-0 bg-blue-50 rounded"
                           title="Inserir profissional JÁ CADASTRADO acima desta linha"
                       >
                           <ArrowUpCircle size={14} />
                       </button>
                       <button 
                           onClick={() => handleInsertProfessional(section.id, index, 'below', orderedProfessionals.map(p => p.nurse.unique_key || ''))}
                           className="text-blue-600 hover:text-blue-800 hover:scale-125 transition-all p-0 bg-blue-50 rounded"
                           title="Inserir profissional JÁ CADASTRADO abaixo desta linha"
                       >
                           <ArrowDownCircle size={14} />
                       </button>
                    </div>
                  )}
                  {canEditSelectedUnit && !isScheduleReleased && (
                  <button 
                    onClick={() => handleRemoveFromRoster(nurse.unique_key || '')} 
                    className="text-red-500 hover:text-red-700 p-0 rounded hover:bg-red-50 transition-colors no-print"
                    title="Remover desta escala mensal"
                  >
                    <Trash2 size={10} />
                  </button>
                  )}
                  {canEditSelectedUnit && !isScheduleReleased ? (
                    <div className="w-full flex items-center justify-center gap-2 no-print">
                      <button
                        type="button"
                        onClick={() => openReassignModal(nurse.unique_key || '', section.id)}
                        className={`flex-1 min-w-0 bg-transparent border-none focus:ring-0 p-0 text-sm font-bold cursor-pointer outline-none uppercase text-center whitespace-nowrap overflow-hidden text-ellipsis ${
                          (((nurse.vinculo || '').toUpperCase().includes('SELETIVO') || (nurse.vinculo || '').toUpperCase().includes('CELETISTA'))) ? 'text-green-600' :
                          (((nurse.vinculo || '').toUpperCase().includes('TERCEIRIZADO') || (nurse.vinculo || '').toUpperCase().includes('TERCERIZADO'))) ? 'text-purple-700' :
                          (nurse.observation || '').toUpperCase().trim() === '1ED' ? 'text-red-600' :
                          (nurse.observation || '').toUpperCase().trim() === '1 ED AB' ? 'text-blue-600' :
                          'text-gray-800'
                        }`}
                        title={nurse.name}
                      >
                        {(() => {
                            const vinculo = (nurse.vinculo || '').toUpperCase().trim()
                            let suffix = ''
                            if (vinculo.includes('SELETIVO') || vinculo.includes('CELETISTA')) suffix = ' (SEL)'
                            if (vinculo.includes('TERCEIRIZADO') || vinculo.includes('TERCERIZADO')) suffix += ' (TER)'
                            if ((nurse.observation || '').toUpperCase().includes('AB') || vinculo.includes('ATENÇÃO BÁSICA') || vinculo.includes('ATENCAO BASICA')) suffix += ' (AB)'
                            return `${nurse.name}${suffix}`
                        })()}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleNameStar(nurse.unique_key || '', !nurse.name_star)}
                        className={`px-2 py-1 rounded border text-lg font-black leading-none hover:bg-gray-50 ${nurse.name_star ? 'text-red-600 border-red-200 bg-red-50 hover:bg-red-50' : 'text-gray-500 border-gray-300 bg-white'}`}
                        title={nurse.name_star ? 'Remover * do nome' : 'Adicionar * ao nome'}
                      >
                        *
                      </button>
                    </div>
                  ) : null}
                  <div className={`${canEditSelectedUnit && !isScheduleReleased ? 'hidden print:block' : 'block'} text-center w-full`}>
                  {(() => {
                     const obs = (nurse.observation || '').toUpperCase().trim()
                     const vinculo = (nurse.vinculo || '').toUpperCase().trim()
                     const isSeletivo = vinculo.includes('SELETIVO') || vinculo.includes('CELETISTA')
                     const isTerceirizado = vinculo.includes('TERCEIRIZADO') || vinculo.includes('TERCERIZADO')
                     
                     let nameColorClass = "text-black"
                     if (isSeletivo) {
                         nameColorClass = "text-green-600"
                     } else if (isTerceirizado) {
                         nameColorClass = "text-purple-700"
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
                     
                     const baseColorClass = nameColorClass || "text-gray-800"
                     
                    return <span className={`relative text-sm font-bold ${baseColorClass} uppercase print:text-[10px] whitespace-nowrap overflow-hidden text-ellipsis block leading-none ${nurse.name_star ? 'pr-4' : ''}`}>
                         {prefixes.map(p => <span key={p} className="mr-1">{p}</span>)}
                        {nurse.name}
                         {(vinculo.includes('SELETIVO') || vinculo.includes('CELETISTA')) && <span className="ml-1">(SEL)</span>}
                         {(vinculo.includes('TERCEIRIZADO') || vinculo.includes('TERCERIZADO')) && <span className="ml-1">(TER)</span>}
                         {/* {obs.includes('1ED') && !isSeletivo && <span className="ml-1">(1ED)</span>} */}
                        {(obs.includes('AB') || vinculo.includes('ATENÇÃO BÁSICA') || vinculo.includes('ATENCAO BASICA')) && <span className="ml-1">(AB)</span>}
                        {displayObs ? displayObs : ''}
                        {nurse.name_star ? (
                          <span className="absolute right-0 top-1/2 -translate-y-1/2 font-black text-lg print:text-[14px] leading-none text-red-600">
                            *
                          </span>
                        ) : null}
                     </span>
                   })()}
                   </div>
                </div>
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center text-[10px] print:text-[8px] uppercase h-5 print:h-5 leading-none overflow-hidden">
                <span className="block whitespace-nowrap overflow-hidden text-ellipsis font-bold print:hidden">{formatRole(nurse.role)}</span>
                <span className="hidden print:block whitespace-nowrap overflow-hidden text-ellipsis font-normal">{formatRolePrintShort(nurse.role)}</span>
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center text-[10px] print:text-[8px] uppercase h-5 print:h-5 leading-none overflow-hidden">
                {(() => {
                  const v = ((nurse.observation || '').includes('1ED') && !(nurse.vinculo || '').toUpperCase().includes('SELETIVO')) ? 'ESCALA DUPLA' : (nurse.vinculo || '-')
                  return (
                    <>
                      <span className="block whitespace-nowrap overflow-hidden text-ellipsis font-bold print:hidden">{v}</span>
                      <span className="hidden print:block whitespace-nowrap overflow-hidden text-ellipsis font-normal">{formatVinculoPrintShort(v)}</span>
                    </>
                  )
                })()}
              </td>
              <td className="border border-black px-0.5 py-0.5 text-center text-[10px] print:text-[8px] uppercase h-5 print:h-5 leading-none overflow-hidden">
                {canEditSelectedUnit && !isScheduleReleased && displayDynamicField === 'coren' ? (
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
                    className="w-full bg-transparent border-none focus:ring-0 p-0 text-[10px] print:text-[8px] cursor-pointer outline-none text-center appearance-none font-bold print:font-normal"
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
                    const val = source[displayDynamicField as keyof Nurse]
                    
                    if (displayDynamicField === 'role') {
                      const r = String(val || '')
                      return (
                        <>
                          <span className="font-bold print:hidden">{formatRole(r)}</span>
                          <span className="hidden print:block font-normal">{formatRolePrintShort(r)}</span>
                        </>
                      )
                    }
                    if (displayDynamicField === 'vinculo') {
                      const v = String(val || '-')
                      return (
                        <>
                          <span className="font-bold print:hidden">{v}</span>
                          <span className="hidden print:block font-normal">{formatVinculoPrintShort(v)}</span>
                        </>
                      )
                    }

                    return <span className="print:text-[8px] whitespace-nowrap font-bold print:font-normal">{String(val || '-')}</span>
                  })()
                )}
              </td>
              {!isSetorHidden && (
              <td className="border border-black px-0.5 py-0.5 text-center text-[10px] print:text-[8px] uppercase h-5 print:h-5 leading-none overflow-hidden tracking-tight">
                  <SectorCell 
                      initialValue={nurse.sector}
                      printValue={formatSectorPrintShort(nurse.sector || '')}
                      onSave={(val) => handleUpdateSector(nurse.unique_key || nurse.id, val)}
                      onCopyDown={(val) => handleCopySectorDown(index, val)}
                      isAdmin={canEditSelectedUnit && !isScheduleReleased}
                      className="font-bold print:font-normal"
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

                let cellClass = "border border-black px-0 py-0 h-5 w-6 print:h-5 print:w-4 text-center text-[10px] print:text-[10px] leading-none relative text-black font-bold print:font-normal"
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
                    cellClass = cellClass.replace(' text-black', ' text-red-600')
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
                    className={`${cellClass} ${canEditSelectedUnit && !isScheduleReleased ? 'cursor-pointer hover:bg-yellow-100 hover:scale-110 hover:shadow-lg hover:z-50 transition-all duration-200' : ''}`}
                    onClick={canEditSelectedUnit && !isScheduleReleased ? () => handleCellClick(nurse, dateStr, nurse.unique_key) : undefined}
                    id={`cell-${nurse.unique_key}-${dateStr}`}
                    tabIndex={canEditSelectedUnit && !isScheduleReleased ? 0 : -1}
                    onKeyDown={canEditSelectedUnit && !isScheduleReleased ? async (e) => {
                      const k = e.key.toLowerCase()
                      if (isSpecialLeave) return
                      
                      // MANTER NAVEGAÇÃO POR SETAS
                      if (k === 'arrowright' || k === 'arrowleft') {
                        e.preventDefault()
                        const delta = k === 'arrowright' ? 1 : -1
                        const targetDay = day + delta
                        const lastDayOfMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate()
                        if (targetDay >= 1 && targetDay <= lastDayOfMonth) {
                          const targetDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
                          const el = document.getElementById(`cell-${nurse.unique_key}-${targetDate}`)
                          el?.focus()
                        }
                        return
                      }

                      // PARA QUALQUER OUTRA TECLA DE ATALHO (D, N, M, T, DELETE), ABRIR O MODAL
                      // O usuário quer que o preenchimento automático/modal seja a única forma
                      if (['d','n','m','t','delete','backspace'].includes(k)) {
                        e.preventDefault()
                        let type: 'day' | 'night' | 'morning' | 'afternoon' | 'DELETE' | undefined = undefined
                        if (k === 'd') type = 'day'
                        else if (k === 'n') type = 'night'
                        else if (k === 'm') type = 'morning'
                        else if (k === 't') type = 'afternoon'
                        else if (k === 'delete' || k === 'backspace') type = 'DELETE'
                        handleCellClick(nurse, dateStr, nurse.unique_key, type)
                      }
                    } : undefined}
                    title={canEditSelectedUnit ? "Clique para gerenciar plantão" : undefined}
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
        {canEditSelectedUnit && !isScheduleReleased && (
        <tr className="no-print bg-white">
          <td className="border border-black px-1 py-1 sticky left-0 bg-yellow-400 z-10"></td>
          <td className="border border-black px-1 py-0 sticky left-8 bg-white z-10 border-r-2 border-r-black w-[320px] text-center">
             <button 
                onClick={() => {
                    const currentRosterIds = (nursesBySection[section.id] || [])
                        .filter(n => !selectedUnitId || n.unit_id === selectedUnitId)
                        .map(n => n.unique_key || '')
                    
                    handleInsertProfessional(section.id, currentRosterIds.length, 'below', currentRosterIds)
                }}
                className="flex items-center justify-center gap-2 text-lg text-blue-600 font-bold w-full hover:text-blue-800 transition-colors py-0 uppercase"
             >
                <PlusCircle size={18} />
                <span>Adicionar Profissional</span>
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
      return data.releases.some(r => r.month === selectedMonth + 1 && r.year === selectedYear && String(r.unit_id) === String(selectedUnitId) && r.is_released)
  }, [data.releases, selectedMonth, selectedYear, selectedUnitId])

  const canEditSelectedUnit = useMemo(() => {
      if (isAdmin) return true
      if (myScalePermissionUnitIds.includes('*')) return true
      if (!selectedUnitId) return false
      return myScalePermissionUnitIds.some(id => String(id) === String(selectedUnitId))
  }, [isAdmin, myScalePermissionUnitIds, selectedUnitId])

  const canManageSelectedUnit = canEditSelectedUnit && !isScheduleReleased

  const formatRolePrintShort = useCallback((role: string) => {
    const r = String(role || '').toUpperCase().trim()
    if (!r) return ''
    if (r === 'TECNICO') return 'TÉC. ENF.'
    if (r === 'ENFERMEIRO') return 'ENF.'
    if (r === 'MEDICO') return 'MÉD.'
    if (r === 'COORDENADOR') return 'COORD.'
    if (r === 'COORDENACAO_GERAL') return 'COORD. G.'
    if (r === 'RECEPCAO') return 'RECEPÇÃO'
    if (r === 'AGENTE_DE_PORTARIA') return 'AG. PORT.'
    if (r === 'ASSISTENTE_SOCIAL') return 'ASS. SOC.'
    if (r === 'MOTORISTA') return 'MOTOR.'
    return r
  }, [])

  const formatVinculoPrintShort = useCallback((v: string) => {
    const s = String(v || '').toUpperCase().trim()
    if (!s || s === '-') return '-'
    if (s.includes('ESCALA DUPLA')) return 'E.D.'
    if (s.includes('ESCALA DESCOBERTA')) return 'DESC.'
    if (s.includes('SELETIVO')) return 'SEL.'
    if (s.includes('CONCURSO')) return 'CONC.'
    if (s.includes('TERCEIRIZ')) return 'TER.'
    if (s.includes('CELETISTA')) return 'CEL.'
    return s.slice(0, 8)
  }, [])

  const formatSectorPrintShort = useCallback((v: string) => {
    const s = String(v || '').toUpperCase().trim()
    if (!s || s === '-') return '-'
    if (s.includes('ESTABIL')) return 'ESTAB.'
    if (s.includes('PRONTO') && s.includes('SOCOR')) return 'P.S.'
    if (s.includes('TRIAG')) return 'TRIAG.'
    if (s.includes('CIRURG')) return 'CIR.'
    if (s.includes('SALA') && s.includes('PART')) return 'PARTO'
    return s.slice(0, 8)
  }, [])

  const visibleUnits = useMemo(() => {
      const allUnits = data.units || []
      if (isAdmin || myScalePermissionUnitIds.includes('*')) return allUnits
      return allUnits.filter(u => myScalePermissionUnitIds.some(id => String(id) === String(u.id)))
  }, [data.units, isAdmin, myScalePermissionUnitIds])

  // Sync Footer Text
  useEffect(() => {
      const metadata = data.releases?.find(r => r.month === selectedMonth + 1 && r.year === selectedYear && (selectedUnitId ? String(r.unit_id) === String(selectedUnitId) : !r.unit_id))
      setFooterText(metadata?.footer_text || '')
  }, [data.releases, selectedMonth, selectedYear, selectedUnitId])

  const handleCopySchedule = async () => {
    if (isScheduleReleased) return
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
    <div className="min-h-screen bg-white">
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
          <div className="print-header-number flex items-center justify-center w-10 h-10 bg-gray-800 text-white font-bold rounded leading-none text-sm print:w-24 print:h-24 print:text-[40px] print:rounded-xl print:bg-[#1f2933] print:text-white print:border-4 print:border-black print:-mt-3 print:mb-2">
            {(unitNumber || headerPage) || '1'}
          </div>
          {isAdmin && !printOnly && !isScheduleReleased && (
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
      <div className="flex flex-col items-stretch gap-4 mb-6 no-print w-full px-4">
        <div className="flex flex-wrap gap-4 items-end justify-between w-full">
            <div className="flex-1 min-w-[300px]">
            <label className="block text-sm font-medium text-black mb-1">Setor</label>
            {isEditingUnit ? (
                <div className="flex items-center gap-2">
                    <input 
                        value={editingUnitTitle}
                        onChange={e => setEditingUnitTitle(e.target.value)}
                        className="border border-gray-300 rounded px-3 py-2 text-sm w-full bg-white text-black"
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
                <div className="flex items-center gap-2 w-full">
                    <select 
                        value={selectedUnitId} 
                        onChange={handleUnitChange}
                        className="border border-gray-300 rounded px-3 py-2 text-sm flex-1 bg-white text-black"
                    >
                        {visibleUnits.length === 0 ? (
                          <option value="">Sem permissões de escala</option>
                        ) : (
                          <option value="">Selecione um setor...</option>
                        )}
                        {[...visibleUnits].sort((a, b) => {
                          const na = parseInt(unitNumbersMap[a.id] || '9999', 10)
                          const nb = parseInt(unitNumbersMap[b.id] || '9999', 10)
                          if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb
                          return a.title.localeCompare(b.title)
                        }).map(unit => {
                          const num = unitNumbersMap[unit.id]
                          
                          let status = ''
                          const s = unitMonthStatuses[String(unit.id)]
                          if (s?.released) status = ' ✅ (LIBERADA)'

                          return (
                            <option key={unit.id} value={unit.id}>
                                {num ? `${num} - ${unit.title}` : unit.title}{status}
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
                    {selectedUnitId && selectedUnitId !== 'new_unit_action' && isAdmin && !isScheduleReleased && (
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
            <div className="w-[200px]">
            <label className="block text-sm font-medium text-black mb-1">Mês</label>
            <select 
                value={selectedMonth} 
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="border border-gray-300 rounded px-3 py-2 text-sm w-full bg-white text-black"
            >
                {MONTHS.map((m, i) => (
                <option key={i} value={i}>{m}</option>
                ))}
            </select>
            </div>
            <div className="w-[180px]">
            <label className="block text-sm font-medium text-black mb-1">Ano</label>
            <div className="flex gap-1 items-center">
                <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="border border-gray-300 rounded px-3 py-2 text-sm w-full bg-white text-black"
                >
                    {YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                    ))}
                </select>
            </div>
            </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full justify-start items-center">
           {isAdmin && isSetorHidden && !isScheduleReleased && (
                <button 
                    onClick={() => handleToggleSetorVisibility(false)}
                    className="px-2 py-2 bg-gray-600 text-white rounded text-[10px] hover:bg-gray-700 flex items-center gap-1 no-print h-[38px] whitespace-nowrap"
                    title="Reexibir coluna SETOR"
                >
                    <Plus size={14} /> EXIBIR SETOR
                </button>
            )}
            {isAdmin && !isScheduleReleased && (
                <button 
                    onClick={() => setIsUnitManagerOpen(true)}
                    className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-[10px] hover:bg-gray-50 flex items-center gap-1 no-print h-[38px] whitespace-nowrap font-bold uppercase"
                    title="Gerenciar todos os setores (editar/excluir)"
                >
                    <Pencil size={14} /> Gerenciar Lista
                </button>
            )}
            {isAdmin && (
                <button 
                    onClick={() => setIsPermissionManagerOpen(true)}
                    className="px-3 py-2 bg-white border border-gray-300 text-gray-700 rounded text-[10px] hover:bg-gray-50 flex items-center gap-1 no-print h-[38px] whitespace-nowrap font-bold uppercase"
                    title="Gerenciar quem pode cadastrar cada escala"
                >
                    <UserPlus size={14} /> Permissões
                </button>
            )}
           {isSaving && (
                <div className="flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded animate-pulse no-print h-[38px]">
                    <span className="animate-spin h-3 w-3 border-2 border-indigo-700 border-t-transparent rounded-full"></span>
                    <span className="text-xs font-medium">Salvando...</span>
                </div>
           )}
           {loading ? (
               <button disabled className="bg-gray-300 text-gray-500 px-4 py-2 rounded flex items-center justify-center gap-2 text-sm h-[38px] min-w-[180px] cursor-not-allowed">
                  <span className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></span>
                  Carregando...
               </button>
           ) : (
             (!isLaunched && !canEditSelectedUnit) ? (
                <div className="flex items-center justify-center h-[38px] px-4 text-red-600 font-bold bg-red-50 border border-red-200 rounded whitespace-nowrap">
                    Escala ainda não liberada
                </div>
             ) : (
                <>
                {canEditSelectedUnit && !isScheduleReleased && (
                    <button 
                        onClick={handleSaveAll}
                        className="bg-indigo-600 text-white px-4 py-2 rounded flex items-center justify-center gap-2 text-sm hover:bg-indigo-700 transition-colors h-[38px] font-bold"
                        title="SALVAR TUDO no banco de dados agora"
                        disabled={isSaving}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        SALVAR TUDO
                    </button>
                )}
                {isAdmin && !isScheduleReleased && (
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
                        <span>Copiar Modelo</span>
                    </button>
                )}
                {isAdmin && selectedUnitId && !isScheduleReleased && (
                    <button 
                        onClick={handleClearSchedule}
                        className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded flex items-center justify-center gap-2 text-sm hover:bg-red-100 transition-colors h-[38px]"
                        title="Excluir toda a escala deste mês para o setor selecionado"
                    >
                        <Trash2 size={16} />
                        <span>Excluir Escala do Mês</span>
                    </button>
                )}
                {isScheduleReleased ? (
                    <button 
                        onClick={handleUnrelease}
                        className="group flex items-center justify-center gap-2 text-green-600 font-bold h-[38px] px-4 bg-green-50 border border-green-200 rounded min-w-[180px] whitespace-nowrap hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors"
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
                        className="bg-blue-600 text-white px-4 py-2 rounded flex items-center justify-center gap-2 text-sm hover:bg-blue-700 transition-colors h-[38px] min-w-[180px]"
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

      <div className="print:bg-white bg-white w-full">
      <div className={`overflow-x-auto w-full border-none shadow-none relative schedule-root print-schedule-root ${printOnly ? 'print:overflow-visible' : ''}`}>
        {loading ? (
             <div className="text-center py-4 text-black">Carregando...</div>
        ) : (
             (() => {
               const rosterForContext = (data.roster || []).filter(r => r.month === selectedMonth + 1 && r.year === selectedYear && (!selectedUnitId || String(r.unit_id) === String(selectedUnitId)))
               const baseLaunched = rosterForContext.length > 0
               const isLaunched = baseLaunched
               if (!isLaunched && !canEditSelectedUnit && !printOnly) {
                 return <div className="text-center py-6 text-sm text-gray-600">Escala em construção</div>
               }
               return (
                 <div className="w-full">
                 {!isLaunched && !printOnly && (
                   <div className="no-print mb-4 p-3 rounded border border-yellow-200 bg-yellow-50 text-yellow-900 text-sm font-medium">
                     Nenhum profissional lançado para {MONTHS[selectedMonth]} / {selectedYear} neste setor. Se você já lançou em outro mês, selecione o Mês/Ano no topo.
                   </div>
                 )}
                 {visibleSections.map((section, index) => (
                    <div key={section.id} className="mb-8 last:mb-0 w-full">
                      <table className="table-fixed border-collapse border border-black text-black text-[8px] print:text-[10px] w-full">
                             <colgroup>
                <col className="w-8 print:w-6" />
                                <col className="w-[320px] print:w-[200px]" />
                                <col className="w-20 print:w-[92px]" />
                                <col className="w-20 print:w-[66px]" />
                                <col className="w-16 print:w-[56px]" />
                                {!isSetorHidden && <col className="w-20 print:w-[78px]" />}
                                {daysArray.map(d => <col key={d.day} className="w-4 print:w-4" />)}
                                <col className="w-10 print:w-10" />
                             </colgroup>
                             <thead>
                                {/* Header Row 1: Unit Title - Only for first section */}
                                {index === 0 && selectedUnitId && (
                                <tr className="bg-[#1e3a5f] text-white">
                                    <th colSpan={(isSetorHidden ? 5 : 6) + daysInMonth + 1} className="border border-black px-0.5 py-0.5 text-center font-bold print:font-normal uppercase text-base print:text-[14px] whitespace-nowrap overflow-hidden text-ellipsis">
                                        {data.units.find(u => u.id === selectedUnitId)?.title || 'UNIDADE'}
                                    </th>
                                </tr>
                                )}
                                {/* Header Row 2: Section Title + Month/Year */}
                                <tr className="bg-[#1e3a5f] text-white">
                                    <th colSpan={(isSetorHidden ? 5 : 6) + daysInMonth + 1} className="border border-black px-0.5 py-0.5 text-center font-bold print:font-normal uppercase text-base print:text-[15px] relative group whitespace-nowrap overflow-hidden text-ellipsis">
                                        {editingSectionId === section.id ? (
                                          <span className="no-print inline-flex items-center justify-center gap-2 w-full px-2">
                                            <span className="shrink-0">ESCALA</span>
                                            <input
                                              value={editingSectionTitle}
                                              onChange={(e) => setEditingSectionTitle(e.target.value)}
                                              className="max-w-[420px] w-full text-sm font-bold uppercase text-black bg-white rounded px-2 py-1 outline-none"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') saveSectionTitle()
                                                if (e.key === 'Escape') setEditingSectionId(null)
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                            />
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                saveSectionTitle()
                                              }}
                                              className="p-1 rounded bg-white/10 hover:bg-white/20"
                                              title="Salvar"
                                            >
                                              <Save size={16} />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setEditingSectionId(null)
                                              }}
                                              className="p-1 rounded bg-white/10 hover:bg-white/20"
                                              title="Cancelar"
                                            >
                                              <X size={16} />
                                            </button>
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center justify-center gap-2">
                                            ESCALA {section.title} - {MONTHS[selectedMonth]} {selectedYear}
                                            {canEditSelectedUnit && !isScheduleReleased && (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  startEditingSection(section)
                                                }}
                                                className="no-print text-white/80 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                title="Editar nome do grupo"
                                              >
                                                <Pencil size={16} />
                                              </button>
                                            )}
                                          </span>
                                        )}
                                        <span className="hidden print:inline">
                                          ESCALA {section.title} - {MONTHS[selectedMonth]} {selectedYear}
                                        </span>
                                        {isAdmin && (
                                            <button 
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (isScheduleReleased) return;
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
                                      className="border border-black px-0.5 py-0.5 text-center sticky left-0 bg-[#85b1e2] z-20 font-bold cursor-pointer select-none text-sm print:text-[14px] w-8 print:w-6 print:static print:left-auto print:z-0"
                                      rowSpan={2}
                                  onClick={async () => {
                                    if (!isAdmin || isScheduleReleased) return
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
                                <th className="border border-black px-0.5 py-0.5 text-center w-[320px] print:w-[200px] sticky left-8 bg-[#85b1e2] z-20 border-r-2 border-r-black font-bold uppercase text-sm print:text-[14px] group print:static print:left-auto print:z-0" rowSpan={2}>
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
                                <th className="border border-black px-0.5 py-0.5 text-center w-20 print:w-[92px] font-bold text-sm print:text-[13px] bg-[#85b1e2]" rowSpan={2}>CATEGORIA</th>
                                <th className="border border-black px-0.5 py-0.5 text-center w-20 print:w-[66px] font-bold text-sm print:text-[13px] bg-[#85b1e2]" rowSpan={2}>VÍNCULO</th>
                                <th className="border border-black px-0.5 py-0.5 text-center w-16 print:w-[56px] font-bold text-sm print:text-[13px] bg-[#85b1e2]" rowSpan={2}>
                                    <>
                                      <select
                                        value={displayDynamicField}
                                        onChange={(e) => handleDisplayDynamicFieldChange(e.target.value as any)}
                                        className="no-print bg-transparent w-full text-center uppercase font-bold outline-none"
                                        title="Clique para escolher a coluna (COREN/CRM/CPF/Telefone)"
                                      >
                                        <option value="coren">COREN</option>
                                        <option value="crm">CRM</option>
                                        <option value="cpf">CPF</option>
                                        <option value="phone">TELEFONE</option>
                                        <option value="role">CARGO</option>
                                        <option value="vinculo">VÍNCULO</option>
                                      </select>
                                      <span className="hidden print:block uppercase">
                                        {displayDynamicField === 'role' ? 'CARGO' : displayDynamicField}
                                      </span>
                                    </>
                                </th>
                                {!isSetorHidden && (
                                <th className="border border-black px-0.5 py-0.5 text-center w-20 print:w-[78px] font-bold text-sm print:text-[13px] bg-[#85b1e2] group relative" rowSpan={2}>
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
                                    <th key={`wd-${day}`} className={`border border-black px-0 py-0 text-center w-4 print:w-4 text-[10px] print:text-[10px] font-bold ${isWeekend ? 'bg-[#3b5998] text-white' : 'bg-[#85b1e2] text-black'}`}>
                                    {weekday}
                                    </th>
                                ))}
                                <th className="border border-black px-0.5 py-0.5 text-center w-12 print:w-16 font-bold text-sm print:text-[14px] bg-[#85b1e2]">TOTAL</th>
                            </tr>
                            {/* Main Headers Row 2 */}
                            <tr className="bg-[#85b1e2] text-black">
                                {daysArray.map(({ day, isWeekend }) => (
                                    <th key={`d-${day}`} className={`border border-black px-0 py-0 text-center w-4 print:w-4 text-[10px] print:text-[10px] font-bold ${isWeekend ? 'bg-[#3b5998] text-white' : 'bg-[#85b1e2] text-black'}`}>
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
                            {(() => {
                                if (index !== visibleSections.length - 1) return null;

                                const activeLegendData = footerLegendData

                                if (activeLegendData.length === 0 && !footerText) return null;

                                return (
                                    <tr className="bg-white text-black no-print-background">
                                        <td 
                                            colSpan={(isSetorHidden ? 5 : 6) + daysInMonth + 1} 
                                            className="border-x border-black px-1 py-1"
                                        >
                                            <div className="flex flex-col gap-0.5 min-h-[1px]">
                                                {activeLegendData.map((legend: any) => (
                                                    <div key={legend.type} className="text-xs print:text-[11px] font-bold uppercase flex items-start">
                                                        <span className="mr-2 whitespace-nowrap">{legend.label}:</span>
                                                        <span className="font-normal">{legend.names}</span>
                                                    </div>
                                                ))}
                                                {footerText && footerText !== '<br>' && footerText !== '' && (
                                                    <div 
                                                        className={`text-xs print:text-[11px] ${activeLegendData.length > 0 ? 'mt-1' : ''}`}
                                                        dangerouslySetInnerHTML={{ __html: footerText }}
                                                    />
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })()}
                        </tfoot>
                    </table>
                 </div>
             ))}
             
             {canManageSelectedUnit && (
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
             </div>
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

      {isAdmin && !isScheduleReleased && (
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
                <button onClick={saveNewSection} className="text-green-600 hover:text-green-800">
                    <Check size={18} />
                </button>
                <button onClick={() => setIsAddingSection(false)} className="text-red-600 hover:text-red-800">
                    <X size={18} />
                </button>
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
        {canEditSelectedUnit && (
        <div className="flex flex-col items-end gap-2 mb-2 no-print">
            <div className="flex flex-wrap gap-2 justify-end">
                {canEditSelectedUnit && (
                    <button 
                        onClick={handleEditFooter}
                        className="px-2 py-1 text-xs border rounded text-black border-gray-300 hover:bg-gray-50"
                    >
                        Editar texto do rodapé
                    </button>
                )}
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
                <div className="bg-white p-6 border rounded shadow-2xl w-[98%] max-w-[1500px] mx-auto">
                    <h3 className="font-bold mb-4 text-xl text-black">Editar Texto do Rodapé</h3>
                    
                    {/* Toolbar */}
                    <div className="flex flex-wrap gap-2 mb-4 p-3 bg-gray-100 rounded border border-gray-200">
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('bold', false); }}
                            className="p-2 px-4 bg-white border border-gray-300 rounded hover:bg-gray-200 font-bold text-black text-lg"
                            title="Negrito"
                        >B</button>
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('italic', false); }}
                            className="p-2 px-4 bg-white border border-gray-300 rounded hover:bg-gray-200 italic text-black text-lg"
                            title="Itálico"
                        >I</button>
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('underline', false); }}
                            className="p-2 px-4 bg-white border border-gray-300 rounded hover:bg-gray-200 underline text-black text-lg"
                            title="Sublinhado"
                        >U</button>
                        <button
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('insertUnorderedList', false); }}
                            className="p-2 px-3 bg-white border border-gray-300 rounded hover:bg-gray-200 text-black text-sm font-bold"
                            title="Lista"
                        >
                            • Lista
                        </button>
                        <button
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('removeFormat', false); }}
                            className="p-2 px-3 bg-white border border-gray-300 rounded hover:bg-gray-200 text-black text-sm font-bold"
                            title="Limpar formatação"
                        >
                            Limpar
                        </button>
                        <div className="w-px h-8 bg-gray-300 mx-2"></div>
                        <input 
                            type="color" 
                            onChange={(e) => { document.execCommand('foreColor', false, e.target.value); }}
                            className="w-10 h-10 p-0 border rounded cursor-pointer bg-white"
                            title="Cor do Texto"
                        />
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('foreColor', false, '#ef4444'); }}
                            className="w-10 h-10 rounded bg-red-500 border border-gray-300 hover:scale-110 transition-transform"
                            title="Vermelho"
                        ></button>
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('foreColor', false, '#3b82f6'); }}
                            className="w-10 h-10 rounded bg-blue-500 border border-gray-300 hover:scale-110 transition-transform"
                            title="Azul"
                        ></button>
                        <button 
                            onMouseDown={(e) => { e.preventDefault(); document.execCommand('foreColor', false, '#000000'); }}
                            className="w-10 h-10 rounded bg-black border border-gray-300 hover:scale-110 transition-transform"
                            title="Preto"
                        ></button>
                    </div>

                    <div
                        contentEditable
                        ref={footerEditorRef}
                        className="w-full min-h-[300px] border-2 border-blue-100 p-4 mb-4 text-base text-black bg-white rounded shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500 overflow-y-auto"
                        onInput={(e) => setTempFooterText(e.currentTarget.innerHTML)}
                    />
                    
                    <p className="text-xs text-gray-500 mb-4 font-medium italic">Dica: Use as ferramentas acima para formatar o texto (Negrito, Cor, etc). A área de edição foi aumentada para facilitar o trabalho.</p>

                    <div className="flex justify-end gap-3 mt-4">
                        <button onClick={() => setIsEditingFooter(false)} className="px-6 py-2 border-2 rounded-lg hover:bg-gray-100 text-black font-semibold transition-colors">Cancelar</button>
                        <button onClick={saveFooterText} className="px-8 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md transition-colors">Salvar Alterações</button>
                    </div>
                </div>
            )}
        </div>
        )}

        {/* Electronic Release Signature */}
        {isScheduleReleased && (
            <div className="mt-16 text-[11px] font-bold uppercase hidden print:block text-center max-w-[600px] mx-auto">
                {data.releases?.find(r => r.month === selectedMonth + 1 && r.year === selectedYear && (selectedUnitId ? String(r.unit_id) === String(selectedUnitId) : !r.unit_id))?.release_signature || 'LIBERADO ELETRONICAMENTE'}
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
            zoom: 0.95; /* Increased for better legibility */
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
            font-size: 13px !important;
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
          .schedule-root th {
            font-size: 16px !important;
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
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-xl">
                <h3 className="font-bold text-lg mb-4 text-black border-b pb-2">
                    Gerenciar Plantão
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                    <strong>Profissional:</strong> {shiftModalData.nurseName}<br/>
                    <strong>Data Inicial:</strong> {shiftModalData.date.split('-').reverse().join('/')}
                </p>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-black mb-2 italic">1. Preenchimento Automático (Mês Todo)</label>
                    <div className="flex gap-2 flex-wrap mb-4 bg-blue-50 p-3 rounded border border-blue-200">
                        <button 
                            onClick={() => handleSaveShifts('day', 'daily', false)}
                            className="flex-1 min-w-[60px] py-2 px-2 rounded border bg-white text-black border-gray-300 hover:bg-blue-600 hover:text-white transition-colors font-bold"
                            title="Preencher todo o mês com Dia (D)"
                        >
                            Dia (D)
                        </button>
                        <button 
                            onClick={() => handleSaveShifts('night', 'daily', false)}
                            className="flex-1 min-w-[60px] py-2 px-2 rounded border bg-white text-black border-gray-300 hover:bg-blue-600 hover:text-white transition-colors font-bold"
                            title="Preencher todo o mês com Noite (N)"
                        >
                            Noite (N)
                        </button>
                        <button 
                            onClick={() => handleSaveShifts('morning', 'daily', false)}
                            className="flex-1 min-w-[60px] py-2 px-2 rounded border bg-white text-black border-gray-300 hover:bg-blue-600 hover:text-white transition-colors font-bold"
                            title="Preencher todo o mês com Manhã (M)"
                        >
                            Manhã (M)
                        </button>
                        <button 
                            onClick={() => handleSaveShifts('afternoon', 'daily', false)}
                            className="flex-1 min-w-[60px] py-2 px-2 rounded border bg-white text-black border-gray-300 hover:bg-blue-600 hover:text-white transition-colors font-bold"
                            title="Preencher todo o mês com Tarde (T)"
                        >
                            Tarde (T)
                        </button>
                        <button 
                            onClick={() => handleSaveShifts('mt', 'daily', false)}
                            className="flex-1 min-w-[60px] py-2 px-2 rounded border bg-white text-black border-gray-300 hover:bg-blue-600 hover:text-white transition-colors font-bold"
                            title="Preencher todo o mês com MT"
                        >
                            MT
                        </button>
                        <button 
                            onClick={() => handleSaveShifts('morning', 'mon_fri', false)}
                            className="flex-1 min-w-[80px] py-2 px-2 rounded border bg-white text-black border-gray-300 hover:bg-blue-600 hover:text-white transition-colors font-bold"
                            title="Preencher Segunda a Sexta - Manhã (M)"
                        >
                            Seg a Sexta M
                        </button>
                        <button 
                            onClick={() => handleSaveShifts('afternoon', 'mon_fri', false)}
                            className="flex-1 min-w-[80px] py-2 px-2 rounded border bg-white text-black border-gray-300 hover:bg-blue-600 hover:text-white transition-colors font-bold"
                            title="Preencher Segunda a Sexta - Tarde (T)"
                        >
                            Seg a Sexta T
                        </button>
                        <button 
                            onClick={() => handleSaveShifts('dn', 'daily', false)}
                            className="flex-1 min-w-[60px] py-2 px-2 rounded border bg-white text-black border-gray-300 hover:bg-blue-600 hover:text-white transition-colors font-bold"
                            title="Preencher todo o mês com DN"
                        >
                            DN
                        </button>
                        <button 
                            onClick={() => handleSaveShifts('dn', 'dn_off4', false)}
                            className="flex-1 min-w-[80px] py-2 px-2 rounded border bg-white text-black border-gray-300 hover:bg-blue-600 hover:text-white transition-colors font-bold"
                            title="DN Folga 4 (Repetir até o fim do mês)"
                        >
                            DN Folga 4
                        </button>
                        <button 
                            onClick={() => handleSaveShifts('day', 'd_off2', false)}
                            className="flex-1 min-w-[80px] py-2 px-2 rounded border bg-white text-black border-gray-300 hover:bg-blue-600 hover:text-white transition-colors font-bold"
                            title="D Folga 2 (Repetir até o fim do mês)"
                        >
                            D Folga 2
                        </button>
                        <button 
                            onClick={() => handleSaveShifts('nd', 'nd_off4', false)}
                            className="flex-1 min-w-[80px] py-2 px-2 rounded border bg-white text-black border-gray-300 hover:bg-blue-600 hover:text-white transition-colors font-bold"
                            title="ND Folga 4 (Repetir até o fim do mês)"
                        >
                            ND Folga 4
                        </button>
                        <button 
                            onClick={() => handleSaveShifts('delete', 'daily', false)}
                            className="flex-1 min-w-[60px] py-2 px-2 rounded border bg-white text-red-600 border-red-300 hover:bg-red-600 hover:text-white transition-colors font-bold"
                            title="Limpar toda a linha (Mês inteiro)"
                        >
                            Limpar Mês
                        </button>
                    </div>

                    <label className="block text-sm font-medium text-black mb-2 italic">2. Opção Manual (Apenas este dia)</label>
                    <div className="flex gap-2 flex-wrap bg-gray-50 p-3 rounded border">
                        {['day', 'night', 'morning', 'afternoon', 'mt', 'dn'].map(type => (
                            <button 
                                key={type}
                                onClick={() => handleSaveShifts(type, 'none', manualRed)}
                                className="flex-1 min-w-[45px] py-1 px-1 rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-100 uppercase text-[10px]"
                            >
                                {type === 'day' ? 'D' : type === 'night' ? 'N' : type === 'morning' ? 'M' : type === 'afternoon' ? 'T' : type.toUpperCase()}
                            </button>
                        ))}
                        <button 
                            onClick={() => handleSaveShifts('delete', 'none', false)}
                            className="flex-1 min-w-[45px] py-1 px-1 rounded border bg-white text-red-400 border-red-200 hover:bg-red-50 text-[10px]"
                        >
                            APAGAR
                        </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          id="manualRed"
                          type="checkbox"
                          checked={manualRed}
                          onChange={(e) => setManualRed(e.target.checked)}
                          className="h-4 w-4"
                        />
                        <label htmlFor="manualRed" className="text-sm font-semibold text-gray-800">
                          Sinalizar letra em vermelho (somente manual)
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (!manualBaseType) return
                          handleSaveShifts(manualBaseType, 'none', manualRed)
                        }}
                        disabled={!manualBaseType}
                        className={`px-3 py-2 rounded font-bold text-xs transition-colors ${manualBaseType ? 'bg-gray-800 text-white hover:bg-black' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                        title={manualBaseType ? 'Salvar somente a sinalização (sem mudar a letra)' : 'Não há letra neste dia para sinalizar'}
                      >
                        SALVAR SINALIZAÇÃO
                      </button>
                    </div>
                </div>

                <div className="flex justify-center border-t pt-4 mt-2">
                    <button 
                        onClick={() => setIsShiftModalOpen(false)}
                        className={`px-6 py-2 rounded font-bold transition-colors ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-800 text-white hover:bg-black'}`}
                        disabled={isSaving}
                    >
                        {isSaving ? 'SALVANDO...' : 'FECHAR JANELA'}
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
                                : sqlModalType === 'V16'
                                    ? 'Para permitir ocultar a coluna SETOR, é necessário adicionar uma nova coluna à tabela de metadados.'
                                    : 'Para permitir gerenciar permissões por setor, é necessário criar uma tabela no banco de dados.'}
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
` : sqlModalType === 'V16' ? `-- Execute este código no SQL Editor do Supabase (V16):
-- Este script adiciona a coluna is_setor_hidden na tabela de metadados.

ALTER TABLE monthly_schedule_metadata 
ADD COLUMN IF NOT EXISTS is_setor_hidden BOOLEAN DEFAULT FALSE;
` : sqlModalType === 'V17' ? `-- Execute este código no SQL Editor do Supabase (V17):
-- Este script cria a tabela de permissões de escala.

CREATE TABLE IF NOT EXISTS scale_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nurse_id UUID REFERENCES nurses(id) ON DELETE CASCADE,
    unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(nurse_id, unit_id)
);

-- Habilitar RLS (Opcional, mas recomendado)
ALTER TABLE scale_permissions ENABLE ROW LEVEL SECURITY;

-- Política simples: apenas admins podem ver/editar
CREATE POLICY "Admins can manage scale permissions" ON scale_permissions
    FOR ALL USING (auth.jwt() ->> 'role' = 'ADMIN' OR auth.jwt() ->> 'role' = 'COORDENACAO_GERAL');
` : ''}
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

      {/* Nurse Selection Modal for Reassign */}
      {isReassignModalOpen && (
          <NurseSelectionModal
              isOpen={isReassignModalOpen}
              onClose={() => setIsReassignModalOpen(false)}
              onSelect={onReassignSelected}
              nurses={allNurses.length > 0 ? allNurses : data.nurses}
              isFetching={isFetchingAllNurses}
              sectionTitle={data.sections.find(s => s.id === reassignData?.sectionId)?.title}
              existingNurseIds={[]}
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

      {/* Unit Management Modal */}
      {isUnitManagerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
                <div className="bg-gray-800 p-4 text-white flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                        <Pencil size={18} />
                        Gerenciar Lista de Setores
                    </h3>
                    <button onClick={() => setIsUnitManagerOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[70vh]">
                    <div className="space-y-3">
                        {[...data.units].sort((a, b) => {
                            const na = parseInt(unitNumbersMap[a.id] || '9999', 10)
                            const nb = parseInt(unitNumbersMap[b.id] || '9999', 10)
                            return na - nb || a.title.localeCompare(b.title)
                        }).map(unit => (
                            <div key={unit.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200 group hover:border-indigo-300 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="bg-gray-200 text-gray-700 font-bold px-2 py-1 rounded text-xs min-w-[30px] text-center">
                                        {unitNumbersMap[unit.id] || '-'}
                                    </span>
                                    <span className="font-bold text-gray-800 uppercase text-sm">{unit.title}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={async () => {
                                            const newTitle = prompt('Novo nome para o setor:', unit.title)
                                            if (newTitle && newTitle !== unit.title) {
                                                const res = await updateUnit(unit.id, newTitle)
                                                if (res.success) fetchData(true)
                                                else alert(res.message)
                                            }
                                        }}
                                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                        title="Editar nome"
                                    >
                                        <Pencil size={16} />
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            const newNum = prompt('Novo número para o setor:', unitNumbersMap[unit.id] || '')
                                            if (newNum !== null) {
                                                const res = await saveUnitNumber(unit.id, newNum)
                                                if (res.success) {
                                                    const map = await getAllUnitNumbers()
                                                    setUnitNumbersMap(map || {})
                                                } else alert(res.message)
                                            }
                                        }}
                                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                        title="Editar número"
                                    >
                                        <ArrowDownCircle size={16} />
                                    </button>
                                    <button 
                                        onClick={async () => {
                                            if (confirm(`DESEJA EXCLUIR O SETOR "${unit.title}"?\n\nIsso apagará o setor E TODO O SEU HISTÓRICO de escalas e plantões.\n\nEsta ação é IRREVERSÍVEL.`)) {
                                                const confirmName = prompt(`Para confirmar a exclusão, digite EXCLUIR ou o nome do setor (${unit.title}):`)
                                                if (confirmName && (confirmName.toUpperCase().trim() === 'EXCLUIR' || confirmName.toUpperCase().trim() === unit.title.toUpperCase().trim())) {
                                                    const res = await deleteUnit(unit.id)
                                                    if (res.success) {
                                                        if (selectedUnitId === unit.id) setSelectedUnitId('')
                                                        fetchData(true)
                                                    } else alert(res.message)
                                                } else if (confirmName !== null) {
                                                    alert('Confirmação incorreta. A exclusão foi cancelada.')
                                                }
                                            }
                                        }}
                                        className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                        title="EXCLUIR DEFINITIVAMENTE"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-between items-center">
                    <p className="text-xs text-gray-500 italic">Cuidado: a exclusão de um setor apaga todos os plantões salvos nele.</p>
                    <button 
                        onClick={() => setIsUnitManagerOpen(false)}
                        className="px-6 py-2 bg-gray-800 text-white font-bold rounded-xl hover:bg-black transition-colors uppercase text-xs tracking-widest"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Permission Manager Modal */}
      {isPermissionManagerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden">
                <div className="bg-indigo-800 p-4 text-white flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2">
                        <UserPlus size={18} />
                        Gerenciar Permissões de Escala
                    </h3>
                    <button onClick={() => setIsPermissionManagerOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                        <X size={24} />
                    </button>
                </div>
                
                <div className="p-6 border-b bg-gray-50">
                    <div className="flex flex-col gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Servidor</label>
                                <select 
                                    value={permissionNurseId}
                                    onChange={e => {
                                      setPermissionNurseId(e.target.value)
                                      setPermissionUnitSearch('')
                                    }}
                                    disabled={isFetchingAllNurses}
                                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">
                                      {isFetchingAllNurses ? 'Carregando servidores...' : 'Selecione um servidor...'}
                                    </option>
                                    {[...(allNurses.length > 0 ? allNurses : data.nurses)]
                                      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
                                      .map(n => (
                                        <option key={n.id} value={n.id}>
                                          {n.name}{n.vinculo ? ` (${n.vinculo})` : ''}
                                        </option>
                                    ))}
                                </select>
                                {permissionNurseId && (
                                  <div className="mt-2 p-2 rounded-lg bg-indigo-50 border border-indigo-100">
                                    <p className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                                      Escalas liberadas para {selectedPermissionNurse?.name || 'Servidor'}: {selectedPermissionUnits.length}
                                    </p>
                                    {selectedPermissionUnits.length > 0 ? (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {selectedPermissionUnits.map(u => (
                                          <span key={u.id} className="text-[11px] px-2 py-0.5 rounded-full bg-white border border-indigo-200 text-indigo-700 font-semibold">
                                            {u.title}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-[11px] text-gray-500 mt-1">
                                        Nenhuma escala específica liberada para este servidor.
                                      </p>
                                    )}
                                  </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Setores / Escalas</label>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                  <label className="flex items-center gap-2 text-xs font-bold text-gray-700 uppercase">
                                    <input
                                      type="checkbox"
                                      checked={permissionSelectAllUnits}
                                      onChange={(e) => {
                                        const checked = e.target.checked
                                        setPermissionSelectAllUnits(checked)
                                        if (checked) {
                                          setPermissionUnitIds([...data.units].map(u => u.id))
                                        } else {
                                          setPermissionUnitIds([])
                                        }
                                      }}
                                      className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    Todas as escalas
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPermissionUnitIds([])
                                      setPermissionSelectAllUnits(false)
                                      setPermissionUnitSearch('')
                                    }}
                                    className="text-xs font-bold text-gray-600 hover:text-gray-900 uppercase"
                                  >
                                    Limpar
                                  </button>
                                </div>

                                <input
                                  value={permissionUnitSearch}
                                  onChange={(e) => setPermissionUnitSearch(e.target.value)}
                                  placeholder="Pesquisar setor..."
                                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white text-black focus:ring-2 focus:ring-indigo-500 mb-2"
                                />

                                <div className="bg-white border border-gray-200 rounded-lg p-2 max-h-[160px] overflow-y-auto">
                                  {[...data.units]
                                    .sort((a, b) => a.title.localeCompare(b.title))
                                    .filter(u => u.title.toLowerCase().includes(permissionUnitSearch.toLowerCase().trim()))
                                    .map(u => {
                                      const checked = permissionUnitIds.includes(u.id)
                                      return (
                                        <label key={u.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            disabled={permissionSelectAllUnits}
                                            onChange={(e) => {
                                              const isChecked = e.target.checked
                                              setPermissionUnitIds(prev => {
                                                const next = isChecked ? Array.from(new Set([...prev, u.id])) : prev.filter(id => id !== u.id)
                                                setPermissionSelectAllUnits(next.length > 0 && next.length === data.units.length)
                                                return next
                                              })
                                            }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                          />
                                          <span className="text-sm text-gray-800">{u.title}</span>
                                        </label>
                                      )
                                    })}
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={async () => {
                                if (!permissionNurseId) {
                                  alert('Selecione o servidor.')
                                  return
                                }

                                const targetUnitIds = permissionSelectAllUnits ? [...data.units].map(u => u.id) : permissionUnitIds
                                if (targetUnitIds.length === 0) {
                                  alert('Selecione pelo menos um setor, ou marque "Todas as escalas".')
                                  return
                                }

                                const res = targetUnitIds.length === 1
                                  ? await addScalePermission(permissionNurseId, targetUnitIds[0])
                                  : await addScalePermissions(permissionNurseId, targetUnitIds)
                                if (res.success) {
                                    const p = await getScalePermissions()
                                    setPermissions(p)
                                    setPermissionNurseId('')
                                    setPermissionUnitIds([])
                                    setPermissionSelectAllUnits(false)
                                    setPermissionUnitSearch('')
                                } else {
                                    if (res.message === 'DATABASE_V17_REQUIRED') {
                                        setSqlModalType('V17')
                                        setShowSqlModal(true)
                                    } else {
                                        alert(res.message)
                                    }
                                }
                            }}
                            className="bg-indigo-600 text-white font-bold py-2 rounded-lg hover:bg-indigo-700 transition-colors uppercase text-xs tracking-widest shadow-md"
                        >
                            Vincular Servidor à Escala
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto max-h-[40vh]">
                    <h4 className="text-xs font-bold text-gray-500 uppercase mb-4 tracking-widest">Permissões Ativas</h4>
                    <div className="space-y-2">
                        {permissions.length === 0 ? (
                            <p className="text-sm text-gray-400 italic text-center py-4">Nenhuma permissão específica cadastrada.</p>
                        ) : (
                            permissions.map(p => (
                                <div key={p.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-800 text-sm uppercase">
                                            {p.nurses?.name || data.nurses.find(n => n.id === p.nurse_id)?.name || 'Servidor'}
                                        </span>
                                        {(p.nurses?.vinculo || data.nurses.find(n => n.id === p.nurse_id)?.vinculo) && (
                                          <span className="text-[11px] text-gray-500 font-medium">
                                            Perfil: {p.nurses?.vinculo || data.nurses.find(n => n.id === p.nurse_id)?.vinculo}
                                          </span>
                                        )}
                                        <span className="text-xs text-indigo-600 font-medium">
                                            Acesso ao Setor: {p.units?.title || data.units.find(u => u.id === p.unit_id)?.title || 'Setor'}
                                        </span>
                                    </div>
                                    <button 
                                        onClick={async () => {
                                            if (confirm('Remover esta permissão de edição?')) {
                                                const res = await removeScalePermission(p.id)
                                                if (res.success) {
                                                    const pList = await getScalePermissions()
                                                    setPermissions(pList)
                                                } else alert(res.message)
                                            }
                                        }}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Remover permissão"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-end">
                    <button 
                        onClick={() => setIsPermissionManagerOpen(false)}
                        className="px-6 py-2 bg-gray-800 text-white font-bold rounded-xl hover:bg-black transition-colors uppercase text-xs tracking-widest"
                    >
                        Concluir
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* QR Code in the bottom right corner of the print layout */}
      <div className="hidden print:flex fixed bottom-2 right-2 flex-col items-center gap-0.5 z-[9999] opacity-90">
          <QRCodeSVG 
              value={typeof window !== 'undefined' ? `${window.location.origin}/?unit=${selectedUnitId}&month=${selectedMonth + 1}&year=${selectedYear}` : ''} 
              size={85}
              level="H"
              includeMargin={true}
          />
          <span className="text-[8px] font-bold text-black uppercase tracking-tight">Autenticidade</span>
      </div>
    </div>
  )
}
