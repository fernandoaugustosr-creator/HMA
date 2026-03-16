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

export async function getSystemRoles() {
  const defaultRoles = [
    { id: 'ADMIN', label: 'Administrador' },
    { id: 'COORDENACAO_GERAL', label: 'Coordenação Geral' },
    { id: 'COORDENADOR', label: 'Coordenador' },
    { id: 'ENFERMEIRO', label: 'Enfermeiro' },
    { id: 'TECNICO', label: 'Técnico de Enfermagem' }
  ]

  if (isLocalMode()) {
    const db = readDb()
    return db.roles || defaultRoles
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
  
  return data.map((row: any) => ({
    id: row.key.replace('role_', ''),
    label: row.value || row.key.replace('role_', '')
  }))
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
  const { data } = await supabase
    .from('nurses')
    .select('id,name,cpf,role,coren,vinculo,section_id,unit_id,created_at')
    .range(0, 9999)
    .order('name')
  return data || []
})

export async function getNursesBySection(sectionId: string) {
  if (isLocalMode()) {
    const db = readDb()
    return db.nurses.filter(n => n.section_id === sectionId).sort((a, b) => a.name.localeCompare(b.name))
  }
  
  const supabase = createClient()
  const { data } = await supabase
    .from('nurses')
    .select('id,name,cpf,role,coren,vinculo,section_id,unit_id,created_at')
    .eq('section_id', sectionId)
    .range(0, 9999)
    .order('name')
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
  const role = formData.get('role') as string || 'ENFERMEIRO'
  const sectionId = formData.get('sectionId') as string
  const unitId = formData.get('unitId') as string
  const sector = formData.get('sector') as string // Manual sector name if provided

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
       else if (role === 'TECNICO') finalSectionId = db.schedule_sections.find(s => s.title === 'TÉCNICOS DE ENFERMAGEM')?.id || null
    }

    const newNurse = {
      id: randomUUID(),
      name,
      cpf: finalCpf,
      password, // Plain text for local dev
      coren,
      crm: crm || '',
      phone: phone || '',
      vinculo,
      role,
      section_id: finalSectionId,
      unit_id: unitId,
      created_at: new Date().toISOString()
    }

    db.nurses.push(newNurse)

    // Add to current month roster automatically
    if (finalSectionId) {
        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()
        
        // Ensure monthly_rosters exists
        if (!db.monthly_rosters) db.monthly_rosters = []

        db.monthly_rosters.push({
            id: randomUUID(),
            nurse_id: newNurse.id,
            section_id: finalSectionId,
            unit_id: unitId,
            month: currentMonth,
            year: currentYear,
            sector: sector || '', // History for this month
            created_at: new Date().toISOString()
        })
    }

    writeDb(db)
    
    revalidatePath('/servidores')
    return { success: true, message: 'Servidor cadastrado com sucesso!' }
  }

  const supabase = createClient()
  
  let finalSectionId = sectionId
  if (!finalSectionId) {
      const { data: sections } = await supabase.from('schedule_sections').select('*')
      if (sections) {
          if (role === 'ENFERMEIRO' || role === 'COORDENADOR') finalSectionId = sections.find(s => s.title === 'ENFERMEIROS')?.id || null
          else if (role === 'TECNICO') finalSectionId = sections.find(s => s.title === 'TÉCNICOS DE ENFERMAGEM')?.id || null
      }
  }

  const { data: insertedNurse, error } = await supabase.from('nurses').insert({
    name,
    cpf: finalCpf,
    password,
    coren,
    crm: crm || '',
    phone: phone || '',
    vinculo,
    role,
    section_id: finalSectionId || null,
    unit_id: unitId || null
  }).select().single()

  if (error) {
    console.error('Error creating nurse:', error)
    if (error.message?.includes('crm') || error.message?.includes('phone')) {
        return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V15). Solicite ao suporte para rodar o script de CRM e Telefone.' }
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

  // Add to current month roster automatically
  if (insertedNurse && finalSectionId) {
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()
      
      await supabase.from('monthly_rosters').insert({
          nurse_id: insertedNurse.id,
          section_id: finalSectionId,
          unit_id: unitId,
          month: currentMonth,
          year: currentYear,
          sector: sector || '' // History for this month
      })
  }

  revalidatePath('/servidores')
  return { success: true, message: 'Servidor cadastrado com sucesso!' }
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
    { data: sectionsRows },
    { data: unitsRows },
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
    supabase.from('schedule_sections')
      .select('id, title'),
    supabase.from('units')
      .select('id, title'),
    supabase.from('time_off_requests')
      .select('id, nurse_id, start_date, end_date, type, status')
      .eq('status', 'approved')
      .lte('start_date', date)
      .gte('end_date', date)
  ])

  const rosterById: Record<string, { section_id: string | null, unit_id: string | null, nurse_id: string | null }> = {}
  const rosterByNurse: Record<string, { section_id: string | null, unit_id: string | null, id?: string | null }> = {}
  ;(rosterRows || []).forEach((r: any) => {
    rosterById[r.id] = { section_id: r.section_id || null, unit_id: r.unit_id || null, nurse_id: r.nurse_id || null }
    if (r.nurse_id && !rosterByNurse[r.nurse_id]) {
      rosterByNurse[r.nurse_id] = { section_id: r.section_id || null, unit_id: r.unit_id || null, id: r.id || null }
    }
  })

  const nursesById: Record<string, { name: string, role: string, unit_id?: string, section_id?: string }> = {}
  ;(nursesRows || []).forEach((n: any) => {
    nursesById[n.id] = { name: n.name, role: n.role, unit_id: n.unit_id, section_id: n.section_id }
  })

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

