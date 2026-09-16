'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClientForPortal } from '@/lib/supabase'
import { readDbForPortal, writeDbForPortal, isLocalModeForPortal } from '@/lib/local-db'
import { getCurrentPortalConfig, getCurrentSessionCookie, getCurrentSessionUser, HMA_PORTAL, SAMU_PORTAL, type PortalConfig, type PortalKey } from '@/lib/portal-session'
import type { MenuAccessLevel, SidebarMenuItemId } from '@/lib/sidebar-menu-items'
import { SIDEBAR_MENU_ITEMS, DEFAULT_REPORTS_PERMISSIONS } from '@/lib/sidebar-menu-items'
import { SESSION_IDLE_TIMEOUT_SECONDS } from '@/lib/constants'
import { randomUUID } from 'crypto'
import { cache } from 'react'
import {
  checkIsReleasedLocal, checkIsReleasedSupabase,
  checkIsAnyReleasedSupabase, checkAnyReleasedLocal,
  validateClearMonthly, appendAuditLocal, appendAuditSupabase
} from '@/app/security'

const resolvePortalKey = (portalKey?: PortalKey): PortalKey => portalKey || getCurrentPortalConfig().key
const createClient = (portalKey?: PortalKey) => createClientForPortal(resolvePortalKey(portalKey))
const readDb = (portalKey?: PortalKey) => readDbForPortal(resolvePortalKey(portalKey))
const writeDb = (data: any, portalKey?: PortalKey) => writeDbForPortal(data, resolvePortalKey(portalKey))
const isLocalMode = (portalKey?: PortalKey) => isLocalModeForPortal(resolvePortalKey(portalKey))

// Types
interface Section {
  id: string
  title: string
  position: number
  sector_title?: string
}

interface Unit {
  id: string
  title: string
}

interface ScalePermission {
  id: string
  nurse_id: string
  unit_id: string
  created_at?: string
}

export type { Section, Unit, ScalePermission }

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

export async function getCouncilTypes() {
  const defaultTypes = ['COREN', 'CRM', 'CRO', 'CRP', 'CRF', 'CRN', 'CREFITO', 'CRESS', 'CREA', 'CAU']

  const mergeUnique = (base: string[], extra: string[]) => {
    const set = new Set<string>()
    base.forEach(v => {
      const s = String(v || '').trim().toUpperCase()
      if (s) set.add(s)
    })
    extra.forEach(v => {
      const s = String(v || '').trim().toUpperCase()
      if (s) set.add(s)
    })
    return Array.from(set)
  }

  if (isLocalMode()) {
    const db = readDb()
    const list = (db.settings && Array.isArray(db.settings.council_types) ? db.settings.council_types : []) as any[]
    return mergeUnique(defaultTypes, list.map(x => String(x || '').trim().toUpperCase()).filter(Boolean))
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('key, value')
    .like('key', 'council_%')

  if (error || !data || data.length === 0) {
    return defaultTypes
  }

  const fromSettings = (data || []).map((row: any) => String(row.value || row.key.replace('council_', '')).trim().toUpperCase()).filter(Boolean)
  return mergeUnique(defaultTypes, fromSettings)
}

export async function addCouncilType(type: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const id = String(type || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!id) return { success: false, message: 'Conselho inválido.' }

  if (isLocalMode()) {
    const db = readDb()
    db.settings = db.settings || {}
    db.settings.council_types = Array.isArray(db.settings.council_types) ? db.settings.council_types : []
    const list = (db.settings.council_types as any[]).map(x => String(x || '').trim().toUpperCase()).filter(Boolean)
    if (!list.includes(id)) {
      list.push(id)
      db.settings.council_types = list
      writeDb(db)
    }
    revalidatePath('/servidores')
    revalidatePath('/escala')
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: `council_${id}`, value: id, bool_value: true }, { onConflict: 'key' })

  if (error) return { success: false, message: 'Erro ao adicionar conselho: ' + error.message }
  revalidatePath('/servidores')
  revalidatePath('/escala')
  revalidatePath('/')
  return { success: true }
}

