'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase'
import { readDb, writeDb, isLocalMode } from '@/lib/local-db'
import { randomUUID } from 'crypto'

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

export async function getNurses() {
  if (isLocalMode()) {
    const db = readDb()
    return db.nurses.sort((a, b) => a.name.localeCompare(b.name))
  }
  
  const supabase = createClient()
  const { data } = await supabase
    .from('nurses')
    .select('id,name,cpf,role,coren,vinculo,section_id,unit_id,created_at')
    .order('name')
  return data || []
}

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
  const vinculo = formData.get('vinculo') as string
  const role = formData.get('role') as string || 'ENFERMEIRO'
  const sectionId = formData.get('sectionId') as string
  const unitId = formData.get('unitId') as string

  // Validate Name (Essential)
  if (!name) {
    return { success: false, message: 'Nome é obrigatório' }
  }

  // Handle CPF: Use provided or generate temporary
  const finalCpf = cpf || `TEMP-${Date.now()}`

  if (isLocalMode()) {
    const db = readDb()
    
    // Check duplicate CPF
    if (db.nurses.some(n => n.cpf === finalCpf)) {
      return { success: false, message: 'CPF já cadastrado' }
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
    vinculo,
    role,
    section_id: finalSectionId || null,
    unit_id: unitId || null
  }).select().single()

  if (error) {
    console.error('Error creating nurse:', error)
    if (error.code === '23505') return { success: false, message: 'CPF já cadastrado' }
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
          year: currentYear
      })
  }

  revalidatePath('/servidores')
  return { success: true, message: 'Servidor cadastrado com sucesso!' }
}

export async function getSections() {
  if (isLocalMode()) {
    const db = readDb()
    return db.schedule_sections || []
  }
  
  const supabase = createClient()
  const { data } = await supabase.from('schedule_sections').select('*').order('position', { ascending: true, nullsFirst: true }).order('title', { ascending: true })
  return data || []
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
    // 1. Unassign old coordinator(s) for this section (optional but good for consistency)
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

    // Primeiro remove escalas mensais que referenciam este setor (evita erro de FK)
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

  if (!rawCpf || !password) {
    return { message: 'CPF e Senha são obrigatórios' }
  }

  const cleanCpf = rawCpf.replace(/\D/g, '')

  if (isLocalMode()) {
    const db = readDb()
    const nurse = db.nurses.find(n => n.cpf.replace(/\D/g, '') === cleanCpf)

    if (!nurse) {
      return { message: 'CPF não encontrado (Local)' }
    }

    if (nurse.password !== password) {
      return { message: 'Senha incorreta (Local)' }
    }

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

    if (mustChangePassword) {
      redirect('/alterar-senha')
    }
    redirect('/')
  }

  const supabase = createClient()
  
  let nurse = null
  
  // Tenta buscar exato primeiro
  const { data: nursesRaw } = await supabase
    .from('nurses')
    .select('*')
    .eq('cpf', rawCpf)
    
  if (nursesRaw && nursesRaw.length > 0) {
      nurse = nursesRaw[0]
  }

  if (!nurse) {
      // Tenta buscar pelo limpo
      const { data: nursesClean } = await supabase
        .from('nurses')
        .select('*')
        .eq('cpf', cleanCpf)
      
      if (nursesClean && nursesClean.length > 0) {
          nurse = nursesClean[0]
      }
  }

  if (!nurse) {
      // Tenta buscar pelo formatado (XXX.XXX.XXX-XX)
      // Garante que tem 11 dígitos para formatar corretamente
      if (cleanCpf.length === 11) {
          const formattedCpf = cleanCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
          const { data: nursesFormatted } = await supabase
            .from('nurses')
            .select('*')
            .eq('cpf', formattedCpf)
          
          if (nursesFormatted && nursesFormatted.length > 0) {
              nurse = nursesFormatted[0]
          }
      }
  }

  if (!nurse) {
    return { message: 'CPF não encontrado' }
  }

  if (nurse.password !== password) {
    return { message: 'Senha incorreta' }
  }

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
      .select('nurse_id, section_id, unit_id, month, year')
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

  const rosterByNurse: Record<string, { section_id: string | null, unit_id: string | null }> = {}
  ;(rosterRows || []).forEach((r: any) => {
    rosterByNurse[r.nurse_id] = { section_id: r.section_id || null, unit_id: r.unit_id || null }
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
    const roster = rosterByNurse[s.nurse_id]
    const sectionTitle = roster?.section_id ? sectionsById[roster.section_id] || null : null
    const unitTitle = roster?.unit_id ? unitsById[roster.unit_id] || null : null
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
      is_in_roster: !!roster,
      swap_with_name: swapWithName
    }
  })

  return { 
    success: true, 
    data: enrichedShifts.filter(s => s.is_in_roster && !timeOffNurseIds.has(s.nurse_id)) 
  }
}

