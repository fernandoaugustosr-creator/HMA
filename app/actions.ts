'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase'
import { readDb, writeDb, isLocalMode } from '@/lib/local-db'
import { randomUUID } from 'crypto'
import { cache } from 'react'

// Types
export interface Section {
  id: string
  title: string
  position: number
  sector_title?: string
}

export interface Unit {
  id: string
  title: string
}

export interface ScalePermission {
  id: string
  nurse_id: string
  unit_id: string
  created_at?: string
}

export async function getSystemRoles() {
  const defaultRoles = [
    { id: 'ADMIN', label: 'Administrador' },
    { id: 'COORDENACAO_GERAL', label: 'Coordenação Geral' },
    { id: 'COORDENADOR', label: 'Coordenador' },
    { id: 'ENFERMEIRO', label: 'Enfermeiro' },
    { id: 'TECNICO', label: 'Téc. de Enfermagem' }
  ]

  const mergeUnique = (base: { id: string, label: string }[], extra: { id: string, label: string }[]) => {
    const map = new Map<string, { id: string, label: string }>()
    base.forEach(r => map.set(String(r.id), { id: String(r.id), label: String(r.label) }))
    extra.forEach(r => {
      const id = String(r.id)
      const label = String(r.label)
      if (!map.has(id)) map.set(id, { id, label })
    })
    return Array.from(map.values())
  }

  if (isLocalMode()) {
    const db = readDb()
    return mergeUnique(defaultRoles, db.roles || [])
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .like('key', 'role_%')

  if (error || !data || data.length === 0) {
    return defaultRoles
  }

  // Expect keys like 'role_ADMIN', 'role_TECNICO'
  // If we have a 'value' column, we can store the label there.
  // If not, we format the ID.
  // Let's check if 'value' exists by seeing if it's returned.
  // Actually, saveAbsenceSettings used bool_value. 
  // Let's assume we might need to add a value column or use bool_value.
  // Ideally we want to store the label.
  
  const fromSettings = data.map((row: any) => ({
    id: row.key.replace('role_', ''),
    label: row.value || row.key.replace('role_', '')
  }))
  return mergeUnique(defaultRoles, fromSettings)
}

export async function addSystemRole(roleId: string, roleLabel: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.roles = db.roles || []
    if (!db.roles.find((r: any) => r.id === roleId)) {
      db.roles.push({ id: roleId, label: roleLabel })
      writeDb(db)
    }
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  
  // Check if value column exists, otherwise we just insert key/bool_value
  // We'll try to insert with value first. If it fails, we fallback?
  // Or simpler: we use a new table 'roles' if app_settings is too limited.
  // But sticking to app_settings as planned.
  // Let's assume we added a 'value' column or check if it exists.
  // Since I can't check easily, I'll try to upsert.
  
  const { error } = await supabase
    .from('app_settings')
    .upsert({ 
      key: `role_${roleId}`, 
      value: roleLabel,
      bool_value: true 
    }, { onConflict: 'key' })

  if (error) {
    // If error implies 'value' column missing, we might need to add it.
    // But for now, let's return error message.
    return { success: false, message: 'Erro ao adicionar cargo: ' + error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function updateSystemRole(roleId: string, roleLabel: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const protectedRoles = new Set(['ADMIN', 'COORDENACAO_GERAL', 'COORDENADOR', 'ENFERMEIRO', 'TECNICO'])
  if (protectedRoles.has(roleId)) {
    return { success: false, message: 'Este cargo é protegido e não pode ser alterado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.roles = db.roles || []
    const existing = db.roles.find((r: any) => r.id === roleId)
    if (!existing) return { success: false, message: 'Cargo não encontrado.' }
    existing.label = roleLabel
    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('app_settings')
    .upsert({
      key: `role_${roleId}`,
      value: roleLabel,
      bool_value: true
    }, { onConflict: 'key' })

  if (error) return { success: false, message: 'Erro ao alterar cargo: ' + error.message }
  revalidatePath('/')
  return { success: true }
}

export async function deleteSystemRole(roleId: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const protectedRoles = new Set(['ADMIN', 'COORDENACAO_GERAL', 'COORDENADOR', 'ENFERMEIRO', 'TECNICO'])
  if (protectedRoles.has(roleId)) {
    return { success: false, message: 'Este cargo é protegido e não pode ser removido.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.roles = (db.roles || []).filter((r: any) => r.id !== roleId)
    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase.from('app_settings').delete().eq('key', `role_${roleId}`)
  if (error) return { success: false, message: 'Erro ao remover cargo: ' + error.message }
  revalidatePath('/')
  return { success: true }
}

export async function getBirthdaysForMonth(month: number) {
  const session = cookies().get('session_user')
  if (!session) return []

  const parseBirthDate = (raw: any) => {
    if (!raw) return null
    const s = String(raw)
    const parts = s.split('-')
    if (parts.length >= 3 && parts[1] && parts[2]) {
      const m = Number(parts[1])
      const d = Number(parts[2].slice(0, 2))
      if (!Number.isNaN(m) && !Number.isNaN(d)) return { month: m, day: d }
    }
    return null
  }

  if (isLocalMode()) {
    const db = readDb()
    const list = (db.nurses || [])
      .map((n: any) => {
        const parsed = parseBirthDate(n.birth_date)
        if (!parsed || parsed.month !== month) return null
        return { id: String(n.id), name: String(n.name || ''), day: parsed.day }
      })
      .filter(Boolean) as { id: string, name: string, day: number }[]
    return list.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name, 'pt-BR'))
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('nurses')
    .select('id,name,birth_date')
    .range(0, 9999)

  if (error) {
    if (error.message?.includes('birth_date')) return []
    return []
  }

  const list = (data || [])
    .map((n: any) => {
      const parsed = parseBirthDate(n.birth_date)
      if (!parsed || parsed.month !== month) return null
      return { id: String(n.id), name: String(n.name || ''), day: parsed.day }
    })
    .filter(Boolean) as { id: string, name: string, day: number }[]

  return list.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name, 'pt-BR'))
}

export async function getAbsenceSettings() {
  const defaultSettings = {
    view_roles: ['ADMIN', 'COORDENACAO_GERAL', 'COORDENADOR'],
    edit_roles: ['ADMIN', 'COORDENACAO_GERAL', 'COORDENADOR']
  }

  if (isLocalMode()) {
    const db = readDb()
    const settings = db.settings || {}
    return {
      view_roles: settings.absence_view_roles || defaultSettings.view_roles,
      edit_roles: settings.absence_edit_roles || defaultSettings.edit_roles
    }
  }

  const supabase = createClient()
  
  // We'll use keys like 'absence_role_view_ADMIN', 'absence_role_edit_ENFERMEIRO'
  // But strictly storing arrays in a text column would be easier if supported.
  // Let's assume we can use a JSON value in a 'value' column or 'json_value'.
  // Since we are unsure, let's try to fetch all keys starting with 'absence_'
  
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, bool_value')
    .like('key', 'absence_%')

  if (error) {
    console.error('Error fetching absence settings:', error)
    return defaultSettings
  }

  const viewRoles = new Set<string>(defaultSettings.view_roles)
  const editRoles = new Set<string>(defaultSettings.edit_roles)

  // If we have any DB settings, we should probably clear defaults and only use DB,
  // OR we merge? Usually DB settings override.
  // Let's say if we find ANY absence_view_* key, we assume the DB is the source of truth for views.
  
  const hasDbViewSettings = data.some(d => d.key.startsWith('absence_view_'))
  const hasDbEditSettings = data.some(d => d.key.startsWith('absence_edit_'))

  if (hasDbViewSettings) viewRoles.clear()
  if (hasDbEditSettings) editRoles.clear()

  data.forEach((row: any) => {
    if (row.bool_value) {
      if (row.key.startsWith('absence_view_')) {
        viewRoles.add(row.key.replace('absence_view_', ''))
      } else if (row.key.startsWith('absence_edit_')) {
        editRoles.add(row.key.replace('absence_edit_', ''))
      }
    }
  })

  return {
    view_roles: Array.from(viewRoles),
    edit_roles: Array.from(editRoles)
  }
}

export async function saveAbsenceSettings(viewRoles: string[], editRoles: string[]) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  // Fetch all current system roles to ensure we cover custom ones
  const systemRoles = await getSystemRoles()
  const allRoleIds = systemRoles.map(r => r.id)

  if (isLocalMode()) {
    const db = readDb()
    db.settings = db.settings || {}
    db.settings.absence_view_roles = viewRoles
    db.settings.absence_edit_roles = editRoles
    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  
  const updates = []
  
  // For each known role, update the boolean
  for (const role of allRoleIds) {
    updates.push({
      key: `absence_view_${role}`,
      bool_value: viewRoles.includes(role)
    })
    updates.push({
      key: `absence_edit_${role}`,
      bool_value: editRoles.includes(role)
    })
  }

  const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' })

  if (error) {
    return { success: false, message: 'Erro ao salvar configurações: ' + error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function getUnitNumber(unitId: string) {
  if (!unitId) return null
  if (isLocalMode()) {
    const db = readDb()
    const map = (db.settings && db.settings.unit_numbers) || {}
    return map[unitId] || null
  }
  const supabase = createClient()
  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .eq('key', `unit_number_${unitId}`)
    .maybeSingle()
  return data?.value || null
}

export async function saveUnitNumber(unitId: string, numberText: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }
  if (!unitId) return { success: false, message: 'Setor inválido.' }
  const value = (numberText || '').trim()
  if (isLocalMode()) {
    const db = readDb()
    db.settings = db.settings || {}
    db.settings.unit_numbers = db.settings.unit_numbers || {}
    db.settings.unit_numbers[unitId] = value
    writeDb(db)
    revalidatePath('/escala')
    return { success: true }
  }
  const supabase = createClient()
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: `unit_number_${unitId}`, value }, { onConflict: 'key' })
  if (error) return { success: false, message: 'Erro ao salvar número do setor: ' + error.message }
  revalidatePath('/escala')
  return { success: true }
}

export async function getAllUnitNumbers(): Promise<Record<string, string>> {
  if (isLocalMode()) {
    const db = readDb()
    const map = (db.settings && db.settings.unit_numbers) || {}
    return map
  }
  const supabase = createClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .ilike('key', 'unit_number_%')
  if (error) return {}
  const result: Record<string, string> = {}
  const rows = Array.isArray(data) ? data : []
  rows.forEach((row: any) => {
    const unitId = String(row.key).replace('unit_number_', '')
    result[unitId] = row.value || ''
  })
  return result
}

export async function checkAdmin() {
  const session = cookies().get('session_user')
  if (!session) throw new Error('Unauthorized')
  const user = JSON.parse(session.value)
  const isAdmin = user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'
  if (!isAdmin) throw new Error('Forbidden: Admin access required')
  return user
}

/**
 * Enhanced checkAdmin that also allows users with specific scale permissions
 * for a given unit.
 */
export async function checkScaleEditor(unitId?: string | null) {
  const session = cookies().get('session_user')
  if (!session) throw new Error('Unauthorized')
  const user = JSON.parse(session.value)
  
  // ADMIN, COORDENACAO_GERAL e COORDENADOR têm acesso de edição de escala
  if (user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.role === 'COORDENADOR' || user.cpf === '02170025367') {
    return user
  }

  // If no unitId is provided, only global admins can pass
  if (!unitId) {
    throw new Error('Acesso negado: Requer privilégios de administrador global')
  }

  // Check for specific unit permission
  if (isLocalMode()) {
    const db = readDb()
    const hasPerm = (db.scale_permissions || []).some(
      (p: any) => String(p.nurse_id) === String(user.id) && String(p.unit_id) === String(unitId)
    )
    if (hasPerm) return user
  } else {
    const supabase = createClient()
    const { data } = await supabase
      .from('scale_permissions')
      .select('id')
      .eq('nurse_id', user.id)
      .eq('unit_id', unitId)
      .maybeSingle()
    
    if (data) return user
  }

  throw new Error('Acesso negado: Você não tem permissão para gerenciar as escalas deste setor.')
}

async function getUnitIdByRosterId(rosterId: string): Promise<string | null> {
  if (!rosterId) return null

  if (isLocalMode()) {
    const db = readDb()
    const r = (db.monthly_rosters || []).find((x: any) => String(x.id) === String(rosterId))
    return r ? (r.unit_id || null) : null
  }

  const supabase = createClient()
  const { data } = await supabase
    .from('monthly_rosters')
    .select('unit_id')
    .eq('id', rosterId)
    .maybeSingle()
  return (data as any)?.unit_id || null
}

export async function checkUser() {
  const session = cookies().get('session_user')
  if (!session) throw new Error('Unauthorized')
  return JSON.parse(session.value)
}

export async function checkGeneralAdmin() {
  const session = cookies().get('session_user')
  if (!session) throw new Error('Unauthorized')
  const user = JSON.parse(session.value)
  const isDirector = user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'
  if (!isDirector) throw new Error('Forbidden: General admin access required')
  return user
}

export async function logLogin(userId: string, userName: string, userRole: string) {
  if (isLocalMode()) {
    const db = readDb()
    db.login_logs = db.login_logs || []
    db.login_logs.push({
      id: randomUUID(),
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      login_at: new Date().toISOString()
    })
    writeDb(db)
    return { success: true }
  }
  const supabase = createClient()
  const { error } = await supabase.from('login_logs').insert({
    user_id: userId,
    user_name: userName,
    user_role: userRole
  })
  if (error) return { success: false, message: error.message }
  return { success: true }
}

export async function getScalePermissions() {
  try {
    await checkGeneralAdmin()
  } catch (e) {
    return []
  }

  if (isLocalMode()) {
    const db = readDb()
    return db.scale_permissions || []
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('scale_permissions')
    .select('*, nurses(name,vinculo,role,cpf), units(title)')
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Permission Fetch Error:', error)
    if (error.message.includes('scale_permissions')) {
      throw new Error('DATABASE_V17_REQUIRED')
    }
    return []
  }
  
  return data || []
}

export async function getMyScalePermissionUnitIds() {
  let user: any
  try {
    user = await checkUser()
  } catch (e) {
    return []
  }

  if (user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.role === 'COORDENADOR' || user.cpf === '02170025367') {
    return ['*']
  }

  if (isLocalMode()) {
    const db = readDb()
    return (db.scale_permissions || [])
      .filter((p: any) => String(p.nurse_id) === String(user.id))
      .map((p: any) => p.unit_id)
      .filter(Boolean)
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('scale_permissions')
    .select('unit_id')
    .eq('nurse_id', user.id)

  if (error) return []
  return (data || []).map((d: any) => d.unit_id).filter(Boolean)
}

export async function getEditableUnits() {
  let user: any
  try {
    user = await checkUser()
  } catch (e) {
    return []
  }

  const isGlobalAdmin = user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.role === 'COORDENADOR' || user.cpf === '02170025367'

  if (isLocalMode()) {
    const db = readDb()
    const units = db.units || []
    if (isGlobalAdmin) return units
    const allowedUnitIds = new Set(
      (db.scale_permissions || [])
        .filter((p: any) => String(p.nurse_id) === String(user.id))
        .map((p: any) => String(p.unit_id))
    )
    return units.filter((u: any) => allowedUnitIds.has(String(u.id)))
  }

  const supabase = createClient()
  if (isGlobalAdmin) {
    const { data, error } = await supabase.from('units').select('id,title').order('title', { ascending: true })
    if (error) return []
    return data || []
  }

  const { data, error } = await supabase
    .from('scale_permissions')
    .select('units(id,title)')
    .eq('nurse_id', user.id)

  if (error) return []
  const mapped = (data || []).map((row: any) => row.units).filter(Boolean)
  mapped.sort((a: any, b: any) => String(a.title || '').localeCompare(String(b.title || '')))
  return mapped
}

export async function getAllUnits() {
  try {
    await checkUser()
  } catch (e) {
    return []
  }

  if (isLocalMode()) {
    const db = readDb()
    const units = (db.units || []).map((u: any) => ({ id: u.id, title: u.title }))
    units.sort((a: any, b: any) => String(a.title || '').localeCompare(String(b.title || '')))
    return units
  }

  const supabase = createClient()
  const { data, error } = await supabase.from('units').select('id,title').order('title', { ascending: true })
  if (error) return []
  return data || []
}

export async function getUnitMonthStatuses(month: number, year: number) {
  let user: any
  try {
    user = await checkUser()
  } catch (e) {
    return {}
  }

  const isGlobalAdmin = user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'
  const allowedUnitIds = new Set<string>()

  if (!isGlobalAdmin) {
    const units = await getEditableUnits()
    units.forEach((u: any) => {
      if (u?.id) allowedUnitIds.add(String(u.id))
    })
  }

  const allow = (unitId: any) => {
    if (isGlobalAdmin) return true
    return allowedUnitIds.has(String(unitId))
  }

  if (isLocalMode()) {
    const db = readDb()
    const rosterRows = (db.monthly_rosters || []).filter((r: any) => r.month === month && r.year === year && r.unit_id)
    const releasedRows = (db.monthly_schedule_metadata || []).filter((m: any) => m.month === month && m.year === year && m.unit_id && m.is_released)

    const map: Record<string, { launched: boolean; released: boolean }> = {}

    rosterRows.forEach((r: any) => {
      if (!allow(r.unit_id)) return
      const id = String(r.unit_id)
      if (!map[id]) map[id] = { launched: false, released: false }
      map[id].launched = true
    })

    releasedRows.forEach((m: any) => {
      if (!allow(m.unit_id)) return
      const id = String(m.unit_id)
      if (!map[id]) map[id] = { launched: false, released: false }
      map[id].released = true
    })

    return map
  }

  const supabase = createClient()
  const [rostersRes, releasesRes] = await Promise.all([
    supabase.from('monthly_rosters').select('unit_id').eq('month', month).eq('year', year).not('unit_id', 'is', null).range(0, 20000),
    supabase.from('monthly_schedule_metadata').select('unit_id,is_released').eq('month', month).eq('year', year).not('unit_id', 'is', null).range(0, 20000),
  ])

  const map: Record<string, { launched: boolean; released: boolean }> = {}

  ;(rostersRes.data || []).forEach((r: any) => {
    if (!allow(r.unit_id)) return
    const id = String(r.unit_id)
    if (!map[id]) map[id] = { launched: false, released: false }
    map[id].launched = true
  })

  ;(releasesRes.data || []).forEach((m: any) => {
    if (!m.is_released) return
    if (!allow(m.unit_id)) return
    const id = String(m.unit_id)
    if (!map[id]) map[id] = { launched: false, released: false }
    map[id].released = true
  })

  return map
}

export async function addScalePermission(nurseId: string, unitId: string) {
  try {
    await checkGeneralAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.scale_permissions = db.scale_permissions || []
    if (!db.scale_permissions.find((p: any) => p.nurse_id === nurseId && p.unit_id === unitId)) {
      db.scale_permissions.push({
        id: randomUUID(),
        nurse_id: nurseId,
        unit_id: unitId,
        created_at: new Date().toISOString()
      })
      writeDb(db)
    }
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('scale_permissions')
    .insert({ nurse_id: nurseId, unit_id: unitId })

  if (error) {
    console.error('Permission Add Error:', error)
    if (error.message.includes('scale_permissions')) {
      return { success: false, message: 'DATABASE_V17_REQUIRED' }
    }
    return { success: false, message: error.message }
  }
  revalidatePath('/')
  return { success: true }
}

export async function addScalePermissions(nurseId: string, unitIds: string[]) {
  try {
    await checkGeneralAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const ids = Array.from(new Set((unitIds || []).filter(Boolean).map(String)))
  if (!nurseId || ids.length === 0) {
    return { success: false, message: 'Selecione o servidor e pelo menos um setor.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.scale_permissions = db.scale_permissions || []
    ids.forEach(unitId => {
      if (!db.scale_permissions.find((p: any) => p.nurse_id === nurseId && p.unit_id === unitId)) {
        db.scale_permissions.push({
          id: randomUUID(),
          nurse_id: nurseId,
          unit_id: unitId,
          created_at: new Date().toISOString()
        })
      }
    })
    writeDb(db)
    return { success: true }
  }

  const supabase = createClient()
  const rows = ids.map(unitId => ({ nurse_id: nurseId, unit_id: unitId }))
  const { error } = await supabase
    .from('scale_permissions')
    .upsert(rows, { onConflict: 'nurse_id,unit_id', ignoreDuplicates: true })

  if (error) {
    console.error('Permission Bulk Add Error:', error)
    if (error.message.includes('scale_permissions')) {
      return { success: false, message: 'DATABASE_V17_REQUIRED' }
    }
    return { success: false, message: error.message }
  }

  revalidatePath('/')
  return { success: true }
}

export async function removeScalePermission(permissionId: string) {
  try {
    await checkGeneralAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.scale_permissions = (db.scale_permissions || []).filter((p: any) => p.id !== permissionId)
    writeDb(db)
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('scale_permissions')
    .delete()
    .eq('id', permissionId)

  if (error) return { success: false, message: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function getLoginLogs() {
  try {
    await checkGeneralAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }
  if (isLocalMode()) {
    const db = readDb()
    return { success: true, logs: (db.login_logs || []).sort((a: any, b: any) => (new Date(b.login_at).getTime()) - (new Date(a.login_at).getTime())) }
  }
  const supabase = createClient()
  const { data, error } = await supabase
    .from('login_logs')
    .select('id, user_id, user_name, user_role, login_at')
    .order('login_at', { ascending: false })
    .limit(200)
  if (error) return { success: false, message: 'Erro ao buscar logs: ' + error.message }
  return { success: true, logs: data || [] }
}

export async function logCurrentSessionLogin() {
  const session = cookies().get('session_user')
  if (!session) return { success: false, message: 'Sessão inválida' }
  const user = JSON.parse(session.value)
  return await logLogin(user.id, user.name, user.role)
}

export async function getSameDaySwapEnabled(): Promise<boolean> {
  if (isLocalMode()) {
    const db = readDb()
    return !!db.settings?.allow_same_day_swap
  }

  const supabase = createClient()
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('bool_value')
      .eq('key', 'allow_same_day_swap')
      .maybeSingle()

    if (error) {
      console.error('Error fetching allow_same_day_swap setting:', error)
      return false
    }

    return !!data?.bool_value
  } catch (e) {
    console.error('Unexpected error fetching allow_same_day_swap setting:', e)
    return false
  }
}

export async function toggleSameDaySwapSetting() {
  const session = cookies().get('session_user')
  if (!session) return { success: false, message: 'Não autorizado' }
  const user = JSON.parse(session.value)

  const isDirector = user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'
  if (!isDirector) {
    return { success: false, message: 'Apenas a Direção de Enfermagem pode alterar esta configuração.' }
  }

  const currentEnabled = await getSameDaySwapEnabled()
  const newEnabled = !currentEnabled

  if (isLocalMode()) {
    const db = readDb()
    db.settings = db.settings || {}
    db.settings.allow_same_day_swap = newEnabled
    writeDb(db)
    revalidatePath('/')
    revalidatePath('/trocas')
    revalidatePath('/coordenacao')
    return { success: true, enabled: newEnabled }
  }

  const supabase = createClient()

  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        { key: 'allow_same_day_swap', bool_value: newEnabled },
        { onConflict: 'key' }
      )

    if (error) {
      console.error('Error updating allow_same_day_swap setting:', error)
      return { success: false, message: 'Erro ao salvar configuração.', enabled: currentEnabled }
    }

    revalidatePath('/')
    revalidatePath('/trocas')
    revalidatePath('/coordenacao')

    return { success: true, enabled: newEnabled }
  } catch (e) {
    console.error('Unexpected error updating allow_same_day_swap setting:', e)
    return { success: false, message: 'Erro inesperado ao salvar configuração.', enabled: currentEnabled }
  }
}

export const getNurses = cache(async () => {
  if (isLocalMode()) {
    const db = readDb()
    return db.nurses.sort((a, b) => a.name.localeCompare(b.name))
  }
  
  const supabase = createClient()
  const { data, error } = await supabase
    .from('nurses')
    .select('id,name,name_star,cpf,role,coren,vinculo,section_id,unit_id,birth_date,certidao_negativa_date,coren_expiry_date,created_at')
    .range(0, 9999)
    .order('name')
  if (error) {
    if (error.message?.includes('birth_date') || error.message?.includes('certidao_negativa_date') || error.message?.includes('coren_expiry_date') || error.message?.includes('name_star')) {
      const { data: fallbackData } = await supabase
        .from('nurses')
        .select('id,name,cpf,role,coren,vinculo,section_id,unit_id,created_at')
        .range(0, 9999)
        .order('name')
      return fallbackData || []
    }
    return []
  }
  return data || []
})

export async function getNursesBySection(sectionId: string) {
  if (isLocalMode()) {
    const db = readDb()
    return db.nurses.filter(n => n.section_id === sectionId).sort((a, b) => a.name.localeCompare(b.name))
  }
  
  const supabase = createClient()
  const { data, error } = await supabase
    .from('nurses')
    .select('id,name,name_star,cpf,role,coren,vinculo,section_id,unit_id,birth_date,certidao_negativa_date,coren_expiry_date,created_at')
    .eq('section_id', sectionId)
    .range(0, 9999)
    .order('name')
  if (error) {
    if (error.message?.includes('birth_date') || error.message?.includes('certidao_negativa_date') || error.message?.includes('coren_expiry_date') || error.message?.includes('name_star')) {
      const { data: fallbackData } = await supabase
        .from('nurses')
        .select('id,name,cpf,role,coren,vinculo,section_id,unit_id,created_at')
        .eq('section_id', sectionId)
        .range(0, 9999)
        .order('name')
      return fallbackData || []
    }
    return []
  }
  return data || []
}

export async function createNurse(prevState: any, formData: FormData) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado: Apenas administradores podem cadastrar servidores.' }
  }

  const name = formData.get('name') as string
  const cpf = formData.get('cpf') as string
  const password = formData.get('password') as string || '123456'
  const coren = formData.get('coren') as string
  const crm = formData.get('crm') as string
  const phone = formData.get('phone') as string
  const vinculo = formData.get('vinculo') as string
  const role = formData.get('role') as string || ''
  const birthDate = (formData.get('birth_date') as string) || ''
  const certidaoNegativaDate = (formData.get('certidao_negativa_date') as string) || ''
  const corenExpiryDate = (formData.get('coren_expiry_date') as string) || ''
  const nameStar = formData.get('name_star') === 'on'
  const sectionId = formData.get('sectionId') as string
  const unitId = formData.get('unitId') as string
  const sector = formData.get('sector') as string // Manual sector name if provided

  // Custom Month/Year for roster insertion
  const customMonth = formData.get('month') ? parseInt(formData.get('month') as string, 10) : null
  const customYear = formData.get('year') ? parseInt(formData.get('year') as string, 10) : null

  // Validate Name (Essential)
  if (!name) {
    return { success: false, message: 'Nome é obrigatório' }
  }

  // Handle CPF: Use provided or generate temporary
  const finalCpf = cpf || `TEMP-${Date.now()}`

  if (isLocalMode()) {
    const db = readDb()
    
    // Check duplicate CPF + Vinculo
    if (db.nurses.some(n => n.cpf === finalCpf && n.vinculo === vinculo)) {
      return { success: false, message: 'Já existe um servidor com este CPF e Vínculo.' }
    }

    let finalSectionId = sectionId
    if (!finalSectionId) {
       if (role === 'ENFERMEIRO') finalSectionId = db.schedule_sections.find(s => s.title === 'ENFERMEIROS')?.id || null
       else if (role === 'TECNICO') finalSectionId = db.schedule_sections.find(s => s.title === 'TÉC. DE ENFERMAGEM')?.id || null
    }

    const newNurse = {
      id: randomUUID(),
      name,
      name_star: !!nameStar,
      cpf: finalCpf,
      password, // Plain text for local dev
      coren,
      crm: crm || '',
      phone: phone || '',
      vinculo,
      role,
      section_id: finalSectionId,
      unit_id: unitId,
      birth_date: birthDate || '',
      certidao_negativa_date: certidaoNegativaDate || '',
      coren_expiry_date: corenExpiryDate || '',
      created_at: new Date().toISOString()
    }

    db.nurses.push(newNurse)

    let lastRosterId: string | undefined = undefined

    // Add to roster automatically
    if (finalSectionId) {
        const now = new Date()
        const rosterMonth = customMonth || (now.getMonth() + 1)
        const rosterYear = customYear || now.getFullYear()
        
        // Ensure monthly_rosters exists
        if (!db.monthly_rosters) db.monthly_rosters = []

        const newRosterId = randomUUID()
        db.monthly_rosters.push({
            id: newRosterId,
            nurse_id: newNurse.id,
            section_id: finalSectionId,
            unit_id: unitId,
            month: rosterMonth,
            year: rosterYear,
            sector: sector || '', // History for this month
            created_at: new Date().toISOString()
        })
        lastRosterId = newRosterId
    }

    writeDb(db)
    
    revalidatePath('/servidores')
    return { success: true, message: 'Servidor cadastrado com sucesso!', rosterId: lastRosterId }
  }

  const supabase = createClient()
  let lastRosterId: string | undefined = undefined
  
  let finalSectionId = sectionId
  if (!finalSectionId) {
      const { data: sections } = await supabase.from('schedule_sections').select('*')
      if (sections) {
          if (role === 'ENFERMEIRO' || role === 'COORDENADOR') finalSectionId = sections.find(s => s.title === 'ENFERMEIROS')?.id || null
          else if (role === 'TECNICO') finalSectionId = sections.find(s => s.title === 'TÉC. DE ENFERMAGEM')?.id || null
      }
  }

  const { data: insertedNurse, error } = await supabase.from('nurses').insert({
    name,
    name_star: !!nameStar,
    cpf: finalCpf,
    password,
    coren,
    crm: crm || '',
    phone: phone || '',
    vinculo,
    role,
    birth_date: birthDate || null,
    certidao_negativa_date: certidaoNegativaDate || null,
    coren_expiry_date: corenExpiryDate || null,
    section_id: finalSectionId || null,
    unit_id: unitId || null
  }).select().single()

  if (error) {
    console.error('Error creating nurse:', error)
    if (error.message?.includes('crm') || error.message?.includes('phone')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V15). Solicite ao suporte para rodar o script de CRM e Telefone.' }
    }
    if (error.message?.includes('birth_date')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V18). Solicite ao suporte para rodar o script de Data de Nascimento.' }
    }
    if (error.message?.includes('certidao_negativa_date') || error.message?.includes('coren_expiry_date')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V19). Solicite ao suporte para rodar o script de Certidão Negativa e Vencimento do COREN.' }
    }
    if (error.message?.includes('name_star')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V21). Solicite ao suporte para rodar o script de Marcação com * no Nome.' }
    }
    if (error.code === '23505') {
        // Detect specific constraint violation
        if (error.message?.includes('nurses_cpf_key')) {
             return { success: false, message: 'Erro: O banco de dados bloqueou o CPF duplicado. Por favor, execute o script V13 no Supabase.' }
        }
        return { success: false, message: 'Já existe um servidor com este CPF e Vínculo.' }
    }
    return { success: false, message: 'Erro ao cadastrar servidor: ' + error.message }
  }

  // Add to roster automatically
  if (insertedNurse && finalSectionId) {
      const now = new Date()
      const rosterMonth = customMonth || (now.getMonth() + 1)
      const rosterYear = customYear || now.getFullYear()
      
      const { data: insertedRoster } = await supabase.from('monthly_rosters').insert({
          nurse_id: insertedNurse.id,
          section_id: finalSectionId,
          unit_id: unitId,
          month: rosterMonth,
          year: rosterYear,
          sector: sector || '' // History for this month
      }).select('id').single()
      
      if (insertedRoster) lastRosterId = insertedRoster.id
  }

  revalidatePath('/servidores')
  return { success: true, message: 'Servidor cadastrado com sucesso!', rosterId: lastRosterId }
}

export const getSections = cache(async () => {
  if (isLocalMode()) {
    const db = readDb()
    return db.schedule_sections || []
  }
  
  const supabase = createClient()
  const { data } = await supabase.from('schedule_sections').select('*').order('position', { ascending: true, nullsFirst: true }).order('title', { ascending: true })
  return data || []
})

export async function createSection(prevState: any, formData: FormData) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const title = formData.get('title') as string
  const coordinatorId = formData.get('coordinatorId') as string

  if (!title) return { success: false, message: 'Título é obrigatório' }

  if (isLocalMode()) {
    const db = readDb()
    const newSection = {
      id: randomUUID(),
      title,
      position: (db.schedule_sections.length || 0) + 1,
      created_at: new Date().toISOString()
    }
    db.schedule_sections.push(newSection)

    if (coordinatorId) {
      const nurse = db.nurses.find((n: any) => n.id === coordinatorId)
      if (nurse) {
        nurse.role = 'COORDENADOR'
        nurse.section_id = newSection.id
      }
    }

    writeDb(db)
    revalidatePath('/coordenacao/gestao')
    revalidatePath('/servidores')
    return { success: true, message: 'Setor criado com sucesso!' }
  }

  const supabase = createClient()

  // Calculate next position
  const { data: maxPosData } = await supabase
    .from('schedule_sections')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  const nextPosition = (maxPosData?.position || 0) + 1

  const { data: section, error } = await supabase.from('schedule_sections').insert({ 
    title,
    position: nextPosition
  }).select().single()
  
  if (error || !section) return { success: false, message: 'Erro ao criar setor: ' + (error?.message || '') }

  if (coordinatorId) {
    const { error: updateError } = await supabase.from('nurses').update({ 
      role: 'COORDENADOR',
      section_id: section.id
    }).eq('id', coordinatorId)

    if (updateError) {
      return { success: true, message: 'Setor criado, mas erro ao definir coordenador: ' + updateError.message }
    }
  }
  
  revalidatePath('/coordenacao/gestao')
  revalidatePath('/servidores')
  return { success: true, message: 'Setor criado com sucesso!' }
}

export async function updateSectionForm(prevState: any, formData: FormData) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const id = formData.get('id') as string
  const title = formData.get('title') as string
  const coordinatorId = formData.get('coordinatorId') as string

  if (!id || !title) {
    return { success: false, message: 'Dados incompletos' }
  }

  if (isLocalMode()) {
    const db = readDb()
    const section = db.schedule_sections.find((s: any) => s.id === id)
    if (!section) {
      return { success: false, message: 'Setor não encontrado' }
    }
    section.title = title

    // Update coordinator if provided
    if (coordinatorId) {
      // Unassign previous coordinator of this section
      const prevCoordinator = db.nurses.find((n: any) => n.section_id === id && n.role === 'COORDENADOR')
      if (prevCoordinator && prevCoordinator.id !== coordinatorId) {
        prevCoordinator.role = 'ENFERMEIRO' // Downgrade or just keep as nurse? Usually 'ENFERMEIRO'
      }
      
      // Assign new
      const newCoordinator = db.nurses.find((n: any) => n.id === coordinatorId)
      if (newCoordinator) {
        newCoordinator.role = 'COORDENADOR'
        newCoordinator.section_id = id
      }
    } else if (coordinatorId === '') {
       // Explicitly removed? The form might not send empty string if just not selected, but let's see.
       // If user selects "Sem coordenador", we might want to handle it.
       // But for now let's assume if they pick someone, we update.
    }

    writeDb(db)
    revalidatePath('/coordenacao/gestao')
    revalidatePath('/servidores')
    return { success: true, message: 'Setor atualizado com sucesso!' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('schedule_sections').update({ title }).eq('id', id)

  if (error) return { success: false, message: 'Erro ao atualizar setor: ' + error.message }

  if (coordinatorId) {
    // 1. Unassign old coordinator(s) for this section
    await supabase.from('nurses').update({ role: 'ENFERMEIRO' }).eq('section_id', id).eq('role', 'COORDENADOR')

    // 2. Assign new
    const { error: updateError } = await supabase.from('nurses').update({ 
      role: 'COORDENADOR',
      section_id: id
    }).eq('id', coordinatorId)

    if (updateError) return { success: true, message: 'Setor atualizado, mas erro ao definir coordenador.' }
  }

  revalidatePath('/coordenacao/gestao')
  revalidatePath('/servidores')
  return { success: true, message: 'Setor atualizado com sucesso!' }
}

export async function deleteSectionForm(prevState: any, formData: FormData) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  try {
    const id = formData.get('id') as string
    if (!id) return { success: false, message: 'Setor inválido' }

    if (isLocalMode()) {
      const db = readDb()

      // Desvincular servidores do setor
      db.nurses.forEach((n: any) => {
        if (n.section_id === id) {
          n.section_id = null
          if (n.role === 'COORDENADOR') n.role = 'ENFERMEIRO'
        }
      })

      // Remover escalas mensais ligadas ao setor
      if (Array.isArray(db.monthly_rosters)) {
        db.monthly_rosters = db.monthly_rosters.filter((r: any) => r.section_id !== id)
      }
      
      // Remover o setor
      db.schedule_sections = db.schedule_sections.filter((s: any) => s.id !== id)
      writeDb(db)
      revalidatePath('/coordenacao/gestao')
      revalidatePath('/servidores')
      return { success: true, message: 'Setor excluído com sucesso!' }
    }

    const supabase = createClient()

    // 1. Desvincular servidores do setor (evita erro de FK em nurses.section_id)
    await supabase.from('nurses').update({ section_id: null }).eq('section_id', id)

    // 2. Remover escalas mensais ligadas ao setor (evita erro de FK em monthly_rosters.section_id)
    const { error: rosterError } = await supabase
      .from('monthly_rosters')
      .delete()
      .eq('section_id', id)

    if (rosterError) {
      return { success: false, message: 'Erro ao limpar escalas do setor: ' + rosterError.message }
    }
    
    const { error } = await supabase.from('schedule_sections').delete().eq('id', id)

    if (error) return { success: false, message: 'Erro ao excluir setor: ' + error.message }

    revalidatePath('/coordenacao/gestao')
    revalidatePath('/servidores')
    return { success: true, message: 'Setor excluído com sucesso!' }
  } catch (error: any) {
    return { success: false, message: 'Erro interno ao excluir setor: ' + error.message }
  }
}

export async function assignCoordinator(prevState: any, formData: FormData) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const nurseId = formData.get('nurseId') as string
  const sectionId = formData.get('sectionId') as string

  if (!nurseId || !sectionId) return { success: false, message: 'Dados incompletos' }

  if (isLocalMode()) {
    const db = readDb()
    const nurse = db.nurses.find(n => n.id === nurseId)
    if (nurse) {
      nurse.role = 'COORDENADOR'
      nurse.section_id = sectionId
      writeDb(db)
      revalidatePath('/coordenacao/gestao')
      revalidatePath('/servidores')
      return { success: true, message: 'Coordenador atribuído com sucesso!' }
    }
    return { success: false, message: 'Servidor não encontrado' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('nurses').update({ 
    role: 'COORDENADOR',
    section_id: sectionId
  }).eq('id', nurseId)

  if (error) return { success: false, message: 'Erro ao atribuir coordenador: ' + error.message }

  revalidatePath('/coordenacao/gestao')
  revalidatePath('/servidores')
  return { success: true, message: 'Coordenador atribuído com sucesso!' }
}

export async function registerAbsence(prevState: any, formData: FormData) {
  let user
  try {
    user = await checkUser()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const settings = await getAbsenceSettings()
  const isAdminOrSpecial = user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'
  const canEdit = settings.edit_roles.includes(user.role) || isAdminOrSpecial

  if (!canEdit) {
    return { success: false, message: 'Você não tem permissão para registrar faltas.' }
  }

  const nurseId = formData.get('nurseId') as string
  const date = formData.get('date') as string
  const reason = formData.get('reason') as string

  if (!nurseId || !date) {
    return { success: false, message: 'Servidor e data são obrigatórios' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.absences = db.absences || []
    
    const newAbsence = {
      id: randomUUID(),
      nurse_id: nurseId,
      created_by: user.id,
      date,
      reason,
      created_at: new Date().toISOString()
    }
    
    db.absences.push(newAbsence)
    writeDb(db)
    revalidatePath('/coordenacao')
    revalidatePath('/')
    return { success: true, message: 'Falta registrada com sucesso (Local)' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('absences').insert({
    nurse_id: nurseId,
    created_by: user.id,
    date,
    reason,
    created_at: new Date().toISOString()
  })

  if (error) return { success: false, message: 'Erro ao registrar falta: ' + error.message }

  revalidatePath('/coordenacao')
  revalidatePath('/')
  return { success: true, message: 'Falta registrada com sucesso' }
}

export async function requestPayment(prevState: any, formData: FormData) {
  let user
  try {
    user = await checkUser()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const shiftDate = formData.get('shiftDate') as string
  const shiftHoursRaw = formData.get('shiftHours') as string
  const location = formData.get('location') as string
  const observation = formData.get('observation') as string
  const nurseIdFromForm = formData.get('nurseId') as string | null

  if (!shiftDate || !shiftHoursRaw || !location) {
    return { success: false, message: 'Data, carga horária e local são obrigatórios' }
  }

  const shiftHours = parseInt(shiftHoursRaw, 10)
  if (![12, 24].includes(shiftHours)) {
    return { success: false, message: 'Carga horária inválida' }
  }

  const nurseId = nurseIdFromForm || user.id

  if (isLocalMode()) {
    return { success: false, message: 'Solicitação de pagamento não disponível no modo local.' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('payment_requests').insert({
    nurse_id: nurseId,
    coordinator_id: user.id,
    shift_date: shiftDate,
    shift_hours: shiftHours,
    location,
    observation
  })

  if (error) return { success: false, message: 'Erro ao solicitar pagamento: ' + error.message }

  revalidatePath('/coordenacao')
  return { success: true, message: 'Solicitação de pagamento enviada com sucesso' }
}

export async function getCoordinationRequests() {
  let user
  try {
    user = await checkUser()
  } catch (e) {
    throw new Error('Unauthorized')
  }

  if (isLocalMode()) {
    return {
      absences: [],
      paymentRequests: [],
      generalRequests: [],
    }
  }

  const supabase = createClient()

  if (user.role === 'COORDENADOR' && user.section_id) {
    const nursesInSection = await getNursesBySection(user.section_id)
    const nurseIds = nursesInSection.map((n: any) => n.id)

    if (nurseIds.length === 0) {
      return {
        absences: [],
        paymentRequests: [],
        generalRequests: [],
      }
    }

    const [absencesRes, myAbsencesRes, paymentsRes, generalRes] = await Promise.all([
      supabase
        .from('absences')
        .select('id,nurse_id,created_by,date,reason,created_at, nurses!absences_nurse_id_fkey(name)')
        .in('nurse_id', nurseIds)
        .order('date', { ascending: false }),
      supabase
        .from('absences')
        .select('id,nurse_id,created_by,date,reason,created_at, nurses!absences_nurse_id_fkey(name)')
        .eq('created_by', user.id)
        .order('date', { ascending: false }),
      supabase
        .from('payment_requests')
        .select('id,nurse_id,coordinator_id,shift_date,shift_hours,location,observation,status,created_at')
        .in('nurse_id', nurseIds)
        .order('shift_date', { ascending: false }),
      supabase
        .from('general_requests')
        .select('id,nurse_id,content,created_at')
        .eq('nurse_id', user.id)
        .order('created_at', { ascending: false }),
    ])

    if (absencesRes.error) {
      throw new Error(absencesRes.error.message)
    }
    if (myAbsencesRes.error) {
        throw new Error(myAbsencesRes.error.message)
    }
    if (paymentsRes.error) {
      throw new Error(paymentsRes.error.message)
    }
    if (generalRes.error) {
      throw new Error(generalRes.error.message)
    }

    const allAbsences = [...(absencesRes.data || []), ...(myAbsencesRes.data || [])]
    const uniqueAbsences = Array.from(new Map(allAbsences.map(item => [item.id, item])).values())
    uniqueAbsences.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

    const mappedAbsences = uniqueAbsences.map((item: any) => ({
      ...item,
      nurse_name: item.nurses?.name || 'Desconhecido'
    }))

    return {
      absences: mappedAbsences,
      paymentRequests: paymentsRes.data || [],
      generalRequests: generalRes.data || [],
      nurses: nursesInSection || [],
    }
  }

  let absencesQuery = supabase
      .from('absences')
      .select('id,nurse_id,created_by,date,reason,created_at, nurses!absences_nurse_id_fkey(name)')
      .order('date', { ascending: false })

  let paymentQuery = supabase
      .from('payment_requests')
      .select('id,nurse_id,coordinator_id,shift_date,shift_hours,location,observation,status,created_at')
      .order('shift_date', { ascending: false })

  let generalQuery = supabase
      .from('general_requests')
      .select('id,nurse_id,content,created_at')
      .order('created_at', { ascending: false })

  const isManager = user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'
  
  if (!isManager) {
      absencesQuery = absencesQuery.eq('nurse_id', user.id)
      paymentQuery = paymentQuery.eq('nurse_id', user.id)
      generalQuery = generalQuery.eq('nurse_id', user.id)
  }

  const [absencesRes, paymentsRes, generalRes] = await Promise.all([
    absencesQuery,
    paymentQuery,
    generalQuery
  ])

  if (absencesRes.error) {
    throw new Error(absencesRes.error.message)
  }
  if (paymentsRes.error) {
    throw new Error(paymentsRes.error.message)
  }
  if (generalRes.error) {
    throw new Error(generalRes.error.message)
  }

  let nursesList: any[] = []
  if (user.role === 'COORDENACAO_GERAL') {
    nursesList = await getNurses()
  }

  return {
    absences: (absencesRes.data || []).map((item: any) => ({
      ...item,
      nurse_name: item.nurses?.name || 'Desconhecido'
    })),
    paymentRequests: paymentsRes.data || [],
    generalRequests: generalRes.data || [],
    nurses: nursesList,
  }
}

export async function deleteAbsence(id: string) {
  let user
  try {
    user = await checkUser()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const settings = await getAbsenceSettings()
  const isAdminOrSpecial = user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'
  const canEdit = settings.edit_roles.includes(user.role) || isAdminOrSpecial

  if (!canEdit) {
    return { success: false, message: 'Acesso negado. Você não tem permissão para excluir faltas.' }
  }

  if (isLocalMode()) {
    return { success: false, message: 'Exclusão de faltas não disponível no modo local.' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('absences').delete().eq('id', id)

  if (error) return { success: false, message: 'Erro ao remover falta: ' + error.message }
  revalidatePath('/coordenacao')
  revalidatePath('/')
  return { success: true, message: 'Falta removida com sucesso' }
}

export async function deletePaymentRequest(id: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    return { success: false, message: 'Exclusão de pagamentos não disponível no modo local.' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('payment_requests').delete().eq('id', id)

  if (error) return { success: false, message: 'Erro ao remover solicitação de pagamento: ' + error.message }
  revalidatePath('/coordenacao')
  return { success: true, message: 'Solicitação de pagamento removida com sucesso' }
}

export async function deleteGeneralRequest(id: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    return { success: false, message: 'Exclusão de solicitações não disponível no modo local.' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('general_requests').delete().eq('id', id)

  if (error) return { success: false, message: 'Erro ao remover solicitação: ' + error.message }
  revalidatePath('/coordenacao')
  return { success: true, message: 'Solicitação removida com sucesso' }
}

export async function createGeneralRequest(prevState: any, formData: FormData) {
  let user
  try {
    user = await checkUser()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const requestType = formData.get('requestType') as string
  const description = formData.get('description') as string

  if (!description) {
    return { success: false, message: 'Descrição é obrigatória' }
  }

  let content = description
  if (requestType) {
    content = `[${requestType}] ${description}`
  }

  if (isLocalMode()) {
    return { success: false, message: 'Outras solicitações não disponíveis no modo local.' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('general_requests').insert({
    nurse_id: user.id,
    content
  })

  if (error) return { success: false, message: 'Erro ao enviar solicitação: ' + error.message }

  revalidatePath('/coordenacao')
  return { success: true, message: 'Solicitação enviada com sucesso' }
}

export async function login(prevState: any, formData: FormData) {
  const rawCpf = formData.get('cpf') as string
  const password = formData.get('password') as string
  const selectedProfileId = formData.get('selectedProfileId') as string

  // Handling profile selection from multi-profile step
  if (selectedProfileId) {
      const selectionCookie = cookies().get('login_selection_options')
      if (!selectionCookie) {
          return { message: 'Sessão de seleção expirada. Tente novamente.' }
      }
      
      let options: any[] = []
      try {
          options = JSON.parse(selectionCookie.value)
      } catch (e) {
          return { message: 'Erro ao processar seleção.' }
      }

      const selected = options.find((o: any) => o.id === selectedProfileId)
      if (!selected) {
          return { message: 'Perfil inválido.' }
      }

      // We need to fetch the full nurse object again to be sure (and get section_title)
      // We can reuse the logic below by mocking a single result finding
      // But simpler to just re-fetch by ID.
      
      let nurse = null
      let sectionTitle = ''

      if (isLocalMode()) {
          const db = readDb()
          nurse = db.nurses.find(n => n.id === selectedProfileId)
          if (nurse && nurse.section_id) {
             sectionTitle = db.schedule_sections.find(s => s.id === nurse.section_id)?.title || ''
          }
      } else {
          const supabase = createClient()
          const { data } = await supabase.from('nurses').select('*').eq('id', selectedProfileId).single()
          nurse = data
          if (nurse && nurse.section_id) {
              const { data: section } = await supabase.from('schedule_sections').select('title').eq('id', nurse.section_id).single()
              if (section) sectionTitle = section.title
          }
      }

      if (!nurse) return { message: 'Erro ao recuperar perfil selecionado.' }

      // Clear selection cookie
      cookies().delete('login_selection_options')

      // Proceed to set session cookie
      const mustChangePassword = nurse.password === '123456'
      
      // Auto-promote to COORDENACAO_GERAL if specific CPF (legacy check)
      const cleanCpfForRole = (nurse.cpf || '').replace(/\D/g, '')
      if (cleanCpfForRole === '02170025367' && nurse.role !== 'COORDENACAO_GERAL' && !isLocalMode()) {
        const supabase = createClient()
        await supabase.from('nurses').update({ role: 'COORDENACAO_GERAL' }).eq('id', nurse.id)
        nurse.role = 'COORDENACAO_GERAL'
      }

      cookies().set('session_user', JSON.stringify({ 
        name: nurse.name, 
        id: nurse.id, 
        cpf: nurse.cpf,
        role: nurse.role,
        section_id: nurse.section_id,
        section_title: sectionTitle,
        mustChangePassword
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
      await logLogin(nurse.id, nurse.name, nurse.role)

      if (mustChangePassword) {
        redirect('/alterar-senha')
      }
      redirect('/')
  }

  if (!rawCpf || !password) {
    return { message: 'CPF e Senha são obrigatórios' }
  }

  const cleanCpf = rawCpf.replace(/\D/g, '')

  if (isLocalMode()) {
    const db = readDb()
    // Find ALL nurses with this CPF
    const nurses = db.nurses.filter(n => n.cpf.replace(/\D/g, '') === cleanCpf)

    if (nurses.length === 0) {
      return { message: 'CPF não encontrado (Local)' }
    }

    // Filter by password
    const validNurses = nurses.filter(n => n.password === password)

    if (validNurses.length === 0) {
      return { message: 'Senha incorreta (Local)' }
    }

    if (validNurses.length > 1) {
        // Multiple profiles found
        const options = validNurses.map(n => ({
            id: n.id,
            name: n.name,
            role: n.role,
            vinculo: n.vinculo,
            unit_id: n.unit_id
        }))
        
        cookies().set('login_selection_options', JSON.stringify(options), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 5, // 5 minutes
            path: '/',
        })
        
        return { 
            success: false, 
            step: 'select_profile',
            profiles: options
        }
    }

    const nurse = validNurses[0]
    const mustChangePassword = password === '123456'

    let sectionTitle = ''
    if (nurse.section_id) {
       sectionTitle = db.schedule_sections.find(s => s.id === nurse.section_id)?.title || ''
    }

    cookies().set('session_user', JSON.stringify({ 
      name: nurse.name, 
      id: nurse.id, 
      cpf: nurse.cpf,
      role: nurse.role,
      section_id: nurse.section_id,
      section_title: sectionTitle,
      mustChangePassword
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    await logLogin(nurse.id, nurse.name, nurse.role)

    if (mustChangePassword) {
      redirect('/alterar-senha')
    }
    redirect('/')
  }

  const supabase = createClient()
  
  // Strategy: Fetch from all 3 potential CPF formats and merge
  const queries = [
      supabase.from('nurses').select('*').eq('cpf', rawCpf),
      supabase.from('nurses').select('*').eq('cpf', cleanCpf)
  ]

  if (cleanCpf.length === 11) {
      const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      queries.push(supabase.from('nurses').select('*').eq('cpf', formattedCpf))
  }

  const results = await Promise.all(queries)
  
  // Merge and Deduplicate by ID
  const allNurses = results.reduce((acc, res) => {
      if (res.data) {
          return [...acc, ...res.data]
      }
      return acc
  }, [] as any[])

  const uniqueNurses = Array.from(new Map(allNurses.map(item => [item.id, item])).values())

  if (uniqueNurses.length === 0) {
    return { message: 'CPF não encontrado' }
  }

  // Filter by password
  const validNurses = uniqueNurses.filter(n => n.password === password)

  if (validNurses.length === 0) {
    return { message: 'Senha incorreta' }
  }

  if (validNurses.length > 1) {
      // Multiple profiles found
      const options = validNurses.map(n => ({
          id: n.id,
          name: n.name,
          role: n.role,
          vinculo: n.vinculo,
          unit_id: n.unit_id
      }))
      
      cookies().set('login_selection_options', JSON.stringify(options), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 5, // 5 minutes
          path: '/',
      })
      
      return { 
          success: false, 
          step: 'select_profile',
          profiles: options
      }
  }

  const nurse = validNurses[0]
  const mustChangePassword = password === '123456'

  let sectionTitle = ''
  if (nurse.section_id) {
      const { data: section } = await supabase.from('schedule_sections').select('title').eq('id', nurse.section_id).single()
      if (section) sectionTitle = section.title
  }

  const cleanCpfForRole = (nurse.cpf || '').replace(/\D/g, '')
  if (cleanCpfForRole === '02170025367' && nurse.role !== 'COORDENACAO_GERAL') {
    await supabase.from('nurses').update({ role: 'COORDENACAO_GERAL' }).eq('id', nurse.id)
    nurse.role = 'COORDENACAO_GERAL'
  }

  cookies().set('session_user', JSON.stringify({ 
    name: nurse.name, 
    id: nurse.id, 
    cpf: nurse.cpf,
    role: nurse.role,
    section_id: nurse.section_id,
    section_title: sectionTitle,
    mustChangePassword
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  await logLogin(nurse.id, nurse.name, nurse.role)

  if (mustChangePassword) {
    redirect('/alterar-senha')
  }

  redirect('/')
}

export async function getMonthlyManagementReport(month: number, year: number) {
  try {
    await checkAdmin()
    
    let nurses: any[] = []
    let rosters: any[] = []
    let units: any[] = []
    let releases: any[] = []

    if (isLocalMode()) {
      const db = readDb()
      nurses = db.nurses || []
      rosters = (db.monthly_rosters || []).filter((r: any) => r.month === month && r.year === year)
      units = db.units || []
      releases = (db.monthly_schedule_metadata || []).filter((m: any) => m.month === month && m.year === year && m.is_released)
    } else {
      const supabase = createClient()
      
      // 1. Primeiro busca as unidades e os metadados de liberação
      const [
        { data: unitsData, error: e3 },
        { data: releasesData, error: e4 }
      ] = await Promise.all([
        supabase.from('units').select('id, title').range(0, 1000),
        supabase.from('monthly_schedule_metadata').select('unit_id').eq('month', month).eq('year', year).eq('is_released', true).range(0, 1000)
      ])

      if (e3 || e4) throw new Error(`Erro ao buscar setores: ${e3?.message || e4?.message}`)

      // 2. Busca os registros da escala (rosters)
      const { data: rostersData, error: e2 } = await supabase
        .from('monthly_rosters')
        .select('id, nurse_id, unit_id, observation')
        .eq('month', month)
        .eq('year', year)
        .range(0, 1000) // Pega os primeiros 1000 registros do mês

      if (e2) throw new Error(`Erro ao buscar registros da escala: ${e2.message}`)

      const rosterList = rostersData || []
      
      // 3. Busca APENAS os enfermeiros que estão na escala do mês para ganhar performance
      const nurseIds = Array.from(new Set(rosterList.map(r => r.nurse_id)))
      let nursesData: any[] = []
      
      if (nurseIds.length > 0) {
          // Busca em blocos se houver muitos enfermeiros (supabase IN filter tem limites)
          const { data, error: e1 } = await supabase
            .from('nurses')
            .select('id, name, vinculo, role')
            .in('id', nurseIds)
            .range(0, 1000)
          
          if (e1) throw new Error(`Erro ao buscar profissionais: ${e1.message}`)
          nursesData = data || []
      }

      nurses = nursesData
      rosters = rosterList
      units = unitsData || []
      releases = releasesData || []
    }

    // Otimização: Criar um mapa de enfermeiros para busca O(1)
    const nurseMap = new Map()
    nurses.forEach(n => nurseMap.set(String(n.id), n))

    // Processamento do relatório
    const activeUnitIds = new Set(rosters.map(r => String(r.unit_id)))
    const sectorsWithSchedules = units.filter(u => activeUnitIds.has(String(u.id)))
    
    const stats = {
      totalSchedules: activeUnitIds.size,
      releasedSchedules: releases.length,
      concursados: 0,
      seletivados: 0,
      escalaDupla: 0,
      descoberta: 0,
      totalEntries: rosters.length,
      professions: {
        enfermeiros: { total: 0, concursados: 0, seletivados: 0, escalaDupla: 0, descoberta: 0 },
        tecnicos: { total: 0, concursados: 0, seletivados: 0, escalaDupla: 0, descoberta: 0 },
        auxiliares: { total: 0, concursados: 0, seletivados: 0, escalaDupla: 0, descoberta: 0 },
        medicos: { total: 0, concursados: 0, seletivados: 0, escalaDupla: 0, descoberta: 0 },
        outros: { total: 0, concursados: 0, seletivados: 0, escalaDupla: 0, descoberta: 0 }
      },
      sectors: sectorsWithSchedules.map(s => {
        const sectorRosters = rosters.filter(r => String(r.unit_id) === String(s.id))
        const sectorNurseIds = sectorRosters.map(r => String(r.nurse_id))
        const sectorNurses = nurses.filter(n => sectorNurseIds.includes(String(n.id)))
        const sectorRoles = Array.from(new Set(sectorNurses.map(n => (n.role || '').toUpperCase())))
        
        // Detailed stats per sector and profession
        const sectorStats: any = {
          total: { concursados: 0, seletivados: 0, escalaDupla: 0, descoberta: 0, total: sectorRosters.length },
          ENFERMEIRO: { concursados: 0, seletivados: 0, escalaDupla: 0, descoberta: 0, total: 0 },
          TECNICO: { concursados: 0, seletivados: 0, escalaDupla: 0, descoberta: 0, total: 0 },
          AUXILIAR: { concursados: 0, seletivados: 0, escalaDupla: 0, descoberta: 0, total: 0 },
          MEDICO: { concursados: 0, seletivados: 0, escalaDupla: 0, descoberta: 0, total: 0 },
          OUTROS: { concursados: 0, seletivados: 0, escalaDupla: 0, descoberta: 0, total: 0 }
        }

        sectorRosters.forEach(r => {
          const nurse = nurseMap.get(String(r.nurse_id))
          if (nurse) {
            const role = (nurse.role || '').toUpperCase()
            const vin = (nurse.vinculo || '').toUpperCase()
            const obs = (r.observation || '').toUpperCase()
            const name = (nurse.name || '').toUpperCase()

            let pKey = 'OUTROS'
            if (role.includes('ENFERMEIRO')) pKey = 'ENFERMEIRO'
            else if (role.includes('TECNICO') || role.includes('TÉCNICO')) pKey = 'TECNICO'
            else if (role.includes('AUXILIAR')) pKey = 'AUXILIAR'
            else if (role.includes('MEDICO') || role.includes('MÉDICO')) pKey = 'MEDICO'

            sectorStats[pKey].total++

            if (name.includes('DESCOBE') || obs.includes('DESCOBE') || vin.includes('DESCOBE') || vin === 'ESCALA') {
              sectorStats.total.descoberta++
              sectorStats[pKey].descoberta++
            } else if (vin.includes('DUPLA') || obs.includes('DUPLA') || obs.includes('1ED') || name.includes('1ED')) {
              sectorStats.total.escalaDupla++
              sectorStats[pKey].escalaDupla++
            } else if (vin.includes('CONCURSO') || vin.includes('EFETIVO')) {
              sectorStats.total.concursados++
              sectorStats[pKey].concursados++
            } else if (vin.includes('SELETIVO')) {
              sectorStats.total.seletivados++
              sectorStats[pKey].seletivados++
            }
          }
        })

        return {
          id: String(s.id),
          title: s.title,
          isReleased: releases.some(r => String(r.unit_id) === String(s.id)),
          professions: sectorRoles,
          stats: sectorStats
        }
      })
    }

    rosters.forEach(r => {
      const nurse = nurseMap.get(String(r.nurse_id))
      if (nurse) {
        const vinculo = (nurse.vinculo || '').toUpperCase()
        const role = (nurse.role || '').toUpperCase()
        const obs = (r.observation || '').toUpperCase()
        const nurseName = (nurse.name || '').toUpperCase()

        // 1. Identificar a Profissão (chave para os stats internos)
        let profKey: keyof typeof stats.professions = 'outros'
        if (role.includes('ENFERMEIRO')) profKey = 'enfermeiros'
        else if (role.includes('TECNICO') || role.includes('TÉCNICO')) profKey = 'tecnicos'
        else if (role.includes('AUXILIAR')) profKey = 'auxiliares'
        else if (role.includes('MEDICO') || role.includes('MÉDICO')) profKey = 'medicos'

        stats.professions[profKey].total++

        // 2. Classificação de Vínculo/Situação
        let isDescoberta = false
        let isEscalaDupla = false
        let isConcursado = false
        let isSeletivado = false

        // Prioridade 1: Escala Descoberta (Identifica por nome parcial "DESCOBE" ou vínculo)
        if (
          nurseName.includes('DESCOBERTA') || 
          nurseName.includes('DESCOBE') || 
          obs.includes('DESCOBERTA') || 
          obs.includes('DESCOBE') ||
          vinculo.includes('DESCOBERTA') ||
          vinculo.includes('DESCOBE') ||
          vinculo === 'ESCALA'
        ) {
          isDescoberta = true
          stats.descoberta++
          stats.professions[profKey].descoberta++
        } 
        // Prioridade 2: Escala Dupla (Apenas se não for descoberta)
        else if (vinculo.includes('DUPLA') || obs.includes('DUPLA') || obs.includes('1ED') || nurseName.includes('1ED')) {
          isEscalaDupla = true
          stats.escalaDupla++
          stats.professions[profKey].escalaDupla++
        }
        else if (vinculo.includes('CONCURSO') || vinculo.includes('EFETIVO')) {
          isConcursado = true
          stats.concursados++
          stats.professions[profKey].concursados++
        }
        else if (vinculo.includes('SELETIVO')) {
          isSeletivado = true
          stats.seletivados++
          stats.professions[profKey].seletivados++
        }
      }
    })

    return { success: true, data: stats }
  } catch (e: any) {
    console.error('Error generating management report:', e)
    return { success: false, message: 'Erro ao gerar relatório: ' + e.message }
  }
}

export async function getMonthlyNote(month: number, year: number, unitId?: string | null) {
  try {
    if (isLocalMode()) {
       const db = readDb()
       const note = db.monthly_notes.find(n => n.month === month && n.year === year && (unitId ? n.unit_id === unitId : !n.unit_id))
       return { success: true, note: note ? note.note : '' }
    }

    const supabase = createClient()
    let query = supabase.from('monthly_notes').select('note').eq('month', month).eq('year', year)
    
    if (unitId) {
        query = query.eq('unit_id', unitId)
    } else {
        query = query.is('unit_id', null)
    }

    const { data, error } = await query.maybeSingle()
    
    if (error) {
        console.error('Error fetching note:', error)
        return { success: false, message: 'Erro ao buscar observação' }
    }

    return { success: true, note: data ? data.note : '' }
  } catch (e) {
      console.error('Error in getMonthlyNote:', e)
      return { success: false, message: 'Erro interno' }
  }
}

export async function saveMonthlyNote(month: number, year: number, note: string, unitId?: string | null) {
  try {
      await checkAdmin()
      
      if (isLocalMode()) {
          const db = readDb()
          const index = db.monthly_notes.findIndex(n => n.month === month && n.year === year && (unitId ? n.unit_id === unitId : !n.unit_id))
          if (index >= 0) {
              db.monthly_notes[index].note = note
              db.monthly_notes[index].updated_at = new Date().toISOString()
          } else {
              db.monthly_notes.push({
                  id: randomUUID(),
                  month,
                  year,
                  unit_id: unitId || null,
                  note,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
              })
          }
          writeDb(db)
          revalidatePath('/')
          return { success: true }
      }

      const supabase = createClient()
      
      let query = supabase.from('monthly_notes').select('id').eq('month', month).eq('year', year)
      if (unitId) query = query.eq('unit_id', unitId)
      else query = query.is('unit_id', null)
      
      const { data: existing } = await query.maybeSingle()
      
      if (existing) {
          const { error } = await supabase.from('monthly_notes').update({ note, updated_at: new Date().toISOString() }).eq('id', existing.id)
          if (error) throw error
      } else {
          const payload: any = {
              month,
              year,
              note,
              updated_at: new Date().toISOString()
          }
          if (unitId) payload.unit_id = unitId
          
          const { error } = await supabase.from('monthly_notes').insert(payload)
          if (error) throw error
      }
      
      revalidatePath('/')
      return { success: true }
  } catch (e) {
      console.error('Error saving note:', e)
      return { success: false, message: 'Erro ao salvar observação' }
  }
}

export async function getUserDashboardData() {
  const session = cookies().get('session_user')
  if (!session) return null
  const user = JSON.parse(session.value)
  const userId = user.id
  const isAdmin = user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'

  const today = new Date()
  const cutoffDate = new Date(today)
  cutoffDate.setDate(today.getDate() - 2)
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0]
  
  if (isLocalMode()) {
    const db = readDb()
    
    // Create lookup maps for sections and units
    const sectionsById: Record<string, string> = {}
    ;(db.schedule_sections || []).forEach((s: any) => { sectionsById[s.id] = s.title })

    const unitsById: Record<string, string> = {}
    ;(db.units || []).forEach((u: any) => { unitsById[u.id] = u.title })

    // Get nurse info for fallback
    const nurse = db.nurses.find((n: any) => n.id === userId)

    // Shifts (from cutoff date onwards)
    const shifts = db.shifts
      .filter((s: any) => s.nurse_id === userId && s.shift_date >= cutoffDateStr)
      .sort((a: any, b: any) => a.shift_date.localeCompare(b.shift_date))
      .map((s: any) => {
        const dateStr = s.shift_date
        const [y, m] = dateStr.split('-')
        const year = parseInt(y, 10)
        const month = parseInt(m, 10)
        
        const roster = db.monthly_rosters?.find((r: any) => 
            r.nurse_id === userId && r.month === month && r.year === year
        )

        const sectionTitleFromRoster = roster?.section_id ? sectionsById[roster.section_id] : null
        const unitTitleFromRoster = roster?.unit_id ? unitsById[roster.unit_id] : null
        const sectionFallback = nurse?.section_id ? sectionsById[nurse.section_id] : null
        const unitFallback = nurse?.unit_id ? unitsById[nurse.unit_id] : null
        
        return {
            ...s,
            section_name: sectionTitleFromRoster ?? sectionFallback,
            unit_name: unitTitleFromRoster ?? unitFallback,
            is_in_roster: !!roster
        }
      })

    // Time off requests (Folgas/Trocas/Licenças)
    let timeOffs = db.time_off_requests
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    if (!isAdmin) {
      timeOffs = timeOffs.filter(r => r.nurse_id === userId)
    }

    // Enrich with nurse name for admin
    const enrichedTimeOffs = timeOffs.map(r => {
        const nurse = db.nurses.find(n => n.id === r.nurse_id)
        return { ...r, nurse_name: nurse ? nurse.name : 'Desconhecido' }
    })

    return { shifts, timeOffs: enrichedTimeOffs, user: { ...user, isAdmin } }
  }

  const supabase = createClient()
  
  const { data: userData, error: userError } = await supabase
    .from('nurses')
    .select('*')
    .eq('id', userId)
    .single()

  if (userError || !userData) return null

  // Shifts (from cutoff date onwards), enriched with nurse's section and unit
  const { data: rawShifts } = await supabase
    .from('shifts')
    .select(`
      *,
      nurses (
        units (title),
        schedule_sections (title)
      )
    `)
    .gte('date', cutoffDateStr)
    .eq('nurse_id', userId)
    .order('date', { ascending: true })

  // Build month/year sets from shifts
  const monthsSet = new Set<number>()
  const yearsSet = new Set<number>()
  ;(rawShifts || []).forEach((s: any) => {
    const dateStr = s.date || s.shift_date
    if (dateStr) {
      const [y, m] = dateStr.split('-')
      const year = parseInt(y, 10)
      const month = parseInt(m, 10)
      if (!Number.isNaN(year)) yearsSet.add(year)
      if (!Number.isNaN(month)) monthsSet.add(month)
    }
  })

  // Fetch monthly roster for the months that have shifts for this user
  let rosterLookup: Record<string, { section_id: string | null, unit_id: string | null }> = {}
  if (monthsSet.size > 0 && yearsSet.size > 0) {
    const monthsArr = Array.from(monthsSet.values())
    const yearsArr = Array.from(yearsSet.values())

    const { data: rosterRows } = await supabase
      .from('monthly_rosters')
      .select('*')
      .eq('nurse_id', userId)
      .in('month', monthsArr)
      .in('year', yearsArr)

    if (rosterRows && rosterRows.length > 0) {
      rosterRows.forEach((r: any) => {
        const key = `${r.year}-${String(r.month).padStart(2, '0')}`
        rosterLookup[key] = { section_id: r.section_id || null, unit_id: r.unit_id || null }
      })
    }
  }

  // Fetch sections and units to resolve titles
  const [sectionsRes, unitsRes] = await Promise.all([
    supabase.from('schedule_sections').select('id,title'),
    supabase.from('units').select('id,title')
  ])
  const sectionsById: Record<string, string> = {}
  const unitsById: Record<string, string> = {}
  ;(sectionsRes.data || []).forEach((s: any) => { sectionsById[s.id] = s.title })
  ;(unitsRes.data || []).forEach((u: any) => { unitsById[u.id] = u.title })

  // Final enriched shifts using monthly roster assignment (escala)
  const shifts = (rawShifts || []).map((s: any) => {
    const dateStr = s.date || s.shift_date
    const [y, m] = dateStr ? dateStr.split('-') : [undefined, undefined]
    const rosterKey = y && m ? `${parseInt(y, 10)}-${m}` : ''
    const roster = rosterLookup[rosterKey]
    const sectionTitleFromRoster = roster?.section_id ? sectionsById[roster.section_id] : null
    const unitTitleFromRoster = roster?.unit_id ? unitsById[roster.unit_id] : null
    const sectionTitleFallback = s.nurses?.schedule_sections?.title || null
    const unitTitleFallback = s.nurses?.units?.title || null
    return {
      ...s,
      section_name: sectionTitleFromRoster ?? sectionTitleFallback,
      unit_name: unitTitleFromRoster ?? unitTitleFallback,
      is_in_roster: !!roster
    }
  })

  // Time off requests
  let timeOffsQuery = supabase
    .from('time_off_requests')
    .select('*, nurses(name)')
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    timeOffsQuery = timeOffsQuery.eq('nurse_id', userId)
  }

  const { data: timeOffs } = await timeOffsQuery

  const enrichedTimeOffs = timeOffs?.map((r: any) => ({
    ...r,
    nurse_name: r.nurses?.name || 'Desconhecido'
  })) || []

  return { shifts: shifts || [], timeOffs: enrichedTimeOffs, user: { ...userData, isAdmin, role: userData.role } }
}

export async function getDailyShifts(date: string) {
  try {
    const user = await checkUser()
  } catch (e) {
    return { success: false, message: 'Acesso negado' }
  }

  if (isLocalMode()) {
    const db = readDb()
    const shifts = db.shifts.filter(s => s.date === date)

    const swaps = (db.shift_swaps || []).filter((swap: any) =>
      swap.status === 'approved' &&
      (swap.requester_shift_date === date || swap.requested_shift_date === date)
    )

    const swapsByKey: Record<string, string> = {}
    swaps.forEach((swap: any) => {
      const requester = db.nurses.find((n: any) => n.id === swap.requester_id)
      const requested = db.nurses.find((n: any) => n.id === swap.requested_id)
      const requesterName = requester?.name || 'Desconhecido'
      const requestedName = requested?.name || 'Desconhecido'

      // Key for Requester on Requester Date (if they were still on the shift)
      const key1 = `${swap.requester_id}_${swap.requester_shift_date}`
      swapsByKey[key1] = requestedName

      // Key for Requested on Requester Date (The one taking the shift)
      const key2 = `${swap.requested_id}_${swap.requester_shift_date}`
      swapsByKey[key2] = requesterName

      if (swap.requested_shift_date) {
        // Key for Requested on Requested Date (if they were still on the shift)
        const key3 = `${swap.requested_id}_${swap.requested_shift_date}`
        swapsByKey[key3] = requesterName

        // Key for Requester on Requested Date (The one taking the shift)
        const key4 = `${swap.requester_id}_${swap.requested_shift_date}`
        swapsByKey[key4] = requestedName
      }
    })

    const [yearStr, monthStr] = date.split('-')
    const yearNum = parseInt(yearStr, 10)
    const monthNum = parseInt(monthStr, 10)

    const enrichedShifts = shifts.map(s => {
      const nurse = db.nurses.find(n => n.id === s.nurse_id)
      const roster = db.monthly_rosters.find(
        r => r.nurse_id === s.nurse_id && r.month === monthNum && r.year === yearNum
      )

      const sectionId = roster?.section_id ?? nurse?.section_id ?? null
      const unitId = roster?.unit_id ?? nurse?.unit_id ?? null

      const sectionTitle = sectionId ? db.schedule_sections.find(sec => sec.id === sectionId)?.title ?? null : null
      const unitTitle = unitId ? db.units.find(u => u.id === unitId)?.title ?? null : null

      const swapKey = `${s.nurse_id}_${s.date}`
      const swapWithName = swapsByKey[swapKey] || null

      return {
        ...s,
        nurse_name: nurse?.name || 'Desconhecido',
        nurse_role: nurse?.role || 'Desconhecido',
        unit_id: unitId,
        section_id: sectionId,
        unit_name: unitTitle,
        section_name: sectionTitle,
        is_in_roster: !!roster,
        swap_with_name: swapWithName
      }
    })

    const timeOffsForDay = (db.time_off_requests || []).filter((t: any) =>
      t.status === 'approved' &&
      t.start_date <= date &&
      t.end_date >= date
    )
    const timeOffNurseIds = new Set(timeOffsForDay.map((t: any) => t.nurse_id))

    return { 
      success: true, 
      data: enrichedShifts.filter(s => s.is_in_roster && !timeOffNurseIds.has(s.nurse_id)) 
    }
  }

  const supabase = createClient()

  // 1) Buscar plantões do dia
  const { data: rawShifts, error: shiftsError } = await supabase
    .from('shifts')
    .select('*')
    .eq('date', date)

  if (shiftsError) {
    console.error('Error fetching daily shifts:', shiftsError)
    return { success: false, message: 'Erro ao buscar plantões' }
  }

  const shifts = rawShifts || []
  if (shifts.length === 0) {
    return { success: true, data: [] }
  }

  const { data: swapsRows, error: swapsError } = await supabase
    .from('shift_swaps')
    .select(`
      id,
      requester_id,
      requested_id,
      requester_shift_date,
      requested_shift_date,
      status,
      requester:nurses!requester_id(name),
      requested:nurses!requested_id(name)
    `)
    .eq('status', 'approved')
    .or(`requester_shift_date.eq.${date},requested_shift_date.eq.${date}`)

  if (swapsError) {
    console.error('Error fetching shift swaps for daily view:', swapsError)
  }

  const swaps = swapsRows || []

  const swapsByKey: Record<string, string> = {}
  swaps.forEach((swap: any) => {
    const requesterName = swap.requester?.name || 'Desconhecido'
    const requestedName = swap.requested?.name || 'Desconhecido'

    // Key for Requester on Requester Date
    const key1 = `${swap.requester_id}_${swap.requester_shift_date}`
    swapsByKey[key1] = requestedName

    // Key for Requested on Requester Date (The one taking the shift)
    const key2 = `${swap.requested_id}_${swap.requester_shift_date}`
    swapsByKey[key2] = requesterName

    if (swap.requested_shift_date) {
      // Key for Requested on Requested Date
      const key3 = `${swap.requested_id}_${swap.requested_shift_date}`
      swapsByKey[key3] = requesterName

      // Key for Requester on Requested Date (The one taking the shift)
      const key4 = `${swap.requester_id}_${swap.requested_shift_date}`
      swapsByKey[key4] = requestedName
    }
  })

  const nurseIds = Array.from(new Set(shifts.map(s => s.nurse_id).filter(Boolean)))
  const [yearStr, monthStr] = date.split('-')
  const yearNum = parseInt(yearStr, 10)
  const monthNum = parseInt(monthStr, 10)

  // 2) Buscar dados auxiliares em paralelo: roster (escala mensal), enfermeiros, seções e setores
  const [
    { data: rosterRows },
    { data: nursesRows },
    { data: timeOffRows }
  ] = await Promise.all([
    supabase.from('monthly_rosters')
      .select('id, nurse_id, section_id, unit_id, month, year')
      .eq('month', monthNum)
      .eq('year', yearNum)
      .in('nurse_id', nurseIds),
    supabase.from('nurses')
      .select('id, name, role, unit_id, section_id')
      .in('id', nurseIds),
    supabase.from('time_off_requests')
      .select('id, nurse_id, start_date, end_date, type, status')
      .eq('status', 'approved')
      .lte('start_date', date)
      .gte('end_date', date)
  ])

  const rosterById: Record<string, { section_id: string | null, unit_id: string | null, nurse_id: string | null }> = {}
  const rosterByNurse: Record<string, { section_id: string | null, unit_id: string | null, id?: string | null }> = {}
  const sectionIds = new Set<string>()
  const unitIds = new Set<string>()
  ;(rosterRows || []).forEach((r: any) => {
    rosterById[r.id] = { section_id: r.section_id || null, unit_id: r.unit_id || null, nurse_id: r.nurse_id || null }
    if (r.nurse_id && !rosterByNurse[r.nurse_id]) {
      rosterByNurse[r.nurse_id] = { section_id: r.section_id || null, unit_id: r.unit_id || null, id: r.id || null }
    }
    if (r.section_id) sectionIds.add(String(r.section_id))
    if (r.unit_id) unitIds.add(String(r.unit_id))
  })

  const nursesById: Record<string, { name: string, role: string, unit_id?: string, section_id?: string }> = {}
  ;(nursesRows || []).forEach((n: any) => {
    nursesById[n.id] = { name: n.name, role: n.role, unit_id: n.unit_id, section_id: n.section_id }
    if (n.section_id) sectionIds.add(String(n.section_id))
    if (n.unit_id) unitIds.add(String(n.unit_id))
  })

  const [sectionsResult, unitsResult] = await Promise.all([
    sectionIds.size > 0
      ? supabase.from('schedule_sections').select('id, title').in('id', Array.from(sectionIds))
      : Promise.resolve({ data: [] as any[] }),
    unitIds.size > 0
      ? supabase.from('units').select('id, title').in('id', Array.from(unitIds))
      : Promise.resolve({ data: [] as any[] })
  ])
  const sectionsRows = sectionsResult.data || []
  const unitsRows = unitsResult.data || []

  const sectionsById: Record<string, string> = {}
  ;(sectionsRows || []).forEach((s: any) => { sectionsById[s.id] = s.title })

  const unitsById: Record<string, string> = {}
  ;(unitsRows || []).forEach((u: any) => { unitsById[u.id] = u.title })

  const timeOffNurseIds = new Set<string>()
  ;(timeOffRows || []).forEach((t: any) => {
    if (t.nurse_id) timeOffNurseIds.add(t.nurse_id)
  })

  // 3) Enriquecer plantões com dados de escala mensal (prioritário) e nomes
  const enrichedShifts = shifts.map((s: any) => {
    const swapKey = `${s.nurse_id}_${s.date}`
    const swapWithName = swapsByKey[swapKey] || null

    const nurseInfo = nursesById[s.nurse_id] || { name: 'Desconhecido', role: 'Desconhecido', unit_id: null, section_id: null }
    const rosterForShift = s.roster_id ? rosterById[s.roster_id] : rosterByNurse[s.nurse_id]
    const sectionTitle = rosterForShift?.section_id ? sectionsById[rosterForShift.section_id] || null : null
    const unitTitle = rosterForShift?.unit_id ? unitsById[rosterForShift.unit_id] || null : null
    const sectionFallback = nurseInfo.section_id ? sectionsById[nurseInfo.section_id] || null : null
    const unitFallback = nurseInfo.unit_id ? unitsById[nurseInfo.unit_id] || null : null

    return {
      ...s,
      shift_type: s.type,
      shift_date: s.date,
      nurse_name: nurseInfo.name,
      nurse_role: nurseInfo.role,
      unit_id: rosterForShift?.unit_id ?? nurseInfo.unit_id ?? null,
      section_id: rosterForShift?.section_id ?? nurseInfo.section_id ?? null,
      unit_name: unitTitle ?? unitFallback,
      section_name: sectionTitle ?? sectionFallback,
      is_in_roster: !!rosterForShift,
      swap_with_name: swapWithName
    }
  })

  return { 
    success: true, 
    data: enrichedShifts.filter(s => s.is_in_roster && !timeOffNurseIds.has(s.nurse_id)) 
  }
}

export async function getMonthlyScheduleData(month: number, year: number, unitId?: string, isPublic: boolean = false) {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    if (isLocalMode()) {
      const db = readDb()
      
      // Initialize monthly_rosters if missing
      if (!db.monthly_rosters) db.monthly_rosters = []

      const roster = db.monthly_rosters.filter(r => {
        if (r.month !== month || r.year !== year) return false
        if (unitId === undefined) return true
        if (!unitId) return !r.unit_id
        return String(r.unit_id) === String(unitId)
      })
      
      const nurseIds = new Set((roster || []).map((r: any) => r.nurse_id).filter(Boolean))
      const nurses = (db.nurses || []).filter((n: any) => nurseIds.has(String(n.id)))
      const rosterIdsForContext = new Set((roster || []).map((r: any) => r.id).filter(Boolean))
      const shifts = db.shifts.filter((s: any) => {
        const date = s.shift_date || s.date
        if (!date) return false
        if (date < startDate || date > endDate) return false
        if (rosterIdsForContext.size > 0) {
          return s.roster_id && rosterIdsForContext.has(s.roster_id)
        }
        return true
      })
      const nurseNameById = new Map<string, string>()
      ;(db.nurses || []).forEach((n: any) => {
        if (!n?.id) return
        nurseNameById.set(String(n.id), String(n.name || ''))
      })

      const timeOffs = db.time_off_requests
        .filter(t => 
        ['approved', 'pending'].includes(t.status) && 
        ((t.start_date <= endDate && t.end_date >= startDate))
      )
        .map((t: any) => ({
          ...t,
          nurse_name: nurseNameById.get(String(t.nurse_id)) || ''
        }))
      const releases = db.monthly_schedule_metadata.filter((m: any) => {
        if (m.month !== month || m.year !== year) return false
        if (unitId === undefined) return true
        if (!unitId) return !m.unit_id
        return String(m.unit_id) === String(unitId)
      })
      const absences = (db.absences || []).filter(a => a.date >= startDate && a.date <= endDate)

      // Se for acesso público, verificar se a escala está liberada
      if (isPublic && !releases.some(r => r.is_released)) {
        throw new Error('Acesso não autorizado: escala não liberada')
      }

      return {
        nurses: nurses || [],
        roster: roster || [],
        shifts: shifts || [],
        timeOffs: timeOffs || [],
        absences: absences || [],
        sections: db.schedule_sections || [],
        units: db.units || [],
        releases: releases || []
      }
    }

    const supabase = createClient()
    
    // Se for acesso público, validar se a escala está liberada antes de mais nada
    if (isPublic) {
      const { data: releaseCheck } = await supabase
        .from('monthly_schedule_metadata')
        .select('is_released')
        .eq('month', month)
        .eq('year', year)
        .eq('unit_id', unitId || '')
        .single()
      
      if (!releaseCheck || !releaseCheck.is_released) {
        throw new Error('Acesso não autorizado: escala não liberada')
      }
    }

    // FETCH BASE DATA IN PARALLEL (unit-scoped when unitId is provided)
    let rosterQuery = supabase.from('monthly_rosters')
        .select('id, nurse_id, unit_id, section_id, month, year, observation, sector, created_at, list_order, name_star')
        .eq('month', month)
        .eq('year', year)

    if (unitId) rosterQuery = rosterQuery.eq('unit_id', unitId)
    else if (unitId !== undefined) rosterQuery = rosterQuery.is('unit_id', null)

    const releasesQueryBase = supabase.from('monthly_schedule_metadata').select('*').eq('month', month).eq('year', year)
    const releasesQuery = unitId ? releasesQueryBase.eq('unit_id', unitId) : (unitId === undefined ? releasesQueryBase : releasesQueryBase.is('unit_id', null))

    let timeOffsQuery = supabase.from('time_off_requests')
      .select('id, nurse_id, start_date, end_date, type, status, unit_id')
      .in('status', ['approved', 'pending'])
      .lte('start_date', endDate)
      .gte('end_date', startDate)
      .range(0, 1000)

    if (unitId) timeOffsQuery = timeOffsQuery.or(`unit_id.eq.${unitId},unit_id.is.null`)

    let absencesQuery = supabase.from('absences').select('*').gte('date', startDate).lte('date', endDate).range(0, 1000)
    if (unitId) absencesQuery = absencesQuery.eq('unit_id', unitId)

    const [
        { data: sections },
        { data: units },
        { data: rosterData, error: rosterError },
        { data: timeOffsData },
        { data: releasesData },
        { data: absencesData }
    ] = await Promise.all([
        supabase.from('schedule_sections').select('*').order('position', { ascending: true, nullsFirst: true }).order('title', { ascending: true }),
        supabase.from('units').select('*'),
        rosterQuery.range(0, 5000), // Increased range for larger hospitals
        timeOffsQuery,
        releasesQuery,
        absencesQuery
    ])

    let roster = rosterData || []
    if ((!rosterData || rosterData.length === 0) && rosterError?.message?.includes('name_star')) {
      let fallbackRosterQuery = supabase.from('monthly_rosters')
        .select('id, nurse_id, unit_id, section_id, month, year, observation, sector, created_at, list_order')
        .eq('month', month)
        .eq('year', year)
      if (unitId) fallbackRosterQuery = fallbackRosterQuery.eq('unit_id', unitId)
      else if (unitId !== undefined) fallbackRosterQuery = fallbackRosterQuery.is('unit_id', null)
      const { data: fallbackRoster, error: fallbackErr } = await fallbackRosterQuery.range(0, 5000)
      if (fallbackErr) throw fallbackErr
      roster = fallbackRoster || []
    }
    const nurseIdList = Array.from(new Set(roster.map((r: any) => r.nurse_id).filter(Boolean)))
    let nurses: any[] = []
    if (nurseIdList.length > 0) {
      const { data: nursesData, error: nursesError } = await supabase
        .from('nurses')
        .select('*')
        .in('id', nurseIdList)
        .order('name')
        .range(0, 1000)
      if (nursesError) console.error('Error fetching nurses:', nursesError)
      nurses = nursesData || []
    }

    const timeOffsRaw = timeOffsData || []
    const timeOffNurseIds = Array.from(new Set(timeOffsRaw.map((t: any) => t.nurse_id).filter(Boolean)))
    const knownNameById = new Map<string, string>()
    nurses.forEach((n: any) => {
      if (!n?.id) return
      knownNameById.set(String(n.id), String(n.name || ''))
    })
    const missingTimeOffIds = timeOffNurseIds.filter((id) => !knownNameById.has(String(id)))

    if (missingTimeOffIds.length > 0) {
      const chunk = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size))
      const chunks = chunk(missingTimeOffIds, 200)
      for (const ids of chunks) {
        const { data: extraNames, error: extraErr } = await supabase
          .from('nurses')
          .select('id,name')
          .in('id', ids)
          .range(0, 1000)
        if (extraErr) {
          console.error('Error fetching time-off nurse names:', extraErr)
          continue
        }
        ;(extraNames || []).forEach((n: any) => {
          if (!n?.id) return
          if (!knownNameById.has(String(n.id))) {
            knownNameById.set(String(n.id), String(n.name || ''))
          }
        })
      }
    }

    const timeOffs = timeOffsRaw.map((t: any) => ({
      ...t,
      nurse_name: knownNameById.get(String(t.nurse_id)) || ''
    }))

    let shifts: any[] = []
    const rosterIds = roster.map((r: any) => r.id).filter(Boolean)
    if (rosterIds.length > 0) {
      const chunk = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size))
      const chunks = chunk(rosterIds, 200)
      const shiftRows: any[] = []
      for (const ids of chunks) {
        let { data: chunkShifts, error: shiftsError } = await supabase
          .from('shifts')
          .select('id, nurse_id, date, type, roster_id, created_at, is_red')
          .in('roster_id', ids)
          .gte('date', startDate)
          .lte('date', endDate)
          .range(0, 20000)
        if (shiftsError) {
          if (shiftsError.message?.includes('is_red')) {
            const fallback = await supabase
              .from('shifts')
              .select('id, nurse_id, date, type, roster_id, created_at')
              .in('roster_id', ids)
              .gte('date', startDate)
              .lte('date', endDate)
              .range(0, 20000)
            if (fallback.error) throw fallback.error
            chunkShifts = fallback.data as any
            shiftsError = null as any
          } else {
            throw shiftsError
          }
        }
        if (chunkShifts && chunkShifts.length > 0) shiftRows.push(...chunkShifts)
      }
      shifts = shiftRows.map((s: any) => ({
        ...s,
        shift_date: s.date,
        shift_type: s.type,
        is_red: !!s.is_red
      }))
    }

    return {
        nurses: nurses || [],
        roster: roster,
        shifts: shifts,
        timeOffs: timeOffs,
        absences: absencesData || [],
        sections: sections || [],
        units: units || [],
        releases: releasesData || []
    }
  } catch (error) {
    console.error('Critical error in getMonthlyScheduleData:', error)
    // Return empty structure to prevent page crash
    return {
      nurses: [],
      roster: [],
      shifts: [],
      timeOffs: [],
      absences: [],
      sections: [],
      units: [],
      releases: []
    }
  }
}

export async function exportMonthlySchedule(month: number, year: number, unitId: string | null) {
    try {
        await checkAdmin()
        const data = await getMonthlyScheduleData(month, year, unitId || undefined)
        return { success: true, data }
    } catch (e: any) {
        return { success: false, message: e.message }
    }
}

export async function importMonthlySchedule(month: number, year: number, unitId: string | null, data: any) {
    try {
        const user = await checkAdmin()
        const supabase = createClient()
        
        if (!data || !data.shifts) throw new Error('Dados inválidos para importação')

        // 1. Prepare roster entries
        // We need to ensure roster entries exist for the imported shifts
        // For simplicity, we assume the professional exists. 
        // If they don't, we skip their shifts.
        
        const shiftsToImport = data.shifts.map((s: any) => ({
            nurseId: s.nurse_id,
            rosterId: s.roster_id,
            date: s.shift_date || s.date,
            type: s.shift_type || s.type,
            isRed: !!(s.is_red ?? s.isRed)
        }))

        // Use our safe saveShifts function to handle the actual DB work
        const res = await saveShifts(shiftsToImport)
        
        if (res.success) {
            // Log the import
            await supabase.from('audit_logs').insert({
                user_id: user.id,
                user_name: user.name,
                action: 'IMPORT_SCHEDULE',
                details: { month, year, unit_id: unitId, count: shiftsToImport.length }
            })
            revalidatePath('/')
            return { success: true, message: `Importação concluída: ${shiftsToImport.length} plantões restaurados.` }
        } else {
            throw new Error(res.message)
        }
    } catch (e: any) {
        console.error('Import failed:', e)
        return { success: false, message: 'Erro na importação: ' + e.message }
    }
}


export async function getAllNurses() {
    try {
        if (isLocalMode()) {
            const db = readDb()
            return db.nurses || []
        }
        const supabase = createClient()
        // Use a large range and count to ensure we get absolutely everyone
        const { data, error, count } = await supabase
            .from('nurses')
            .select('*', { count: 'exact' })
            .order('name')
            .range(0, 19999)
        
        if (error) {
            console.error('Error in getAllNurses Supabase:', error)
            throw error
        }
        
        console.log(`getAllNurses: Fetched ${data?.length} of ${count} nurses.`)
        return data || []
    } catch (e) {
        console.error('Error in getAllNurses:', e)
        return []
    }
}

export async function releaseSchedule(month: number, year: number, unitId: string | null) {
  try {
      if (unitId) {
        await checkScaleEditor(unitId)
      } else {
        await checkAdmin()
      }
      const session = cookies().get('session_user')
      const user = JSON.parse(session!.value)
      
      // Get current nurse info for the signature
      let nurseName = user.name
      let nurseCoren = ''
      
      if (isLocalMode()) {
          const db = readDb()
          const n = db.nurses.find((n: any) => n.id === user.id)
          if (n) {
              nurseName = n.name
              nurseCoren = n.coren || ''
          }
      } else {
          const supabase = createClient()
          const { data: n } = await supabase.from('nurses').select('name, coren').eq('id', user.id).single()
          if (n) {
              nurseName = n.name
              nurseCoren = n.coren || ''
          }
      }

      const signature = `LIBERADO ELETRONICAMENTE POR ${nurseName.toUpperCase()} ${nurseCoren ? `COREN ${nurseCoren}` : ''}`.trim()

      if (isLocalMode()) {
         const db = readDb()
         const existingIndex = db.monthly_schedule_metadata.findIndex(m => m.month === month && m.year === year && (unitId ? m.unit_id === unitId : !m.unit_id))
         
         const payload = {
             id: existingIndex >= 0 ? db.monthly_schedule_metadata[existingIndex].id : randomUUID(),
             month,
             year,
             unit_id: unitId || null,
             is_released: true,
             released_at: new Date().toISOString(),
             updated_at: new Date().toISOString(),
             released_by: user.id,
             release_signature: signature
         }

         if (existingIndex >= 0) {
             db.monthly_schedule_metadata[existingIndex] = { ...db.monthly_schedule_metadata[existingIndex], ...payload }
         } else {
             db.monthly_schedule_metadata.push(payload)
         }
         writeDb(db)
         revalidatePath('/')
         return { success: true }
      }

      const supabase = createClient()
      
      let query = supabase.from('monthly_schedule_metadata').select('id').eq('month', month).eq('year', year)
      if (unitId) query = query.eq('unit_id', unitId)
      else query = query.is('unit_id', null)

      const { data: existing } = await query.maybeSingle()

      if (existing) {
          const { error } = await supabase.from('monthly_schedule_metadata').update({
              is_released: true,
              released_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              release_signature: signature
          }).eq('id', existing.id)
          if (error) throw error
      } else {
          const payload: any = {
              month,
              year,
              is_released: true,
              released_at: new Date().toISOString(),
              release_signature: signature
          }
          if (unitId) payload.unit_id = unitId

          const { error } = await supabase.from('monthly_schedule_metadata').insert(payload)
          if (error) throw error
      }
      
      revalidatePath('/')
      return { success: true }
  } catch(e: any) {
      console.error(e)
      return { success: false, message: `Erro ao liberar escala: ${e.message || 'Erro desconhecido'}` }
  }
}

export async function getRecentAbsences() {
  let user
  try {
    user = await checkUser()
  } catch (e) {
    throw new Error('Unauthorized')
  }

  // Always filter by user.id as per requirement to show "Minhas Faltas" in dashboard
  
  if (isLocalMode()) {
    const db = readDb()
    let absences = db.absences || []
    
    // Filter for current user (robust comparison)
    absences = absences.filter((a: any) => String(a.nurse_id) === String(user.id))

    // Enrich with nurse name
    const enriched = absences.map((a: any) => {
        const nurse = db.nurses.find((n: any) => String(n.id) === String(a.nurse_id))
        return { ...a, nurse_name: nurse ? nurse.name : 'Desconhecido' }
    })
    // Sort by created_at desc, fallback to date
    enriched.sort((a: any, b: any) => {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
        if (timeA === 0 && timeB === 0) {
             return new Date(b.date).getTime() - new Date(a.date).getTime()
        }
        return timeB - timeA
    })
    return enriched.slice(0, 50)
  }

  const supabase = createClient()
  let query = supabase
    .from('absences')
    .select('*, nurses!absences_nurse_id_fkey(name)')
    .eq('nurse_id', user.id) // Filter for current user
    .order('created_at', { ascending: false, nullsFirst: false })
    .order('date', { ascending: false })
  
  query = query.limit(50)

  const { data, error } = await query

  if (error) {
    console.error('Error fetching absences:', error)
    return []
  }

  // Flatten nurse name
  return data.map((item: any) => ({
      ...item,
      nurse_name: item.nurses?.name || 'Desconhecido'
  }))
}

export async function unreleaseSchedule(month: number, year: number, unitId: string | null) {
  try {
      if (unitId) {
        await checkScaleEditor(unitId)
      } else {
        await checkAdmin()
      }
      
      if (isLocalMode()) {
        const db = readDb()
        const existingIndex = db.monthly_schedule_metadata.findIndex(m => m.month === month && m.year === year && (unitId ? m.unit_id === unitId : !m.unit_id))
        
        if (existingIndex >= 0) {
            db.monthly_schedule_metadata[existingIndex].is_released = false
            db.monthly_schedule_metadata[existingIndex].updated_at = new Date().toISOString()
            db.monthly_schedule_metadata[existingIndex].release_signature = null
            writeDb(db)
        }
        revalidatePath('/')
        return { success: true }
      }

      const supabase = createClient()
      
      let query = supabase.from('monthly_schedule_metadata').select('id').eq('month', month).eq('year', year)
      if (unitId) query = query.eq('unit_id', unitId)
      else query = query.is('unit_id', null)

      const { data: existing } = await query.maybeSingle()

      if (existing) {
          const { error } = await supabase.from('monthly_schedule_metadata').update({
              is_released: false,
              updated_at: new Date().toISOString(),
              release_signature: null
          }).eq('id', existing.id)
          if (error) throw error
      }
      
      revalidatePath('/')
      return { success: true }
  } catch(e: any) {
      console.error(e)
      return { success: false, message: `Erro ao cancelar liberação da escala: ${e.message || 'Erro desconhecido'}` }
  }
}

export async function updateScheduleFooter(month: number, year: number, unitId: string | null, footerText: string) {
  try {
      if (unitId) {
        await checkScaleEditor(unitId)
      } else {
        await checkAdmin()
      }

      if (isLocalMode()) {
        const db = readDb()
        const existingIndex = db.monthly_schedule_metadata.findIndex(m => m.month === month && m.year === year && (unitId ? m.unit_id === unitId : !m.unit_id))
        
        const payload = {
            id: existingIndex >= 0 ? db.monthly_schedule_metadata[existingIndex].id : randomUUID(),
            month,
            year,
            unit_id: unitId || null,
            footer_text: footerText,
            updated_at: new Date().toISOString()
        }

        if (existingIndex >= 0) {
            db.monthly_schedule_metadata[existingIndex] = { ...db.monthly_schedule_metadata[existingIndex], ...payload }
        } else {
            db.monthly_schedule_metadata.push({
                ...payload,
                is_released: false,
                released_at: null
            })
        }
        writeDb(db)
        revalidatePath('/')
        return { success: true }
      }

      const supabase = createClient()
      
      let query = supabase.from('monthly_schedule_metadata').select('id').eq('month', month).eq('year', year)
      if (unitId) query = query.eq('unit_id', unitId)
      else query = query.is('unit_id', null)

      const { data: existing } = await query.maybeSingle()

      if (existing) {
          const { error } = await supabase.from('monthly_schedule_metadata').update({
              footer_text: footerText,
              updated_at: new Date().toISOString()
          }).eq('id', existing.id)
          if (error) throw error
      } else {
          const payload: any = {
              month,
              year,
              footer_text: footerText,
              is_released: false
          }
          if (unitId) payload.unit_id = unitId

          const { error } = await supabase.from('monthly_schedule_metadata').insert(payload)
          if (error) throw error
      }
      
      revalidatePath('/')
      return { success: true }
  } catch(e) {
      console.error(e)
      return { success: false, message: 'Erro ao salvar rodapé' }
  }
}

export async function updateScheduleDynamicField(month: number, year: number, unitId: string | null, field: string) {
  try {
      await checkAdmin()

      if (isLocalMode()) {
        const db = readDb()
        
        // Update ALL metadata entries to have the same dynamic_field (Global)
        db.monthly_schedule_metadata.forEach(m => {
            m.dynamic_field = field
            m.updated_at = new Date().toISOString()
        })

        // Ensure the current one exists too
        const currentMeta = db.monthly_schedule_metadata.find(m => m.month === month && m.year === year && (unitId ? m.unit_id === unitId : !m.unit_id))
        if (!currentMeta) {
            db.monthly_schedule_metadata.push({
                id: randomUUID(),
                month,
                year,
                unit_id: unitId || null,
                dynamic_field: field,
                is_released: false,
                released_at: null,
                updated_at: new Date().toISOString()
            })
        }
        
        writeDb(db)
        revalidatePath('/')
        return { success: true }
      }

      const supabase = createClient()
      
      // Update ALL existing metadata to use the new field (Global)
      const { error: updateAllError } = await supabase
        .from('monthly_schedule_metadata')
        .update({
            dynamic_field: field,
            updated_at: new Date().toISOString()
        })
        .neq('dynamic_field', field) // only update those that are different

      if (updateAllError) {
          // If the column doesn't exist, we'll catch it in the catch block
          if (updateAllError.message?.includes('column "dynamic_field" does not exist')) {
              throw updateAllError
          }
          console.error('Error updating all dynamic fields:', updateAllError)
      }

      // Ensure the current month/year/unit entry exists
      let query = supabase.from('monthly_schedule_metadata').select('id').eq('month', month).eq('year', year)
      if (unitId) query = query.eq('unit_id', unitId)
      else query = query.is('unit_id', null)

      const { data: existing } = await query.maybeSingle()

      if (!existing) {
          const payload: any = {
              month,
              year,
              dynamic_field: field,
              is_released: false
          }
          if (unitId) payload.unit_id = unitId

          const { error: insertError } = await supabase.from('monthly_schedule_metadata').insert(payload)
          if (insertError) throw insertError
      }
      
      revalidatePath('/')
      return { success: true }
  } catch(e: any) {
       console.error('Dynamic Field Error:', e)
       if (e.message?.includes('column "dynamic_field" does not exist')) {
           return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V14). Solicite ao suporte para rodar o script de campo dinâmico.' }
       }
       return { success: false, message: 'Erro ao salvar campo dinâmico: ' + (e.message || 'Erro desconhecido') }
   }
}

export async function updateScheduleSetorVisibility(month: number, year: number, unitId: string | null, isHidden: boolean) {
  try {
      await checkAdmin()

      if (isLocalMode()) {
        const db = readDb()
        const existingIndex = db.monthly_schedule_metadata.findIndex(m => m.month === month && m.year === year && (unitId ? m.unit_id === unitId : !m.unit_id))
        
        if (existingIndex >= 0) {
            db.monthly_schedule_metadata[existingIndex].is_setor_hidden = isHidden
            db.monthly_schedule_metadata[existingIndex].updated_at = new Date().toISOString()
        } else {
            db.monthly_schedule_metadata.push({
                id: randomUUID(),
                month,
                year,
                unit_id: unitId || null,
                is_setor_hidden: isHidden,
                is_released: false,
                released_at: null,
                updated_at: new Date().toISOString()
            })
        }
        writeDb(db)
        revalidatePath('/')
        return { success: true }
      }

      const supabase = createClient()
      
      let query = supabase.from('monthly_schedule_metadata').select('id').eq('month', month).eq('year', year)
      if (unitId) query = query.eq('unit_id', unitId)
      else query = query.is('unit_id', null)

      const { data: existing } = await query.maybeSingle()

      if (existing) {
          const { error } = await supabase.from('monthly_schedule_metadata').update({
              is_setor_hidden: isHidden,
              updated_at: new Date().toISOString()
          }).eq('id', existing.id)
          if (error) throw error
      } else {
          const payload: any = {
              month,
              year,
              is_setor_hidden: isHidden,
              is_released: false
          }
          if (unitId) payload.unit_id = unitId

          const { error } = await supabase.from('monthly_schedule_metadata').insert(payload)
          if (error) throw error
      }
      
      revalidatePath('/')
      return { success: true }
  } catch(e: any) {
       console.error('Setor Visibility Error:', e)
       const errorMsg = e.message || ''
       if (errorMsg.includes('column "is_setor_hidden" does not exist') || errorMsg.includes("'is_setor_hidden' column") || errorMsg.includes('is_setor_hidden')) {
           return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V16). Solicite ao suporte para rodar o script de visibilidade do setor ou utilize o botão de atualização se disponível.' }
       }
       return { success: false, message: 'Erro ao salvar visibilidade do setor: ' + (errorMsg || 'Erro desconhecido') }
   }
}

export async function clearMonthlySchedule(month: number, year: number, unitId: string | null) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  let currentUser: any = null
  try {
    currentUser = await checkUser()
  } catch (e) {
    currentUser = null
  }

  if (isLocalMode()) {
    const db = readDb()

    const rosterToDelete = db.monthly_rosters.filter((r: any) => r.month === month && r.year === year && (unitId ? r.unit_id === unitId : !r.unit_id))
    const rosterIds = rosterToDelete.map((r: any) => r.id)

    db.monthly_rosters = db.monthly_rosters.filter((r: any) => !(r.month === month && r.year === year && (unitId ? r.unit_id === unitId : !r.unit_id)))

    if (rosterIds.length > 0) {
      db.shifts = db.shifts.filter((s: any) => {
        // Only delete shifts linked to the deleted rosters
        if (s.roster_id && rosterIds.includes(s.roster_id)) return false
        // Legacy fallback: if no roster_id, we can't be sure, so we leave it alone or use nurse_id check CAREFULLY
        // But for safety in local mode, let's assume if roster_id is missing, it's legacy and bound to first roster.
        // If we are deleting the roster, we should delete the shifts?
        // Let's stick to roster_id deletion for safety.
        return true
      })
    }

    db.monthly_schedule_metadata = db.monthly_schedule_metadata.filter((m: any) => !(m.month === month && m.year === year && (unitId ? m.unit_id === unitId : !m.unit_id)))

    if (currentUser) {
      db.audit_logs = db.audit_logs || []
      db.audit_logs.push({
        id: randomUUID(),
        user_id: currentUser.id,
        user_name: currentUser.name,
        action: 'CLEAR_MONTHLY_SCHEDULE_LOCAL',
        details: { month, year, unit_id: unitId, roster_count: rosterIds.length, startDate, endDate },
        created_at: new Date().toISOString()
      })
    }

    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  try {
    const supabase = createClient()

    let rosterQuery = supabase
      .from('monthly_rosters')
      .select('id')
      .eq('month', month)
      .eq('year', year)

    if (unitId) rosterQuery = rosterQuery.eq('unit_id', unitId)
    else rosterQuery = rosterQuery.is('unit_id', null)

    const { data: rostersToDelete, error: rosterError } = await rosterQuery
    if (rosterError && rosterError.code !== 'PGRST116') throw rosterError

    const rosterIds = (rostersToDelete || []).map((r: any) => r.id)

    if (rosterIds.length > 0) {
      // 1. Delete shifts linked to these rosters (Safe Deletion)
      const { error: deleteShiftsError } = await supabase
        .from('shifts')
        .delete()
        .in('roster_id', rosterIds)
      
      if (deleteShiftsError) throw deleteShiftsError

      // 2. Delete the rosters themselves
      const { error: deleteRosterError } = await supabase
        .from('monthly_rosters')
        .delete()
        .in('id', rosterIds)

      if (deleteRosterError) throw deleteRosterError
    }

    let deleteMetadata = supabase
      .from('monthly_schedule_metadata')
      .delete()
      .eq('month', month)
      .eq('year', year)

    if (unitId) deleteMetadata = deleteMetadata.eq('unit_id', unitId)
    else deleteMetadata = deleteMetadata.is('unit_id', null)

    const { error: metadataError } = await deleteMetadata
    if (metadataError) throw metadataError

    if (currentUser) {
      supabase.from('audit_logs').insert({
        user_id: currentUser.id,
        user_name: currentUser.name,
        action: 'CLEAR_MONTHLY_SCHEDULE',
        details: { month, year, unit_id: unitId, roster_count: rosterIds.length, startDate, endDate }
      }).then(() => {})
    }

    revalidatePath('/')
    return { success: true }
  } catch (e: any) {
    console.error('Error clearing monthly schedule:', e)
    return { success: false, message: e.message || 'Erro ao excluir escala do mês' }
  }
}

export async function clearAllDatabaseShifts() {
  try {
    await checkAdmin()
    const supabase = createClient()
    
    if (isLocalMode()) {
        const db = readDb()
        db.shifts = []
        db.monthly_rosters = []
        db.absences = []
        db.monthly_schedule_metadata = []
        db.audit_logs = db.audit_logs || []
        db.audit_logs.push({
            id: randomUUID(),
            user_id: 'system',
            user_name: 'Limpeza Total',
            action: 'CLEAR_ALL_DATABASE',
            details: { message: 'Banco de dados de escala resetado pelo usuário' },
            created_at: new Date().toISOString()
        })
        writeDb(db)
        revalidatePath('/')
        return { success: true, message: 'Todo o banco de dados de escala foi limpo com sucesso.' }
    }

    // SUPABASE MODE
    // 1. Delete all shifts
    const { error: shiftsError } = await supabase.from('shifts').delete().neq('id', '00000000-0000-0000-0000-000000000000') // Deletes everything
    if (shiftsError) throw shiftsError

    // 2. Delete all monthly rosters
    const { error: rosterError } = await supabase.from('monthly_rosters').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (rosterError) throw rosterError

    // 3. Delete all metadata
    const { error: metaError } = await supabase.from('monthly_schedule_metadata').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (metaError) throw metaError

    // 4. Delete all absences (optional but often expected in "clear all")
    const { error: absenceError } = await supabase.from('absences').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (absenceError) throw absenceError

    // Log the action
    let user: any = null
    try { user = await checkUser() } catch(e) {}
    if (user) {
        await supabase.from('audit_logs').insert({
            user_id: user.id,
            user_name: user.name,
            action: 'CLEAR_ALL_DATABASE',
            details: { message: 'Reset total do banco solicitado' }
        })
    }

    revalidatePath('/')
    return { success: true, message: 'Todo o banco de dados de escala foi limpo com sucesso.' }
  } catch (e: any) {
    console.error('Error in clearAllDatabaseShifts:', e)
    return { success: false, message: 'Erro ao limpar banco: ' + e.message }
  }
}

export async function clearSectionRoster(month: number, year: number, unitId: string | null, sectionId: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()

    const rosterToDelete = db.monthly_rosters.filter((r: any) => 
        r.month === month && 
        r.year === year && 
        (unitId ? r.unit_id === unitId : !r.unit_id) &&
        r.section_id === sectionId
    )
    const rosterIds = rosterToDelete.map((r: any) => r.id)

    if (rosterIds.length === 0) return { success: true }

    db.monthly_rosters = db.monthly_rosters.filter((r: any) => !rosterIds.includes(r.id))

    db.shifts = db.shifts.filter((s: any) => {
      if (s.roster_id && rosterIds.includes(s.roster_id)) return false
      return true
    })

    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  try {
    const supabase = createClient()

    let rosterQuery = supabase
      .from('monthly_rosters')
      .select('id')
      .eq('month', month)
      .eq('year', year)
      .eq('section_id', sectionId)

    if (unitId) rosterQuery = rosterQuery.eq('unit_id', unitId)
    else rosterQuery = rosterQuery.is('unit_id', null)

    const { data: rosterItems, error: rosterError } = await rosterQuery
    if (rosterError) throw rosterError

    const rosterIds = rosterItems?.map(r => r.id) || []

    if (rosterIds.length > 0) {
        const { error: shiftsError } = await supabase
            .from('shifts')
            .delete()
            .in('roster_id', rosterIds)
        if (shiftsError) throw shiftsError

        const { error: deleteError } = await supabase
            .from('monthly_rosters')
            .delete()
            .in('id', rosterIds)
        if (deleteError) throw deleteError
    }

    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    console.error('Error clearing section roster:', error)
    return { success: false, message: error.message }
  }
}

export async function clearAllUnitRosters(unitId: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    
    // Find ALL rosters for this unit
    const rostersToDelete = db.monthly_rosters.filter((r: any) => r.unit_id === unitId)
    const rosterIds = rostersToDelete.map((r: any) => r.id)

    if (rosterIds.length === 0) return { success: true, message: 'Nenhuma escala encontrada.' }

    // Delete shifts linked to these rosters
    db.shifts = db.shifts.filter((s: any) => {
      if (s.roster_id && rosterIds.includes(s.roster_id)) return false
      return true
    })

    // Delete rosters
    db.monthly_rosters = db.monthly_rosters.filter((r: any) => !rosterIds.includes(r.id))

    // Delete metadata
    if (db.monthly_schedule_metadata) {
        db.monthly_schedule_metadata = db.monthly_schedule_metadata.filter((m: any) => m.unit_id !== unitId)
    }

    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  try {
    const supabase = createClient()
    
    // 1. Get all roster IDs for unit
    const { data: rosters, error: rosterError } = await supabase
        .from('monthly_rosters')
        .select('id')
        .eq('unit_id', unitId)
    
    if (rosterError) throw rosterError

    const rosterIds = rosters?.map((r: any) => r.id) || []

    if (rosterIds.length > 0) {
        // 2. Delete shifts
        const { error: deleteShiftsError } = await supabase
            .from('shifts')
            .delete()
            .in('roster_id', rosterIds)
        
        if (deleteShiftsError) throw deleteShiftsError

        // 3. Delete rosters
        const { error: deleteRostersError } = await supabase
            .from('monthly_rosters')
            .delete()
            .in('id', rosterIds)
        
        if (deleteRostersError) throw deleteRostersError
    }

    // 4. Delete metadata
    const { error: metadataError } = await supabase
        .from('monthly_schedule_metadata')
        .delete()
        .eq('unit_id', unitId)

    if (metadataError) throw metadataError

    revalidatePath('/')
    return { success: true }
  } catch (e: any) {
    console.error('Error clearing all unit rosters:', e)
    return { success: false, message: e.message || 'Erro ao excluir todas as escalas do setor' }
  }
}

export async function getReleasedSchedules() {
  try {
    if (isLocalMode()) {
      const db = readDb()
      const releases = db.monthly_schedule_metadata
        .filter(m => m.is_released)
        .map(m => {
          const unit = db.units.find(u => u.id === m.unit_id)
          return {
            ...m,
            unit_name: unit ? unit.title : 'Unknown Unit'
          }
        })
        .sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year
            return b.month - a.month
        })
      return releases
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('monthly_schedule_metadata')
      .select('id,month,year,unit_id,is_released,released_at,footer_text,units(title)')
      .eq('is_released', true)
      .order('year', { ascending: false })
      .order('month', { ascending: false })

    if (error) throw error
    
    return data.map((d: any) => ({
      id: d.id,
      month: d.month,
      year: d.year,
      unit_id: d.unit_id,
      is_released: d.is_released,
      released_at: d.released_at,
      footer_text: d.footer_text,
      unit_name: d.units?.title
    }))
  } catch (error) {
    console.error('Error fetching released schedules:', error)
    return []
  }
}

export async function assignNurseToRoster(
  nurseId: string, 
  sectionId: string, 
  unitId: string | null, 
  month: number, 
  year: number, 
  observation?: string, 
  createdAt?: string,
  allowDuplicate: boolean = false,
  listOrder?: number | null,
  skipRevalidate: boolean = false
) {
  try {
    await checkScaleEditor(unitId)
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  // Only update the specific month (no propagation)
  const monthsToUpdate = [month]
  let lastInsertedId: string | undefined = undefined

  if (isLocalMode()) {
    const db = readDb()
    if (!db.monthly_rosters) db.monthly_rosters = []
    
    monthsToUpdate.forEach(m => {
        // Check if already in roster for this month AND unit (update or insert)
        const existingIndex = db.monthly_rosters.findIndex((r: any) => 
            r.nurse_id === nurseId && 
            r.month === m && 
            r.year === year &&
            (unitId ? r.unit_id === unitId : !r.unit_id)
        )
        
        let finalOrder = listOrder
        if (finalOrder === undefined || finalOrder === null) {
            // Find max list_order in this section/month/unit to put at the end
            const currentRoster = db.monthly_rosters.filter((r: any) => 
                r.section_id === sectionId && 
                r.month === m && 
                r.year === year &&
                (unitId ? r.unit_id === unitId : !r.unit_id)
            )
            if (currentRoster.length > 0) {
                const maxOrder = Math.max(...currentRoster.map((r: any) => r.list_order || 0))
                finalOrder = maxOrder + 1
            } else {
                finalOrder = 1
            }
        }

        if (existingIndex !== -1 && !allowDuplicate) {
          db.monthly_rosters[existingIndex].section_id = sectionId
          db.monthly_rosters[existingIndex].unit_id = unitId
          if (observation !== undefined) db.monthly_rosters[existingIndex].observation = observation
          if (createdAt) db.monthly_rosters[existingIndex].created_at = createdAt
          if (finalOrder !== undefined) db.monthly_rosters[existingIndex].list_order = finalOrder
          lastInsertedId = db.monthly_rosters[existingIndex].id
        } else {
          const newId = randomUUID()
          db.monthly_rosters.push({
            id: newId,
            nurse_id: nurseId,
            section_id: sectionId,
            unit_id: unitId,
            month: m,
            year,
            observation: observation || '',
            created_at: createdAt || new Date().toISOString(),
            list_order: finalOrder
          })
          lastInsertedId = newId
        }
    })

    writeDb(db)
    if (!skipRevalidate) revalidatePath('/')
    return { success: true, rosterId: lastInsertedId }
  }

  const supabase = createClient()
  let warningMsg: string | undefined = undefined;
  
  try {
  for (const m of monthsToUpdate) {
    // Check if exists first to decide whether to clear shifts
    let query = supabase
        .from('monthly_rosters')
        .select('id')
        .eq('nurse_id', nurseId)
        .eq('month', m)
        .eq('year', year)
    
    if (unitId) query = query.eq('unit_id', unitId)
    else query = query.is('unit_id', null)

    const { data: existing } = await query.maybeSingle()

    // Check for CONFLICT in OTHER units (Warning generation)
    if (!existing) {
        let conflictQuery = supabase
            .from('monthly_rosters')
            .select('units(title)')
            .eq('nurse_id', nurseId)
            .eq('month', m)
            .eq('year', year)
        
        if (unitId) conflictQuery = conflictQuery.neq('unit_id', unitId)
        else conflictQuery = conflictQuery.not('unit_id', 'is', null)

        const { data: conflict, error: conflictError } = await conflictQuery.maybeSingle()
        
        if (!conflictError && conflict) {
             const conflictUnitName = (conflict as any).units?.title || 'Outro Setor'
             warningMsg = `Atenção: Este profissional já possui vínculo no setor "${conflictUnitName}".`
        }
    }

    const payload: any = {
        nurse_id: nurseId, 
        section_id: sectionId, 
        unit_id: unitId, 
        month: m, 
        year 
    }
    
    let finalOrder = listOrder
    if (finalOrder === undefined || finalOrder === null) {
        // Find max list_order in this section/month/unit to put at the end
        let maxQuery = supabase
            .from('monthly_rosters')
            .select('list_order')
            .eq('section_id', sectionId)
            .eq('month', m)
            .eq('year', year)
        
        if (unitId) maxQuery = maxQuery.eq('unit_id', unitId)
        else maxQuery = maxQuery.is('unit_id', null)
        
        const { data: maxData } = await maxQuery.order('list_order', { ascending: false }).limit(1)
        if (maxData && maxData.length > 0) {
            finalOrder = (maxData[0].list_order || 0) + 1
        } else {
            finalOrder = 1
        }
    }

    if (observation !== undefined) payload.observation = observation
    if (createdAt) payload.created_at = createdAt
    if (finalOrder !== undefined) payload.list_order = finalOrder

    let error;
    let resultId: string | undefined = undefined

    if (allowDuplicate) {
        // If allowing duplicates, always insert a new record
        const { data: inserted, error: insertError } = await supabase
            .from('monthly_rosters')
            .insert(payload)
            .select('id')
            .single()
        error = insertError
        resultId = inserted?.id
    } else {
        if (existing) {
            // Update existing in THIS unit
            const { error: updateError } = await supabase
                .from('monthly_rosters')
                .update(payload)
                .eq('id', existing.id)
            error = updateError
            resultId = existing.id
        } else {
            // Insert new for THIS unit (even if nurse exists in other units)
            const { data: inserted, error: insertError } = await supabase
                .from('monthly_rosters')
                .insert(payload)
                .select('id')
                .single()
            error = insertError
            resultId = inserted?.id
        }
    }

    if (error) {
                console.error('Error adding/updating roster:', error)
                if (error.code === '23505') {
                    const constraint = (error as any).constraint || 'desconhecida'
                    return { success: false, message: `Erro: O sistema bloqueou a duplicidade (Constraint: ${constraint}). Solicite ao suporte para rodar o script V11.` }
                }
                return { success: false, message: error.message }
            }
    
    lastInsertedId = resultId
  }

  if (!skipRevalidate) revalidatePath('/')
  return { success: true, warning: warningMsg, rosterId: lastInsertedId }
  } catch (err: any) {
      console.error('Unhandled error in assignNurseToRoster:', err)
      return { success: false, message: `Erro ao processar: ${err.message || 'Erro desconhecido'}` }
  }
}

export async function removeNurseFromRoster(nurseId: string, month: number, year: number) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    if (db.monthly_rosters) {
        // Remove only from current month
        db.monthly_rosters = db.monthly_rosters.filter(r => !(r.nurse_id === nurseId && r.year === year && r.month === month))
        writeDb(db)
    }
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('monthly_rosters')
    .delete()
    .eq('nurse_id', nurseId)
    .eq('year', year)
    .eq('month', month)

  if (error) return { success: false, message: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function removeRosterEntry(rosterId: string) {
  try {
    const unitId = await getUnitIdByRosterId(rosterId)
    await checkScaleEditor(unitId)
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    if (db.monthly_rosters) {
        // DELETE SHIFTS FIRST
        db.shifts = (db.shifts || []).filter((s: any) => s.roster_id !== rosterId)
        // THEN DELETE ROSTER ENTRY
        db.monthly_rosters = db.monthly_rosters.filter(r => r.id !== rosterId)
        writeDb(db)
    }
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  
  // DELETE SHIFTS FIRST TO AVOID FK CONSTRAINTS
  const { error: shiftsError } = await supabase
    .from('shifts')
    .delete()
    .eq('roster_id', rosterId)
  
  if (shiftsError) {
      console.error('Error deleting shifts before removing professional:', shiftsError)
      return { success: false, message: shiftsError.message }
  }

  const { error } = await supabase
    .from('monthly_rosters')
    .delete()
    .eq('id', rosterId)

  if (error) return { success: false, message: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function copyMonthlyRoster(sourceMonth: number, sourceYear: number, targetMonth: number, targetYear: number, unitId?: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const computeInterval = (days: number[]) => {
    if (!days || days.length < 2) return null
    const diffs: number[] = []
    for (let i = 1; i < days.length; i++) {
      const diff = days[i] - days[i - 1]
      if (diff <= 0) return null
      diffs.push(diff)
    }
    const base = diffs[0]
    for (let i = 1; i < diffs.length; i++) {
      if (diffs[i] !== base) return null
    }
    return base
  }

  const dayMs = 24 * 60 * 60 * 1000

  if (isLocalMode()) {
    const db = readDb()
    if (!db.monthly_rosters) db.monthly_rosters = []

    const sourceRoster = db.monthly_rosters.filter(r => r.month === sourceMonth && r.year === sourceYear && (!unitId || r.unit_id === unitId))
    
    // 1. Calculate projected shifts for all professionals first to determine order
    const projections = sourceRoster.map(sr => {
        // Project shifts based on 6-day cycle: D -> N -> 4 off
        const nurseShifts = db.shifts.filter(s => s.nurse_id === sr.nurse_id)
        let projectedShifts: { date: string, type: string, day: number }[] = []
        let firstWorkDay = 999
        let hasNightOnDay1 = false

        if (nurseShifts.length > 0) {
            const sourceLastDayFull = new Date(Date.UTC(sourceYear, sourceMonth, 0, 23, 59, 59)).getTime()
            const sorted = nurseShifts
              .map(s => {
                const parts = String(s.shift_date).split('-')
                const y = parseInt(parts[0], 10)
                const m = parseInt(parts[1], 10)
                const d = parseInt(parts[2], 10)
                const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
                return { raw: s, date, time: date.getTime() }
              })
              .filter(x => !Number.isNaN(x.time) && x.time <= sourceLastDayFull)
              .sort((a, b) => b.time - a.time)

            if (sorted.length > 0) {
                const anchor = sorted[0]
                const anchorDate = anchor.date
                const anchorType = anchor.raw.shift_type

                const isNight = (type: string) => type === 'night' || type === 'dn'
                const anchorPos = isNight(anchorType) ? 1 : 0 // 0=D, 1=N, 2,3,4,5=Off (6-day cycle)
                const targetLastDay = new Date(targetYear, targetMonth, 0).getDate()

                for (let d = 1; d <= targetLastDay; d++) {
                  const targetDate = new Date(Date.UTC(targetYear, targetMonth - 1, d, 12, 0, 0))
                  const diffDays = Math.round((targetDate.getTime() - anchorDate.getTime()) / dayMs)
                  if (diffDays <= 0) continue

                  const cyclePos = (anchorPos + diffDays) % 6
                  const finalPos = cyclePos < 0 ? cyclePos + 6 : cyclePos

                  if (finalPos === 0 || finalPos === 1) {
                    const shiftType = (finalPos === 0) ? 'day' : 'night'
                    projectedShifts.push({
                      date: `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
                      type: shiftType,
                      day: d
                    })
                    if (d < firstWorkDay) firstWorkDay = d
                    if (d === 1 && finalPos === 1) hasNightOnDay1 = true
                  }
                }
            }
        }

        // Sort Key: Night on Day 1 comes first (Key 0), then by first day of work
        const sortKey = hasNightOnDay1 ? 0 : firstWorkDay

        return {
            source: sr,
            projectedShifts,
            sortKey
        }
    })

    // 2. Sort by projected pattern (staircase)
    projections.sort((a, b) => a.sortKey - b.sortKey)

    // 3. Create target rosters and shifts in new order
    let addedCount = 0
    projections.forEach((p, idx) => {
        const sr = p.source
        const targetRoster = {
            id: randomUUID(),
            nurse_id: sr.nurse_id,
            section_id: sr.section_id,
            unit_id: sr.unit_id,
            month: targetMonth,
            year: targetYear,
            observation: sr.observation || '',
            sector: sr.sector || '',
            list_order: idx + 1, // New sequential order based on staircase
            created_at: new Date().toISOString()
        }
        db.monthly_rosters.push(targetRoster)
        addedCount++

        p.projectedShifts.forEach(ps => {
            db.shifts.push({
                id: randomUUID(),
                nurse_id: sr.nurse_id,
                shift_date: ps.date,
                shift_type: ps.type,
                updated_at: new Date().toISOString(),
                roster_id: targetRoster.id
            })
        })
    })
    
    writeDb(db)
    revalidatePath('/')
    return { success: true, message: `${addedCount} servidores copiados seguindo o padrão visual.` }
  }

  const supabase = createClient()
  
  // Fetch source
  let query = supabase.from('monthly_rosters').select('*').eq('month', sourceMonth).eq('year', sourceYear)
  if (unitId) query = query.eq('unit_id', unitId)
  
  const { data: sourceRoster, error: fetchError } = await query
  
  if (fetchError) return { success: false, message: fetchError.message }
  if (!sourceRoster || sourceRoster.length === 0) return { success: true, message: 'Nenhum servidor encontrado no mês de origem.' }

  // Fetch source shifts
  const nurseIds = sourceRoster.map(r => r.nurse_id)
  const sourceStartDate = `${sourceYear}-${String(sourceMonth).padStart(2, '0')}-01`
  const sourceLastDay = new Date(sourceYear, sourceMonth, 0).getDate()
  const sourceEndDate = `${sourceYear}-${String(sourceMonth).padStart(2, '0')}-${sourceLastDay}`

  const { data: sourceShifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('*')
      .in('nurse_id', nurseIds)
      .gte('date', sourceStartDate)
      .lte('date', sourceEndDate)
      
  if (shiftsError) return { success: false, message: shiftsError.message }

  const shiftsByRosterId: Record<string, any[]> = {}
  const shiftsByNurseIdLegacy: Record<string, any[]> = {}

  if (sourceShifts) {
      sourceShifts.forEach(s => {
          if (s.roster_id) {
              if (!shiftsByRosterId[s.roster_id]) shiftsByRosterId[s.roster_id] = []
              shiftsByRosterId[s.roster_id].push(s)
          } else {
              if (!shiftsByNurseIdLegacy[s.nurse_id]) shiftsByNurseIdLegacy[s.nurse_id] = []
              shiftsByNurseIdLegacy[s.nurse_id].push(s)
          }
      })
  }

  // 2. Pre-calculate projections to determine order (staircase pattern)
  const targetLastDay = new Date(targetYear, targetMonth, 0).getDate()
  const processedLegacyNurses = new Set<string>()
  const projections = []

  for (const sourceEntry of sourceRoster) {
      let myShifts = shiftsByRosterId[sourceEntry.id] || []
      if (!processedLegacyNurses.has(sourceEntry.nurse_id) && shiftsByNurseIdLegacy[sourceEntry.nurse_id]) {
          myShifts = [...myShifts, ...shiftsByNurseIdLegacy[sourceEntry.nurse_id]]
          processedLegacyNurses.add(sourceEntry.nurse_id)
      }

      let firstWorkDay = 999
      let hasNightOnDay1 = false
      const shiftsToInsert = []

      if (myShifts.length > 0) {
          const sourceLastDayFull = new Date(Date.UTC(sourceYear, sourceMonth, 0, 23, 59, 59)).getTime()
          const sorted = myShifts
            .map(s => {
              const parts = String(s.date).split('-')
              const y = parseInt(parts[0], 10)
              const m = parseInt(parts[1], 10)
              const d = parseInt(parts[2], 10)
              const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
              return { raw: s, date, time: date.getTime() }
            })
            .filter(x => !Number.isNaN(x.time) && x.time <= sourceLastDayFull)
            .sort((a, b) => b.time - a.time)

          if (sorted.length > 0) {
            const anchor = sorted[0]
            const anchorDate = anchor.date
            const anchorType = anchor.raw.type

            const isNight = (type: string) => type === 'night' || type === 'dn'
            const anchorPos = isNight(anchorType) ? 1 : 0 // 6-day cycle: 0=D, 1=N, 2,3,4,5=Off

            for (let d = 1; d <= targetLastDay; d++) {
              const targetDate = new Date(Date.UTC(targetYear, targetMonth - 1, d, 12, 0, 0))
              const diffDays = Math.round((targetDate.getTime() - anchorDate.getTime()) / dayMs)
              if (diffDays <= 0) continue

              const cyclePos = (anchorPos + diffDays) % 6
              const finalPos = cyclePos < 0 ? cyclePos + 6 : cyclePos

              if (finalPos === 0 || finalPos === 1) {
                const shiftType = (finalPos === 0) ? 'day' : 'night'
                const dateStr = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
                
                shiftsToInsert.push({
                  nurse_id: sourceEntry.nurse_id,
                  date: dateStr,
                  type: shiftType
                })
                if (d < firstWorkDay) firstWorkDay = d
                if (d === 1 && finalPos === 1) hasNightOnDay1 = true
              }
            }
          }
      }

      const sortKey = hasNightOnDay1 ? 0 : firstWorkDay
      projections.push({
          source: sourceEntry,
          shiftsToInsert,
          sortKey
      })
  }

  // 3. Sort projections by staircase pattern
  projections.sort((a, b) => a.sortKey - b.sortKey)

  // 4. Insert sequentially to preserve order
  let addedCount = 0
  for (let i = 0; i < projections.length; i++) {
      const p = projections[i]
      const sourceEntry = p.source
      
      const targetEntry = {
          nurse_id: sourceEntry.nurse_id,
          section_id: sourceEntry.section_id,
          unit_id: sourceEntry.unit_id,
          month: targetMonth,
          year: targetYear,
          observation: sourceEntry.observation || null,
          sector: sourceEntry.sector || null,
          list_order: i + 1, // New sequential order
          created_at: new Date().toISOString()
      }

      const { data: insertedRoster, error: insertError } = await supabase
          .from('monthly_rosters')
          .insert(targetEntry)
          .select()
          .single()
      
      if (insertError) continue
      addedCount++

      if (p.shiftsToInsert.length > 0) {
          const finalShifts = p.shiftsToInsert.map(s => ({
              ...s,
              roster_id: insertedRoster.id
          }))
          await supabase.from('shifts').insert(finalShifts)
      }
  }
  
  revalidatePath('/')
  return { success: true, message: `${addedCount} servidores copiados com sucesso.` }
}

export async function getNurseSectorHistory(nurseId: string) {
  if (isLocalMode()) {
    const db = readDb()
    return db.monthly_rosters
      .filter(r => r.nurse_id === nurseId && r.sector)
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        return b.month - a.month
      })
      .map(r => ({
        month: r.month,
        year: r.year,
        sector: r.sector
      }))
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('monthly_rosters')
    .select('month, year, sector')
    .eq('nurse_id', nurseId)
    .not('sector', 'is', null)
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) return []
  return data || []
}

export async function updateRosterObservation(rosterId: string, observation: string) {
  try {
    const unitId = await getUnitIdByRosterId(rosterId)
    await checkScaleEditor(unitId)
    
    if (isLocalMode()) {
      const db = readDb()
      const roster = db.monthly_rosters.find(r => r.id === rosterId)
      if (roster) {
        roster.observation = observation
        writeDb(db)
        revalidatePath('/')
        return { success: true }
      }
      return { success: false, message: 'Roster entry not found' }
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('monthly_rosters')
      .update({ observation })
      .eq('id', rosterId)

    if (error) throw error
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    console.error('Error updating observation:', e)
    return { success: false, message: 'Erro ao atualizar observação' }
  }
}

export async function updateRosterSector(rosterId: string, sector: string) {
  try {
    const unitId = await getUnitIdByRosterId(rosterId)
    await checkScaleEditor(unitId)
    
    if (isLocalMode()) {
      const db = readDb()
      const roster = db.monthly_rosters.find(r => r.id === rosterId)
      if (roster) {
        roster.sector = sector
        
        // Also update the nurse's current sector if this is the most recent roster
        const nurse = db.nurses.find(n => n.id === roster.nurse_id)
        if (nurse) {
          // Check if this roster is for the current month or future
          const now = new Date()
          const currentMonth = now.getMonth() + 1
          const currentYear = now.getFullYear()
          
          if (roster.year > currentYear || (roster.year === currentYear && roster.month >= currentMonth)) {
            nurse.sector = sector
          }
        }

        writeDb(db)
        revalidatePath('/')
        return { success: true }
      }
      return { success: false, message: 'Roster entry not found' }
    }

    const supabase = createClient()
    
    // 1. Get roster info to know the nurse and date
    const { data: rosterData } = await supabase
      .from('monthly_rosters')
      .select('nurse_id, month, year')
      .eq('id', rosterId)
      .single()

    const { error } = await supabase
      .from('monthly_rosters')
      .update({ sector })
      .eq('id', rosterId)

    if (error) throw error

    // 2. Update nurse's current sector if it's the latest roster
    if (rosterData) {
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()

      if (rosterData.year > currentYear || (rosterData.year === currentYear && rosterData.month >= currentMonth)) {
        await supabase
          .from('nurses')
          .update({ sector })
          .eq('id', rosterData.nurse_id)
      }
    }

    revalidatePath('/')
    return { success: true }
  } catch (e) {
    console.error('Error updating sector:', e)
    return { success: false, message: 'Erro ao atualizar setor' }
  }
}

export async function updateRosterCoren(rosterId: string, coren: string) {
  try {
    const unitId = await getUnitIdByRosterId(rosterId)
    await checkScaleEditor(unitId)
    
    if (isLocalMode()) {
      const db = readDb()
      const roster = db.monthly_rosters.find(r => r.id === rosterId)
      if (roster) {
        roster.coren = coren
        
        // Also update the nurse's base profile COREN
        const nurse = db.nurses.find(n => n.id === roster.nurse_id)
        if (nurse) {
          nurse.coren = coren
        }

        writeDb(db)
        revalidatePath('/')
        return { success: true }
      }
      return { success: false, message: 'Roster entry not found' }
    }

    const supabase = createClient()
    
    // 1. Get roster info to know the nurse
    const { data: rosterData } = await supabase
      .from('monthly_rosters')
      .select('nurse_id')
      .eq('id', rosterId)
      .single()

    // 2. Update roster entry COREN
    const { error: rosterError } = await supabase
      .from('monthly_rosters')
      .update({ coren })
      .eq('id', rosterId)

    if (rosterError) throw rosterError

    // 3. Update nurse's base profile COREN
    if (rosterData) {
      const { error: nurseError } = await supabase
          .from('nurses')
          .update({ coren })
          .eq('id', rosterData.nurse_id)
      if (nurseError) console.error('Error updating nurse base coren:', nurseError)
    }

    revalidatePath('/')
    return { success: true }
  } catch (e) {
    console.error('Error updating coren:', e)
    return { success: false, message: 'Erro ao atualizar COREN' }
  }
}

export async function updateRosterOrder(rosterId: string, listOrder: number | null) {
  try {
    const unitId = await getUnitIdByRosterId(rosterId)
    await checkScaleEditor(unitId)

    if (isLocalMode()) {
      const db = readDb()
      const roster = db.monthly_rosters.find(r => r.id === rosterId)
      if (roster) {
        roster.list_order = listOrder
        writeDb(db)
        revalidatePath('/')
        return { success: true }
      }
      return { success: false, message: 'Roster entry not found' }
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('monthly_rosters')
      .update({ list_order: listOrder })
      .eq('id', rosterId)

    if (error) throw error
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    console.error('Error updating list order:', e)
    return { success: false, message: 'Erro ao atualizar numeração' }
  }
}

export async function resetSectionOrder(sectionId: string, unitId: string | null, month: number, year: number, startRosterId?: string, orderedRosterIds?: string[], startNumber: number = 1) {
  try {
    if (unitId === 'ALL') {
      await checkAdmin()
    } else {
      await checkScaleEditor(unitId)
    }

    if (isLocalMode()) {
      const db = readDb()
      let candidates = db.monthly_rosters
        .filter(r => r.section_id === sectionId && r.month === month && r.year === year && (unitId === 'ALL' ? true : (unitId ? r.unit_id === unitId : !r.unit_id)))
      
      if (orderedRosterIds && orderedRosterIds.length > 0) {
        // Explicitly construct sorted list based on orderedRosterIds
        const candidateMap = new Map(candidates.map(d => [d.id, d]))
        const newSorted = []

        // 1. Add items present in orderedRosterIds
        for (const id of orderedRosterIds) {
          if (candidateMap.has(id)) {
            newSorted.push(candidateMap.get(id)!)
            candidateMap.delete(id)
          }
        }

        // 2. Append any remaining items
        const remaining = Array.from(candidateMap.values())
        remaining.sort((a, b) => {
            const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
            const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
            return aTime - bTime
        })

        candidates = [...newSorted, ...remaining]
      } else {
        candidates.sort((a, b) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
          return aTime - bTime
        })
      }

      let startIndex = 0
      if (startRosterId) {
        const idx = candidates.findIndex(r => r.id === startRosterId)
        if (idx >= 0) {
          startIndex = idx
        } else {
           // If startRosterId is provided but not found, abort
           return { success: false, message: 'Item não encontrado na escala para iniciar a renumeração.' }
        }
      }

      // Track currentMax to ensure strictly increasing sequence
      let currentMax = 0
      let resetBase = 0

      for (let i = 0; i < candidates.length; i++) {
          const r = candidates[i]
          let newOrder = 0

          if (i < startIndex) {
             // For items before the reset point
             if (r.list_order != null) {
                 if (r.list_order <= currentMax) {
                     newOrder = currentMax + 1
                 } else {
                     newOrder = r.list_order
                 }
             } else {
                 const targetDisplay = i + 1
                 const group = Math.floor(currentMax / 10000)
                 let candidate = group * 10000 + targetDisplay
                 while (candidate <= currentMax) candidate += 10000
                 newOrder = candidate
             }
          } else if (i === startIndex) {
             // The Reset Point: Start a new group
             const nextGroupBase = (Math.floor(currentMax / 10000) + 1) * 10000
             newOrder = nextGroupBase + startNumber
             resetBase = nextGroupBase
          } else {
             // i > startIndex: Strictly sequential from resetBase
             newOrder = resetBase + startNumber + (i - startIndex)
          }

          r.list_order = newOrder
          currentMax = newOrder
      }

      writeDb(db)
      revalidatePath('/')
      return { success: true }
    }

    const supabase = createClient()

    let query = supabase
      .from('monthly_rosters')
      .select('*, nurse:nurses(name)')
      .eq('section_id', sectionId)
      .eq('month', month)
      .eq('year', year)
    
    if (unitId !== 'ALL') {
      if (unitId) {
        query = query.eq('unit_id', unitId)
      } else {
        query = query.is('unit_id', null)
      }
    }

    const { data, error } = await query
    if (error) throw error

    // If we have orderedRosterIds, verify that all are present.
    // If some are missing (especially if one was just inserted), retry once after a short delay.
    let finalData = data || []
    if (orderedRosterIds && orderedRosterIds.length > 0) {
        const foundIds = new Set(finalData.map(d => d.id))
        const missing = orderedRosterIds.filter(id => !foundIds.has(id))
        
        if (missing.length > 0) {
            console.log(`resetSectionOrder: Missing ${missing.length} IDs. Retrying after 800ms...`)
            await new Promise(resolve => setTimeout(resolve, 800))
            const { data: retryData, error: retryError } = await query
            if (!retryError && retryData) {
                finalData = retryData
            }
        }
    }

    let sorted: any[] = []
    if (orderedRosterIds && orderedRosterIds.length > 0) {
      // Explicitly construct sorted list based on orderedRosterIds
      const candidateMap = new Map(finalData.map(d => [d.id, d]))
      
      // 1. Add items present in orderedRosterIds
      for (const id of orderedRosterIds) {
        if (candidateMap.has(id)) {
          sorted.push(candidateMap.get(id))
          candidateMap.delete(id)
        }
      }
      
      // 2. Append any remaining items (not in orderedRosterIds)
      // These will be sorted by created_at/name/id as fallback
      const remaining = Array.from(candidateMap.values())
      remaining.sort((a: any, b: any) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
          if (aTime !== bTime) return aTime - bTime
          return (a.id || '').localeCompare(b.id || '')
      })
      
      sorted = [...sorted, ...remaining]
      
      console.log('Explicitly Sorted Candidates:', sorted.map((s: any) => `${s.nurse?.name} (${s.list_order})`).join(', '))
    } else {
      // Fallback: Always sort by created_at -> name -> id to match frontend "Chronological" order
      sorted = data || []
      sorted.sort((a: any, b: any) => {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
          if (aTime !== bTime) return aTime - bTime
          
          const nameA = a.nurse?.name || ''
          const nameB = b.nurse?.name || ''
          const nameCompare = nameA.localeCompare(nameB)
          if (nameCompare !== 0) return nameCompare
          
          return (a.id || '').localeCompare(b.id || '')
      })
    }

    let startIndex = 0
    if (startRosterId) {
      const idx = sorted.findIndex((r: any) => r.id === startRosterId)
      if (idx >= 0) {
        startIndex = idx
      } else {
        // If startRosterId is provided but not found, abort to avoid resetting the whole list accidentally
        return { success: false, message: 'Item não encontrado na escala para iniciar a renumeração.' }
      }
    }

    // Track currentMax to ensure strictly increasing sequence
    let currentMax = 0
    let resetBase = 0
    const updates = []

    for (let i = 0; i < sorted.length; i++) {
        const r = sorted[i]
        let newOrder = 0

        if (i < startIndex) {
            // For items before the reset point
            if (r.list_order != null) {
                // Keep existing order if possible, but ensure strictly increasing if needed
                if (r.list_order <= currentMax) {
                    newOrder = currentMax + 1
                } else {
                    newOrder = r.list_order
                }
            } else {
                // If null, materialize it to preserve visual order (index + 1)
                // We try to find a value that displays as (i+1) but is > currentMax
                // Display = val % 10000. Target = i + 1.
                const targetDisplay = i + 1
                const group = Math.floor(currentMax / 10000)
                let candidate = group * 10000 + targetDisplay
                
                // Ensure candidate > currentMax
                while (candidate <= currentMax) {
                    candidate += 10000
                }
                newOrder = candidate
            }
        } else if (i === startIndex) {
            // The Reset Point: Start a new group
            const nextGroupBase = (Math.floor(currentMax / 10000) + 1) * 10000
            newOrder = nextGroupBase + startNumber
            resetBase = nextGroupBase
        } else {
            // i > startIndex: Strictly sequential from resetBase
            newOrder = resetBase + startNumber + (i - startIndex)
        }

        // Update if changed or if it was null
        if (r.list_order !== newOrder) {
            updates.push({
                id: r.id,
                nurse_id: r.nurse_id,
                section_id: r.section_id,
                unit_id: r.unit_id ?? null,
                month: r.month,
                year: r.year,
                observation: r.observation ?? null,
                sector: r.sector ?? null,
                created_at: r.created_at,
                list_order: newOrder
            })
        }
        
        currentMax = newOrder
    }

    if (updates.length > 0) {
      const { error: updateError } = await supabase
        .from('monthly_rosters')
        .upsert(updates, { onConflict: 'id' })
      if (updateError) throw updateError
    }

    revalidatePath('/')
    return { success: true }
  } catch (e: any) {
    console.error('Error resetting section order:', e)
    const errorMessage = e && typeof e.message === 'string' ? e.message : ''
    return { 
      success: false, 
      message: errorMessage 
        ? `Erro ao reiniciar numeração: ${errorMessage}` 
        : 'Erro ao reiniciar numeração' 
    }
  }
}

export async function updateRosterListOrders(updates: { id: string, list_order: number }[]) {
  try {
    const rosterIds = Array.from(new Set((updates || []).map(u => u.id).filter(Boolean))) as string[]
    if (rosterIds.length === 0) {
      await checkAdmin()
    } else {
      const unitIds: (string | null)[] = []
      for (const rosterId of rosterIds) {
        unitIds.push(await getUnitIdByRosterId(rosterId))
      }
      const uniqueUnitIds = Array.from(new Set(unitIds.map(x => x || ''))).filter(Boolean)
      for (const unitId of uniqueUnitIds) {
        await checkScaleEditor(unitId)
      }
    }
    
    if (isLocalMode()) {
      const db = readDb()
      let changed = false
      updates.forEach(u => {
        const roster = db.monthly_rosters.find(r => r.id === u.id)
        if (roster) {
          roster.list_order = u.list_order
          changed = true
        }
      })
      if (changed) {
        writeDb(db)
        revalidatePath('/')
      }
      return { success: true }
    }
    
    const supabase = createClient()
    
    for (const u of updates) {
      const { error } = await supabase
        .from('monthly_rosters')
        .update({ list_order: u.list_order })
        .eq('id', u.id)
        
      if (error) throw error
    }
    
    revalidatePath('/')
    return { success: true }
  } catch (e: any) {
    console.error('Error updating roster orders:', e)
    return { success: false, message: e.message || 'Erro ao atualizar ordem' }
  }
}

export async function uploadLogo(formData: FormData) {
  return { success: false, message: 'Upload de logo não implementado ainda.' }
}

export async function uploadCityLogo(formData: FormData) {
  return { success: false, message: 'Upload de logo da prefeitura não implementado ainda.' }
}

export async function logout() {
  cookies().delete('session_user')
  redirect('/login')
}

export async function requestTimeOff(prevState: any, formData: FormData) {
  const startDate = formData.get('startDate') as string
  let endDate = formData.get('endDate') as string
  const reason = formData.get('reason') as string
  const nurseIdFromForm = formData.get('nurseId') as string
  
  if (!startDate) return { message: 'Data da folga é obrigatória' }
  if (!endDate) endDate = startDate

  const session = cookies().get('session_user')
  if (!session) return { success: false, message: 'Usuário não autenticado' }
  const user = JSON.parse(session.value)
  const isAdmin = user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'

  const targetNurseId = (isAdmin && nurseIdFromForm) ? nurseIdFromForm : user.id
  const initialStatus = isAdmin ? 'approved' : 'pending'

  if (isLocalMode()) {
    const db = readDb()
    const newRequest = {
      id: randomUUID(),
      nurse_id: targetNurseId,
      start_date: startDate,
      end_date: endDate,
      reason,
      status: initialStatus,
      type: 'folga',
      created_at: new Date().toISOString()
    }
    db.time_off_requests.push(newRequest)
    writeDb(db)
    revalidatePath('/folgas')
    return { success: true, message: 'Solicitação enviada com sucesso (Local)' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('time_off_requests').insert({
    nurse_id: targetNurseId,
    start_date: startDate,
    end_date: endDate,
    reason,
    status: initialStatus,
    type: 'folga'
  })

  if (error) return { message: 'Erro ao solicitar folga: ' + error.message }
  revalidatePath('/folgas')
  return { success: true, message: 'Solicitação enviada com sucesso' }
}

export async function assignLeave(prevState: any, formData: FormData) {
  const nurseId = formData.get('nurseId') as string
  const startDate = formData.get('startDate') as string
  const endDate = formData.get('endDate') as string
  const type = formData.get('type') as string || 'ferias'
  const unitId = formData.get('unitId') as string || null

  try {
    if (unitId) await checkScaleEditor(unitId)
    else await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }
  
  const reasonMap: Record<string, string> = {
    'ferias': 'Férias programadas',
    'licenca_saude': 'Licença Saúde',
    'licenca_maternidade': 'Licença Maternidade',
    'cessao': 'Cessão'
  }

  const reason = reasonMap[type] || 'Ausência'

  if (!nurseId || !startDate || !endDate) {
    return { success: false, message: 'Todos os campos são obrigatórios' }
  }

  if (isLocalMode()) {
    const db = readDb()
    const newRequest: any = {
      id: randomUUID(),
      nurse_id: nurseId,
      start_date: startDate,
      end_date: endDate,
      reason,
      type,
      status: 'approved',
      created_at: new Date().toISOString()
    }
    if (unitId) newRequest.unit_id = unitId
    
    db.time_off_requests.push(newRequest)
    writeDb(db)
    revalidatePath('/')
    return { success: true, message: 'Ausência cadastrada com sucesso (Local)' }
  }

  const supabase = createClient()
  const payload: any = {
    nurse_id: nurseId,
    start_date: startDate,
    end_date: endDate,
    reason,
    type,
    status: 'approved'
  }
  if (unitId) payload.unit_id = unitId

  const { error } = await supabase.from('time_off_requests').insert(payload)

  if (error) return { success: false, message: 'Erro ao cadastrar ausência: ' + error.message }
  revalidatePath('/')
  return { success: true, message: 'Ausência cadastrada com sucesso' }
}

export async function deleteTimeOffRequest(id: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.time_off_requests = db.time_off_requests.filter(r => r.id !== id)
    writeDb(db)
    revalidatePath('/folgas')
    revalidatePath('/dashboard')
    return { success: true, message: 'Solicitação removida com sucesso (Local)' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('time_off_requests').delete().eq('id', id)

  if (error) return { success: false, message: 'Erro ao remover solicitação: ' + error.message }
  revalidatePath('/folgas')
  revalidatePath('/dashboard')
  return { success: true, message: 'Solicitação removida com sucesso' }
}

export async function updateTimeOffRequest(id: string, data: { startDate: string, endDate: string, reason: string }) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    const index = db.time_off_requests.findIndex(r => r.id === id)
    if (index !== -1) {
      db.time_off_requests[index] = { ...db.time_off_requests[index], start_date: data.startDate, end_date: data.endDate, reason: data.reason }
      writeDb(db)
      revalidatePath('/folgas')
      revalidatePath('/dashboard')
      return { success: true, message: 'Solicitação atualizada com sucesso (Local)' }
    }
    return { success: false, message: 'Solicitação não encontrada (Local)' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('time_off_requests').update({
    start_date: data.startDate,
    end_date: data.endDate,
    reason: data.reason
  }).eq('id', id)

  if (error) return { success: false, message: 'Erro ao atualizar solicitação: ' + error.message }
  revalidatePath('/folgas')
  revalidatePath('/')
  return { success: true, message: 'Solicitação atualizada com sucesso' }
}

export async function deleteNurse(id: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.nurses = db.nurses.filter(n => n.id !== id)
    db.shifts = db.shifts.filter(s => s.nurse_id !== id)
    db.time_off_requests = db.time_off_requests.filter(t => t.nurse_id !== id)
    if (db.monthly_rosters) {
        db.monthly_rosters = db.monthly_rosters.filter(r => r.nurse_id !== id)
    }
    if ((db as any).payment_requests) {
      ;(db as any).payment_requests = (db as any).payment_requests.filter((p: any) => p.nurse_id !== id && p.coordinator_id !== id)
    }
    if ((db as any).general_requests) {
      ;(db as any).general_requests = (db as any).general_requests.filter((g: any) => g.nurse_id !== id && g.coordinator_id !== id)
    }
    if ((db as any).shift_swaps) {
      ;(db as any).shift_swaps = (db as any).shift_swaps.filter((s: any) => s.requester_id !== id && s.requested_id !== id)
    }
    if ((db as any).absences) {
      ;(db as any).absences = (db as any).absences.filter((a: any) => a.nurse_id !== id && a.created_by !== id)
    }
    writeDb(db)
    revalidatePath('/')
    return { success: true, message: 'Servidor removido com sucesso (Local)' }
  }

  const supabase = createClient()
  try {
    await supabase.from('payment_requests').update({ coordinator_id: null }).eq('coordinator_id', id)
  } catch (e) {}
  await supabase.from('payment_requests').delete().eq('nurse_id', id)
  await supabase.from('general_requests').delete().eq('nurse_id', id)
  await supabase.from('shift_swaps').delete().or(`requester_id.eq.${id},requested_id.eq.${id}`)
  await supabase.from('absences').delete().eq('nurse_id', id)
  await supabase.from('shifts').delete().eq('nurse_id', id)
  await supabase.from('time_off_requests').delete().eq('nurse_id', id)
  await supabase.from('monthly_rosters').delete().eq('nurse_id', id)
  
  const { error } = await supabase.from('nurses').delete().eq('id', id)

  if (error) return { success: false, message: 'Erro ao remover servidor: ' + error.message }
  revalidatePath('/')
  return { success: true, message: 'Servidor removido com sucesso' }
}

export async function setNurseNameStar(id: string, nameStar: boolean) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    const nurse = db.nurses.find((n: any) => n.id === id)
    if (!nurse) return { success: false, message: 'Servidor não encontrado (Local)' }
    nurse.name_star = !!nameStar
    writeDb(db)
    revalidatePath('/servidores')
    revalidatePath('/escala')
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase.from('nurses').update({ name_star: !!nameStar }).eq('id', id)
  if (error) {
    if (error.message?.includes('name_star')) {
      return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V21). Solicite ao suporte para rodar o script de Marcação com * no Nome.' }
    }
    return { success: false, message: 'Erro ao atualizar: ' + error.message }
  }
  revalidatePath('/servidores')
  revalidatePath('/escala')
  revalidatePath('/')
  return { success: true }
}

export async function setRosterNameStar(rosterId: string, nameStar: boolean) {
  if (!rosterId) return { success: false, message: 'Dados inválidos.' }
  try {
    const unitId = await getUnitIdByRosterId(rosterId)
    await checkScaleEditor(unitId)
  } catch (e: any) {
    return { success: false, message: e?.message || 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    const r = (db.monthly_rosters || []).find((x: any) => String(x.id) === String(rosterId))
    if (!r) return { success: false, message: 'Registro não encontrado (Local).' }
    r.name_star = !!nameStar
    writeDb(db)
    revalidatePath('/escala')
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase.from('monthly_rosters').update({ name_star: !!nameStar }).eq('id', rosterId)
  if (error) {
    if (error.message?.includes('name_star')) {
      return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V22). Solicite ao suporte para rodar o script de Asterisco por Linha.' }
    }
    return { success: false, message: 'Erro ao atualizar: ' + error.message }
  }
  revalidatePath('/escala')
  revalidatePath('/')
  return { success: true }
}

export async function updateNurse(id: string, prevState: any, formData: FormData) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const name = formData.get('name') as string
  const cpf = formData.get('cpf') as string
  const coren = formData.get('coren') as string
  const crm = formData.get('crm') as string
  const phone = formData.get('phone') as string
  const vinculo = formData.get('vinculo') as string
  const role = formData.get('role') as string
  const birthDate = (formData.get('birth_date') as string) || ''
  const certidaoNegativaDate = (formData.get('certidao_negativa_date') as string) || ''
  const corenExpiryDate = (formData.get('coren_expiry_date') as string) || ''
  const hasNameStar = formData.has('name_star')
  const nameStar = hasNameStar ? (formData.get('name_star') === 'on') : undefined
  const sectionId = formData.get('sectionId') as string
  const unitId = formData.get('unitId') as string
  const sector = formData.get('sector') as string
  const password = formData.get('password') as string
  const useDefaultPassword = formData.get('useDefaultPassword') === 'on'

  if (!name) return { success: false, message: 'Nome é obrigatório' }

  if (isLocalMode()) {
    const db = readDb()
    const nurse = db.nurses.find(n => n.id === id)
    if (!nurse) return { success: false, message: 'Servidor não encontrado (Local)' }

    // Check duplicate CPF + Vinculo
    const targetCpf = cpf || nurse.cpf
    const targetVinculo = vinculo || nurse.vinculo
    
    if (db.nurses.some(n => n.id !== id && n.cpf === targetCpf && n.vinculo === targetVinculo)) {
        return { success: false, message: 'Já existe um servidor com este CPF e Vínculo.' }
    }

    // Logic to correct section_id based on role if needed
    let finalSectionId = sectionId
    
    if (role === 'COORDENADOR' || role === 'ENFERMEIRO') {
        const enfermeirosSection = db.schedule_sections.find(s => s.title === 'ENFERMEIROS')
        const tecnicosSection = db.schedule_sections.find(s => s.title === 'TÉC. DE ENFERMAGEM')
        
        if (enfermeirosSection) {
             if (!finalSectionId || (tecnicosSection && finalSectionId === tecnicosSection.id)) {
                 finalSectionId = enfermeirosSection.id
             }
        }
    } else if (role === 'TECNICO') {
        const enfermeirosSection = db.schedule_sections.find(s => s.title === 'ENFERMEIROS')
        const tecnicosSection = db.schedule_sections.find(s => s.title === 'TÉC. DE ENFERMAGEM')
        
        if (tecnicosSection) {
             if (!finalSectionId || (enfermeirosSection && finalSectionId === enfermeirosSection.id)) {
                 finalSectionId = tecnicosSection.id
             }
        }
    }

    nurse.name = name
    // Allow clearing CPF (will be replaced by a TEMP value if empty)
    nurse.cpf = cpf || `TEMP-${Date.now()}`
    nurse.coren = coren
    nurse.crm = crm || nurse.crm || ''
    nurse.phone = phone || nurse.phone || ''
    nurse.vinculo = vinculo
    nurse.role = role
    nurse.sector = sector || nurse.sector
    nurse.birth_date = birthDate
    nurse.certidao_negativa_date = certidaoNegativaDate
    nurse.coren_expiry_date = corenExpiryDate
    if (hasNameStar) nurse.name_star = !!nameStar
    
    // Only update location if provided (optional) or corrected
    if (finalSectionId) nurse.section_id = finalSectionId
    if (unitId) nurse.unit_id = unitId

    if (useDefaultPassword) {
      nurse.password = '123456'
    } else if (password) {
      nurse.password = password
    }

    // Update Roster Entries if section changed OR sector changed (current/future only)
    if (finalSectionId || sector !== undefined) {
        if (db.monthly_rosters) {
            const now = new Date()
            const currentMonth = now.getMonth() + 1
            const currentYear = now.getFullYear()

            db.monthly_rosters.forEach(r => {
                if (r.nurse_id === id) {
                    if (finalSectionId) r.section_id = finalSectionId
                    
                    // Only update sector history for current/future months
                    if (sector !== undefined && (r.year > currentYear || (r.year === currentYear && r.month >= currentMonth))) {
                        r.sector = sector
                    }
                }
            })
        }
    }

    writeDb(db)
    revalidatePath('/')
    revalidatePath('/servidores')
    return { success: true, message: 'Servidor atualizado com sucesso (Local)' }
  }

  const supabase = createClient()
  
  let finalSectionId = sectionId

  // Fetch sections to validate/correct
  const { data: sections } = await supabase.from('schedule_sections').select('id, title')
  
  if (sections) {
    const enfermeirosId = sections.find(s => s.title === 'ENFERMEIROS')?.id
    const tecnicosId = sections.find(s => s.title === 'TÉC. DE ENFERMAGEM')?.id
    
    if (role === 'COORDENADOR' || role === 'ENFERMEIRO') {
        if (enfermeirosId) {
             // If no section provided OR if it matches TECNICOS, force ENFERMEIROS
             if (!finalSectionId || finalSectionId === tecnicosId) {
                 finalSectionId = enfermeirosId
             }
        }
    } else if (role === 'TECNICO') {
        if (tecnicosId) {
             // If no section provided OR if it matches ENFERMEIROS, force TECNICOS
             if (!finalSectionId || finalSectionId === enfermeirosId) {
                 finalSectionId = tecnicosId
             }
        }
    }
  }
  
  const updateData: any = {
      name,
      coren,
      crm: crm || '',
      phone: phone || '',
      vinculo,
      role,
      cpf: cpf || `TEMP-${Date.now()}`
  }
  if (finalSectionId) updateData.section_id = finalSectionId
  if (unitId) updateData.unit_id = unitId
  if (sector) updateData.sector = sector
  updateData.birth_date = birthDate || null
  updateData.certidao_negativa_date = certidaoNegativaDate || null
  updateData.coren_expiry_date = corenExpiryDate || null
  if (hasNameStar) updateData.name_star = !!nameStar

  if (useDefaultPassword) {
    updateData.password = '123456'
  } else if (password) {
    updateData.password = password
  }

  const { error } = await supabase.from('nurses').update(updateData).eq('id', id)

  if (error) {
    if (error.message?.includes('crm') || error.message?.includes('phone')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V15). Solicite ao suporte para rodar o script de CRM e Telefone.' }
    }
    if (error.message?.includes('birth_date')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V18). Solicite ao suporte para rodar o script de Data de Nascimento.' }
    }
    if (error.message?.includes('certidao_negativa_date') || error.message?.includes('coren_expiry_date')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V19). Solicite ao suporte para rodar o script de Certidão Negativa e Vencimento do COREN.' }
    }
    if (error.message?.includes('name_star')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V21). Solicite ao suporte para rodar o script de Marcação com * no Nome.' }
    }
    if (error.code === '23505') return { success: false, message: 'Já existe um servidor com este CPF e Vínculo.' }
    return { success: false, message: 'Erro ao atualizar: ' + error.message }
  }
  
  // Update Roster Entries if section changed OR sector changed
  if (finalSectionId || sector) {
      const rosterUpdates: any = {}
      if (finalSectionId) rosterUpdates.section_id = finalSectionId
      
      if (sector) {
          // Update sector only for current and future rosters
          const now = new Date()
          const currentMonth = now.getMonth() + 1
          const currentYear = now.getFullYear()

          // Note: This is a bit tricky with Supabase in a single call without complex queries.
          // We'll update all rosters for this nurse that are >= current date.
          await supabase
            .from('monthly_rosters')
            .update({ sector, ...(finalSectionId ? { section_id: finalSectionId } : {}) })
            .eq('nurse_id', id)
            .or(`year.gt.${currentYear},and(year.eq.${currentYear},month.gte.${currentMonth})`)
      } else if (finalSectionId) {
          await supabase.from('monthly_rosters').update({ section_id: finalSectionId }).eq('nurse_id', id)
      }
  }
  
  revalidatePath('/')
  revalidatePath('/servidores')
  return { success: true, message: 'Servidor atualizado com sucesso' }
}

export async function reassignNurse(oldId: string, newId: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.shifts.forEach(s => { if (s.nurse_id === oldId) s.nurse_id = newId })
    db.time_off_requests.forEach(t => { if (t.nurse_id === oldId) t.nurse_id = newId })
    writeDb(db)
    revalidatePath('/')
    return { success: true, message: 'Servidor reatribuído (Local)' }
  }

  const supabase = createClient()
  const { error: sError } = await supabase.from('shifts').update({ nurse_id: newId }).eq('nurse_id', oldId)
  const { error: tError } = await supabase.from('time_off_requests').update({ nurse_id: newId }).eq('nurse_id', oldId)

  if (sError || tError) return { success: false, message: 'Erro ao reatribuir dados' }
  revalidatePath('/')
  return { success: true }
}

export async function assignNurseToSection(nurseId: string, sectionId: string, unitId?: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const finalUnitId = unitId === '' ? null : unitId

  if (isLocalMode()) {
    const db = readDb()
    const nurse = db.nurses.find(n => n.id === nurseId)
    if (nurse) {
      nurse.section_id = sectionId
      if (finalUnitId !== undefined) {
        nurse.unit_id = finalUnitId
      }
      writeDb(db)
    }
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const updates: any = { section_id: sectionId }
  if (finalUnitId !== undefined) {
    updates.unit_id = finalUnitId
  }

  const { error } = await supabase.from('nurses').update(updates).eq('id', nurseId)
  
  if (error) return { success: false, message: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function getTimeOffRequests() {
  const session = cookies().get('session_user')
  if (!session) return []
  const user = JSON.parse(session.value)
  const isAdmin = user.role === 'ADMIN' || user.cpf === '02170025367'

  if (isLocalMode()) {
    const db = readDb()
    let requests = db.time_off_requests.map(r => {
      const nurse = db.nurses.find(n => n.id === r.nurse_id)
      return { ...r, nurses: { name: nurse ? nurse.name : 'Desconhecido' } }
    })
    
    // Sort desc
    requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    if (!isAdmin) {
      requests = requests.filter(r => r.nurse_id === user.id)
    }
    return requests
  }

  const supabase = createClient()
  let query = supabase.from('time_off_requests').select('*, nurses (name)').order('created_at', { ascending: false })
  if (!isAdmin) query = query.eq('nurse_id', user.id)
  
  const { data, error } = await query
  if (error) return []
  return data
}

export async function updateTimeOffStatus(requestId: string, newStatus: 'approved' | 'rejected') {
  try {
    await checkAdmin()
  } catch (e) {
    throw new Error('Acesso negado.')
  }

  if (isLocalMode()) {
    const db = readDb()
    const request = db.time_off_requests.find(r => r.id === requestId)
    if (request) {
      request.status = newStatus
      writeDb(db)
    }
    revalidatePath('/folgas')
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase.from('time_off_requests').update({ status: newStatus }).eq('id', requestId)
  if (error) throw new Error('Erro ao atualizar status: ' + error.message)
  revalidatePath('/folgas')
  return { success: true }
}

export async function deleteTimeOff(id: string) {
  if (isLocalMode()) {
    const db = readDb()
    const req = db.time_off_requests.find(t => t.id === id)
    try {
      if (req?.unit_id) await checkScaleEditor(req.unit_id)
      else await checkAdmin()
    } catch (e) {
      return { success: false, message: 'Acesso negado.' }
    }
    db.time_off_requests = db.time_off_requests.filter(t => t.id !== id)
    writeDb(db)
    revalidatePath('/')
    return { success: true, message: 'Ausência removida com sucesso (Local)' }
  }

  const supabase = createClient()
  const { data: req, error: reqError } = await supabase
    .from('time_off_requests')
    .select('unit_id')
    .eq('id', id)
    .maybeSingle()

  if (reqError) return { success: false, message: 'Erro ao validar ausência: ' + reqError.message }

  try {
    if (req?.unit_id) await checkScaleEditor(req.unit_id)
    else await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }
  const { error } = await supabase.from('time_off_requests').delete().eq('id', id)
  
  if (error) return { success: false, message: 'Erro ao remover ausência: ' + error.message }
  revalidatePath('/')
  return { success: true, message: 'Ausência removida com sucesso' }
}

// SECTION MANAGEMENT

export async function addSection(title: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.schedule_sections.push({
      id: randomUUID(),
      title,
      position: db.schedule_sections.length + 1,
      created_at: new Date().toISOString()
    })
    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()

  // Calculate next position
  const { data: maxPosData } = await supabase
    .from('schedule_sections')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  
  const nextPosition = (maxPosData?.position || 0) + 1

  const { error } = await supabase.from('schedule_sections').insert({ 
    title,
    position: nextPosition
  })
  if (error) return { success: false, message: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function updateSection(id: string, title: string, sectorTitle?: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    const section = db.schedule_sections.find(s => s.id === id)
    if (section) {
      section.title = title
      if (sectorTitle !== undefined) section.sector_title = sectorTitle
      writeDb(db)
    }
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const payload: any = { title }
  if (sectorTitle !== undefined) payload.sector_title = sectorTitle
  
  const { error } = await supabase.from('schedule_sections').update(payload).eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function deleteSection(id: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    
    // Cleanup rosters and shifts first
    const rostersToDelete = (db.monthly_rosters || []).filter((r: any) => r.section_id === id)
    const rosterIds = rostersToDelete.map((r: any) => r.id)
    
    if (rosterIds.length > 0) {
         db.shifts = (db.shifts || []).filter((s: any) => !rosterIds.includes(s.roster_id))
         db.monthly_rosters = db.monthly_rosters.filter((r: any) => !rosterIds.includes(r.id))
    }

    db.schedule_sections = db.schedule_sections.filter(s => s.id !== id)
    // Update nurses in this section to null or default? For now null.
    db.nurses.forEach(n => {
        if (n.section_id === id) n.section_id = null
    })
    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  
  // Cleanup related data first to avoid FK constraints
  const { data: rosters } = await supabase.from('monthly_rosters').select('id').eq('section_id', id)
  const rosterIds = rosters?.map(r => r.id) || []
  
  if (rosterIds.length > 0) {
       await supabase.from('shifts').delete().in('roster_id', rosterIds)
       await supabase.from('monthly_rosters').delete().in('id', rosterIds)
  }

  // Reset nurses section_id before deleting the section to avoid FK constraints
  await supabase.from('nurses').update({ section_id: null }).eq('section_id', id)

  const { error } = await supabase.from('schedule_sections').delete().eq('id', id)
  if (error) {
    console.error('Error deleting section:', error)
    return { success: false, message: error.message }
  }
  revalidatePath('/')
  return { success: true }
}

export async function saveShifts(shifts: { nurseId: string, rosterId?: string, date: string, type: string, isRed?: boolean }[]) {
  // 0. Acesso e Validação básica
  try {
    const rosterIds = Array.from(new Set((shifts || []).map(s => s.rosterId).filter(Boolean))) as string[]
    if (rosterIds.length === 0) {
      await checkAdmin()
    } else {
      const unitIds: (string | null)[] = []
      for (const rosterId of rosterIds) {
        unitIds.push(await getUnitIdByRosterId(rosterId))
      }
      const uniqueUnitIds = Array.from(new Set(unitIds.map(x => x || ''))).filter(Boolean)
      for (const unitId of uniqueUnitIds) {
        await checkScaleEditor(unitId)
      }
    }
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (!shifts || !Array.isArray(shifts) || !shifts.length) {
    return { success: true }
  }

  // 1. Agrupar por Contexto (Profissional + Roster + Mês/Ano)
  // Isso nos permite realizar deleções em lote, que são muito mais rápidas e seguras.
  const contexts = new Map<string, { nurseId: string, rosterId: string | null, month: number, year: number, shifts: typeof shifts }>()
  
  shifts.forEach(s => {
    // USE STRING PARSING to avoid timezone issues with Date object
    const dateParts = s.date.split('-')
    if (dateParts.length !== 3) return
    
    const year = parseInt(dateParts[0])
    const month = parseInt(dateParts[1])
    const key = `${s.nurseId}-${s.rosterId || 'legacy'}-${month}-${year}`
    
    if (!contexts.has(key)) {
      contexts.set(key, { nurseId: s.nurseId, rosterId: s.rosterId || null, month, year, shifts: [] })
    }
    contexts.get(key)!.shifts.push(s)
  })

  // 0. Get current user for audit logs
  let currentUser: any = null
  try {
    currentUser = await checkUser()
  } catch (e) {
    // Not critical, continue
  }

  // MODO LOCAL (SQLite simulado)
  if (isLocalMode()) {
    const db = readDb()
    console.log(`[saveShifts] Modo Local: Salvamento para ${contexts.size} contextos.`)
    
    for (const ctx of contexts.values()) {
      const datesToClear = new Set(ctx.shifts.map(s => s.date))
      
      // Limpar os dias específicos deste contexto
      db.shifts = db.shifts.filter((s: any) => !(
        s.nurse_id === ctx.nurseId && 
        (ctx.rosterId ? s.roster_id === ctx.rosterId : !s.roster_id) && 
        datesToClear.has(s.shift_date)
      ))
      
      // Inserir novos (exceto os marcados como DELETE)
      ctx.shifts.forEach(s => {
        if (s.type !== 'DELETE') {
          db.shifts.push({ 
            id: randomUUID(), 
            nurse_id: s.nurseId, 
            roster_id: s.rosterId || undefined, 
            shift_date: s.date, 
            shift_type: s.type, 
            is_red: !!(s as any).isRed,
            updated_at: new Date().toISOString() 
          })
        }
      })
    }

    // Audit Log for Local Mode
    if (currentUser) {
        db.audit_logs = db.audit_logs || []
        db.audit_logs.push({
            id: randomUUID(),
            user_id: currentUser.id,
            user_name: currentUser.name,
            action: 'SAVE_SHIFTS_LOCAL',
            details: { total_operations: shifts.length },
            created_at: new Date().toISOString()
        })
    }
    
    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  // MODO SUPABASE (Produção)
  console.log(`[saveShifts] Modo Supabase: Salvamento ATÔMICO por DATA para ${shifts.length} plantões.`)
  const supabase = createClient()
  
  try {
    const allInserts: any[] = []
    
    // Agrupar deleções por Roster e Profissional para minimizar queries
    // MAS deletar APENAS as datas que estamos prestes a inserir ou que foram marcadas como DELETE
    const deleteGroups = new Map<string, { nurseId: string, rosterId: string | null, dates: string[] }>()
    
    shifts.forEach(s => {
        const key = `${s.nurseId}-${s.rosterId || 'legacy'}`
        if (!deleteGroups.has(key)) {
            deleteGroups.set(key, { nurseId: s.nurseId, rosterId: s.rosterId || null, dates: [] })
        }
        deleteGroups.get(key)!.dates.push(s.date)
        
        // Só inserimos se não for um comando de DELETE explícito
        if (s.type !== 'DELETE') {
            allInserts.push({
                nurse_id: s.nurseId,
                roster_id: s.rosterId || null,
                date: s.date,
                type: s.type,
                is_red: !!(s as any).isRed
            })
        }
    })

    const deletePromises: Promise<any>[] = []
    for (const group of deleteGroups.values()) {
        let query = supabase.from('shifts').delete()
            .eq('nurse_id', group.nurseId)
            .in('date', group.dates)
        
        if (group.rosterId) query = query.eq('roster_id', group.rosterId)
        else query = query.is('roster_id', null)
        
        deletePromises.push(query)
    }

    // PASSO 1: Limpar APENAS as datas que serão afetadas (Somente se houver algo para inserir ou deletar explicitamente)
    if (deletePromises.length > 0) {
        console.log(`[saveShifts] Executando ${deletePromises.length} limpezas pontuais...`)
        const deleteResults = await Promise.all(deletePromises)
        const deleteErrors = deleteResults.filter(r => r.error).map(r => r.error!.message)
        if (deleteErrors.length > 0) throw new Error(`Erro na limpeza pontual: ${deleteErrors.join(', ')}`)
    }

    // PASSO 2: Inserir o novo estado
    if (allInserts.length > 0) {
      console.log(`[saveShifts] Gravando ${allInserts.length} plantões...`)
      // Chunking aumentado para suportar volumes massivos de dados
      const chunk = (arr: any[], size: number) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size))
      const chunks = chunk(allInserts, 5000) 
      
      for (const c of chunks) {
        const { error: insertError } = await supabase.from('shifts').insert(c)
        if (insertError) {
          console.error('[saveShifts] Erro no Insert:', insertError)
          if (insertError.message?.includes('is_red')) {
            throw new Error('Erro: O banco de dados Supabase precisa ser atualizado (V20). Solicite ao suporte para rodar o script de Sinalização Vermelha de Plantões.')
          }
          throw new Error(`Falha na gravação: ${insertError.message}`)
        }
      }
    }

    // PASSO 3: Auditoria simplificada
    if (currentUser) {
        supabase.from('audit_logs').insert({
            user_id: currentUser.id,
            user_name: currentUser.name,
            action: 'SAVE_SHIFTS_STRICT',
            details: { count: allInserts.length, affected_dates: shifts.length }
        }).then(() => {})
    }

    console.log('[saveShifts] Salvamento PONTUAL concluído com sucesso.')
    revalidatePath('/')
    return { success: true }
  } catch (error: any) {
    console.error('ERRO CRÍTICO em saveShifts:', error)
    return { success: false, message: error.message || 'Erro inesperado ao salvar plantões' }
  }
}

export async function changePassword(prevState: any, formData: FormData) {
  const newPassword = formData.get('newPassword') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!newPassword || !confirmPassword) {
    return { success: false, message: 'Todos os campos são obrigatórios' }
  }

  if (newPassword !== confirmPassword) {
    return { success: false, message: 'As senhas não conferem' }
  }

  if (newPassword === '123456') {
    return { success: false, message: 'A nova senha não pode ser a padrão' }
  }

  if (newPassword.length < 6) {
    return { success: false, message: 'A senha deve ter pelo menos 6 caracteres' }
  }

  const sessionCookie = cookies().get('session_user')
  if (!sessionCookie) {
    return { success: false, message: 'Sessão inválida' }
  }

  const user = JSON.parse(sessionCookie.value)

  if (isLocalMode()) {
    const db = readDb()
    const nurse = db.nurses.find(n => n.id === user.id)
    if (!nurse) return { success: false, message: 'Usuário não encontrado (Local)' }

    nurse.password = newPassword
    writeDb(db)
  } else {
    const supabase = createClient()
    const { error } = await supabase.from('nurses').update({ password: newPassword }).eq('id', user.id)
    if (error) return { success: false, message: 'Erro ao atualizar senha: ' + error.message }
  }

  // Update session cookie to remove mustChangePassword
  const updatedUser = { ...user, mustChangePassword: false }
  cookies().set('session_user', JSON.stringify(updatedUser), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  redirect('/')
}