export async function deleteCouncilType(type: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const id = String(type || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!id) return { success: false, message: 'Conselho inválido.' }
  if (id === 'CRM' || id === 'COREN') return { success: false, message: 'Este conselho é protegido e não pode ser removido.' }

  if (isLocalMode()) {
    const db = readDb()
    db.settings = db.settings || {}
    const list = Array.isArray(db.settings.council_types) ? db.settings.council_types : []
    db.settings.council_types = (list as any[]).map(x => String(x || '').trim().toUpperCase()).filter(Boolean).filter(x => x !== id)
    writeDb(db)
    revalidatePath('/servidores')
    revalidatePath('/escala')
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase.from('app_settings').delete().eq('key', `council_${id}`)
  if (error) return { success: false, message: 'Erro ao remover conselho: ' + error.message }
  revalidatePath('/servidores')
  revalidatePath('/escala')
  revalidatePath('/')
  return { success: true }
}

export async function getBirthdaysForMonth(month: number) {
  const user = getCurrentSessionUser()
  if (!user) return []

  // ===== COERÇÃO FORTE =====
  month = _safeMonth(month) as number

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
  const user = getCurrentSessionUser()
  if (!user) throw new Error('Unauthorized')
  const isAdmin = user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'
  if (!isAdmin) throw new Error('Forbidden: Admin access required')
  return user
}

/**
 * Enhanced checkAdmin that also allows users with specific scale permissions
 * for a given unit.
 */
export async function checkScaleEditor(unitId?: string | null) {
  const user = getCurrentSessionUser()
  if (!user) throw new Error('Unauthorized')
  
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
  const user = getCurrentSessionUser()
  if (!user) throw new Error('Unauthorized')
  return user
}

export async function checkGeneralAdmin() {
  const user = getCurrentSessionUser()
  if (!user) throw new Error('Unauthorized')
  const isDirector = user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'
  if (!isDirector) throw new Error('Forbidden: General admin access required')
  return user
}

export async function logLogin(userId: string, userName: string, userRole: string, portalKey?: PortalKey) {
  if (isLocalMode(portalKey)) {
    const db = readDb(portalKey)
    db.login_logs = db.login_logs || []
    db.login_logs.push({
      id: randomUUID(),
      user_id: userId,
      user_name: userName,
      user_role: userRole,
      login_at: new Date().toISOString()
    })
    writeDb(db, portalKey)
    return { success: true }
  }
  const supabase = createClient(portalKey)
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

  // ===== COERÇÃO FORTE =====
  year  = _safeYear(year)  as number
  month = _safeMonth(month) as number

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
  const user = getCurrentSessionUser()
  if (!user) return { success: false, message: 'Sessão inválida' }
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
  const user = getCurrentSessionUser()
  if (!user) return { success: false, message: 'Não autorizado' }

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

export async function getScheduleSectionDisplayFields(unitId: string, month: number, year: number): Promise<Record<string, string>> {
  const safeUnitId = String(unitId || '').trim()
  // ===== COERÇÃO FORTE (mesmo padrão das outras funções) =====
  const safeMonth = _safeMonth(month)
  const safeYear  = _safeYear(year)
  if (!safeUnitId) return {}

  if (isLocalMode()) {
    const db = readDb()
    const store = (db.settings?.schedule_section_display_fields || {}) as Record<string, string>
    const prefix = `${safeUnitId}_${safeMonth}_${safeYear}_`
    return Object.entries(store).reduce((acc, [key, value]) => {
      if (key.startsWith(prefix) && value) {
        acc[key.slice(prefix.length)] = String(value)
      }
      return acc
    }, {} as Record<string, string>)
  }

  try {
    const supabase = createClient()
    const prefix = `schedule_section_display_field_${safeUnitId}_${safeMonth}_${safeYear}_`
    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')
      .like('key', `${prefix}%`)

    if (error) {
      console.error('Error fetching section display fields:', error)
      return {}
    }

    return (data || []).reduce((acc: Record<string, string>, row: any) => {
      const key = String(row?.key || '')
      const value = String(row?.value || '')
      if (!key.startsWith(prefix) || !value) return acc
      acc[key.slice(prefix.length)] = value
      return acc
    }, {})
  } catch (e) {
    console.error('Unexpected error fetching section display fields:', e)
    return {}
  }
}

export async function saveScheduleSectionDisplayField(unitId: string, sectionId: string, month: number, year: number, field: string) {
  const safeUnitId = String(unitId || '').trim()
  const safeSectionId = String(sectionId || '').trim()
  // ===== COERÇÃO FORTE (mesmo padrão das outras funções) =====
  const safeMonth = _safeMonth(month)
  const safeYear  = _safeYear(year)
  const safeField = String(field || '').trim().toLowerCase()

  if (!safeUnitId || !safeSectionId || !safeField) {
    return { success: false, message: 'Configuração inválida.' }
  }

  const session = getCurrentSessionCookie()
  if (!session) return { success: false, message: 'Sessão inválida.' }

  if (isLocalMode()) {
    const db = readDb()
    db.settings = db.settings || {}
    const store = (db.settings.schedule_section_display_fields || {}) as Record<string, string>
    store[`${safeUnitId}_${safeMonth}_${safeYear}_${safeSectionId}`] = safeField
    db.settings.schedule_section_display_fields = store
    writeDb(db)
    return { success: true }
  }

  try {
    const supabase = createClient()
    const { error } = await supabase
      .from('app_settings')
      .upsert(
        {
          key: `schedule_section_display_field_${safeUnitId}_${safeMonth}_${safeYear}_${safeSectionId}`,
          value: safeField,
          bool_value: true
        },
        { onConflict: 'key' }
      )

    if (error) {
      console.error('Error saving section display field:', error)
      return { success: false, message: 'Erro ao salvar configuração da escala.' }
    }

    revalidatePath('/escala')
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    console.error('Unexpected error saving section display field:', e)
    return { success: false, message: 'Erro inesperado ao salvar configuração da escala.' }
  }
}

let _nursesColumnsCache: Set<string> | null = null
async function _detectNursesColumns(supabase: any): Promise<Set<string>> {
  if (_nursesColumnsCache) return _nursesColumnsCache
  try {
    const allCols = [
      'id','name','name_star','cpf','role','coren','crm','vinculo','section_id','unit_id',
      'birth_date','certidao_negativa_date','coren_expiry_date','phone','address','house_number','city','email',
      'password','sector','created_at'
    ]
    const existing = new Set<string>()
    for (const col of allCols) {
      try {
        const { error } = await supabase.from('nurses').select(col).limit(1)
        if (!error) existing.add(col)
      } catch {}
    }
    _nursesColumnsCache = existing
    return existing
  } catch {
    _nursesColumnsCache = new Set(['id','name','cpf','role','coren','crm','vinculo','section_id','unit_id','birth_date','certidao_negativa_date','coren_expiry_date','password','created_at'])
    return _nursesColumnsCache
  }
}

const _tableColumnsCache: Record<string, Set<string>> = {}
async function _detectColumns(supabase: any, tableName: string, columnsToCheck: string[]): Promise<Set<string>> {
  const key = String(tableName || '').trim()
  if (key && _tableColumnsCache[key]) return _tableColumnsCache[key]
  const set = new Set<string>()
  try {
    for (const col of columnsToCheck) {
      try {
        const { error } = await supabase.from(tableName).select(col).limit(1)
        if (!error) set.add(col)
      } catch {}
    }
  } catch {}
  if (key) _tableColumnsCache[key] = set
  return set
}

/**
 * Coerção segura de mês (número 1..12). Evita "month is NULL violates not-null constraint"
 * quando o front-end enviar string 'Agosto' ou undefined/NaN após re-render da tela /escala.
 * Default: mês corrente (nunca retorna null/undefined/NaN).
 */
function _safeMonth(m: any, fallbackMonth?: number): number {
  const fb = (typeof fallbackMonth === 'number' && !isNaN(fallbackMonth) && fallbackMonth >= 1 && fallbackMonth <= 12)
    ? fallbackMonth
    : new Date().getMonth() + 1
  if (m === null || m === undefined || m === '') return fb
  // Número direto
  if (typeof m === 'number') {
    const r = Math.trunc(m)
    if (!isNaN(r) && r >= 1 && r <= 12) return r
    return fb
  }
  // String
  if (typeof m === 'string') {
    const trimmed = m.trim()
    if (!trimmed) return fb
    const asNumber = Number(trimmed.replace(/[^\d-]/g,''))
    if (!isNaN(asNumber) && asNumber >= 1 && asNumber <= 12) return Math.trunc(asNumber)
    // Nome do mês em PT-BR
    const lower = trimmed.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    const map: Record<string, number> = {
      'janeiro':1,'jan':1,'fevereiro':2,'fev':2,'marco':3,'mar':3,'abril':4,'abr':4,'maio':5,'mai':5,
      'junho':6,'jun':6,'julho':7,'jul':7,'agosto':8,'ago':8,'setembro':9,'set':9,'outubro':10,'out':10,
      'novembro':11,'nov':11,'dezembro':12,'dez':12,
    }
    // match exato
    if (map[lower]) return map[lower]
    // match substring
    for (const k of Object.keys(map)) if (lower.includes(k)) return map[k]
    return fb
  }
  return fb
}

/**
 * Coerção segura de ano (2020..2100). Default: ano corrente.
 * Nunca retorna null/undefined/NaN.
 */
function _safeYear(y: any, fallbackYear?: number): number {
  const fb = (typeof fallbackYear === 'number' && !isNaN(fallbackYear) && fallbackYear >= 2020 && fallbackYear <= 2100)
    ? fallbackYear
    : new Date().getFullYear()
  if (y === null || y === undefined || y === '') return fb
  if (typeof y === 'number') {
    const r = Math.trunc(y)
    if (!isNaN(r) && r >= 2020 && r <= 2100) return r
    return fb
  }
  if (typeof y === 'string') {
    const trimmed = y.trim()
    if (!trimmed) return fb
    const asNumber = Number(trimmed.replace(/[^\d]/g,''))
    if (!isNaN(asNumber) && asNumber >= 2020 && asNumber <= 2100) return Math.trunc(asNumber)
    if (asNumber >= 20 && asNumber <= 99) return 2000 + asNumber
    return fb
  }
  return fb
}

const _formatPtDate = (iso: any) => {
  if (!iso) return ''
  const s = String(iso).slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return String(iso || '')
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

const NURSE_VINCULO_TYPES = [
  'CONCURSO',
  'CONTRATADO',
  'SELETIVO',
  'CESSÃO',
  'TERCEIRIZADO',
  'ESCALA DESCOBERTA',
  'ESTÁGIO',
  'OUTRO',
]

interface NurseVinculo {
  id: string
  nurse_id: string
  tipo_vinculo: string
  data_admissao: string
  data_baixa: string
  created_at: string
  updated_at: string
}

async function _ensureNurseVinculosTable(supabase: any): Promise<{ ok: boolean; error?: any }> {
  try {
    const { data, error } = await supabase.raw(`
      CREATE TABLE IF NOT EXISTS nurse_vinculos (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        nurse_id UUID NOT NULL REFERENCES nurses(id) ON DELETE CASCADE,
        tipo_vinculo TEXT NOT NULL DEFAULT '',
        data_admissao TEXT DEFAULT '',
        data_baixa TEXT DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_nurse_vinculos_nurse_id ON nurse_vinculos(nurse_id);
    `)
    if (error && !String(error.message || '').includes('already exists') && !String(error.message || '').includes('42P07')) {
      return { ok: false, error }
    }
    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e }
  }
}

export async function migrateNurseVinculosTable() {
  try { await checkAdmin() } catch { return { ok: false, message: 'Acesso negado.' } }
  if (isLocalMode()) {
    const db = readDb()
    if (!db.nurse_vinculos) db.nurse_vinculos = []
    writeDb(db)
    return { ok: true }
  }
  const sb = createClient()
  const r = await _ensureNurseVinculosTable(sb)
  if (r.error) return { ok: false, message: String(r.error.message || r.error || '') }
  return { ok: true }
}

function _hydrateNurseVinculos(nurses: any[], vinculos: NurseVinculo[]): any[] {
  const byNurse = new Map<string, NurseVinculo[]>()
  for (const v of vinculos) {
    const arr = byNurse.get(v.nurse_id) || []
    arr.push(v)
    byNurse.set(v.nurse_id, arr)
  }
  return nurses.map((n: any) => {
    const arr = byNurse.get(n.id) || []
    const sorted = [...arr].sort((a, b) => {
      if (a.data_baixa && !b.data_baixa) return 1
      if (!a.data_baixa && b.data_baixa) return -1
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    })
    const tiposAtivos = sorted.filter(v => !v.data_baixa).map(v => v.tipo_vinculo).filter(Boolean)
    const joinedAtivos = tiposAtivos.length ? tiposAtivos.join(' / ') : (n.vinculo || '')
    return { ...n, vinculos: sorted, vinculo: joinedAtivos || n.vinculo || '' }
  })
}

export async function getNurseVinculos(nurseId?: string): Promise<NurseVinculo[]> {
  if (isLocalMode()) {
    const db = readDb()
    if (!db.nurse_vinculos) return []
    let all = db.nurse_vinculos as NurseVinculo[]
    if (nurseId) all = all.filter(v => v.nurse_id === nurseId)
    return all
  }
  const sb = createClient()
  let q = sb.from('nurse_vinculos').select('*')
  if (nurseId) q = q.eq('nurse_id', nurseId)
  const { data, error } = await q
  if (error) {
    if (String(error.message || '').includes('does not exist') || String(error.code || '') === '42P01') return []
    return []
  }
  return (data || []) as NurseVinculo[]
}

const _isoVinculoDate = (v: any): string => {
  const raw = String(v || '').trim()
  if (!raw) return ''
  if (raw.toUpperCase() === 'SEM_DATA') return 'SEM_DATA'
  // Já é ISO (AAAA-MM-DD)?
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.slice(0, 10)
  // PT-BR DD/MM/AAAA?
  const m = raw.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/)
  if (m) {
    let dd = Number(m[1])
    let mm = Number(m[2])
    let yy = Number(m[3])
    if (yy < 100) yy = yy < 40 ? 2000 + yy : 1900 + yy
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yy >= 1900 && yy <= 2100) {
      return `${yy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    }
  }
  return raw.slice(0, 10)
}

export async function createNurseVinculo(
  nurseId: string,
  payload: { tipo_vinculo: string; data_admissao?: string; data_baixa?: string }
) {
  try { await checkAdmin() } catch { return { success: false, message: 'Acesso negado.' } }
  if (!nurseId) return { success: false, message: 'Servidor não informado.' }
  const tipo = String(payload.tipo_vinculo || '').trim().toUpperCase()
  if (!tipo) {
    console.error('[createNurseVinculo] tipo_vinculo VAZIO')
    return { success: false, message: 'Informe o tipo de vínculo.' }
  }
  const dataAdmissao = _isoVinculoDate(payload.data_admissao)
  const dataBaixa = _isoVinculoDate(payload.data_baixa)

  const row = {
    nurse_id: nurseId,
    tipo_vinculo: tipo,
    data_admissao: dataAdmissao,
    data_baixa: dataBaixa,
  }
  console.log('[createNurseVinculo] INSERT:', JSON.stringify(row))

  if (isLocalMode()) {
    const db = readDb()
    if (!db.nurse_vinculos) db.nurse_vinculos = []
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    db.nurse_vinculos.push({ id, created_at: now, updated_at: now, ...row } as NurseVinculo)
    writeDb(db)
    revalidatePath('/servidores')
    revalidatePath('/')
    return { success: true, id, message: 'Vínculo adicionado.' }
  }
  const sb = createClient()
  await _ensureNurseVinculosTable(sb)
  const { data, error } = await sb.from('nurse_vinculos').insert([row]).select('id').single()
  if (error) {
    console.error('[createNurseVinculo] Supabase error:', JSON.stringify({ code: error.code, message: error.message, details: (error as any).details, hint: (error as any).hint }))
    return { success: false, message: error.message || 'Erro ao criar vínculo.' }
  }
  console.log('[createNurseVinculo] OK id=' + data?.id)
  revalidatePath('/servidores')
  revalidatePath('/')
  return { success: true, id: data?.id, message: 'Vínculo adicionado.' }
}

export async function updateNurseVinculo(
  vinculoId: string,
  payload: { tipo_vinculo?: string; data_admissao?: string; data_baixa?: string }
) {
  try { await checkAdmin() } catch { return { success: false, message: 'Acesso negado.' } }
  if (!vinculoId) return { success: false, message: 'Vínculo não informado.' }
  const patch: any = { updated_at: new Date().toISOString() }
  if (payload.tipo_vinculo !== undefined) patch.tipo_vinculo = String(payload.tipo_vinculo).trim().toUpperCase()
  if (payload.data_admissao !== undefined) patch.data_admissao = _isoVinculoDate(payload.data_admissao)
  if (payload.data_baixa !== undefined) patch.data_baixa = _isoVinculoDate(payload.data_baixa)
  console.log('[updateNurseVinculo] id=' + vinculoId + ' UPDATE:', JSON.stringify(patch))

  if (isLocalMode()) {
    const db = readDb()
    if (!db.nurse_vinculos) db.nurse_vinculos = []
    const i = db.nurse_vinculos.findIndex((v: NurseVinculo) => v.id === vinculoId)
    if (i < 0) return { success: false, message: 'Vínculo não encontrado.' }
    db.nurse_vinculos[i] = { ...db.nurse_vinculos[i], ...patch, updated_at: new Date().toISOString() }
    writeDb(db)
    revalidatePath('/servidores')
    revalidatePath('/')
    return { success: true, message: 'Vínculo atualizado.' }
  }
  const sb = createClient()
  const { error } = await sb.from('nurse_vinculos').update(patch).eq('id', vinculoId)
  if (error) {
    console.error('[updateNurseVinculo] Supabase error:', JSON.stringify({ code: error.code, message: error.message, details: (error as any).details, hint: (error as any).hint }))
    return { success: false, message: error.message || 'Erro ao atualizar vínculo.' }
  }
  revalidatePath('/servidores')
  revalidatePath('/')
  return { success: true, message: 'Vínculo atualizado.' }
}

export async function deleteNurseVinculo(vinculoId: string) {
  try { await checkAdmin() } catch { return { success: false, message: 'Acesso negado.' } }
  if (!vinculoId) return { success: false, message: 'Vínculo não informado.' }
  if (isLocalMode()) {
    const db = readDb()
    if (!db.nurse_vinculos) db.nurse_vinculos = []
    db.nurse_vinculos = db.nurse_vinculos.filter((v: NurseVinculo) => v.id !== vinculoId)
    writeDb(db)
    revalidatePath('/servidores')
    revalidatePath('/')
    return { success: true, message: 'Vínculo excluído.' }
  }
  const sb = createClient()
  const { error } = await sb.from('nurse_vinculos').delete().eq('id', vinculoId)
  if (error) return { success: false, message: error.message || 'Erro ao excluir vínculo.' }
  revalidatePath('/servidores')
  revalidatePath('/')
  return { success: true, message: 'Vínculo excluído.' }
}

const _getNursesCached = cache(async () => {
  let nurses: any[] = []
  if (isLocalMode()) {
    const db = readDb()
    nurses = db.nurses.sort((a, b) => a.name.localeCompare(b.name))
  } else {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('nurses')
      .select('id,name,name_star,cpf,role,coren,crm,vinculo,section_id,unit_id,birth_date,certidao_negativa_date,coren_expiry_date,phone,address,house_number,city,email,created_at')
      .range(0, 9999)
      .order('name')
    if (error) {
      if (error.message?.includes('city')) {
        const { data: fbCity } = await supabase
          .from('nurses')
          .select('id,name,name_star,cpf,role,coren,crm,vinculo,section_id,unit_id,birth_date,certidao_negativa_date,coren_expiry_date,phone,address,house_number,email,created_at')
          .range(0, 9999)
          .order('name')
        if (fbCity) nurses = fbCity || []
      }
      if (!nurses.length && error.message?.includes('email')) {
        const { data: fbEmail } = await supabase
          .from('nurses')
          .select('id,name,name_star,cpf,role,coren,crm,vinculo,section_id,unit_id,birth_date,certidao_negativa_date,coren_expiry_date,phone,address,house_number,created_at')
          .range(0, 9999)
          .order('name')
        if (fbEmail) nurses = fbEmail || []
      }
      if (!nurses.length && (error.message?.includes('address') || error.message?.includes('house_number'))) {
        const { data: fb1 } = await supabase
          .from('nurses')
          .select('id,name,name_star,cpf,role,coren,crm,vinculo,section_id,unit_id,birth_date,certidao_negativa_date,coren_expiry_date,phone,created_at')
          .range(0, 9999)
          .order('name')
        if (fb1) nurses = fb1 || []
      }
      if (!nurses.length && (error.message?.includes('birth_date') || error.message?.includes('certidao_negativa_date') || error.message?.includes('coren_expiry_date') || error.message?.includes('name_star') || error.message?.includes('crm') || error.message?.includes('phone'))) {
        const { data: fallbackData } = await supabase
          .from('nurses')
          .select('id,name,cpf,role,coren,vinculo,section_id,unit_id,created_at')
          .range(0, 9999)
          .order('name')
        nurses = fallbackData || []
      }
    } else {
      nurses = data || []
    }
  }
  try {
    const vinculos = await getNurseVinculos()
    return _hydrateNurseVinculos(nurses, vinculos as any)
  } catch {
    return nurses
  }
})

export async function getNurses() {
  return _getNursesCached()
}

export async function getNursesBySection(sectionId: string) {
  if (isLocalMode()) {
    const db = readDb()
    return db.nurses.filter(n => n.section_id === sectionId).sort((a, b) => a.name.localeCompare(b.name))
  }
  
  const supabase = createClient()
  const { data, error } = await supabase
    .from('nurses')
    .select('id,name,name_star,cpf,role,coren,crm,vinculo,section_id,unit_id,birth_date,certidao_negativa_date,coren_expiry_date,created_at')
    .eq('section_id', sectionId)
    .range(0, 9999)
    .order('name')
  if (error) {
    if (error.message?.includes('birth_date') || error.message?.includes('certidao_negativa_date') || error.message?.includes('coren_expiry_date') || error.message?.includes('name_star') || error.message?.includes('crm')) {
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
  const corenRaw = formData.get('coren') as string
  const crmRaw = formData.get('crm') as string
  const councilTypeRaw = formData.get('council_type') as string
  const councilNumberRaw = formData.get('council_number') as string
  const phone = formData.get('phone') as string
  const address = (formData.get('address') as string) || ''
  const houseNumber = (formData.get('house_number') as string) || ''
  const city = (formData.get('city') as string) || ''
  const email = (formData.get('email') as string) || ''
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
  const councilType = String(councilTypeRaw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const councilNumber = String(councilNumberRaw || '').trim()
  const coren = councilType === 'COREN' ? councilNumber : String(corenRaw || '').trim()
  const crm = (councilType || councilNumber)
    ? (councilType === 'COREN' ? String(crmRaw || '').trim() : `${councilType || 'CRM'}${councilNumber ? ` ${councilNumber}` : ''}`.trim())
    : String(crmRaw || '').trim()

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
      address: address || '',
      house_number: houseNumber || '',
      city: city || '',
      email: email || '',
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
        const vinculosAtivosAuto: any[] = []
        if (vinculo) {
          for (const parte of String(vinculo).split(/[\/,;]+|\s+E\s+|\s+OU\s+/gi).map(s => s.trim()).filter(Boolean)) {
            vinculosAtivosAuto.push({ tipo_vinculo: parte.toUpperCase(), data_admissao: '', data_baixa: '' })
          }
        }
        const snapshotAuto: any = {
          snapshot_name: name,
          snapshot_role: role,
          snapshot_vinculo: vinculo || '',
          snapshot_vinculos_json: vinculosAtivosAuto.length > 0 ? JSON.stringify(vinculosAtivosAuto) : ''
        }
        db.monthly_rosters.push({
            id: newRosterId,
            nurse_id: newNurse.id,
            section_id: finalSectionId,
            unit_id: unitId,
            month: rosterMonth,
            year: rosterYear,
            sector: sector || '', // History for this month
            created_at: new Date().toISOString(),
            ...snapshotAuto
        })
        lastRosterId = newRosterId
    }

    writeDb(db)
    
    revalidatePath('/servidores')
    return { success: true, message: 'Servidor cadastrado com sucesso!', rosterId: lastRosterId, id: newNurse.id, nurseId: newNurse.id }
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

  const insertDataFull: any = {
    name,
    name_star: !!nameStar,
    cpf: finalCpf,
    password,
    coren,
    crm: crm || '',
    phone: phone || '',
    address: address || '',
    house_number: houseNumber || '',
    city: city || '',
    email: email || '',
    vinculo,
    role,
    birth_date: birthDate || null,
    certidao_negativa_date: certidaoNegativaDate || null,
    coren_expiry_date: corenExpiryDate || null,
    section_id: finalSectionId || null,
    unit_id: unitId || null
  }

  const existingCols = await _detectNursesColumns(supabase)
  const filteredInsert: any = {}
  for (const k of Object.keys(insertDataFull)) {
    if (existingCols.has(k)) filteredInsert[k] = insertDataFull[k]
  }

  const { data: insertedNurse, error } = await supabase.from('nurses').insert(filteredInsert).select().single()

  if (error) {
    console.error('[createNurse] Supabase error:', JSON.stringify({ code: error.code, message: error.message, details: (error as any).details, hint: (error as any).hint }))
    if (error.code === '42703') {
      const missingColMatch = (error.message || '').match(/column\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s+of/i) || (error.message || '').match(/([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i)
      const missingCol = missingColMatch ? missingColMatch[1] : ''
      if (missingCol === 'city') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V24). Solicite ao suporte para rodar o script de Cidade.' }
      }
      if (missingCol === 'email') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V23). Solicite ao suporte para rodar o script de E-mail.' }
      }
      if (missingCol === 'address' || missingCol === 'house_number') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V22). Solicite ao suporte para rodar o script de Endereço e Número da Casa.' }
      }
      if (missingCol === 'crm' || missingCol === 'phone') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V15). Solicite ao suporte para rodar o script de CRM e Telefone.' }
      }
      if (missingCol === 'birth_date') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V18). Solicite ao suporte para rodar o script de Data de Nascimento.' }
      }
      if (missingCol === 'certidao_negativa_date' || missingCol === 'coren_expiry_date') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V19). Solicite ao suporte para rodar o script de Certidão Negativa e Vencimento do COREN.' }
      }
      if (missingCol === 'name_star') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V21). Solicite ao suporte para rodar o script de Marcação com * no Nome.' }
      }
      if (missingCol) {
        return { success: false, message: `Erro: Coluna "${missingCol}" não existe no Supabase. Por favor, abra o SQL HELP (botão vermelho no modal) e rode o script completo V15/V18/V19/V21/V22/V23/V24.` }
      }
    }
    if (error.message?.includes('city')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V24). Solicite ao suporte para rodar o script de Cidade.' }
    }
    if (error.message?.includes('email')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V23). Solicite ao suporte para rodar o script de E-mail.' }
    }
    if (error.message?.includes('address') || error.message?.includes('house_number')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V22). Solicite ao suporte para rodar o script de Endereço e Número da Casa.' }
    }
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
      // ===== COERÇÃO FORTE (evita NULL em monthly_rosters.month / year) =====
      const safeRosterMonth = _safeMonth(rosterMonth, (now.getMonth() + 1))
      const safeRosterYear  = _safeYear(rosterYear, now.getFullYear())
      
      const rosterCols = await _detectColumns(supabase, 'monthly_rosters', [
        'id','nurse_id','section_id','unit_id','month','year','sector','created_at','list_order','observation',
        'snapshot_name','snapshot_role','snapshot_vinculo','snapshot_vinculos_json'
      ])
      const rosterSnapshot = await _buildNurseSnapshot(insertedNurse.id)
      const rosterPayload: any = {
          nurse_id: insertedNurse.id,
          section_id: finalSectionId,
          unit_id: unitId,
          month: safeRosterMonth,
          year: safeRosterYear,
          sector: sector || '' // History for this month
      }
      if (rosterCols.has('snapshot_name')) rosterPayload.snapshot_name = rosterSnapshot.snapshot_name
      if (rosterCols.has('snapshot_role')) rosterPayload.snapshot_role = rosterSnapshot.snapshot_role
      if (rosterCols.has('snapshot_vinculo')) rosterPayload.snapshot_vinculo = rosterSnapshot.snapshot_vinculo
      if (rosterCols.has('snapshot_vinculos_json')) rosterPayload.snapshot_vinculos_json = rosterSnapshot.snapshot_vinculos_json
      const filteredRoster: any = {}
      for (const k of Object.keys(rosterPayload)) {
        if (rosterCols.has(k)) filteredRoster[k] = rosterPayload[k]
      }

      const { data: insertedRoster } = await supabase.from('monthly_rosters').insert(filteredRoster).select('id').single()
      
      if (insertedRoster) lastRosterId = insertedRoster.id
  }

  revalidatePath('/servidores')
  return { success: true, message: 'Servidor cadastrado com sucesso!', rosterId: lastRosterId, id: insertedNurse?.id, nurseId: insertedNurse?.id }
}

const _getSectionsCached = cache(async () => {
  if (isLocalMode()) {
    const db = readDb()
    return db.schedule_sections || []
  }
  
  const supabase = createClient()
  const { data } = await supabase.from('schedule_sections').select('*').order('position', { ascending: true, nullsFirst: true }).order('title', { ascending: true })
  return data || []
})

export async function getSections() {
  return _getSectionsCached()
}

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

async function loginWithPortal(prevState: any, formData: FormData, portalConfig: PortalConfig = HMA_PORTAL) {
  const rawCpf = formData.get('cpf') as string
  const password = formData.get('password') as string
  const selectedProfileId = formData.get('selectedProfileId') as string

  // Handling profile selection from multi-profile step
  if (selectedProfileId) {
      const selectionCookie = cookies().get(portalConfig.selectionCookieName)
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

      if (isLocalMode(portalConfig.key)) {
          const db = readDb(portalConfig.key)
          nurse = db.nurses.find(n => n.id === selectedProfileId)
          if (nurse && nurse.section_id) {
             sectionTitle = db.schedule_sections.find(s => s.id === nurse.section_id)?.title || ''
          }
      } else {
          const supabase = createClient(portalConfig.key)
          const { data } = await supabase.from('nurses').select('*').eq('id', selectedProfileId).single()
          nurse = data
          if (nurse && nurse.section_id) {
              const { data: section } = await supabase.from('schedule_sections').select('title').eq('id', nurse.section_id).single()
              if (section) sectionTitle = section.title
          }
      }

      if (!nurse) return { message: 'Erro ao recuperar perfil selecionado.' }

      // Clear selection cookie
      try { cookies().delete(portalConfig.selectionCookieName) } catch {}
      try { cookies().delete({ name: portalConfig.selectionCookieName, path: portalConfig.basePath || '/' }) } catch {}

      // Proceed to set session cookie
      const mustChangePassword = nurse.password === '123456'
      
      // Auto-promote to COORDENACAO_GERAL if specific CPF (legacy check)
      const cleanCpfForRole = (nurse.cpf || '').replace(/\D/g, '')
      if (cleanCpfForRole === '02170025367' && nurse.role !== 'COORDENACAO_GERAL' && !isLocalMode(portalConfig.key)) {
        const supabase = createClient(portalConfig.key)
        await supabase.from('nurses').update({ role: 'COORDENACAO_GERAL' }).eq('id', nurse.id)
        nurse.role = 'COORDENACAO_GERAL'
      }

      cookies().set(portalConfig.sessionCookieName, JSON.stringify({ 
        name: nurse.name, 
        id: nurse.id, 
        cpf: nurse.cpf,
        role: nurse.role,
        section_id: nurse.section_id,
        section_title: sectionTitle,
        mustChangePassword,
        portal: portalConfig.key,
        login_nonce: randomUUID(),
      }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_IDLE_TIMEOUT_SECONDS,
        path: portalConfig.basePath || '/',
      })
      await logLogin(nurse.id, nurse.name, nurse.role, portalConfig.key)

      if (mustChangePassword) {
        redirect(portalConfig.changePasswordPath)
      }
      redirect(portalConfig.dashboardPath)
  }

  if (!rawCpf || !password) {
    return { message: 'CPF e Senha são obrigatórios' }
  }

  const cleanCpf = rawCpf.replace(/\D/g, '')

  if (isLocalMode(portalConfig.key)) {
    const db = readDb(portalConfig.key)
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
        
        cookies().set(portalConfig.selectionCookieName, JSON.stringify(options), {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 5, // 5 minutes
            path: portalConfig.basePath || '/',
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

    cookies().set(portalConfig.sessionCookieName, JSON.stringify({ 
      name: nurse.name, 
      id: nurse.id, 
      cpf: nurse.cpf,
      role: nurse.role,
      section_id: nurse.section_id,
      section_title: sectionTitle,
      mustChangePassword,
      portal: portalConfig.key,
      login_nonce: randomUUID(),
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_IDLE_TIMEOUT_SECONDS,
      path: portalConfig.basePath || '/',
    })
    await logLogin(nurse.id, nurse.name, nurse.role, portalConfig.key)

    if (mustChangePassword) {
      redirect(portalConfig.changePasswordPath)
    }
    redirect(portalConfig.dashboardPath)
  }

  const supabase = createClient(portalConfig.key)
  
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
      
      cookies().set(portalConfig.selectionCookieName, JSON.stringify(options), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 5, // 5 minutes
          path: portalConfig.basePath || '/',
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

  cookies().set(portalConfig.sessionCookieName, JSON.stringify({ 
    name: nurse.name, 
    id: nurse.id, 
    cpf: nurse.cpf,
    role: nurse.role,
    section_id: nurse.section_id,
    section_title: sectionTitle,
    mustChangePassword,
    portal: portalConfig.key,
    login_nonce: randomUUID(),
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_IDLE_TIMEOUT_SECONDS,
    path: portalConfig.basePath || '/',
  })
  await logLogin(nurse.id, nurse.name, nurse.role, portalConfig.key)

  if (mustChangePassword) {
    redirect(portalConfig.changePasswordPath)
  }

  redirect(portalConfig.dashboardPath)
}

export async function login(prevState: any, formData: FormData) {
  return loginWithPortal(prevState, formData, HMA_PORTAL)
}

export async function loginSamu(prevState: any, formData: FormData) {
  return loginWithPortal(prevState, formData, SAMU_PORTAL)
}

function _enrichNursesWithActiveVinculosHelper(
  nursesInput: any[],
  vinculosInput: any[],
  rosterNurseIds?: Set<string>
) {
  const vinculosByNurse = new Map<string, any[]>()
  for (const v of vinculosInput || []) {
    const baixa = String((v as any).data_baixa ?? '').trim()
    if (baixa) continue
    const nid = String((v as any).nurse_id ?? '')
    if (!nid) continue
    if (!vinculosByNurse.has(nid)) vinculosByNurse.set(nid, [])
    vinculosByNurse.get(nid)!.push({ ...v })
  }

  const result = new Map<string, any>()
  const nurses = nursesInput || []
  for (const n of nurses) {
    const nid = String(n?.id ?? '')
    if (!nid) continue
    if (rosterNurseIds && rosterNurseIds.size > 0 && !rosterNurseIds.has(nid)) {
      result.set(nid, { ...n })
      continue
    }
    const vinculosAtivos = vinculosByNurse.get(nid) || []
    const principal = vinculosAtivos[0]

    let vinculoField = String(n?.vinculo ?? '').trim()
    let dataAdmissao = String((n as any)?.data_admissao ?? (n as any)?.admission_date ?? (n as any)?.dataAdmissao ?? '').trim()
    if (!vinculoField && principal) {
      const tv = String((principal as any).tipo_vinculo ?? '').trim()
      const mat = String((principal as any).matricula ?? '').trim()
      const da = String((principal as any).data_admissao ?? '').trim()
      if (tv) vinculoField = tv
      if (mat && !vinculoField) vinculoField = mat
      if (da && !dataAdmissao) dataAdmissao = da
    }
    for (const v of vinculosAtivos) {
      const da = String((v as any).data_admissao ?? '').trim()
      if (!da) continue
      if (!dataAdmissao) { dataAdmissao = da; continue }
      if (da < dataAdmissao) dataAdmissao = da
    }

    const vinculosExistentes = Array.isArray((n as any).vinculos) ? (n as any).vinculos : []
    const todosVinculos = [...vinculosExistentes]
    for (const v of vinculosAtivos) {
      const ja = todosVinculos.some(
        (x: any) =>
          String(x?.id ?? '') === String((v as any).id ?? '') &&
          String(x?.tipo_vinculo ?? '') === String((v as any).tipo_vinculo ?? '')
      )
      if (!ja) todosVinculos.push({ ...v })
    }

    result.set(nid, {
      ...n,
      vinculo: vinculoField,
      vinculos: todosVinculos,
      data_admissao: dataAdmissao,
      dataAdmissao: dataAdmissao,
      admission_date: dataAdmissao,
      _vinculos_ativos_count: vinculosAtivos.length,
    })
  }
  return result
}

async function _enrichNursesWithActiveVinculos(
  nursesInput: any[],
  rosterNurseIds?: Set<string>
) {
  const nurseIds = Array.from(
    (rosterNurseIds && rosterNurseIds.size > 0 ? rosterNurseIds : new Set((nursesInput || []).map((n: any) => String(n?.id ?? '')).filter(Boolean)))
  )
  if (nurseIds.length === 0) {
    const empty = new Map<string, any>()
    for (const n of nursesInput || []) empty.set(String(n?.id ?? ''), { ...n })
    return empty
  }

  if (isLocalMode()) {
    const db = readDb()
    const vinculos = Array.isArray((db as any).nurse_vinculos) ? (db as any).nurse_vinculos : []
    return _enrichNursesWithActiveVinculosHelper(nursesInput, vinculos, rosterNurseIds)
  }

  const supabase = createClient()
  try {
    const CHUNK = 500
    const all: any[] = []
    for (let i = 0; i < nurseIds.length; i += CHUNK) {
      const part = nurseIds.slice(i, i + CHUNK)
      const { data, error } = await supabase
        .from('nurse_vinculos')
        .select('*')
        .in('nurse_id', part)
        .is('data_baixa', null)
        .order('created_at', { ascending: true })
        .range(0, 99999)
      if (!error && data) all.push(...data)
    }
    return _enrichNursesWithActiveVinculosHelper(nursesInput, all, rosterNurseIds)
  } catch (e: any) {
    console.warn('_enrichNursesWithActiveVinculos falhou (provavelmente tabela nurse_vinculos nao criada ainda), fallback sem enrichment:', e?.message || String(e))
    const fallback = new Map<string, any>()
    for (const n of nursesInput || []) fallback.set(String(n?.id ?? ''), { ...n })
    return fallback
  }
}

export async function getMonthlyManagementReport(month: number, year: number) {
  try {
    await checkAdmin()

    // ===== COERÇÃO FORTE =====
    year  = _safeYear(year)  as number
    month = _safeMonth(month) as number

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

      // 2. Busca os registros da escala (rosters) INCLUINDO SNAPSHOTS V26 (com fallback se V26 não aplicada)
      let rosterList: any[] = []
      try {
        const rosterCols = ['id', 'nurse_id', 'unit_id', 'observation']
        const availSnapCols = await _detectColumns(supabase, 'monthly_rosters', [
          'snapshot_name', 'snapshot_role', 'snapshot_vinculo', 'snapshot_vinculos_json'
        ])
        availSnapCols.forEach(c => rosterCols.push(c))
        const { data: rostersData, error: e2 } = await supabase
          .from('monthly_rosters')
          .select(rosterCols.join(', '))
          .eq('month', month)
          .eq('year', year)
          .range(0, 10000)
        if (!e2) rosterList = rostersData || []
        else throw e2
      } catch (e2: any) {
        console.warn('Erro ao buscar monthly_rosters (talvez sem V26), fallback sem snapshot:', e2?.message || String(e2))
        const { data: rostersData, error: e2b } = await supabase
          .from('monthly_rosters')
          .select('id, nurse_id, unit_id, observation')
          .eq('month', month)
          .eq('year', year)
          .range(0, 10000)
        if (e2b) throw new Error(`Erro ao buscar registros da escala: ${e2b.message}`)
        rosterList = rostersData || []
      }
      
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

    // ENRICHMENT: busca vínculos ativos na tabela 1:N nurse_vinculos (fallback p/ nurses.vinculo coluna antiga)
    const rosterNurseIds = new Set(rosters.map(r => String((r as any).nurse_id || '')).filter(Boolean))
    let nurseMap = await _enrichNursesWithActiveVinculos(nurses, rosterNurseIds)

    // APLICAR SNAPSHOTS V26 (PATCH): para cada roster, se tiver snapshot, cria um nurse "congelado" no lugar do atual
    const rosterPatchedNurses = new Map<string, any>()
    for (const r of rosters) {
      const nid = String((r as any).nurse_id || '')
      if (!nid) continue
      const snapNome = String((r as any).snapshot_name || '').trim()
      const snapCargo = String((r as any).snapshot_role || '').trim()
      const snapVinculo = String((r as any).snapshot_vinculo || '').trim()
      const snapVinculosJson = String((r as any).snapshot_vinculos_json || '').trim()
      if (!snapNome && !snapCargo && !snapVinculo && !snapVinculosJson) continue
      const base = nurseMap.get(nid) || { id: nid, name: '', role: '', vinculo: '', vinculos: [] }
      let vinculosParsed: any[] = Array.isArray((base as any).vinculos) ? (base as any).vinculos : []
      if (snapVinculosJson) {
        try {
          const p = JSON.parse(snapVinculosJson)
          if (Array.isArray(p)) vinculosParsed = p
        } catch {}
      }
      const patched = {
        ...base,
        id: base.id,
        name: snapNome || base.name,
        role: snapCargo || base.role,
        vinculo: snapVinculo || base.vinculo || '',
        vinculos: vinculosParsed
      }
      rosterPatchedNurses.set(nid, patched)
    }
    // Sobrepõe o nurseMap com versões com snapshot
    for (const [k, v] of rosterPatchedNurses) nurseMap.set(k, v)

    // Processamento do relatório
    const unitNumbersMap = await getAllUnitNumbers()
    const activeUnitIds = new Set(rosters.map(r => String(r.unit_id)))
    const sectorsWithSchedules = units.filter(u => activeUnitIds.has(String(u.id)))
    
    const stats = {
      totalSchedules: activeUnitIds.size,
      releasedSchedules: releases.length,
      concursados: 0,
      seletivados: 0,
      contratados: 0,
      escalaDupla: 0,
      descoberta: 0,
      totalEntries: rosters.length,
      professions: {
        enfermeiros: { total: 0, concursados: 0, seletivados: 0, contratados: 0, escalaDupla: 0, descoberta: 0 },
        tecnicos: { total: 0, concursados: 0, seletivados: 0, contratados: 0, escalaDupla: 0, descoberta: 0 },
        auxiliares: { total: 0, concursados: 0, seletivados: 0, contratados: 0, escalaDupla: 0, descoberta: 0 },
        medicos: { total: 0, concursados: 0, seletivados: 0, contratados: 0, escalaDupla: 0, descoberta: 0 },
        outros: { total: 0, concursados: 0, seletivados: 0, contratados: 0, escalaDupla: 0, descoberta: 0 }
      },
      sectors: sectorsWithSchedules.map(s => {
        const sectorRosters = rosters.filter(r => String(r.unit_id) === String(s.id))
        const sectorNurseIds = sectorRosters.map(r => String(r.nurse_id))
        const sectorNurses = nurses.filter(n => sectorNurseIds.includes(String(n.id)))
        const sectorRoles = Array.from(new Set(sectorNurses.map(n => (n.role || '').toUpperCase())))
        const unitNumber = unitNumbersMap[String(s.id)] || ''
        const displayTitle = unitNumber ? `${unitNumber} - ${s.title}` : s.title
        
        // Detailed stats per sector and profession
        const sectorStats: any = {
          total: { concursados: 0, seletivados: 0, contratados: 0, escalaDupla: 0, descoberta: 0, total: sectorRosters.length },
          ENFERMEIRO: { concursados: 0, seletivados: 0, contratados: 0, escalaDupla: 0, descoberta: 0, total: 0 },
          TECNICO: { concursados: 0, seletivados: 0, contratados: 0, escalaDupla: 0, descoberta: 0, total: 0 },
          AUXILIAR: { concursados: 0, seletivados: 0, contratados: 0, escalaDupla: 0, descoberta: 0, total: 0 },
          MEDICO: { concursados: 0, seletivados: 0, contratados: 0, escalaDupla: 0, descoberta: 0, total: 0 },
          OUTROS: { concursados: 0, seletivados: 0, contratados: 0, escalaDupla: 0, descoberta: 0, total: 0 }
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
            } else if (vin.includes('CONTRAT') || vin.includes('CELETISTA') || vin.includes('TERCEIRIZ') || vin.includes('TERCERIZ')) {
              sectorStats.total.contratados++
              sectorStats[pKey].contratados++
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
          title: displayTitle,
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
        let isContratado = false

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
        else if (vinculo.includes('CONTRAT') || vinculo.includes('CELETISTA') || vinculo.includes('TERCEIRIZ') || vinculo.includes('TERCERIZ')) {
          isContratado = true
          stats.contratados++
          stats.professions[profKey].contratados++
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

export async function getMonthlyScheduledStaffReport(month: number, year: number) {
  try {
    await checkAdmin()

    // ===== COERÇÃO FORTE =====
    year  = _safeYear(year)  as number
    month = _safeMonth(month) as number

    let nurses: any[] = []
    let rosters: any[] = []
    let units: any[] = []
    let sections: any[] = []

    const loadLocal = () => {
      const db = readDb()
      nurses = db.nurses || []
      rosters = (db.monthly_rosters || []).filter((r: any) => r.month === month && r.year === year)
      units = db.units || []
      sections = db.schedule_sections || []
    }

    if (isLocalMode()) {
      loadLocal()
    } else {
      try {
        nurses = (await getNurses()) || []
        sections = (await getSections()) || []

        const supabase = createClient()

        const { data: unitsData, error: unitsError } = await supabase
          .from('units')
          .select('id, title')
          .range(0, 9999)

        if (unitsError) {
          console.warn('Erro ao buscar units:', unitsError.message)
        }
        units = unitsData || []

        let rostersData: any[] | null = null
        let rosterError: any = null
        try {
          const rosterCols = ['id', 'nurse_id', 'unit_id']
          const availSnapCols = await _detectColumns(supabase, 'monthly_rosters', [
            'snapshot_name', 'snapshot_role', 'snapshot_vinculo', 'snapshot_vinculos_json'
          ])
          availSnapCols.forEach(c => rosterCols.push(c))
          const { data, error } = await supabase
            .from('monthly_rosters')
            .select(rosterCols.join(', '))
            .eq('month', month)
            .eq('year', year)
            .range(0, 9999)
          if (!error) rostersData = data || []
          else rosterError = error
        } catch (e: any) {
          rosterError = e
        }
        if (rosterError) {
          console.warn('Erro ao buscar monthly_rosters com seleção dinâmica, fallback sem snapshot:', rosterError?.message || String(rosterError))
          try {
            const { data, error } = await supabase
              .from('monthly_rosters')
              .select('id, nurse_id, unit_id')
              .eq('month', month)
              .eq('year', year)
              .range(0, 9999)
            if (!error) rostersData = data || []
            else console.warn('Falha definitiva no monthly_rosters:', error.message)
          } catch (e2: any) {
            console.warn('Falha definitiva no monthly_rosters (fallback):', e2?.message || String(e2))
          }
        }
        rosters = rostersData || []

        if (rosters.length === 0 && nurses.length === 0) {
          console.warn('Sem dados vindos do Supabase, tentando modo local como fallback.')
          loadLocal()
        }
      } catch (e: any) {
        console.warn('Erro geral na busca de dados, usando modo local:', e?.message || String(e))
        loadLocal()
      }
    }

    // ENRICHMENT: busca vínculos ativos na tabela 1:N nurse_vinculos (fallback p/ nurses.vinculo coluna antiga)
    const rosterNurseIdsScheduled = new Set(rosters.map(r => String((r as any).nurse_id || '')).filter(Boolean))
    let nurseMap: Map<string, any> = await _enrichNursesWithActiveVinculos(nurses, rosterNurseIdsScheduled)

    // APLICAR SNAPSHOTS V26 (PATCH): Criar nurseMap com dados CONGELADOS da época do lançamento,
    // e registrar (por chave nurseId + unitId) o snapshot para usar no rowMap
    // Pré-processar snapshots por (nurseId + unitId) para usar no rowMap
    const snapshotByRosterKey = new Map<string, { name: string; role: string; vinculo: string; vinculosJson: string }>()
    for (const r of rosters) {
      const nid = String((r as any).nurse_id || '')
      const uid = String((r as any).unit_id || '')
      const key = `${nid}::${uid}`
      const snapNome = String((r as any).snapshot_name || '').trim()
      const snapCargo = String((r as any).snapshot_role || '').trim()
      const snapVinculo = String((r as any).snapshot_vinculo || '').trim()
      const snapVinculosJson = String((r as any).snapshot_vinculos_json || '').trim()
      if (snapNome || snapCargo || snapVinculo || snapVinculosJson) {
        const base = nurseMap.get(nid) || { id: nid, name: '', role: '', vinculo: '', vinculos: [] }
        let vinculosParsed: any[] = (base as any).vinculos || []
        if (snapVinculosJson) {
          try {
            const p = JSON.parse(snapVinculosJson)
            if (Array.isArray(p)) vinculosParsed = p
          } catch {}
        }
        const patched = {
          ...base,
          id: base.id,
          name: snapNome || base.name,
          role: snapCargo || base.role,
          vinculo: snapVinculo || base.vinculo || '',
          vinculos: vinculosParsed
        }
        nurseMap.set(nid, patched)
        snapshotByRosterKey.set(key, { name: snapNome, role: snapCargo, vinculo: snapVinculo, vinculosJson: snapVinculosJson })
      }
    }

    const unitMap = new Map<string, any>()
    units.forEach(u => unitMap.set(String(u.id), u))

    const formatCouncilNumber = (nurse: any) => {
      const coren = String(nurse?.coren || '').trim()
      if (coren) return coren

      const crm = String(nurse?.crm || '').trim()
      if (!crm) return ''

      const match = crm.match(/^[A-Za-zÀ-ÿ]+(?:[\s./-]+)?(.+)$/)
      return String(match?.[1] || crm).trim()
    }

    const parseCouncilFromCrm = (value: any) => {
      const raw = String(value ?? '').trim()
      if (!raw) return { type: '', number: '', raw: '' }

      const normalized = raw.replace(/^[-–—:\s]+/, '').trim()
      const m = normalized.match(/^([A-Za-z]{2,18})\s*[-–—:]*\s*(.+)$/)
      if (m) {
        const type = String(m[1] || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
        const number = String(m[2] || '').trim()
        return { type, number, raw: normalized }
      }

      const numericOnly = normalized.replace(/[.\-\/\s]/g, '')
      if (numericOnly && /^[0-9]+$/.test(numericOnly)) {
        return { type: 'CRM', number: normalized, raw: normalized }
      }

      return { type: '', number: normalized, raw: normalized }
    }

    const resolveCouncil = (nurse: any) => {
      const role = String(nurse?.role || '').toUpperCase()
      const isDoctor = role.includes('MEDICO') || role.includes('MÉDICO')
      const coren = String(nurse?.coren ?? '').trim()
      const parsed = parseCouncilFromCrm(nurse?.crm)

      let type = ''
      let number = ''

      if (isDoctor) {
        if (parsed.type) type = parsed.type
        else if (parsed.raw || coren) type = 'CRM'
        if (parsed.number || parsed.raw || coren) number = (parsed.number || parsed.raw || coren).trim()
      } else {
        if (coren) {
          type = 'COREN'
          number = coren
        } else {
          type = parsed.type || ''
          number = (parsed.number || parsed.raw || '').trim()
        }
      }

      return { type: type || '-', number: number || '-' }
    }

    const formatDate = (value: any) => {
      const raw = String(value || '').trim()
      if (!raw) return '-'
      const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (match) return `${match[3]}/${match[2]}/${match[1]}`
      return raw
    }

    const rowMap = new Map<string, {
      id: string
      name: string
      role: string
      roleGroup: 'ENF' | 'TEC' | 'AUX' | 'MED' | 'OUTROS'
      councilType: string
      councilNumber: string
      sector: string
      corenExpiryDate: string
      birthDate: string
      admissionDate: string
      phone: string
      address: string
      houseNumber: string
      city: string
      email: string
    }>()

    const classifyRole = (value: any): 'ENF' | 'TEC' | 'AUX' | 'MED' | 'OUTROS' => {
      const role = String(value || '').toUpperCase()
      if (role.includes('ENFERMEIRO')) return 'ENF'
      if (role.includes('TECNICO') || role.includes('TÉCNICO')) return 'TEC'
      if (role.includes('AUXILIAR')) return 'AUX'
      if (role.includes('MEDICO') || role.includes('MÉDICO')) return 'MED'
      return 'OUTROS'
    }

    rosters.forEach((roster: any) => {
      const nurseId = String(roster?.nurse_id || '')
      const unitId = String(roster?.unit_id || '')
      const nurse = nurseId ? nurseMap.get(nurseId) : undefined
      const unit = unitId ? unitMap.get(unitId) : undefined

      const key = `${nurseId}::${unitId}`
      if (key === '::' || rowMap.has(key)) return

      const baseNurse = nurse || {
        id: nurseId,
        name: '',
        role: '',
        coren: '',
        crm: '',
        coren_expiry_date: '',
        birth_date: '',
        data_admissao: '',
        dataAdmissao: '',
        admission_date: '',
        phone: '',
        address: '',
        house_number: '',
        city: '',
        email: '',
      }
      const baseUnit = unit || {
        id: unitId,
        title: '',
      }

      const council = resolveCouncil(baseNurse)

      const nurseName = String(baseNurse.name || '').trim()
        || (nurseId ? `Servidor (${nurseId.slice(0, 8)}...)` : '-')
      const sectorTitle = String(baseUnit.title || '').trim()
        || (unitId ? `Setor (${unitId.slice(0, 8)}...)` : '-')

      rowMap.set(key, {
        id: key,
        name: nurseName,
        role: String(baseNurse.role || '').trim() || '-',
        roleGroup: classifyRole(baseNurse.role),
        councilType: council.type,
        councilNumber: council.number,
        sector: sectorTitle,
        corenExpiryDate: formatDate(baseNurse.coren_expiry_date),
        birthDate: formatDate(baseNurse.birth_date),
        admissionDate:
          formatDate(String(baseNurse.data_admissao || '').trim()) ||
          formatDate(String(baseNurse.admission_date || '').trim()) ||
          formatDate(String(baseNurse.dataAdmissao || '').trim()) ||
          '-',
        phone: String(baseNurse.phone || '').trim() || '-',
        address: String(baseNurse.address || '').trim() || '-',
        houseNumber: String(baseNurse.house_number || '').trim() || '-',
        city: String(baseNurse.city || '').trim() || '-',
        email: String(baseNurse.email || '').trim() || '-'
      })
    })

    if (rowMap.size === 0 && Array.isArray(nurses) && nurses.length > 0) {
      const sectionMap = new Map(
        (Array.isArray(sections) ? sections : [])
          .map((s: any) => [String(s?.id || ''), s])
          .filter(([id]) => id)
      )

      nurses.forEach((nurse: any) => {
        const nurseId = String(nurse?.id || '')
        if (!nurseId) return
        const unitId = String(nurse?.unit_id || '')
        const unit = unitId ? unitMap.get(unitId) : undefined
        const sectionId = String(nurse?.section_id || '')
        const section = sectionId ? sectionMap.get(sectionId) : undefined

        const unitOrSectionTitle =
          String(unit?.title || '').trim()
          || String(section?.title || '').trim()
          || (unitId ? `Setor (${unitId.slice(0, 8)}...)` : '-')

        const key = `${nurseId}::${unitId || sectionId || 'no-unit'}`
        if (rowMap.has(key)) return

        const council = resolveCouncil(nurse)
        rowMap.set(key, {
          id: key,
          name: String(nurse.name || '').trim() || '-',
          role: String(nurse.role || '').trim() || '-',
          roleGroup: classifyRole(nurse.role),
          councilType: council.type,
          councilNumber: council.number,
          sector: unitOrSectionTitle,
          corenExpiryDate: formatDate(nurse.coren_expiry_date),
          birthDate: formatDate(nurse.birth_date),
          admissionDate:
            formatDate(String(nurse.data_admissao || '').trim()) ||
            formatDate(String(nurse.admission_date || '').trim()) ||
            formatDate(String(nurse.dataAdmissao || '').trim()) ||
            '-',
          phone: String(nurse.phone || '').trim() || '-',
          address: String(nurse.address || '').trim() || '-',
          houseNumber: String(nurse.house_number || '').trim() || '-',
          city: String(nurse.city || '').trim() || '-',
          email: String(nurse.email || '').trim() || '-'
        })
      })
    }

    const rows = Array.from(rowMap.values()).sort((a, b) => {
      const sectorCompare = a.sector.localeCompare(b.sector, 'pt-BR', { sensitivity: 'base' })
      if (sectorCompare !== 0) return sectorCompare
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    })

    const sectors = Array.from(
      new Set(
        units
          .map((unit: any) => String(unit?.title || '').trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))

    return {
      success: true,
      data: {
        totalRows: rows.length,
        rows,
        sectors
      }
    }
  } catch (e: any) {
    console.error('Error generating scheduled staff report:', e)
    return { success: false, message: 'Erro ao gerar relatório de escalados: ' + e.message }
  }
}

export async function getMonthlyNote(month: number, year: number, unitId?: string | null) {
  try {
    // ===== COERÇÃO FORTE =====
    year  = _safeYear(year)  as number
    month = _safeMonth(month) as number

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

      // ===== COERÇÃO FORTE =====
      const safeYear  = _safeYear(year)
      const safeMonth = _safeMonth(month)
      month = safeMonth as number
      year  = safeYear  as number

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
  const user = getCurrentSessionUser()
  if (!user) return null
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
    // ===== COERÇÃO FORTE (evita startDate NaN e retorno vazio indevido) =====
    year  = _safeYear(year)  as number
    month = _safeMonth(month) as number

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

      // Patch com snapshots: para cada nurse, se roster tem snapshot, sobrepõe nome/cargo/vinculo do nurse com o snapshot (congelado na época)
      const nursesById = new Map<string, any>()
      ;(nurses || []).forEach((n: any) => nursesById.set(String(n.id), n))
      for (const r of roster || []) {
        const nid = String(r.nurse_id || '')
        if (!nid) continue
        const snapNome = String((r as any).snapshot_name || '').trim()
        const snapCargo = String((r as any).snapshot_role || '').trim()
        const snapVinculo = String((r as any).snapshot_vinculo || '').trim()
        const snapVinculosJson = String((r as any).snapshot_vinculos_json || '').trim()
        if (!snapNome && !snapCargo && !snapVinculo && !snapVinculosJson) continue
        const nurseBase = nursesById.get(nid) || { id: nid, name: '', role: '', vinculo: '', vinculos: [] }
        let vinculosParsed: any[] = nurseBase.vinculos || []
        if (snapVinculosJson) {
          try {
            const parsed = JSON.parse(snapVinculosJson)
            if (Array.isArray(parsed)) vinculosParsed = parsed
          } catch {}
        }
        const patched: any = {
          ...nurseBase,
          id: nurseBase.id,
          name: snapNome || nurseBase.name,
          role: snapCargo || nurseBase.role,
          vinculo: snapVinculo || nurseBase.vinculo || '',
          vinculos: vinculosParsed
        }
        nursesById.set(nid, patched)
      }
      const nursesPatched = Array.from(nursesById.values())

      return {
        nurses: nursesPatched || [],
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
    const rosterBaseCols = ['id', 'nurse_id', 'unit_id', 'section_id', 'month', 'year', 'observation', 'sector', 'created_at', 'list_order', 'name_star']
    const availSnapCols = await _detectColumns(supabase, 'monthly_rosters', [
      'snapshot_name', 'snapshot_role', 'snapshot_vinculo', 'snapshot_vinculos_json'
    ])
    availSnapCols.forEach(c => rosterBaseCols.push(c))
    let rosterQuery = supabase.from('monthly_rosters')
        .select(rosterBaseCols.join(', '))
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
    if ((!rosterData || rosterData.length === 0) && rosterError) {
      // Fallback para versões antigas (colunas ausentes)
      const fallbackCols = [
        'id', 'nurse_id', 'unit_id', 'section_id', 'month', 'year', 'observation', 'sector', 'created_at', 'list_order'
      ]
      if (rosterError?.message?.includes('name_star')) fallbackCols.pop()
      // remove colunas snapshot da lista de fallback (pois foram adicionadas no V26)
      let rosterFallbackQuery = supabase.from('monthly_rosters')
        .select(fallbackCols.join(', '))
        .eq('month', month)
        .eq('year', year)
      if (unitId) rosterFallbackQuery = rosterFallbackQuery.eq('unit_id', unitId)
      else if (unitId !== undefined) rosterFallbackQuery = rosterFallbackQuery.is('unit_id', null)
      const { data: fallbackRoster, error: fallbackErr } = await rosterFallbackQuery.range(0, 5000)
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

    // Patch com snapshots (congela dados históricos da época do lançamento)
    const nursesByIdSb = new Map<string, any>()
    ;(nurses || []).forEach((n: any) => nursesByIdSb.set(String(n.id), n))
    for (const r of roster || []) {
      const nid = String(r.nurse_id || '')
      if (!nid) continue
      const snapNome = String((r as any).snapshot_name || '').trim()
      const snapCargo = String((r as any).snapshot_role || '').trim()
      const snapVinculo = String((r as any).snapshot_vinculo || '').trim()
      const snapVinculosJson = String((r as any).snapshot_vinculos_json || '').trim()
      if (!snapNome && !snapCargo && !snapVinculo && !snapVinculosJson) continue
      const nurseBase = nursesByIdSb.get(nid) || { id: nid, name: '', role: '', vinculo: '', vinculos: [] }
      let vinculosParsed: any[] = (nurseBase as any).vinculos || []
      if (snapVinculosJson) {
        try {
          const parsed = JSON.parse(snapVinculosJson)
          if (Array.isArray(parsed)) vinculosParsed = parsed
        } catch {}
      }
      const patched: any = {
        ...nurseBase,
        id: nurseBase.id,
        name: snapNome || nurseBase.name,
        role: snapCargo || nurseBase.role,
        vinculo: snapVinculo || nurseBase.vinculo || '',
        vinculos: vinculosParsed
      }
      nursesByIdSb.set(nid, patched)
    }
    const nursesPatchedSb = Array.from(nursesByIdSb.values())

    return {
        nurses: nursesPatchedSb || [],
        roster: roster,
        shifts: shifts,
        timeOffs: timeOffs,
        absences: absencesData || [],
        sections: sections || [],
        units: units || [],
        releases: releasesData || []
    }
  } catch (error: any) {
    console.error('Critical error in getMonthlyScheduleData:', error)
    const errMsg = error?.message || String(error) || 'Erro desconhecido'
    const isConnError = errMsg.includes('fetch') || errMsg.includes('ENOTFOUND') || errMsg.includes('DNS') || errMsg.includes('network') || errMsg.includes('ECONNREFUSED') || errMsg.includes('timeout') || errMsg.includes('Socket')
    return {
      nurses: [],
      roster: [],
      shifts: [],
      timeOffs: [],
      absences: [],
      sections: [],
      units: [],
      releases: [],
      __error: {
        message: errMsg,
        isConnectionError: isConnError,
        timestamp: new Date().toISOString(),
        hint: isConnError
          ? 'Falha de conexao com o Supabase. Verifique sua internet ou o painel do Supabase (projeto pode estar pausado ou excluido).'
          : 'Erro ao carregar dados. Verifique o console para mais detalhes.'
      }
    } as any
  }
}

export async function exportMonthlySchedule(month: number, year: number, unitId: string | null) {
    try {
        await checkAdmin()
        // ===== COERÇÃO FORTE =====
        year  = _safeYear(year)  as number
        month = _safeMonth(month) as number
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

        // ===== COERÇÃO FORTE (evita importar no mês errado / NULL) =====
        const safeYear  = _safeYear(year)
        const safeMonth = _safeMonth(month)
        month = safeMonth as number
        year  = safeYear  as number

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
      const user = getCurrentSessionUser()
      if (!user) throw new Error('Sessão inválida')

      // ===== COERÇÃO FORTE (evita liberar mês errado / NULL) =====
      const safeYear  = _safeYear(year)
      const safeMonth = _safeMonth(month)
      month = safeMonth as number
      year  = safeYear  as number
      
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

      // ===== COERÇÃO FORTE =====
      const safeYear  = _safeYear(year)
      const safeMonth = _safeMonth(month)
      month = safeMonth as number
      year  = safeYear  as number

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

      // ===== COERÇÃO FORTE =====
      const safeYear  = _safeYear(year)
      const safeMonth = _safeMonth(month)
      month = safeMonth as number
      year  = safeYear  as number

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

      // ===== COERÇÃO FORTE =====
      const safeYear  = _safeYear(year)
      const safeMonth = _safeMonth(month)
      month = safeMonth as number
      year  = safeYear  as number

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

      // ===== COERÇÃO FORTE =====
      const safeYear  = _safeYear(year)
      const safeMonth = _safeMonth(month)
      month = safeMonth as number
      year  = safeYear  as number

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

  // ===== COERÇÃO FORTE (evita apagar tudo caso month/year cheguem NaN/undefined do front) =====
  const safeYear  = _safeYear(year)
  const safeMonth = _safeMonth(month)
  // Rebind transparente: todo o resto da função continua igual, mas usa valores seguros.
  month = safeMonth as number
  year  = safeYear  as number

  // === PROTECAO DE SEGURANCA: Trava de escala liberada ===
  try {
    const currentUser = await (async () => { try { return await checkUser() } catch(e){ return null } })()
    const portalKey = resolvePortalKey()
    const localMode = isLocalMode(portalKey)
    const lib = localMode
      ? await checkIsReleasedLocal(month, year, unitId)
      : await checkIsReleasedSupabase(month, year, unitId)
    if (lib.released) {
      const v = validateClearMonthly(month, year, lib.unit_name)
      return { success: false, locked: true, message: v.failMessage }
    }
  } catch {}
  // === FIM TRAVA ===

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

export async function clearAllDatabaseShifts(confirmText?: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  // === PROTECAO 1: trava se EXISTIR QUALQUER escala liberada ===
  try {
    const portalKey = resolvePortalKey()
    const localMode = isLocalMode(portalKey)
    const any = localMode
      ? await checkAnyReleasedLocal()
      : await checkIsAnyReleasedSupabase()
    if (any.released) {
      return { success: false, locked: true,
        message: `TRAVA DE SEGURANÇA: Existe escala liberada em "${any.unit_name || '?'}" (${any.month}/${any.year}). Para apagar TUDO você precisa primeiro cancelar a liberação de TODAS as escalas liberadas.` }
    }
    // === PROTECAO 2: Confirmacao obrigatoria APAGAR TUDO ===
    if (confirmText !== 'APAGAR TUDO') {
      return { success: false, needConfirm: true, expectedConfirm: 'APAGAR TUDO',
        message: `Confirmação OBRIGATÓRIA: para apagar TODAS as escalas de TODOS os setores/meses (irrecuperável), DIGITE EXATAMENTE: APAGAR TUDO` }
    }
  } catch {}

  try {
    const supabase = createClient()
    const currentUser = await (async () => { try { return await checkUser() } catch(e){ return null } })()

    if (isLocalMode()) {
        const db = readDb()
        db.shifts = []
        db.monthly_rosters = []
        db.absences = []
        db.monthly_schedule_metadata = []
        db.audit_logs = db.audit_logs || []
        db.audit_logs.push({
            id: randomUUID(),
            user_id: currentUser?.id || 'system',
            user_name: currentUser?.name || 'Limpeza Total',
            action: 'CLEAR_ALL_DATABASE',
            details: { message: 'Banco de dados de escala resetado pelo usuário', confirmText },
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

    if (currentUser) {
        await supabase.from('audit_logs').insert({
            user_id: currentUser.id,
            user_name: currentUser.name,
            action: 'CLEAR_ALL_DATABASE',
            details: { message: 'Reset total do banco solicitado', confirmText }
        })
    }

    revalidatePath('/')
    return { success: true, message: 'Todo o banco de dados de escala foi limpo com sucesso.' }
  } catch (e: any) {
    console.error('Error in clearAllDatabaseShifts:', e)
    return { success: false, message: 'Erro ao limpar banco: ' + e.message }
  }
}

export async function clearSectionRoster(month: number, year: number, unitId: string | null, sectionId: string, confirmText?: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  // ===== COERÇÃO FORTE (evita apagar tudo caso month/year cheguem NaN/undefined do front) =====
  const safeYear  = _safeYear(year)
  const safeMonth = _safeMonth(month)
  month = safeMonth as number
  year  = safeYear  as number

  // === PROTECAO SEGURANCA ===
  try {
    const portalKey = resolvePortalKey()
    const localMode = isLocalMode(portalKey)
    const lib = localMode
      ? await checkIsReleasedLocal(month, year, unitId)
      : await checkIsReleasedSupabase(month, year, unitId)
    if (lib.released) {
      return { success: false, locked: true,
        message: `ESCALA LIBERADA (TRAVA DE SEGURANÇA): "${lib.unit_name || unitId || 'geral'}" (${month}/${year}) está liberada. Cancele a liberação primeiro antes de remover este bloco.` }
    }
  } catch {}

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

export async function clearAllUnitRosters(unitId: string, confirmText?: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  // === PROTECAO 1: trava se QUALQUER mes da unidade estiver liberado ===
  try {
    const portalKey = resolvePortalKey()
    const localMode = isLocalMode(portalKey)
    const mesesLiberados: string[] = []
    let unit_name: string | null = null
    if (localMode) {
      const db = readDb()
      const metas = db.monthly_schedule_metadata || []
      const liberadas = metas.filter((m: any) => m.unit_id === unitId && m.is_released)
      liberadas.forEach((m: any) => mesesLiberados.push(`${m.month}/${m.year}`))
      const u = (db.units || []).find((x: any) => x.id === unitId) as any
      unit_name = u?.title || null
    } else {
      const sb = createClient(portalKey)
      const { data } = await sb
        .from('monthly_schedule_metadata')
        .select('month,year,is_released,units(title)')
        .eq('unit_id', unitId).eq('is_released', true)
      ;(data || []).forEach((m: any) => mesesLiberados.push(`${m.month}/${m.year}`))
      unit_name = ((data||[])[0] as any)?.units?.title || null
    }
    if (mesesLiberados.length) {
      return { success: false, locked: true,
        message: `TRAVA DE SEGURANÇA: O setor "${unit_name || unitId}" tem escala(s) liberada(s) em: ${mesesLiberados.join(', ')}. Cancele a liberação PRIMEIRO de cada mês antes de apagar TODO o histórico do setor.` }
    }
    // PROTECAO 2: confirmacao do nome do setor em maiusculas
    let esperado = 'SETOR'
    if (localMode) {
      const u = (readDb().units || []).find((x: any) => x.id === unitId) as any
      esperado = (u?.title || 'SETOR').toString().toUpperCase().trim()
    } else {
      const sb = createClient(portalKey)
      const { data } = await sb.from('units').select('title').eq('id', unitId).limit(1)
      esperado = (((data||[])[0] as any)?.title || 'SETOR').toString().toUpperCase().trim()
    }
    if (confirmText !== esperado) {
      return { success: false, needConfirm: true, expectedConfirm: esperado,
        message: `Confirmação OBRIGATÓRIA: para apagar TODO O HISTÓRICO do setor "${esperado}", DIGITE EXATAMENTE o nome do setor em MAIÚSCULAS. Esperado: "${esperado}"` }
    }
  } catch {}

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

type NurseSnapshot = {
  snapshot_name: string
  snapshot_role: string
  snapshot_vinculo: string
  snapshot_vinculos_json: string
}
async function _buildNurseSnapshot(nurseId: string): Promise<NurseSnapshot> {
  const empty: NurseSnapshot = { snapshot_name: '', snapshot_role: '', snapshot_vinculo: '', snapshot_vinculos_json: '' }
  if (!nurseId) return empty
  try {
    let nurse: any = null
    let vinculosAtivos: any[] = []
    if (isLocalMode()) {
      const db = readDb()
      nurse = db.nurses.find((n: any) => n.id === nurseId) || null
      const allVinculos = db.nurse_vinculos || []
      vinculosAtivos = allVinculos.filter((v: any) => v.nurse_id === nurseId && !v.data_baixa)
    } else {
      const sb = createClient()
      const { data } = await sb.from('nurses').select('*').eq('id', nurseId).maybeSingle()
      nurse = data || null
      try {
        const { data: vdata } = await sb.from('nurse_vinculos').select('*').eq('nurse_id', nurseId).is('data_baixa', null)
        vinculosAtivos = (vdata || []).filter((v: any) => !v.data_baixa || v.data_baixa === '')
      } catch {}
    }
    if (!nurse) return empty
    const snapshot_vinculo = vinculosAtivos.length > 0
      ? Array.from(new Set(vinculosAtivos.map((v: any) => String(v.tipo_vinculo || '').toUpperCase()).filter(Boolean))).join(' / ')
      : String(nurse.vinculo || '')
    const snapshot_vinculos_json = vinculosAtivos.length > 0
      ? JSON.stringify(vinculosAtivos.map((v: any) => ({
          tipo_vinculo: String(v.tipo_vinculo || ''),
          data_admissao: String(v.data_admissao || ''),
          data_baixa: String(v.data_baixa || '')
        })))
      : ''
    return {
      snapshot_name: String(nurse.name || ''),
      snapshot_role: String(nurse.role || ''),
      snapshot_vinculo,
      snapshot_vinculos_json
    }
  } catch {
    return empty
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

  // ===== VALIDAÇÃO / COERÇÃO FORTE DE MÊS E ANO (evita NULL em monthly_rosters.month) =====
  // Se chegou string 'Agosto', NaN, null, undefined ou 0 → caí no default (mês/ano atual)
  const safeYear  = _safeYear(year)
  const safeMonth = _safeMonth(month)

  // ===== VALIDAÇÃO HARD (DOUBLE CHECK): NUNCA pode chegar aqui com null/NaN/object.
  // Mesmo que _safeMonth/_safeYear sejam reescritos com bug no futuro, este bloco previne.
  const __m = Number(safeMonth)
  const __y = Number(safeYear)
  if (!Number.isInteger(__m) || __m < 1 || __m > 12) {
    console.error('[assignNurseToRoster:VALIDAÇÃO MÊS FALHOU]', { monthParam: month, _safeMonth, safeMonth, __m })
    return { success: false, message: `Mês inválido (debug: month=${JSON.stringify(month)} safe=${JSON.stringify(safeMonth)})` }
  }
  if (!Number.isInteger(__y) || __y < 2020 || __y > 2100) {
    console.error('[assignNurseToRoster:VALIDAÇÃO ANO FALHOU]', { yearParam: year, safeYear, __y })
    return { success: false, message: `Ano inválido (debug: year=${JSON.stringify(year)} safe=${JSON.stringify(safeYear)})` }
  }

  // Validar nurseId e sectionId (não podem ficar empty também)
  if (!nurseId || !String(nurseId).trim()) return { success: false, message: 'Profissional não informado (nurseId vazio).' }
  if (!sectionId || !String(sectionId).trim()) return { success: false, message: 'Setor / Secção não informado.' }

  // Only update the specific month (no propagation)
  const monthsToUpdate = [__m]
  let lastInsertedId: string | undefined = undefined
  const snapshot = await _buildNurseSnapshot(nurseId)

  if (isLocalMode()) {
    const db = readDb()
    if (!db.monthly_rosters) db.monthly_rosters = []
    
    monthsToUpdate.forEach(m => {
        // Check if already in roster for this month AND unit (update or insert)
        const existingIndex = db.monthly_rosters.findIndex((r: any) => 
            r.nurse_id === nurseId && 
            r.month === m && 
            r.year === safeYear &&
            (unitId ? r.unit_id === unitId : !r.unit_id)
        )
        
        let finalOrder = listOrder
        if (finalOrder === undefined || finalOrder === null) {
            // Find max list_order in this section/month/unit to put at the end
            const currentRoster = db.monthly_rosters.filter((r: any) => 
                r.section_id === sectionId && 
                r.month === m && 
                r.year === safeYear &&
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
          const old = db.monthly_rosters[existingIndex]
          if (!old.snapshot_name && !old.snapshot_vinculo) {
            Object.assign(old, snapshot)
          }
          lastInsertedId = db.monthly_rosters[existingIndex].id
        } else {
          const newId = randomUUID()
          const __month = __m
          const __year  = __y
          db.monthly_rosters.push({
            id: newId,
            nurse_id: nurseId,
            section_id: sectionId,
            unit_id: unitId,
            month: __month,
            year: __year,
            observation: observation || '',
            created_at: createdAt || new Date().toISOString(),
            list_order: finalOrder,
            ...snapshot
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
  // Incluir 'sector' nas colunas detectadas pois assignNurseToRoster pode receber sector.
  const rosterCols = await _detectColumns(supabase, 'monthly_rosters', [
    'id','nurse_id','section_id','unit_id','month','year','sector','observation','created_at','list_order','name_star',
    'snapshot_name','snapshot_role','snapshot_vinculo','snapshot_vinculos_json'
  ])

  for (const m of monthsToUpdate) {
    // Check if exists first to decide whether to clear shifts
    let query = supabase
        .from('monthly_rosters')
        .select('id, snapshot_vinculo')
        .eq('nurse_id', nurseId)
        .eq('month', m)
        .eq('year', safeYear)
    
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
            .eq('year', safeYear)
        
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
        month: __m,       // NÃO confiar em "m" do loop. Forçar número seguro validado.
        year:  __y        // NÃO confiar em safeYear direto. Forçar número validado.
    }
    
    let finalOrder = listOrder
    if (finalOrder === undefined || finalOrder === null) {
        // Find max list_order in this section/month/unit to put at the end
        let maxQuery = supabase
            .from('monthly_rosters')
            .select('list_order')
            .eq('section_id', sectionId)
            .eq('month', __m)
            .eq('year', __y)
        
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
    if (finalOrder !== undefined) payload.list_order = Number(finalOrder)

    // Apply snapshots only if inserting new OR existing snapshot is empty (migração)
    const needsSnapshot = !existing || !String(existing.snapshot_vinculo || '').trim()
    if (needsSnapshot) {
      if (rosterCols.has('snapshot_name')) payload.snapshot_name = snapshot.snapshot_name
      if (rosterCols.has('snapshot_role')) payload.snapshot_role = snapshot.snapshot_role
      if (rosterCols.has('snapshot_vinculo')) payload.snapshot_vinculo = snapshot.snapshot_vinculo
      if (rosterCols.has('snapshot_vinculos_json')) payload.snapshot_vinculos_json = snapshot.snapshot_vinculos_json
    }

    // ==================================================================================
    // FIX CRÍTICO: _detectColumns pode falhar com timeout e APAGAR month/year obrigatórios
    // do filteredPayload → Postgres NOT NULL violation. NUNCA filtrar colunas mínimas.
    // ==================================================================================
    const COLUNAS_OBRIGATORIAS = new Set([
      'nurse_id','section_id','unit_id','month','year','observation','created_at','list_order'
    ])

    // Filter payload to only include columns that exist OR are mandatory (nunca remover obrigatórias!)
    const filteredPayload: any = {}
    for (const k of Object.keys(payload)) {
      if (COLUNAS_OBRIGATORIAS.has(k) || rosterCols.has(k)) {
        filteredPayload[k] = payload[k]
      }
    }

    // ==================================================================================
    // VALIDAÇÃO FINAL ANTES DE INSERT / UPDATE: se não tem month/year → RETORNAR ANTES de chamar Supabase
    // (previne para sempre o erro "null value in column month of relation monthly_rosters")
    // ==================================================================================
    const __pfMonth = Number(filteredPayload.month)
    const __pfYear  = Number(filteredPayload.year)
    if (!Number.isInteger(__pfMonth) || __pfMonth < 1 || __pfMonth > 12 || !Number.isInteger(__pfYear) || __pfYear < 2020 || __pfYear > 2100) {
      console.error('[assignNurseToRoster:VALOR FINAL PAYLOAD INVÁLIDO ANTES DE INSERT!]', {
        params: { month, year },
        safe: { safeMonth, safeYear, __m, __y },
        payload,
        filteredPayload,
        rosterCols: Array.from(rosterCols),
        'colunas detectadas qtd': rosterCols.size
      })
      return {
        success: false,
        message: `Validação mês/ano falhou no payload final (detecção de colunas timeout? rosterCols.size=${rosterCols.size}). filteredMonth=${JSON.stringify(filteredPayload.month)} filteredYear=${JSON.stringify(filteredPayload.year)} — contate suporte.`
      }
    }
    // Garantir que são números inteiros limpos (não strings)
    filteredPayload.month = __pfMonth
    filteredPayload.year  = __pfYear
    if (filteredPayload.list_order !== undefined) filteredPayload.list_order = Number(filteredPayload.list_order)

    let error: any;
    let resultId: string | undefined = undefined

    if (allowDuplicate) {
        // If allowing duplicates, always insert a new record
        const { data: inserted, error: insertError } = await supabase
            .from('monthly_rosters')
            .insert(filteredPayload)
            .select('id')
            .single()
        error = insertError
        resultId = inserted?.id
    } else {
        if (existing) {
            // Update existing in THIS unit
            const { error: updateError } = await supabase
                .from('monthly_rosters')
                .update(filteredPayload)
                .eq('id', existing.id)
            error = updateError
            resultId = existing.id
        } else {
            // Insert new for THIS unit (even if nurse exists in other units)
            const { data: inserted, error: insertError } = await supabase
                .from('monthly_rosters')
                .insert(filteredPayload)
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

  // ===== COERÇÃO FORTE (evita apagar de mês errado / NULL) =====
  const safeYear  = _safeYear(year)
  const safeMonth = _safeMonth(month)
  month = safeMonth as number
  year  = safeYear  as number

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

  // === PROTECAO DE SEGURANCA: trava de escala liberada ===
  try {
    const portalKey = resolvePortalKey()
    const localMode = isLocalMode(portalKey)
    let unitIdCheck: string | null = null, month: number | null = null, year: number | null = null
    if (localMode) {
      const r = (readDb().monthly_rosters || []).find((x: any) => x.id === rosterId) as any
      if (r) { unitIdCheck = r.unit_id || null; month = r.month; year = r.year }
    } else {
      const sb = createClient(portalKey)
      const { data } = await sb.from('monthly_rosters').select('id,unit_id,month,year').eq('id', rosterId).limit(1)
      const r = (data || [])[0] as any
      if (r) { unitIdCheck = r.unit_id || null; month = r.month; year = r.year }
    }
    if (unitIdCheck && month && year) {
      const lib = localMode
        ? await checkIsReleasedLocal(month, year, unitIdCheck)
        : await checkIsReleasedSupabase(month, year, unitIdCheck)
      if (lib.released) {
        return { success: false, locked: true,
          message: `ESCALA LIBERADA (TRAVA DE SEGURANÇA): "${lib.unit_name || unitIdCheck}" (${month}/${year}) está liberada. Não é permitido remover servidores de escala já liberada. Cancele a liberação primeiro.` }
      }
    }
  } catch {}
  // === FIM TRAVA ===

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

  // ===== COERÇÃO FORTE DE MÊS/ANO (evita month=NULL, NaN, string "Agosto", etc.) =====
  const now = new Date()
  const safeSourceMonth = _safeMonth(sourceMonth, (now.getMonth() + 1))
  const safeSourceYear  = _safeYear(sourceYear, now.getFullYear())
  const safeTargetMonth = _safeMonth(targetMonth, (now.getMonth() + 1))
  const safeTargetYear  = _safeYear(targetYear, now.getFullYear())
  // Rebind das variáveis de origem para usar os valores seguros em TODO resto da função
  sourceMonth = safeSourceMonth
  sourceYear  = safeSourceYear
  targetMonth = safeTargetMonth
  targetYear  = safeTargetYear

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
    
    // Pré-computar snapshots V26 para cada nurse (mês novo = lançamento novo, estado atual do cadastro é o snapshot)
    const snapMapLocal = new Map<string, NurseSnapshot>()
    for (const sr of sourceRoster) {
      if (sr.nurse_id && !snapMapLocal.has(String(sr.nurse_id))) {
        snapMapLocal.set(String(sr.nurse_id), await _buildNurseSnapshot(String(sr.nurse_id)))
      }
    }

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
        const snap = snapMapLocal.get(String(sr.nurse_id))
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
            created_at: new Date().toISOString(),
            snapshot_name: snap?.snapshot_name || '',
            snapshot_role: snap?.snapshot_role || '',
            snapshot_vinculo: snap?.snapshot_vinculo || '',
            snapshot_vinculos_json: snap?.snapshot_vinculos_json || ''
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
                roster_id: targetRoster.id,
                snapshot_name: snap?.snapshot_name || '',
                snapshot_role: snap?.snapshot_role || '',
                snapshot_vinculo: snap?.snapshot_vinculo || '',
                snapshot_vinculos_json: snap?.snapshot_vinculos_json || ''
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

  // Detectar colunas V26 em monthly_rosters e shifts
  const rosterColsV26 = await _detectColumns(supabase, 'monthly_rosters', [
    'snapshot_name','snapshot_role','snapshot_vinculo','snapshot_vinculos_json'
  ])
  const shiftsColsV26 = await _detectColumns(supabase, 'shifts', [
    'snapshot_name','snapshot_role','snapshot_vinculo','snapshot_vinculos_json'
  ])

  // Pré-computar snapshots V26 para cada nurse (mês novo = lançamento novo, estado atual do cadastro)
  const snapMapSb = new Map<string, NurseSnapshot>()
  for (const sr of sourceRoster) {
    if (sr.nurse_id && !snapMapSb.has(String(sr.nurse_id))) {
      snapMapSb.set(String(sr.nurse_id), await _buildNurseSnapshot(String(sr.nurse_id)))
    }
  }

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
      const snap = snapMapSb.get(String(sourceEntry.nurse_id))
      
      const targetEntry: any = {
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
      if (snap) {
        if (rosterColsV26.has('snapshot_name')) targetEntry.snapshot_name = snap.snapshot_name
        if (rosterColsV26.has('snapshot_role')) targetEntry.snapshot_role = snap.snapshot_role
        if (rosterColsV26.has('snapshot_vinculo')) targetEntry.snapshot_vinculo = snap.snapshot_vinculo
        if (rosterColsV26.has('snapshot_vinculos_json')) targetEntry.snapshot_vinculos_json = snap.snapshot_vinculos_json
      }

      const { data: insertedRoster, error: insertError } = await supabase
          .from('monthly_rosters')
          .insert(targetEntry)
          .select()
          .single()
      
      if (insertError) continue
      addedCount++

      if (p.shiftsToInsert.length > 0) {
          const finalShifts = p.shiftsToInsert.map(s => {
              const row: any = {
                  ...s,
                  roster_id: insertedRoster.id
              }
              if (snap) {
                if (shiftsColsV26.has('snapshot_name')) row.snapshot_name = snap.snapshot_name
                if (shiftsColsV26.has('snapshot_role')) row.snapshot_role = snap.snapshot_role
                if (shiftsColsV26.has('snapshot_vinculo')) row.snapshot_vinculo = snap.snapshot_vinculo
                if (shiftsColsV26.has('snapshot_vinculos_json')) row.snapshot_vinculos_json = snap.snapshot_vinculos_json
              }
              return row
          })
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

    // ===== COERÇÃO FORTE =====
    const safeYear  = _safeYear(year)
    const safeMonth = _safeMonth(month)
    month = safeMonth as number
    year  = safeYear  as number

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
  const c = cookies()
  try { c.delete('session_user') } catch {}
  try { c.delete({ name: 'session_user', path: '/' }) } catch {}
  try { c.delete('login_selection_options') } catch {}
  try { c.delete({ name: 'login_selection_options', path: '/' }) } catch {}
  redirect('/')
}

export async function logoutSamu() {
  const c = cookies()
  try { c.delete('session_user_samu') } catch {}
  try { c.delete({ name: 'session_user_samu', path: '/samu' }) } catch {}
  try { c.delete('login_selection_options_samu') } catch {}
  try { c.delete({ name: 'login_selection_options_samu', path: '/samu' }) } catch {}
  redirect('/samu')
}

export async function touchSession() {
  const portalConfig = getCurrentPortalConfig()
  const sessionCookie = getCurrentSessionCookie()
  if (!sessionCookie) {
    return { ok: false, reason: 'no-session' }
  }
  try {
    const parsed = JSON.parse(sessionCookie.value)
    cookies().set(portalConfig.sessionCookieName, JSON.stringify(parsed), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_IDLE_TIMEOUT_SECONDS,
      path: portalConfig.basePath || '/',
    })
    return { ok: true }
  } catch (e: any) {
    return { ok: false, reason: e?.message || String(e) }
  }
}

export async function forceLogoutIdle() {
  try { await logout() } catch (_) { /* noop */ }
  try { await logoutSamu() } catch (_) { /* noop */ }
  return { ok: true }
}

export async function requestTimeOff(prevState: any, formData: FormData) {
  const startDate = formData.get('startDate') as string
  let endDate = formData.get('endDate') as string
  const reason = formData.get('reason') as string
  const nurseIdFromForm = formData.get('nurseId') as string
  
  if (!startDate) return { message: 'Data da folga é obrigatória' }
  if (!endDate) endDate = startDate

  const user = getCurrentSessionUser()
  if (!user) return { success: false, message: 'Usuário não autenticado' }
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
  const corenRaw = formData.get('coren') as string
  const crmRaw = formData.get('crm') as string
  const councilTypeRaw = formData.get('council_type') as string
  const councilNumberRaw = formData.get('council_number') as string
  const phone = formData.get('phone') as string
  const address = (formData.get('address') as string) || ''
  const houseNumber = (formData.get('house_number') as string) || ''
  const city = (formData.get('city') as string) || ''
  const email = (formData.get('email') as string) || ''
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
  const councilType = String(councilTypeRaw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  const councilNumber = String(councilNumberRaw || '').trim()
  const coren = councilType === 'COREN' ? councilNumber : String(corenRaw || '').trim()
  const crm = (councilType || councilNumber)
    ? (councilType === 'COREN' ? undefined : (councilNumber ? `${councilType || 'CRM'} ${councilNumber}`.trim() : ''))
    : String(crmRaw || '').trim()

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
    if (crm !== undefined) nurse.crm = crm
    nurse.phone = phone || nurse.phone || ''
    nurse.address = address || nurse.address || ''
    nurse.house_number = houseNumber || nurse.house_number || ''
    nurse.city = city || nurse.city || ''
    nurse.email = email || nurse.email || ''
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
      phone: phone || '',
      address: address || '',
      house_number: houseNumber || '',
      city: city || '',
      email: email || '',
      vinculo,
      role,
      cpf: cpf || `TEMP-${Date.now()}`
  }
  if (crm !== undefined) updateData.crm = crm
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

  const existingCols = await _detectNursesColumns(supabase)
  const filteredUpdate: any = {}
  for (const k of Object.keys(updateData)) {
    if (existingCols.has(k)) filteredUpdate[k] = updateData[k]
  }

  const { error } = await supabase.from('nurses').update(filteredUpdate).eq('id', id)

  if (error) {
    console.error('[updateNurse] Supabase error:', JSON.stringify({ code: error.code, message: error.message, details: (error as any).details, hint: (error as any).hint }))
    if (error.code === '42703') {
      const missingColMatch = (error.message || '').match(/column\s+[`"']?([a-zA-Z0-9_]+)[`"']?\s+of/i) || (error.message || '').match(/([a-zA-Z0-9_]+)\s+does\s+not\s+exist/i)
      const missingCol = missingColMatch ? missingColMatch[1] : ''
      if (missingCol === 'city') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V24). Solicite ao suporte para rodar o script de Cidade.' }
      }
      if (missingCol === 'email') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V23). Solicite ao suporte para rodar o script de E-mail.' }
      }
      if (missingCol === 'address' || missingCol === 'house_number') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V22). Solicite ao suporte para rodar o script de Endereço e Número da Casa.' }
      }
      if (missingCol === 'crm' || missingCol === 'phone') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V15). Solicite ao suporte para rodar o script de CRM e Telefone.' }
      }
      if (missingCol === 'birth_date') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V18). Solicite ao suporte para rodar o script de Data de Nascimento.' }
      }
      if (missingCol === 'certidao_negativa_date' || missingCol === 'coren_expiry_date') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V19). Solicite ao suporte para rodar o script de Certidão Negativa e Vencimento do COREN.' }
      }
      if (missingCol === 'name_star') {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V21). Solicite ao suporte para rodar o script de Marcação com * no Nome.' }
      }
      if (missingCol) {
        return { success: false, message: `Erro: Coluna "${missingCol}" não existe no Supabase. Por favor, abra o SQL HELP (botão vermelho no modal) e rode o script completo V15/V18/V19/V21/V22/V23/V24.` }
      }
    }
    if (error.message?.includes('city')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V24). Solicite ao suporte para rodar o script de Cidade.' }
    }
    if (error.message?.includes('email')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V23). Solicite ao suporte para rodar o script de E-mail.' }
    }
    if (error.message?.includes('address') || error.message?.includes('house_number')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V22). Solicite ao suporte para rodar o script de Endereço e Número da Casa.' }
    }
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