export async function getMonthlyScheduleData(month: number, year: number, unitId?: string) {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = new Date(year, month, 0).getDate()
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    if (isLocalMode()) {
      const db = readDb()
      
      // Initialize monthly_rosters if missing
      if (!db.monthly_rosters) db.monthly_rosters = []

      // AUTO-MIGRATION: If roster is empty for this month/year, and it's current or past month
      // populate it to preserve existing view. Future months start empty.
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      const currentYear = now.getFullYear()
      const isCurrentOrPast = year < currentYear || (year === currentYear && month <= currentMonth)

      const rosterForMonth = db.monthly_rosters.filter(r => r.month === month && r.year === year)
      
      if (rosterForMonth.length === 0 && db.nurses.length > 0 && isCurrentOrPast) {
          // Check if we should migrate. Only if this is the first time usage or specific month.
          // For safety, let's migrate if *no* rosters exist at all (first run after update)
          // OR if it's a past/current month that happens to be empty (maybe cleared manually? no, we want to default populate)
          
          console.log('Migrating static assignments to monthly roster (Local)...')
          db.nurses.forEach(n => {
              if (n.section_id) {
                  db.monthly_rosters.push({
                      id: randomUUID(),
                      nurse_id: n.id,
                      section_id: n.section_id,
                      unit_id: n.unit_id || null,
                      month: month,
                      year: year,
                      created_at: new Date().toISOString()
                  })
              }
          })
          writeDb(db)
      }

      // Re-read roster after potential migration
      const finalRoster = db.monthly_rosters.filter(r => r.month === month && r.year === year && (!unitId || r.unit_id === unitId))
      
      // Filter shifts
      // Optimization: if unitId is present, we could filter shifts by nurse/roster, but for local mode it's fast enough.
      const shifts = db.shifts.filter(s => s.shift_date >= startDate && s.shift_date <= endDate)
      
      // Filter timeOffs
      const timeOffs = db.time_off_requests.filter(t => 
        t.status === 'approved' && 
        ((t.start_date <= endDate && t.end_date >= startDate))
      )
      
      // Get releases (metadata)
      const releases = db.monthly_schedule_metadata.filter(m => m.month === month && m.year === year)

      // Get absences
      const absences = (db.absences || []).filter(a => a.date >= startDate && a.date <= endDate)

      return {
        nurses: db.nurses || [],
        roster: finalRoster || [],
        shifts: shifts || [],
        timeOffs: timeOffs || [],
        absences: absences || [],
        sections: db.schedule_sections || [],
        units: db.units || [],
        releases: releases || []
      }
    }

    const supabase = createClient()
    
    // OPTIMIZED FETCHING STRATEGY
    if (unitId) {
        // 1. Fetch Roster for Unit to identify relevant nurses
        const { data: unitRoster, error: rosterError } = await supabase
            .from('monthly_rosters')
            .select('*')
            .eq('month', month)
            .eq('year', year)
            .eq('unit_id', unitId)
        
        if (rosterError && rosterError.code !== 'PGRST116') console.error('Error fetching unit roster:', rosterError)
        
        const roster = unitRoster || []
        // Extract Nurse IDs involved in this unit's roster
        const unitNurseIds = Array.from(new Set(roster.map(r => r.nurse_id)))
        
        // 2. Parallel fetch of other data
        // Note: We still fetch ALL nurses to support the "Add Nurse" dropdown, 
        // but we optimize shifts, timeOffs, and absences to only relevant nurses.
        const queries: any[] = [
            supabase.from('schedule_sections').select('*').order('position', { ascending: true, nullsFirst: true }).order('title', { ascending: true }),
            supabase.from('units').select('*'),
            supabase.from('nurses').select('*').range(0, 19999).order('name'),
            supabase.from('monthly_schedule_metadata').select('*').eq('month', month).eq('year', year),
        ]

        // Only fetch shifts/absences if we have nurses
        let shiftsPromise, timeOffsPromise, absencesPromise

        if (unitNurseIds.length > 0) {
            // Chunking to avoid URL length limits if many nurses
            // Supabase/PostgREST can handle reasonable amounts, but let's be safe if > 100
            // For simplicity, if < 200 nurses, single query. If > 200, we might fallback to full fetch or batch.
            // Assuming unit has < 200 nurses usually.
            
            shiftsPromise = supabase.from('shifts')
                .select('id, nurse_id, date, type, roster_id, created_at')
                .gte('date', startDate)
                .lte('date', endDate)
                .in('nurse_id', unitNurseIds) // Fetch shifts for these nurses (including legacy)

            timeOffsPromise = supabase.from('time_off_requests')
                .select('id, nurse_id, start_date, end_date, type, status, unit_id')
                .in('status', ['approved', 'pending'])
                .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`)
                .in('nurse_id', unitNurseIds)

            absencesPromise = supabase.from('absences')
                .select('*')
                .gte('date', startDate)
                .lte('date', endDate)
                .in('nurse_id', unitNurseIds)
        } else {
            shiftsPromise = Promise.resolve({ data: [] })
            timeOffsPromise = Promise.resolve({ data: [] })
            absencesPromise = Promise.resolve({ data: [] })
        }
        
        const [
            { data: sections },
            { data: units },
            { data: nurses },
            { data: releases },
            { data: rawShifts },
            { data: timeOffsData },
            { data: absencesData }
        ] = await Promise.all([
            ...queries,
            shiftsPromise,
            timeOffsPromise,
            absencesPromise
        ])

        const shifts = rawShifts?.map((s: any) => ({
            ...s,
            shift_date: s.date,
            shift_type: s.type
        })) || []

        return {
            nurses: nurses || [],
            roster: roster,
            shifts: shifts,
            timeOffs: timeOffsData || [],
            absences: absencesData || [],
            sections: sections || [],
            units: units || [],
            releases: releases || []
        }
    }

    // GLOBAL FETCH (Fallback or explicit global view)
    // Parallel fetching for performance optimization
    const [
        { data: sections, error: sectionsError },
        { data: units },
        { data: nurses, error: nursesError },
        { data: rosterData, error: rosterError },
        { data: rawShifts, error: shiftsError },
        { data: timeOffsData, error: timeOffsError },
        { data: releases, error: releasesError },
        { data: absencesData, error: absencesError }
    ] = await Promise.all([
        supabase.from('schedule_sections').select('*').order('position', { ascending: true, nullsFirst: true }).order('title', { ascending: true }),
        supabase.from('units').select('*'),
        supabase.from('nurses').select('*').range(0, 19999).order('name'),
        supabase.from('monthly_rosters').select('*').eq('month', month).eq('year', year).range(0, 19999),
        supabase.from('shifts').select('id, nurse_id, date, type, roster_id, created_at').gte('date', startDate).lte('date', endDate).range(0, 49999),
        supabase.from('time_off_requests').select('id, nurse_id, start_date, end_date, type, status, unit_id').in('status', ['approved', 'pending']).or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`),
        supabase.from('monthly_schedule_metadata').select('*').eq('month', month).eq('year', year),
        supabase.from('absences').select('*').gte('date', startDate).lte('date', endDate).range(0, 9999)
    ])

    if (sectionsError) console.error('Error fetching sections:', sectionsError)
    if (nursesError) console.error('Error fetching nurses:', nursesError)
    if (shiftsError) console.error('Error fetching shifts:', shiftsError)
    if (timeOffsError) console.error('Error fetching timeOffs:', timeOffsError)
    if (rosterError && rosterError.code !== 'PGRST116') console.error('Error fetching roster:', rosterError)
    if (releasesError && releasesError.code !== 'PGRST116') console.error('Error fetching releases:', releasesError)
    if (absencesError) console.error('Error fetching absences:', absencesError)

    let roster = rosterData || []

    // AUTO-MIGRATION (Supabase)
    const now = new Date()
    const currentMonth = now.getMonth() + 1
    const currentYear = now.getFullYear()
    const isCurrentOrPast = year < currentYear || (year === currentYear && month <= currentMonth)

    if ((!roster || roster.length === 0) && isCurrentOrPast && nurses && nurses.length > 0) {
        console.log('Migrating static assignments to monthly roster (Supabase)...')
        const toInsert = nurses
            .filter(n => n.section_id)
            .map(n => ({
                nurse_id: n.id,
                section_id: n.section_id,
                unit_id: n.unit_id,
                month,
                year
            }))
        
        if (toInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('monthly_rosters')
                .upsert(toInsert, { onConflict: 'nurse_id, month, year' })
            
            if (!insertError) {
                 // Fetch the newly created roster to ensure we have the IDs and correct data
                 const { data: newRoster } = await supabase
                    .from('monthly_rosters')
                    .select('*')
                    .eq('month', month)
                    .eq('year', year)
                 roster = newRoster || []
            } else {
                console.error('Error migrating roster:', insertError)
            }
        }
    }

    const shifts = rawShifts?.map(s => ({
      ...s,
      shift_date: s.date,
      shift_type: s.type
    })) || []

    return {
      nurses: nurses || [],
      roster: roster || [],
      shifts: shifts || [],
      timeOffs: timeOffsData || [],
      absences: absencesData || [],
      sections: sections || [],
      units: units || [],
      releases: releases || []
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

export async function releaseSchedule(month: number, year: number, unitId: string | null) {
  try {
      await checkAdmin()
      const session = cookies().get('session_user')
      const user = JSON.parse(session!.value)

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
             released_by: user.id
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
              updated_at: new Date().toISOString()
          }).eq('id', existing.id)
          if (error) throw error
      } else {
          const payload: any = {
              month,
              year,
              is_released: true,
              released_at: new Date().toISOString()
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
      await checkAdmin()
      
      if (isLocalMode()) {
        const db = readDb()
        const existingIndex = db.monthly_schedule_metadata.findIndex(m => m.month === month && m.year === year && (unitId ? m.unit_id === unitId : !m.unit_id))
        
        if (existingIndex >= 0) {
            db.monthly_schedule_metadata[existingIndex].is_released = false
            db.monthly_schedule_metadata[existingIndex].updated_at = new Date().toISOString()
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
              updated_at: new Date().toISOString()
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
      await checkAdmin()
      const session = cookies().get('session_user')
      const user = JSON.parse(session!.value)

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
       if (e.message?.includes('column "is_setor_hidden" does not exist')) {
           return { success: false, message: 'Erro: O banco de dados Supabase precisa ser atualizado (V16). Solicite ao suporte para rodar o script de visibilidade do setor.' }
       }
       return { success: false, message: 'Erro ao salvar visibilidade do setor: ' + (e.message || 'Erro desconhecido') }
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

    revalidatePath('/')
    return { success: true }
  } catch (e: any) {
    console.error('Error clearing monthly schedule:', e)
    return { success: false, message: e.message || 'Erro ao excluir escala do mês' }
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
  listOrder?: number | null
) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  // Only update the specific month (no propagation)
  const monthsToUpdate = [month]

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
        
        if (existingIndex !== -1 && !allowDuplicate) {
          db.monthly_rosters[existingIndex].section_id = sectionId
          db.monthly_rosters[existingIndex].unit_id = unitId
          if (observation !== undefined) db.monthly_rosters[existingIndex].observation = observation
          if (createdAt) db.monthly_rosters[existingIndex].created_at = createdAt
          if (listOrder !== undefined) db.monthly_rosters[existingIndex].list_order = listOrder
        } else {
          // If adding new to roster, clear any existing shifts for this month (clean slate) ONLY if not duplicate mode
          // This prevents "ghost" shifts from appearing if the nurse had shifts in this month previously
          // But if we are adding a duplicate (ED), we should NOT clear shifts as they might belong to the other bond (shared shifts limitation)
          // if (!allowDuplicate) {
          //     const startDate = `${year}-${String(m).padStart(2, '0')}-01`
          //     const lastDay = new Date(year, m, 0).getDate()
          //     const endDate = `${year}-${String(m).padStart(2, '0')}-${lastDay}`
              
          //     if (db.shifts) {
          //         db.shifts = db.shifts.filter((s: any) => 
          //           !(s.nurse_id === nurseId && s.shift_date >= startDate && s.shift_date <= endDate)
          //         )
          //     }
          // }

          db.monthly_rosters.push({
            id: randomUUID(),
            nurse_id: nurseId,
            section_id: sectionId,
            unit_id: unitId,
            month: m,
            year,
            observation: observation || '',
            created_at: createdAt || new Date().toISOString(),
            list_order: listOrder
          })
        }
    })

    writeDb(db)
    revalidatePath('/')
    return { success: true }
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

    if (!existing && !allowDuplicate) {
        // Clear shifts for this month if adding new (and not forcing duplicate)
        // COMMENTED OUT TO PREVENT CROSS-UNIT DATA LOSS
        // Adding a nurse to a new unit should NOT delete their shifts in other units.
        // const startDate = `${year}-${String(m).padStart(2, '0')}-01`
        // const lastDay = new Date(year, m, 0).getDate()
        // const endDate = `${year}-${String(m).padStart(2, '0')}-${lastDay}`
        
        // await supabase.from('shifts')
        //    .delete()
        //    .eq('nurse_id', nurseId)
        //    .gte('date', startDate)
        //    .lte('date', endDate)
    }

    const payload: any = {
        nurse_id: nurseId, 
        section_id: sectionId, 
        unit_id: unitId, 
        month: m, 
        year 
    }
    if (observation !== undefined) payload.observation = observation
    if (createdAt) payload.created_at = createdAt
    if (listOrder !== undefined) payload.list_order = listOrder

    let error;
    if (allowDuplicate) {
        // If allowing duplicates, always insert a new record
        const { error: insertError } = await supabase
            .from('monthly_rosters')
            .insert(payload)
        error = insertError
    } else {
        // If NOT allowing duplicates, we try to update if exists, or insert if not.
        // We use the unit-scoped 'existing' record we already fetched above to ensure we don't hijack records from other units.
        
        if (existing) {
            // Update existing in THIS unit
            const { error: updateError } = await supabase
                .from('monthly_rosters')
                .update(payload)
                .eq('id', existing.id)
            error = updateError
        } else {
            // Insert new for THIS unit (even if nurse exists in other units)
            const { error: insertError } = await supabase
                .from('monthly_rosters')
                .insert(payload)
            error = insertError
        }
    }

    if (error) {
                console.error('Error adding/updating roster:', error)
                if (error.code === '23505') {
                    // Include constraint name in message to help debug if needed
                    const constraint = (error as any).constraint || 'desconhecida'
                    return { success: false, message: `Erro: O sistema bloqueou a duplicidade (Constraint: ${constraint}). Solicite ao suporte para rodar o script V11.` }
                }
                return { success: false, message: error.message }
            }
  }

  revalidatePath('/')
  return { success: true, warning: warningMsg }
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
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    if (db.monthly_rosters) {
        db.monthly_rosters = db.monthly_rosters.filter(r => r.id !== rosterId)
        writeDb(db)
    }
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
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
    await checkAdmin()
    
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
    await checkAdmin()
    
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
    await checkAdmin()
    
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
    await checkAdmin()

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
    await checkAdmin()

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

    let sorted: any[] = []
    
    if (orderedRosterIds && orderedRosterIds.length > 0) {
      // Explicitly construct sorted list based on orderedRosterIds
      const candidateMap = new Map(data?.map(d => [d.id, d]))
      
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
    await checkAdmin()
    
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
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  const nurseId = formData.get('nurseId') as string
  const startDate = formData.get('startDate') as string
  const endDate = formData.get('endDate') as string
  const type = formData.get('type') as string || 'ferias'
  const unitId = formData.get('unitId') as string || null
  
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
    writeDb(db)
    revalidatePath('/')
    return { success: true, message: 'Servidor removido com sucesso (Local)' }
  }

  const supabase = createClient()
  await supabase.from('shifts').delete().eq('nurse_id', id)
  await supabase.from('time_off_requests').delete().eq('nurse_id', id)
  await supabase.from('monthly_rosters').delete().eq('nurse_id', id)
  
  const { error } = await supabase.from('nurses').delete().eq('id', id)

  if (error) return { success: false, message: 'Erro ao remover servidor: ' + error.message }
  revalidatePath('/')
  return { success: true, message: 'Servidor removido com sucesso' }
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
        const tecnicosSection = db.schedule_sections.find(s => s.title === 'TÉCNICOS DE ENFERMAGEM')
        
        if (enfermeirosSection) {
             if (!finalSectionId || (tecnicosSection && finalSectionId === tecnicosSection.id)) {
                 finalSectionId = enfermeirosSection.id
             }
        }
    } else if (role === 'TECNICO') {
        const enfermeirosSection = db.schedule_sections.find(s => s.title === 'ENFERMEIROS')
        const tecnicosSection = db.schedule_sections.find(s => s.title === 'TÉCNICOS DE ENFERMAGEM')
        
        if (tecnicosSection) {
             if (!finalSectionId || (enfermeirosSection && finalSectionId === enfermeirosSection.id)) {
                 finalSectionId = tecnicosSection.id
             }
        }
    }

    nurse.name = name
    if (cpf) nurse.cpf = cpf
    nurse.coren = coren
    nurse.crm = crm || nurse.crm || ''
    nurse.phone = phone || nurse.phone || ''
    nurse.vinculo = vinculo
    nurse.role = role
    nurse.sector = sector || nurse.sector
    
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
    const tecnicosId = sections.find(s => s.title === 'TÉCNICOS DE ENFERMAGEM')?.id
    
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
      role
  }
  if (cpf) updateData.cpf = cpf
  if (finalSectionId) updateData.section_id = finalSectionId
  if (unitId) updateData.unit_id = unitId
  if (sector) updateData.sector = sector

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
    db.time_off_requests = db.time_off_requests.filter(t => t.id !== id)
    writeDb(db)
    revalidatePath('/')
    return { success: true, message: 'Ausência removida com sucesso (Local)' }
  }

  const supabase = createClient()
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