export async function getMonthlyScheduleData(month: number, year: number) {
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
      const finalRoster = db.monthly_rosters.filter(r => r.month === month && r.year === year)
      
      // Filter shifts
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
        supabase.from('nurses').select('*').order('name'),
        supabase.from('monthly_rosters').select('*').eq('month', month).eq('year', year),
        supabase.from('shifts').select('id, nurse_id, date, type, roster_id').gte('date', startDate).lte('date', endDate),
        supabase.from('time_off_requests').select('id, nurse_id, start_date, end_date, type, status, unit_id').in('status', ['approved', 'pending']).or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`),
        supabase.from('monthly_schedule_metadata').select('*').eq('month', month).eq('year', year),
        supabase.from('absences').select('*').gte('date', startDate).lte('date', endDate)
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
    const nurseIds = Array.from(new Set(rosterToDelete.map((r: any) => r.nurse_id).filter(Boolean)))

    db.monthly_rosters = db.monthly_rosters.filter((r: any) => !(r.month === month && r.year === year && (unitId ? r.unit_id === unitId : !r.unit_id)))

    if (nurseIds.length > 0) {
      db.shifts = db.shifts.filter((s: any) => {
        if (!nurseIds.includes(s.nurse_id)) return true
        return s.shift_date < startDate || s.shift_date > endDate
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
      .select('nurse_id, unit_id')
      .eq('month', month)
      .eq('year', year)

    const { data: rosterRows, error: rosterError } = await rosterQuery
    if (rosterError && rosterError.code !== 'PGRST116') throw rosterError

    const filteredRoster = (rosterRows || []).filter((r: any) => unitId ? r.unit_id === unitId : !r.unit_id)
    const nurseIds = Array.from(new Set(filteredRoster.map((r: any) => r.nurse_id).filter(Boolean)))

    let deleteRoster = supabase
      .from('monthly_rosters')
      .delete()
      .eq('month', month)
      .eq('year', year)

    if (unitId) deleteRoster = deleteRoster.eq('unit_id', unitId)
    else deleteRoster = deleteRoster.is('unit_id', null)

    const { error: deleteRosterError } = await deleteRoster
    if (deleteRosterError) throw deleteRosterError

    if (nurseIds.length > 0) {
      const { error: deleteShiftsError } = await supabase
        .from('shifts')
        .delete()
        .in('nurse_id', nurseIds)
        .gte('date', startDate)
        .lte('date', endDate)

      if (deleteShiftsError) throw deleteShiftsError
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
        // Check if already in roster for this month (update or insert)
        const existingIndex = db.monthly_rosters.findIndex((r: any) => r.nurse_id === nurseId && r.month === m && r.year === year)
        
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
          if (!allowDuplicate) {
              const startDate = `${year}-${String(m).padStart(2, '0')}-01`
              const lastDay = new Date(year, m, 0).getDate()
              const endDate = `${year}-${String(m).padStart(2, '0')}-${lastDay}`
              
              if (db.shifts) {
                  db.shifts = db.shifts.filter((s: any) => 
                    !(s.nurse_id === nurseId && s.shift_date >= startDate && s.shift_date <= endDate)
                  )
              }
          }

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
  
  for (const m of monthsToUpdate) {
    // Check if exists first to decide whether to clear shifts
    const { data: existing } = await supabase
        .from('monthly_rosters')
        .select('id')
        .eq('nurse_id', nurseId)
        .eq('month', m)
        .eq('year', year)
        .maybeSingle()

    if (!existing && !allowDuplicate) {
        // Clear shifts for this month if adding new (and not forcing duplicate)
        const startDate = `${year}-${String(m).padStart(2, '0')}-01`
        const lastDay = new Date(year, m, 0).getDate()
        const endDate = `${year}-${String(m).padStart(2, '0')}-${lastDay}`
        
        await supabase.from('shifts')
            .delete()
            .eq('nurse_id', nurseId)
            .gte('date', startDate)
            .lte('date', endDate)
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
        // We do this manually to avoid relying on UNIQUE constraints for upsert logic,
        // because we might have removed those constraints to allow duplicates for other cases.
        
        // Check for existing record
        const { data: existingRecord } = await supabase
            .from('monthly_rosters')
            .select('id')
            .eq('nurse_id', nurseId)
            .eq('month', m)
            .eq('year', year)
            .limit(1)
            .maybeSingle()
            
        if (existingRecord) {
            // Update existing
            const { error: updateError } = await supabase
                .from('monthly_rosters')
                .update(payload)
                .eq('id', existingRecord.id)
            error = updateError
        } else {
            // Insert new
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
  return { success: true }
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

  if (isLocalMode()) {
    const db = readDb()
    if (!db.monthly_rosters) db.monthly_rosters = []

    const sourceRoster = db.monthly_rosters.filter(r => r.month === sourceMonth && r.year === sourceYear && (!unitId || r.unit_id === unitId))
    
    let addedCount = 0
    sourceRoster.forEach(item => {
        // Check if exists in target
        const exists = db.monthly_rosters.some(r => r.nurse_id === item.nurse_id && r.month === targetMonth && r.year === targetYear)
        if (!exists) {
            db.monthly_rosters.push({
                id: randomUUID(),
                nurse_id: item.nurse_id,
                section_id: item.section_id,
                unit_id: item.unit_id,
                month: targetMonth,
                year: targetYear,
                observation: item.observation || '',
                sector: item.sector || '',
                list_order: item.list_order ?? null,
                created_at: item.created_at || new Date().toISOString()
            })
            addedCount++
        }
    })
    
    const nurseIds = sourceRoster.map(r => r.nurse_id)
    if (nurseIds.length > 0) {
        const sourceStartDate = `${sourceYear}-${String(sourceMonth).padStart(2, '0')}-01`
        const sourceLastDay = new Date(sourceYear, sourceMonth, 0).getDate()
        const sourceEndDate = `${sourceYear}-${String(sourceMonth).padStart(2, '0')}-${sourceLastDay}`
        
        const sourceShifts = db.shifts.filter(s => 
            nurseIds.includes(s.nurse_id) && 
            s.shift_date >= sourceStartDate && 
            s.shift_date <= sourceEndDate
        )

        if (sourceShifts.length > 0) {
            const targetLastDay = new Date(targetYear, targetMonth, 0).getDate()
            const targetStartDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
            const targetEndDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetLastDay).padStart(2, '0')}`

            // Limpar quaisquer plantões existentes desses profissionais no mês de destino
            db.shifts = db.shifts.filter(s => 
                !(
                    nurseIds.includes(s.nurse_id) &&
                    s.shift_date >= targetStartDate &&
                    s.shift_date <= targetEndDate
                )
            )

            sourceShifts.forEach(shift => {
                const day = parseInt(shift.shift_date.split('-')[2], 10)
                if (day > targetLastDay) return

                const newDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`

                db.shifts.push({
                    id: randomUUID(),
                    nurse_id: shift.nurse_id,
                    shift_date: newDate,
                    shift_type: shift.shift_type,
                    updated_at: new Date().toISOString()
                })
            })
        }
    }

    writeDb(db)
    revalidatePath('/')
    return { success: true, message: `${addedCount} servidores copiados (incluindo plantões).` }
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

  // Group shifts by roster_id (preferred) and nurse_id (legacy fallback)
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

  // 1. Limpar o mês de destino para garantir uma cópia fiel (evitar duplicatas e misturas)
  let deleteQuery = supabase.from('monthly_rosters').delete().eq('month', targetMonth).eq('year', targetYear)
  if (unitId) deleteQuery = deleteQuery.eq('unit_id', unitId)
  await deleteQuery

  // 2. Ordenar a lista de origem para preservar a ordem visual
  const sortedSourceRoster = [...sourceRoster].sort((a, b) => {
      // Prioridade: list_order
      if (a.list_order !== null && b.list_order !== null) {
          return a.list_order - b.list_order
      }
      if (a.list_order !== null) return -1
      if (b.list_order !== null) return 1
      
      // Fallback: created_at
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  const targetLastDay = new Date(targetYear, targetMonth, 0).getDate()
  let addedCount = 0

  // 3. Processar sequencialmente para garantir ordem
  const processedLegacyNurses = new Set<string>()

  for (const sourceEntry of sortedSourceRoster) {
      // Create target roster entry
      const targetEntry = {
          nurse_id: sourceEntry.nurse_id,
          section_id: sourceEntry.section_id,
          unit_id: sourceEntry.unit_id,
          month: targetMonth,
          year: targetYear,
          observation: sourceEntry.observation || null,
          sector: sourceEntry.sector || null,
          list_order: sourceEntry.list_order ?? null,
          created_at: new Date().toISOString()
      }

      // Insert and get ID
      const { data: insertedRoster, error: insertError } = await supabase
          .from('monthly_rosters')
          .insert(targetEntry)
          .select()
          .single()
      
      if (insertError) {
          console.error('Error inserting roster:', insertError)
          continue
      }
      
      addedCount++

      // Find associated shifts
      let myShifts = shiftsByRosterId[sourceEntry.id] || []
      
      // Legacy handling: Attach legacy shifts to the FIRST occurrence of this nurse
      if (!processedLegacyNurses.has(sourceEntry.nurse_id) && shiftsByNurseIdLegacy[sourceEntry.nurse_id]) {
          myShifts = [...myShifts, ...shiftsByNurseIdLegacy[sourceEntry.nurse_id]]
          processedLegacyNurses.add(sourceEntry.nurse_id)
      }

      if (myShifts.length > 0) {
          const shiftsToInsert = myShifts.map(s => {
              const day = parseInt((s.date as string).split('-')[2], 10)
              if (day > targetLastDay) return null

              const newDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              return {
                  nurse_id: s.nurse_id,
                  date: newDate,
                  type: s.type,
                  roster_id: insertedRoster.id
              }
          }).filter(Boolean)

          if (shiftsToInsert.length > 0) {
              await supabase.from('shifts').insert(shiftsToInsert)
          }
      }
  }
  
  revalidatePath('/')
  return { success: true, message: `${addedCount} servidores copiados com sucesso.` }
}

export async function updateRosterObservation(nurseId: string, month: number, year: number, observation: string) {
  try {
    await checkAdmin()
    
    if (isLocalMode()) {
      const db = readDb()
      const roster = db.monthly_rosters.find(r => r.nurse_id === nurseId && r.month === month && r.year === year)
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
      .match({ nurse_id: nurseId, month, year })

    if (error) throw error
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    console.error('Error updating observation:', e)
    return { success: false, message: 'Erro ao atualizar observação' }
  }
}

export async function updateRosterSector(nurseId: string, month: number, year: number, sector: string) {
  try {
    await checkAdmin()
    
    if (isLocalMode()) {
      const db = readDb()
      const roster = db.monthly_rosters.find(r => r.nurse_id === nurseId && r.month === month && r.year === year)
      if (roster) {
        roster.sector = sector
        writeDb(db)
        revalidatePath('/')
        return { success: true }
      }
      return { success: false, message: 'Roster entry not found' }
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('monthly_rosters')
      .update({ sector })
      .match({ nurse_id: nurseId, month, year })

    if (error) throw error
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    console.error('Error updating sector:', e)
    return { success: false, message: 'Erro ao atualizar setor' }
  }
}

export async function updateRosterOrder(nurseId: string, month: number, year: number, listOrder: number | null) {
  try {
    await checkAdmin()

    if (isLocalMode()) {
      const db = readDb()
      const roster = db.monthly_rosters.find(r => r.nurse_id === nurseId && r.month === month && r.year === year)
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
      .match({ nurse_id: nurseId, month, year })

    if (error) throw error
    revalidatePath('/')
    return { success: true }
  } catch (e) {
    console.error('Error updating list order:', e)
    return { success: false, message: 'Erro ao atualizar numeração' }
  }
}

export async function resetSectionOrder(sectionId: string, unitId: string | null, month: number, year: number, startRosterId?: string, orderedRosterIds?: string[]) {
  try {
    await checkAdmin()

    if (isLocalMode()) {
      const db = readDb()
      let candidates = db.monthly_rosters
        .filter(r => r.section_id === sectionId && r.month === month && r.year === year && (unitId === 'ALL' ? true : (unitId ? r.unit_id === unitId : !r.unit_id)))
      
      if (orderedRosterIds && orderedRosterIds.length > 0) {
        // Sort candidates based on the provided order
        candidates.sort((a, b) => {
            const indexA = orderedRosterIds.indexOf(a.id)
            const indexB = orderedRosterIds.indexOf(b.id)
            if (indexA === -1 && indexB === -1) return 0
            if (indexA === -1) return 1
            if (indexB === -1) return -1
            return indexA - indexB
        })
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

      // Calculate base for numbering - GROUP BASED (Modulo 10000)
      // We want to restart numbering at 1 (visually) but keep sort order higher than previous items
      
      let prevOrder = 0
      if (startIndex > 0) {
        prevOrder = candidates[startIndex - 1].list_order || 0
      }

      // Calculate new base: next multiple of 10000 > prevOrder
      // e.g. if prev is 5, base = 10000. Next items: 10001, 10002... (Displayed as 1, 2...)
      // e.g. if prev is 10005, base = 20000. Next items: 20001, 20002...
      const newBase = (Math.floor(prevOrder / 10000) + 1) * 10000

      // Update from startIndex onwards
      // This rewrites the sequence for all subsequent items to be a single continuous chronological group
      for (let i = startIndex; i < candidates.length; i++) {
          candidates[i].list_order = newBase + (i - startIndex + 1)
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

    let sorted = data || []
    
    // Always sort by created_at -> name -> id to match frontend "Chronological" order
    // We ignore orderedRosterIds because it might be scrambled or incomplete, causing the "Mess"
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

    // Determine the starting base for numbering
    // We use "Groups" of 10000 to allow restarting numbering without affecting previous rows
    // e.g. Group 0: 1-9999. Group 1: 10001-19999 (Displays as 1-9999)
    let prevOrder = 0
    if (startIndex > 0) {
        prevOrder = sorted[startIndex - 1].list_order || 0
    }
    
    // Calculate new base: next multiple of 10000 > prevOrder
    const newBase = (Math.floor(prevOrder / 10000) + 1) * 10000

    // Only update from startIndex onwards
    const updates = []
    for (let i = startIndex; i < sorted.length; i++) {
        const r = sorted[i]
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
            // Use new base + relative index (1, 2, 3...)
            list_order: newBase + (i - startIndex + 1)
        })
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
  const vinculo = formData.get('vinculo') as string
  const role = formData.get('role') as string
  const sectionId = formData.get('sectionId') as string
  const unitId = formData.get('unitId') as string
  const password = formData.get('password') as string
  const useDefaultPassword = formData.get('useDefaultPassword') === 'on'

  if (!name) return { success: false, message: 'Nome é obrigatório' }

  if (isLocalMode()) {
    const db = readDb()
    const nurse = db.nurses.find(n => n.id === id)
    if (!nurse) return { success: false, message: 'Servidor não encontrado (Local)' }

    // Check duplicate CPF only if changed
    if (cpf && cpf !== nurse.cpf && db.nurses.some(n => n.cpf === cpf)) {
        return { success: false, message: 'CPF já cadastrado' }
    }

    nurse.name = name
    if (cpf) nurse.cpf = cpf
    nurse.coren = coren
    nurse.vinculo = vinculo
    nurse.role = role
    
    // Only update location if provided (optional)
    if (sectionId) nurse.section_id = sectionId
    if (unitId) nurse.unit_id = unitId

    if (useDefaultPassword) {
      nurse.password = '123456'
    } else if (password) {
      nurse.password = password
    }

    writeDb(db)
    revalidatePath('/')
    revalidatePath('/servidores')
    return { success: true, message: 'Servidor atualizado com sucesso (Local)' }
  }

  const supabase = createClient()
  
  const updateData: any = {
      name,
      coren,
      vinculo,
      role
  }
  if (cpf) updateData.cpf = cpf
  if (sectionId) updateData.section_id = sectionId
  if (unitId) updateData.unit_id = unitId

  if (useDefaultPassword) {
    updateData.password = '123456'
  } else if (password) {
    updateData.password = password
  }

  const { error } = await supabase.from('nurses').update(updateData).eq('id', id)

  if (error) return { success: false, message: 'Erro ao atualizar: ' + error.message }
  
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
  const { error } = await supabase.from('schedule_sections').delete().eq('id', id)
  if (error) return { success: false, message: error.message }
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
            // Check for legacy shifts to split (preserve for other rosters)
            const { data: legacyShifts } = await supabase
                .from('shifts')
                .select('*')
                .eq('nurse_id', nurseId)
                .is('roster_id', null)
                .in('date', dates)

            if (legacyShifts && legacyShifts.length > 0) {
                 const { data: nurseRosters } = await supabase
                    .from('monthly_rosters')
                    .select('id')
                    .eq('nurse_id', nurseId)
                 
                 const otherRosterIds = nurseRosters?.map(r => r.id).filter(id => id !== rosterId) || []
                 
                 if (otherRosterIds.length > 0) {
                     const splitShifts: any[] = []
                     legacyShifts.forEach(ls => {
                         otherRosterIds.forEach(rid => {
                             splitShifts.push({
                                 nurse_id: nurseId,
                                 roster_id: rid,
                                 date: ls.date,
                                 type: ls.type
                             })
                         })
                     })
                     
                     if (splitShifts.length > 0) {
                         await supabase.from('shifts').insert(splitShifts)
                     }
                 }
            }

            // 1. Delete existing shifts for this SPECIFIC roster entry
            const { error: deleteSpecificError } = await supabase
                .from('shifts')
                .delete()
                .eq('roster_id', rosterId)
                .in('date', dates)

            if (deleteSpecificError) {
                console.error('Error deleting specific shifts:', deleteSpecificError)
                return { success: false, message: 'Erro ao limpar turnos: ' + deleteSpecificError.message }
            }

            // 2. Delete LEGACY shifts (roster_id IS NULL) to prevent interference/duplication
            // This ensures that when we set a shift for a roster row, we don't have a "ghost" legacy shift showing up via fallback
            const { error: deleteLegacyError } = await supabase
                .from('shifts')
                .delete()
                .eq('nurse_id', nurseId)
                .is('roster_id', null)
                .in('date', dates)
            
            if (deleteLegacyError) {
                console.error('Error cleaning legacy shifts:', deleteLegacyError)
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
        }

        // 3. Insert new shifts (filtering out DELETE type)
        const toInsert = batch
            .filter(s => s.type !== 'DELETE')
            .map(s => ({
                nurse_id: s.nurseId,
                roster_id: rosterId, // Can be null
                date: s.date,
                type: s.type
            }))

        if (toInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('shifts')
                .insert(toInsert)
            
            if (insertError) {
                console.error('Error inserting new shifts:', insertError)
                return { success: false, message: 'Erro ao salvar novos turnos: ' + insertError.message }
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