// ============================================================
// 🔐 PERMISSÕES DO SIDEBAR + RELATÓRIOS (Configurável pelo Coord Geral)
//    - Cada item de menu tem 3 níveis: TODOS / COORDENADORES_SETOR / COORD_GERAL
//    - Relatórios ainda têm 2 subitens (management + scheduled)
// ============================================================

export interface SidebarMenuPermissionsAlias {
  items: Record<SidebarMenuItemId, MenuAccessLevel>
  reports: {
    management: MenuAccessLevel
    scheduled: MenuAccessLevel
  }
  updatedAt?: string
  updatedBy?: string
}

const DEFAULT_SIDEBAR_PERMISSIONS: SidebarMenuPermissions = {
  items: SIDEBAR_MENU_ITEMS.reduce((acc, item) => {
    acc[item.id as SidebarMenuItemId] = item.defaultLevel
    return acc
  }, {} as SidebarMenuPermissions['items']),
  reports: {
    management: 'COORD_GERAL_ONLY',
    scheduled: 'COORD_SETOR',
  },
}

const APP_SETTINGS_KEY = 'sidebar_permissions_v2'
const APP_SETTINGS_KEY_LEGACY = 'reports_permissions'

function _applyLegacyReportsPerms(target: SidebarMenuPermissions, legacyRaw: any): SidebarMenuPermissions {
  if (!legacyRaw) return target
  const toLevel = (allowCoordSetor: boolean, allowCoordGeral: boolean): MenuAccessLevel => {
    if (allowCoordSetor) return 'COORD_SETOR'
    if (allowCoordGeral) return 'COORD_GERAL_ONLY'
    return 'COORD_GERAL_ONLY'
  }
  const mgmt = legacyRaw?.management
  const sched = legacyRaw?.scheduled
  return {
    ...target,
    reports: {
      management: toLevel(!!mgmt?.allowCoordSetor, !!mgmt?.allowCoordGeral),
      scheduled: toLevel(!!sched?.allowCoordSetor, !!sched?.allowCoordGeral),
    },
  }
}