export async function saveShifts(shifts: { nurseId: string, rosterId?: string, date: string, type: string }[]) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  console.log('saveShifts called with:', JSON.stringify(shifts, null, 2))
  
  if (!shifts || !Array.isArray(shifts) || !shifts.length) {
    return { success: true }
  }

  if (isLocalMode()) {
    const db = readDb()
    
    shifts.forEach(shift => {
      // Check if exists - match nurse, date AND roster_id (if present)
      let existingIndex = db.shifts.findIndex(s => 
        s.nurse_id === shift.nurseId && 
        s.shift_date === shift.date &&
        (shift.rosterId ? s.roster_id === shift.rosterId : !s.roster_id)
      )
      
      // If we are saving a specific roster shift, handle legacy shift splitting
      if (shift.rosterId) {
        const legacyIndex = db.shifts.findIndex(s => 
          s.nurse_id === shift.nurseId && 
          s.shift_date === shift.date && 
          !s.roster_id
        )
        
        if (legacyIndex !== -1) {
           const legacyShift = db.shifts[legacyIndex]
           
           // Find other rosters for this nurse to preserve the shift there
           const otherRosters = (db.monthly_rosters || [])
              .filter((r: any) => r.nurse_id === shift.nurseId && r.id !== shift.rosterId)
           
           // Create copies for other rosters
           otherRosters.forEach((r: any) => {
               db.shifts.push({
                   ...legacyShift,
                   id: randomUUID(),
                   roster_id: r.id,
                   updated_at: new Date().toISOString()
               })
           })
           
           // Remove the legacy shift
           db.shifts.splice(legacyIndex, 1)
           
           // Re-calculate existingIndex because splice might have shifted indices
           existingIndex = db.shifts.findIndex(s => 
            s.nurse_id === shift.nurseId && 
            s.shift_date === shift.date &&
            (shift.rosterId ? s.roster_id === shift.rosterId : !s.roster_id)
           )
        }
      }

      if (shift.type === 'DELETE') {
        if (existingIndex !== -1) {
          db.shifts.splice(existingIndex, 1)
        }
      } else {
        const newShift = {
          id: existingIndex !== -1 ? db.shifts[existingIndex].id : randomUUID(),
          nurse_id: shift.nurseId,
          roster_id: shift.rosterId || undefined,
          shift_date: shift.date,
          shift_type: shift.type,
          updated_at: new Date().toISOString()
        }
        
        if (existingIndex !== -1) {
          db.shifts[existingIndex] = newShift
        } else {
          db.shifts.push(newShift)
        }
      }
    })
    
    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  
  // Handle Upserts and Deletes logic safely
  // Group by nurse to optimize
  const shiftsByNurse: Record<string, typeof shifts> = {}
  shifts.forEach(s => {
    if (!shiftsByNurse[s.nurseId]) shiftsByNurse[s.nurseId] = []
    shiftsByNurse[s.nurseId].push(s)
  })

  for (const nurseId of Object.keys(shiftsByNurse)) {
    const nurseShifts = shiftsByNurse[nurseId]
    
    // Further group by rosterId to ensure targeted operations
    const shiftsByRoster: Record<string, typeof nurseShifts> = {}
    nurseShifts.forEach(s => {
        const key = s.rosterId || 'legacy'
        if (!shiftsByRoster[key]) shiftsByRoster[key] = []
        shiftsByRoster[key].push(s)
    })

    for (const rKey in shiftsByRoster) {
        const batch = shiftsByRoster[rKey]
        const dates = batch.map(s => s.date)
        const rosterId = rKey === 'legacy' ? null : rKey

        if (rosterId) {
            // Check for legacy shifts (but DO NOT DELETE THEM anymore)
            // We keep them as "Global Fallbacks" for other rosters.
            // If we are clearing a cell (DELETE type), we must "Mask" the legacy shift
            // by inserting an explicit empty/blocked shift in the current roster.
            
            const { data: legacyShifts } = await supabase
                .from('shifts')
                .select('*')
                .eq('nurse_id', nurseId)
                .is('roster_id', null)
                .in('date', dates)

            const legacyDates = new Set(legacyShifts?.map(s => s.date) || [])

            // Process "Deletes" (Clear cell)
            const deletes = batch.filter(s => s.type === 'DELETE')
            if (deletes.length > 0) {
                // For dates with Legacy shift: Upsert 'FOLGA_VAZIA' (Mask)
                const toMask = deletes.filter(s => legacyDates.has(s.date))
                if (toMask.length > 0) {
                     const maskInserts = toMask.map(s => ({
                         nurse_id: s.nurseId,
                         roster_id: rosterId,
                         date: s.date,
                         type: 'FOLGA_VAZIA' // Explicit empty mask
                     }))
                     await supabase.from('shifts').upsert(maskInserts, { onConflict: 'roster_id, date' })
                }

                // For dates WITHOUT Legacy shift: Delete the specific shift (Standard cleanup)
                const toDeleteDates = deletes.filter(s => !legacyDates.has(s.date)).map(s => s.date)
                if (toDeleteDates.length > 0) {
                    await supabase
                        .from('shifts')
                        .delete()
                        .eq('roster_id', rosterId)
                        .in('date', toDeleteDates)
                }
            }
            
            // Process "Inserts/Updates" (Set value)
            const upserts = batch.filter(s => s.type !== 'DELETE').map(s => ({
                nurse_id: s.nurseId,
                roster_id: rosterId,
                date: s.date,
                type: s.type
            }))

            if (upserts.length > 0) {
                const { error: insertError } = await supabase
                    .from('shifts')
                    .upsert(upserts, { onConflict: 'roster_id, date' })
                
                if (insertError) {
                    console.error('Error inserting new shifts:', insertError)
                    if (insertError.code === '23505') {
                        return { success: false, message: 'Erro de duplicidade: Execute o script V14 no Supabase.' }
                    }
                    return { success: false, message: 'Erro ao salvar: ' + insertError.message }
                }
            }
        } else {
            // Legacy/Fallback behavior: Delete by nurse_id where roster_id is null
            const { error: deleteError } = await supabase
                .from('shifts')
                .delete()
                .eq('nurse_id', nurseId)
                .is('roster_id', null) // Be explicit to avoid deleting roster-specific shifts
                .in('date', dates)

            if (deleteError) {
                console.error('Error deleting old shifts:', deleteError)
                return { success: false, message: 'Erro ao limpar turnos antigos: ' + deleteError.message }
            }

            // Shared insert logic moved here for Legacy
            const toInsert = batch
            .filter(s => s.type !== 'DELETE')
            .map(s => ({
                nurse_id: s.nurseId,
                roster_id: null,
                date: s.date,
                type: s.type
            }))

            if (toInsert.length > 0) {
                const { error: insertError } = await supabase
                    .from('shifts')
                    .insert(toInsert)
                 if (insertError) {
                    console.error('Error inserting legacy shifts:', insertError)
                    return { success: false, message: 'Erro ao salvar turnos antigos: ' + insertError.message }
                 }
            }
        }
    }
  }
  
  revalidatePath('/')
  return { success: true }
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