function _sanitizeSidebarPermissions(raw: any): SidebarMenuPermissions {
  const base: SidebarMenuPermissions = {
    items: { ...DEFAULT_SIDEBAR_PERMISSIONS.items },
    reports: { ...DEFAULT_SIDEBAR_PERMISSIONS.reports },
    updatedAt: undefined,
    updatedBy: undefined,
  }
  if (!raw || typeof raw !== 'object') return base

  // Items (garante que todos os IDs conhecidos existam com nível válido)
  if (raw.items && typeof raw.items === 'object') {
    for (const itemDef of SIDEBAR_MENU_ITEMS) {
      const k = itemDef.id
      const v = (raw.items as any)[k]
      const isValid = v === 'EVERYONE' || v === 'COORD_SETOR' || v === 'COORD_GERAL_ONLY'
      if (isValid) (base.items as any)[k] = v
    }
  }

  if (raw.reports && typeof raw.reports === 'object') {
    const mg = (raw.reports as any).management
    const sc = (raw.reports as any).scheduled
    if (mg === 'EVERYONE' || mg === 'COORD_SETOR' || mg === 'COORD_GERAL_ONLY') base.reports.management = mg
    if (sc === 'EVERYONE' || sc === 'COORD_SETOR' || sc === 'COORD_GERAL_ONLY') base.reports.scheduled = sc
  }

  base.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined
  base.updatedBy = typeof raw.updatedBy === 'string' ? raw.updatedBy : undefined

  return base
}

export async function getSidebarPermissions(): Promise<SidebarMenuPermissions> {
  // 1. Tenta carregar formato NOVO (sidebar_permissions_v2)
  let loadedNew: SidebarMenuPermissions | null = null

  if (isLocalMode()) {
    try {
      const db = readDb()
      const raw = (db as any)[APP_SETTINGS_KEY] as any
      if (raw) loadedNew = _sanitizeSidebarPermissions(raw)
    } catch (e) {
      console.warn('getSidebarPermissions (local) falhou:', e)
    }
  } else {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', APP_SETTINGS_KEY)
        .maybeSingle()
      if (!error && data && typeof (data as any).value === 'string' && (data as any).value.length > 0) {
        try {
          loadedNew = _sanitizeSidebarPermissions(JSON.parse((data as any).value))
        } catch (_) { /* ignore JSON parse */ }
      }
    } catch (e: any) {
      console.warn('getSidebarPermissions (supabase) falhou:', e?.message || String(e))
    }
  }

  if (loadedNew) return loadedNew

  // 2. Fallback: tenta carregar formato LEGADO (reports_permissions) e converter
  let legacyRaw: any = null
  if (isLocalMode()) {
    try {
      const db = readDb()
      legacyRaw = (db as any)[APP_SETTINGS_KEY_LEGACY] || null
    } catch (_) { /* noop */ }
  } else {
    const supabase = createClient()
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', APP_SETTINGS_KEY_LEGACY)
        .maybeSingle()
      if (!error && data && typeof (data as any).value === 'string') {
        try { legacyRaw = JSON.parse((data as any).value) } catch (_) { /* noop */ }
      }
    } catch (_) { /* noop */ }
  }

  if (legacyRaw) {
    return _applyLegacyReportsPerms(_sanitizeSidebarPermissions(DEFAULT_SIDEBAR_PERMISSIONS), legacyRaw)
  }
  return _sanitizeSidebarPermissions(DEFAULT_SIDEBAR_PERMISSIONS)
}

export async function saveSidebarPermissions(next: SidebarMenuPermissions) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado. Somente Coordenação Geral pode configurar permissões do menu lateral.' }
  }

  if (!next || !next.items || !next.reports) {
    return { success: false, message: 'Dados de permissão inválidos.' }
  }

  const cleaned = _sanitizeSidebarPermissions(next)
  cleaned.updatedAt = new Date().toISOString()
  cleaned.updatedBy = (() => {
    try {
      const c = cookies().get('session_user')
      const u = c ? JSON.parse(c.value) : null
      return u?.name || u?.cpf || 'desconhecido'
    } catch (_) { return 'desconhecido' }
  })()

  if (isLocalMode()) {
    const db = readDb()
    ;(db as any)[APP_SETTINGS_KEY] = cleaned
    writeDb(db)
    revalidatePath('/')
    revalidatePath('/servidores')
    revalidatePath('/escala')
    revalidatePath('/coordenacao')
    return { success: true, message: 'Permissões do menu lateral atualizadas (Modo Local).' }
  }

  const supabase = createClient()
  try {
    const { error } = await supabase.from('app_settings').upsert({
      key: APP_SETTINGS_KEY,
      value: JSON.stringify(cleaned),
    }, { onConflict: 'key' })
    if (error) {
      return { success: false, message: `Erro Supabase: ${error.message}` }
    }
    revalidatePath('/')
    revalidatePath('/servidores')
    revalidatePath('/escala')
    revalidatePath('/coordenacao')
    return { success: true, message: 'Permissões do menu lateral atualizadas.' }
  } catch (e: any) {
    return { success: false, message: `Erro ao salvar: ${e?.message || String(e)}` }
  }
}

export interface SidebarPermissionEvaluation {
  // Por item do menu (true = usuário tem permissão de visualizar)
  items: Record<SidebarMenuItemId, boolean>
  // Por subitem de relatório
  reports: { management: boolean; scheduled: boolean }
  // Atalhos
  canSeeReportsMenu: boolean
}

function _checkLevel(level: MenuAccessLevel, ctx: { isSuperAdmin: boolean; isCoordGeral: boolean; isCoordSetor: boolean }): boolean {
  if (ctx.isSuperAdmin) return true
  switch (level) {
    case 'EVERYONE':
      return true
    case 'COORD_SETOR':
      return ctx.isCoordGeral || ctx.isCoordSetor
    case 'COORD_GERAL_ONLY':
      return ctx.isCoordGeral
    default:
      return false
  }
}

export async function evaluateSidebarPermissionsForCurrentUser(): Promise<SidebarPermissionEvaluation> {
  let cpf = ''
  let role = ''
  try {
    const c = cookies().get('session_user')
    if (c) {
      const u = JSON.parse(c.value)
      cpf = String(u.cpf || '').replace(/\D/g, '')
      role = String(u.role || '').toUpperCase()
    }
  } catch (_) { /* noop */ }

  const cleanCpf = String(cpf || '').replace(/\D/g, '')
  const isSuperAdmin =
    role === 'ADMIN' ||
    role === 'COORDENACAO_GERAL' ||
    cleanCpf === '02170025367'
  const isCoordGeral = role === 'COORDENACAO_GERAL' || isSuperAdmin
  const isCoordSetor = role === 'COORDENADOR'

  const ctx = { isSuperAdmin, isCoordGeral, isCoordSetor }
  const perms = await getSidebarPermissions()

  const itemsRes = {} as SidebarPermissionEvaluation['items']
  for (const itemDef of SIDEBAR_MENU_ITEMS) {
    const level = perms.items[itemDef.id] || DEFAULT_SIDEBAR_PERMISSIONS.items[itemDef.id]
    itemsRes[itemDef.id] = _checkLevel(level, ctx)
  }

  const reportsRes = {
    management: _checkLevel(perms.reports.management, ctx),
    scheduled: _checkLevel(perms.reports.scheduled, ctx),
  }

  // Sobe como fallback para manter compat com os antigos nomes de actions.ts (relatórios)
  ;(reportsRes as any).canSeeMenu = reportsRes.management || reportsRes.scheduled

  return {
    items: itemsRes,
    reports: reportsRes,
    canSeeReportsMenu: reportsRes.management || reportsRes.scheduled,
  }
}

// Backward compatibility: alias para actions antigas (não quebrar imports já existentes)
export type ReportsPermissions = SidebarMenuPermissions
export interface ReportsPermissionEvaluation {
  canSeeMenu: boolean
  canRunManagement: boolean
  canRunScheduled: boolean
}

export async function getReportsPermissions(): Promise<ReportsPermissions> {
  return getSidebarPermissions() as unknown as ReportsPermissions
}

export async function saveReportsPermissions(next: any) {
  // Se receber formato antigo reports-only, converte para o novo
  if (next && !next.items && (next.management || next.scheduled)) {
    const base = await getSidebarPermissions()
    const toLevel = (allowCoordSetor: boolean, allowCoordGeral: boolean): MenuAccessLevel => {
      if (allowCoordSetor) return 'COORD_SETOR'
      if (allowCoordGeral) return 'COORD_GERAL_ONLY'
      return 'COORD_GERAL_ONLY'
    }
    const converted: SidebarMenuPermissions = {
      ...base,
      reports: {
        management: toLevel(!!next.management?.allowCoordSetor, !!next.management?.allowCoordGeral),
        scheduled: toLevel(!!next.scheduled?.allowCoordSetor, !!next.scheduled?.allowCoordGeral),
      },
    }
    return saveSidebarPermissions(converted)
  }
  return saveSidebarPermissions(next as SidebarMenuPermissions)
}

export async function evaluateReportsPermissionsForCurrentUser(): Promise<ReportsPermissionEvaluation> {
  const evalRes = await evaluateSidebarPermissionsForCurrentUser()
  return {
    canSeeMenu: evalRes.canSeeReportsMenu,
    canRunManagement: evalRes.reports.management,
    canRunScheduled: evalRes.reports.scheduled,
  }
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

function _normalizeName(name: string): string {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function _mergeVinculoStrings(a: string, b: string): string {
  const items = new Set<string>()
  const push = (raw: string) => {
    if (!raw) return
    String(raw)
      .split(/[;,\/\s]+/)
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 1 && s !== 'E' && s !== 'OU' && s !== 'E/OU')
      .forEach(s => items.add(s))
  }
  push(a)
  push(b)
  return Array.from(items).join(' / ')
}

function _pickNonEmpty(a: any, b: any): any {
  if (a === null || a === undefined || a === '') return b
  if (b === null || b === undefined || b === '') return a
  const as = String(a).trim()
  const bs = String(b).trim()
  if (!as) return b
  if (!bs) return a
  if (as === bs) return a
  return a
}

export async function findDuplicateNurses() {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const nurses = await getNurses() || []
  const map = new Map<string, any[]>()

  for (const n of nurses) {
    const key = _normalizeName(n.name || n.name_star ? (n.name || '') : '')
    if (!key) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(n)
  }

  const groups = Array.from(map.entries())
    .filter(([, arr]) => arr.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .map(([normalized, arr]) => ({
      name: normalized,
      count: arr.length,
      nurses: arr.map(n => ({
        id: n.id,
        displayName: n.name,
        role: n.role,
        vinculo: n.vinculo,
        vinculos: Array.isArray(n.vinculos) ? n.vinculos : [],
        phone: n.phone,
        address: n.address,
        house_number: n.house_number,
        city: n.city,
        email: n.email,
        cpf: n.cpf?.startsWith?.('TEMP-') ? '' : n.cpf,
        birth_date: n.birth_date,
        coren: n.coren,
        crm: n.crm,
        section_id: n.section_id,
        unit_id: n.unit_id,
      }))
    }))

  return {
    success: true,
    totalDuplicates: groups.reduce((acc, g) => acc + g.count, 0),
    totalGroups: groups.length,
    groups
  }
}

export async function mergeNurses(targetId: string, sourceIds: string[]) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (!targetId || !Array.isArray(sourceIds) || sourceIds.length === 0) {
    return { success: false, message: 'Informe o cadastro principal e os cadastros a serem unificados.' }
  }
  if (sourceIds.includes(targetId)) {
    return { success: false, message: 'O cadastro principal não pode estar na lista de cadastros a serem unificados.' }
  }

  const allIds = [targetId, ...sourceIds]

  const nurses = await getNurses() || []
  const all = allIds.map(id => nurses.find((n: any) => n.id === id)).filter(Boolean) as any[]
  if (all.length < 2) {
    return { success: false, message: 'Cadastros não encontrados para unificar.' }
  }

  const target = all.find(n => n.id === targetId)
  const sources = all.filter(n => n.id !== targetId)

  let mergedVinculo = target?.vinculo || ''
  for (const s of sources) mergedVinculo = _mergeVinculoStrings(mergedVinculo, s.vinculo)

  const mergeField = (key: string) => {
    let val = target?.[key]
    for (const s of sources) val = _pickNonEmpty(val, s[key])
    return val
  }

  const merged = {
    name: mergeField('name'),
    cpf: mergeField('cpf'),
    role: mergeField('role'),
    section_id: mergeField('section_id'),
    unit_id: mergeField('unit_id'),
    coren: mergeField('coren'),
    crm: mergeField('crm'),
    vinculo: mergedVinculo,
    birth_date: mergeField('birth_date'),
    certidao_negativa_date: mergeField('certidao_negativa_date'),
    coren_expiry_date: mergeField('coren_expiry_date'),
    phone: mergeField('phone'),
    address: mergeField('address'),
    house_number: mergeField('house_number'),
    city: mergeField('city'),
    email: mergeField('email'),
    name_star: Boolean(target?.name_star || sources.some((s: any) => s.name_star)),
  }

  const reassignForeignKeys = async (oldId: string, newId: string, supabase: any, db: any, isLocal: boolean) => {
    if (isLocal) {
      const tables = ['shifts', 'time_off_requests', 'monthly_rosters'] as const
      for (const table of tables) {
        for (const row of db[table] || []) {
          if (row.nurse_id === oldId) row.nurse_id = newId
        }
      }
      if (Array.isArray(db.nurse_vinculos)) {
        for (const row of db.nurse_vinculos) if (row.nurse_id === oldId) row.nurse_id = newId
      }
      return null
    }
    let firstError: any = null
    const promises = [
      supabase.from('shifts').update({ nurse_id: newId }).eq('nurse_id', oldId),
      supabase.from('time_off_requests').update({ nurse_id: newId }).eq('nurse_id', oldId),
      supabase.from('monthly_rosters').update({ nurse_id: newId }).eq('nurse_id', oldId),
      supabase.from('nurse_vinculos').update({ nurse_id: newId }).eq('nurse_id', oldId),
    ]
    const results = await Promise.all(promises)
    for (const r of results) if (r?.error && !firstError) firstError = r.error
    return firstError
  }

  if (isLocalMode()) {
    const db = readDb()
    db.nurses = db.nurses.filter((n: any) => n.id === targetId)
    const idx = db.nurses.findIndex((n: any) => n.id === targetId)
    if (idx >= 0) db.nurses[idx] = { ...db.nurses[idx], ...merged, id: targetId }
    for (const srcId of sourceIds) {
      await reassignForeignKeys(srcId, targetId, null, db, true)
    }
    writeDb(db)
    revalidatePath('/servidores')
    revalidatePath('/')
    return { success: true, message: `${sources.length + 1} cadastros unificados em 1 (modo local).` }
  }

  const supabase = createClient()
  const { error: upErr } = await supabase.from('nurses').update(merged).eq('id', targetId)
  if (upErr) return { success: false, message: 'Erro ao atualizar cadastro principal: ' + (upErr.message || '') }

  for (const srcId of sourceIds) {
    const fkErr = await reassignForeignKeys(srcId, targetId, supabase, null, false)
    if (fkErr) return { success: false, message: 'Erro ao reatribuir dados do id ' + srcId.slice(0, 8) + ': ' + (fkErr.message || '') }
  }

  for (const srcId of sourceIds) {
    const { error: dErr } = await supabase.from('nurses').delete().eq('id', srcId)
    if (dErr) return { success: false, message: 'Erro ao remover duplicata ' + srcId.slice(0, 8) + ': ' + (dErr.message || '') }
  }

  revalidatePath('/servidores')
  revalidatePath('/')
  return { success: true, message: `${sources.length + 1} cadastros unificados com sucesso. Vínculos combinados: ${mergedVinculo || 'nenhum'}` }
}

export async function getTimeOffRequests() {
  const user = getCurrentSessionUser()
  if (!user) return []
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

  // Pré-computar snapshots V26 por profissional (1 chamada por nurse)
  const uniqueNurseIdsForSnapshot = Array.from(new Set((shifts || []).map(s => s.nurseId).filter(Boolean)))
  const snapshotByNurse = new Map<string, NurseSnapshot>()
  for (const nid of uniqueNurseIdsForSnapshot) {
    snapshotByNurse.set(nid, await _buildNurseSnapshot(nid))
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
          const snap = snapshotByNurse.get(s.nurseId)
          db.shifts.push({ 
            id: randomUUID(), 
            nurse_id: s.nurseId, 
            roster_id: s.rosterId || undefined, 
            shift_date: s.date, 
            shift_type: s.type, 
            is_red: !!(s as any).isRed,
            snapshot_name: snap?.snapshot_name || '',
            snapshot_role: snap?.snapshot_role || '',
            snapshot_vinculo: snap?.snapshot_vinculo || '',
            snapshot_vinculos_json: snap?.snapshot_vinculos_json || '',
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
    // Detectar colunas V26 em shifts (supabase) para evitar erro de schema
    const shiftsCols = await _detectColumns(supabase, 'shifts', [
      'snapshot_name','snapshot_role','snapshot_vinculo','snapshot_vinculos_json','is_red'
    ])

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
            const snap = snapshotByNurse.get(s.nurseId)
            const row: any = {
                nurse_id: s.nurseId,
                roster_id: s.rosterId || null,
                date: s.date,
                type: s.type
            }
            if (shiftsCols.has('is_red')) row.is_red = !!(s as any).isRed
            if (snap) {
              if (shiftsCols.has('snapshot_name')) row.snapshot_name = snap.snapshot_name
              if (shiftsCols.has('snapshot_role')) row.snapshot_role = snap.snapshot_role
              if (shiftsCols.has('snapshot_vinculo')) row.snapshot_vinculo = snap.snapshot_vinculo
              if (shiftsCols.has('snapshot_vinculos_json')) row.snapshot_vinculos_json = snap.snapshot_vinculos_json
            }
            allInserts.push(row)
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

  const portalConfig = getCurrentPortalConfig()
  const sessionCookie = getCurrentSessionCookie()
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
  const updatedUser = { ...user, mustChangePassword: false, login_nonce: (user as any)?.login_nonce || randomUUID() }
  cookies().set(portalConfig.sessionCookieName, JSON.stringify(updatedUser), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_IDLE_TIMEOUT_SECONDS,
    path: portalConfig.basePath || '/',
  })

  redirect(portalConfig.dashboardPath)
}

// ============================================================
// 💬 FRASES MOTIVACIONAIS (Frases do Dia)
// ============================================================
export interface MotivationalPhrase {
  id: string
  text: string
  active: boolean
  author?: string
  createdAt: string
}

const MOTIVATIONAL_SETTINGS_KEY = 'motivational_phrases_v1'
const MOTIVATIONAL_SEEDED_KEY = 'motivational_phrases_v1_seeded'

const DEFAULT_MOTIVATIONAL_PHRASES: string[] = [
  'Cuidar de pessoas é mais do que um trabalho: é uma missão.',
  'Cada profissional faz a diferença na construção de um atendimento melhor.',
  'Juntos, somos mais fortes para cuidar de quem precisa.',
  'Nosso trabalho transforma vidas, mesmo nos pequenos gestos.',
  'Onde existe cuidado, existe esperança.',
  'Ser profissional de saúde é escolher cuidar todos os dias.',
  'Uma equipe unida faz acontecer o que parecia impossível.',
  'Cada plantão é uma nova oportunidade de fazer a diferença.',
  'Por trás de cada atendimento, existe uma vida que merece cuidado e respeito.',
  'Nosso maior resultado é saber que alguém saiu daqui melhor do que chegou.',
  'Cuidar com competência, servir com humanidade.',
  'O trabalho de cada um fortalece o trabalho de todos.',
  'Mesmo nos dias difíceis, nosso propósito permanece: cuidar.',
  'Pequenas atitudes podem transformar grandes histórias.',
  'A força de um hospital está na união de seus profissionais.',
  'Quem cuida também deixa marcas de esperança por onde passa.',
  'Nossa dedicação faz parte da recuperação de cada paciente.',
  'Trabalhar em equipe é entender que ninguém cuida sozinho.',
  'Excelência no cuidado começa com compromisso e termina com humanização.',
  'Cada esforço vale a pena quando o propósito é salvar e cuidar de vidas.',
  'Que nunca nos falte força para continuar fazendo o bem.',
  'Nosso trabalho é essencial, nossa dedicação é insubstituível.',
  'Cuidar é colocar conhecimento, responsabilidade e coração em cada atendimento.',
  'Um bom atendimento começa com uma equipe que acredita no que faz.',
  'Somos diferentes em nossas funções, mas iguais em nosso propósito: cuidar.',
  'A união da equipe transforma desafios em resultados.',
  'Todos os dias, temos a oportunidade de fazer a diferença na vida de alguém.',
  'Nossa maior recompensa é contribuir para a vida e o bem-estar de quem precisa.',
  'Que cada plantão seja marcado por respeito, união e compromisso.',
  'Hospital é feito de pessoas que cuidam de pessoas. E cada um de nós importa.',
]

function _uid(prefix = 'p'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function _buildSeedPhrases(): MotivationalPhrase[] {
  const now = new Date().toISOString()
  return DEFAULT_MOTIVATIONAL_PHRASES.map((text, i): MotivationalPhrase => ({
    id: `seed_${Date.now().toString(36)}_${i}_${Math.random().toString(36).slice(2, 6)}`,
    text,
    active: true,
    createdAt: now,
  }))
}

async function _ensureMotivationalSeeded() {
  if (isLocalMode()) {
    try {
      const db = readDb() as any
      if (db[MOTIVATIONAL_SEEDED_KEY]) return
      const existing = _sanitizeMotivationalPhrases(db[MOTIVATIONAL_SETTINGS_KEY])
      if (existing.length === 0) {
        db[MOTIVATIONAL_SETTINGS_KEY] = _buildSeedPhrases()
      }
      db[MOTIVATIONAL_SEEDED_KEY] = true
      writeDb(db)
    } catch (_) { /* noop */ }
    return
  }
  const supabase = createClient()
  try {
    const { data: seededRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', MOTIVATIONAL_SEEDED_KEY)
      .maybeSingle()
    if (seededRow && (seededRow as any)?.value === '1') return

    const { data: phrasesRow } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', MOTIVATIONAL_SETTINGS_KEY)
      .maybeSingle()
    let list: MotivationalPhrase[] = []
    if (phrasesRow && typeof (phrasesRow as any).value === 'string') {
      try { list = _sanitizeMotivationalPhrases(JSON.parse((phrasesRow as any).value)) } catch (_) { /* noop */ }
    }
    if (list.length === 0) {
      const seed = _buildSeedPhrases()
      await supabase.from('app_settings').upsert(
        { key: MOTIVATIONAL_SETTINGS_KEY, value: JSON.stringify(seed) },
        { onConflict: 'key' }
      )
    }
    await supabase.from('app_settings').upsert(
      { key: MOTIVATIONAL_SEEDED_KEY, value: '1' },
      { onConflict: 'key' }
    )
  } catch (_) { /* noop */ }
}

function _sanitizeMotivationalPhrases(raw: any): MotivationalPhrase[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((r: any) => r && typeof r === 'object' && typeof r.text === 'string' && r.text.trim().length > 0)
    .map((r: any): MotivationalPhrase => ({
      id: typeof r.id === 'string' && r.id.length > 0 ? r.id : _uid(),
      text: String(r.text).trim().slice(0, 500),
      active: r.active === false ? false : true,
      author: typeof r.author === 'string' ? r.author : undefined,
      createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date().toISOString(),
    }))
}

export async function getMotivationalPhrases(): Promise<MotivationalPhrase[]> {
  try { await _ensureMotivationalSeeded() } catch (_) { /* noop */ }
  if (isLocalMode()) {
    try {
      const db = readDb()
      const raw = (db as any)[MOTIVATIONAL_SETTINGS_KEY]
      return _sanitizeMotivationalPhrases(raw)
    } catch (_) { return [] }
  }
  const supabase = createClient()
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', MOTIVATIONAL_SETTINGS_KEY)
      .maybeSingle()
    if (!error && data && typeof (data as any).value === 'string' && (data as any).value.length > 0) {
      try {
        return _sanitizeMotivationalPhrases(JSON.parse((data as any).value))
      } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }
  return []
}

async function _persistMotivationalPhrases(list: MotivationalPhrase[], isAdmin: boolean): Promise<{ success: boolean; message?: string }> {
  const clean = _sanitizeMotivationalPhrases(list)
  if (isLocalMode()) {
    const db = readDb()
    ;(db as any)[MOTIVATIONAL_SETTINGS_KEY] = clean
    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }
  const supabase = createClient()
  const { error } = await supabase.from('app_settings').upsert(
    { key: MOTIVATIONAL_SETTINGS_KEY, value: JSON.stringify(clean) },
    { onConflict: 'key' }
  )
  if (error) return { success: false, message: 'Erro Supabase: ' + error.message }
  revalidatePath('/')
  return { success: true }
}

export async function saveMotivationalPhrases(list: MotivationalPhrase[]) {
  try { await checkAdmin() } catch (_) { return { success: false, message: 'Acesso negado.' } }
  return _persistMotivationalPhrases(list, true)
}

export async function addMotivationalPhrase(text: string) {
  try { await checkAdmin() } catch (_) { return { success: false, message: 'Acesso negado.' } }
  const cleanText = String(text || '').trim()
  if (!cleanText) return { success: false, message: 'Digite uma frase.' }
  if (cleanText.length > 500) return { success: false, message: 'Frase muito longa (máx. 500 caracteres).' }

  const current = await getMotivationalPhrases()
  const next: MotivationalPhrase = {
    id: _uid(),
    text: cleanText,
    active: true,
    createdAt: new Date().toISOString(),
  }
  return _persistMotivationalPhrases([next, ...current], true)
}

export async function updateMotivationalPhrase(id: string, changes: Partial<Pick<MotivationalPhrase, 'text' | 'active'>>) {
  try { await checkAdmin() } catch (_) { return { success: false, message: 'Acesso negado.' } }
  if (!id) return { success: false, message: 'ID inválido.' }
  const current = await getMotivationalPhrases()
  let changed = false
  const next = current.map(p => {
    if (p.id !== id) return p
    changed = true
    const np = { ...p }
    if (typeof changes.text === 'string') {
      const t = changes.text.trim()
      if (!t) return p
      np.text = t.slice(0, 500)
    }
    if (typeof changes.active === 'boolean') np.active = changes.active
    return np
  })
  if (!changed) return { success: false, message: 'Frase não encontrada.' }
  return _persistMotivationalPhrases(next, true)
}

export async function deleteMotivationalPhrase(id: string) {
  try { await checkAdmin() } catch (_) { return { success: false, message: 'Acesso negado.' } }
  if (!id) return { success: false, message: 'ID inválido.' }
  const current = await getMotivationalPhrases()
  const next = current.filter(p => p.id !== id)
  return _persistMotivationalPhrases(next, true)
}

export async function getActiveMotivationalPhrases(): Promise<MotivationalPhrase[]> {
  const all = await getMotivationalPhrases()
  return all.filter(p => p.active)
}

export async function getRandomMotivationalPhrase(): Promise<MotivationalPhrase | null> {
  const active = await getActiveMotivationalPhrases()
  if (active.length === 0) return null
  const idx = Math.floor(Math.random() * active.length)
  return active[idx]
}
