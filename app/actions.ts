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
}

export interface Unit {
  id: string
  title: string
}

export async function getNurses() {
  if (isLocalMode()) {
    const db = readDb()
    return db.nurses.sort((a, b) => a.name.localeCompare(b.name))
  }
  
  const supabase = createClient()
  const { data } = await supabase.from('nurses').select('*').order('name')
  return data || []
}

export async function createNurse(prevState: any, formData: FormData) {
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
    writeDb(db)

    revalidatePath('/')
    revalidatePath('/servidores')
    return { success: true, message: 'Servidor cadastrado com sucesso (Local)' }
  }

  const supabase = createClient()
  
  let finalSectionId = sectionId
  if (!finalSectionId) {
      const { data: sections } = await supabase.from('schedule_sections').select('*')
      if (sections) {
          if (role === 'ENFERMEIRO') finalSectionId = sections.find(s => s.title === 'ENFERMEIROS')?.id || null
          else if (role === 'TECNICO') finalSectionId = sections.find(s => s.title === 'TÉCNICOS DE ENFERMAGEM')?.id || null
      }
  }

  const { error } = await supabase.from('nurses').insert({ 
    name, 
    cpf: finalCpf, 
    password,
    coren,
    vinculo,
    role,
    section_id: finalSectionId,
    unit_id: unitId
  })

  if (error) {
    console.error('Supabase Error:', error)
    if (error.code === '23505') return { success: false, message: 'CPF já cadastrado' }
    return { success: false, message: 'Erro ao cadastrar servidor (Supabase): ' + error.message }
  }

  revalidatePath('/')
  revalidatePath('/servidores')
  return { success: true, message: 'Servidor cadastrado com sucesso (Supabase)' }
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

    cookies().set('session_user', JSON.stringify({ name: nurse.name, id: nurse.id, cpf: nurse.cpf }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    redirect('/')
  }

  const supabase = createClient()
  
  // Tenta buscar exato primeiro
  let { data: nurse, error } = await supabase
    .from('nurses')
    .select('*')
    .eq('cpf', rawCpf)
    .single()

  if (!nurse) {
      // Tenta buscar pelo limpo
      const { data: nurseClean } = await supabase
        .from('nurses')
        .select('*')
        .eq('cpf', cleanCpf)
        .single()
      nurse = nurseClean
  }

  if (error || !nurse) {
    return { message: 'CPF não encontrado' }
  }

  if (nurse.password !== password) {
    return { message: 'Senha incorreta' }
  }

  cookies().set('session_user', JSON.stringify({ name: nurse.name, id: nurse.id, cpf: nurse.cpf }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })

  redirect('/')
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

      // AUTO-MIGRATION: If roster is empty for this month/year, and it's Jan 2026 (or generally if roster is empty but nurses exist with static assignments), 
      // populate it to preserve existing view.
      const rosterForMonth = db.monthly_rosters.filter(r => r.month === month && r.year === year)
      
      if (rosterForMonth.length === 0 && db.nurses.length > 0) {
          // Check if we should migrate. Only if this is the first time usage or specific month.
          // For safety, let's migrate if *no* rosters exist at all (first run after update)
          const totalRosters = db.monthly_rosters.length
          if (totalRosters === 0) {
              console.log('Migrating static assignments to monthly roster...')
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

      return {
        nurses: db.nurses || [],
        roster: finalRoster || [],
        shifts: shifts || [],
        timeOffs: timeOffs || [],
        sections: db.schedule_sections || [],
        units: db.units || []
      }
    }

    const supabase = createClient()
    
    const { data: sections, error: sectionsError } = await supabase.from('schedule_sections').select('*').order('position')
    if (sectionsError) console.error('Error fetching sections:', sectionsError)

    const { data: units } = await supabase.from('units').select('*')
    const { data: nurses, error: nursesError } = await supabase.from('nurses').select('*').order('name')
    if (nursesError) console.error('Error fetching nurses:', nursesError)
    
    // Fetch Roster
    // Note: If table doesn't exist, this might fail. We assume migration applied.
    const { data: roster, error: rosterError } = await supabase
        .from('monthly_rosters')
        .select('*')
        .eq('month', month)
        .eq('year', year)
    
    if (rosterError && rosterError.code !== 'PGRST116') { // Ignore if table missing (simulated)
         console.error('Error fetching roster:', rosterError)
    }

    const { data: rawShifts, error: shiftsError } = await supabase
      .from('shifts')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
    if (shiftsError) console.error('Error fetching shifts:', shiftsError)

    const shifts = rawShifts?.map(s => ({
      ...s,
      shift_date: s.date,
      shift_type: s.type
    })) || []

    const { data: timeOffs, error: timeOffsError } = await supabase
      .from('time_off_requests')
      .select('*')
      .eq('status', 'approved')
      .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`)
    if (timeOffsError) console.error('Error fetching timeOffs:', timeOffsError)

    return {
      nurses: nurses || [],
      roster: roster || [],
      shifts: shifts || [],
      timeOffs: timeOffs || [],
      sections: sections || [],
      units: units || []
    }
  } catch (error) {
    console.error('Critical error in getMonthlyScheduleData:', error)
    // Return empty structure to prevent page crash
    return {
      nurses: [],
      roster: [],
      shifts: [],
      timeOffs: [],
      sections: [],
      units: []
    }
  }
}

export async function assignNurseToRoster(nurseId: string, sectionId: string, unitId: string | null, month: number, year: number) {
  // Propagate to future months of the current year
  const monthsToUpdate = []
  for (let m = month; m <= 12; m++) {
    monthsToUpdate.push(m)
  }

  if (isLocalMode()) {
    const db = readDb()
    if (!db.monthly_rosters) db.monthly_rosters = []
    
    monthsToUpdate.forEach(m => {
        // Check if already in roster for this month (update or insert)
        const existingIndex = db.monthly_rosters.findIndex(r => r.nurse_id === nurseId && r.month === m && r.year === year)
        
        if (existingIndex !== -1) {
          db.monthly_rosters[existingIndex].section_id = sectionId
          db.monthly_rosters[existingIndex].unit_id = unitId
        } else {
          db.monthly_rosters.push({
            id: randomUUID(),
            nurse_id: nurseId,
            section_id: sectionId,
            unit_id: unitId,
            month: m,
            year,
            created_at: new Date().toISOString()
          })
        }
    })

    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  
  const upserts = monthsToUpdate.map(m => ({
    nurse_id: nurseId, 
    section_id: sectionId, 
    unit_id: unitId, 
    month: m, 
    year 
  }))

  const { error } = await supabase
    .from('monthly_rosters')
    .upsert(upserts, { onConflict: 'nurse_id, month, year' })

  if (error) return { success: false, message: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function removeNurseFromRoster(nurseId: string, month: number, year: number) {
  if (isLocalMode()) {
    const db = readDb()
    if (db.monthly_rosters) {
        // Remove from current month AND future months of the same year
        db.monthly_rosters = db.monthly_rosters.filter(r => !(r.nurse_id === nurseId && r.year === year && r.month >= month))
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
    .gte('month', month)

  if (error) return { success: false, message: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function copyMonthlyRoster(sourceMonth: number, sourceYear: number, targetMonth: number, targetYear: number, unitId?: string) {
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
                created_at: new Date().toISOString()
            })
            addedCount++
        }
    })
    
    writeDb(db)
    revalidatePath('/')
    return { success: true, message: `${addedCount} servidores copiados.` }
  }

  const supabase = createClient()
  
  // Fetch source
  let query = supabase.from('monthly_rosters').select('*').eq('month', sourceMonth).eq('year', sourceYear)
  if (unitId) query = query.eq('unit_id', unitId)
  
  const { data: sourceRoster, error: fetchError } = await query
  
  if (fetchError) return { success: false, message: fetchError.message }
  if (!sourceRoster || sourceRoster.length === 0) return { success: true, message: 'Nenhum servidor encontrado no mês de origem.' }

  const toInsert = sourceRoster.map(item => ({
      nurse_id: item.nurse_id,
      section_id: item.section_id,
      unit_id: item.unit_id,
      month: targetMonth,
      year: targetYear
  }))

  // Insert ignoring duplicates (onConflict do nothing)
  const { error: insertError } = await supabase
    .from('monthly_rosters')
    .upsert(toInsert, { onConflict: 'nurse_id, month, year', ignoreDuplicates: true })

  if (insertError) return { success: false, message: insertError.message }
  
  revalidatePath('/')
  return { success: true, message: 'Cópia realizada com sucesso.' }
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
  if (!session) return { message: 'Usuário não autenticado' }
  const user = JSON.parse(session.value)
  const isAdmin = user.cpf === '02170025367'

  const targetNurseId = (isAdmin && nurseIdFromForm) ? nurseIdFromForm : user.id
  const initialStatus = (isAdmin && nurseIdFromForm) ? 'approved' : 'pending'

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
    status: initialStatus
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
    const newRequest = {
      id: randomUUID(),
      nurse_id: nurseId,
      start_date: startDate,
      end_date: endDate,
      reason,
      type,
      status: 'approved',
      created_at: new Date().toISOString()
    }
    db.time_off_requests.push(newRequest)
    writeDb(db)
    revalidatePath('/')
    return { success: true, message: 'Ausência cadastrada com sucesso (Local)' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('time_off_requests').insert({
    nurse_id: nurseId,
    start_date: startDate,
    end_date: endDate,
    reason,
    type,
    status: 'approved'
  })

  if (error) return { success: false, message: 'Erro ao cadastrar ausência: ' + error.message }
  revalidatePath('/')
  return { success: true, message: 'Ausência cadastrada com sucesso' }
}

export async function deleteNurse(id: string) {
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
  const name = formData.get('name') as string
  const cpf = formData.get('cpf') as string
  const coren = formData.get('coren') as string
  const vinculo = formData.get('vinculo') as string
  const role = formData.get('role') as string
  const sectionId = formData.get('sectionId') as string
  const unitId = formData.get('unitId') as string

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

  const { error } = await supabase.from('nurses').update(updateData).eq('id', id)

  if (error) return { success: false, message: 'Erro ao atualizar: ' + error.message }
  
  revalidatePath('/')
  revalidatePath('/servidores')
  return { success: true, message: 'Servidor atualizado com sucesso' }
}

export async function reassignNurse(oldId: string, newId: string) {
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
  const isAdmin = user.cpf === '02170025367'

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
  const { error } = await supabase.from('schedule_sections').insert({ title })
  if (error) return { success: false, message: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function updateSection(id: string, title: string) {
  if (isLocalMode()) {
    const db = readDb()
    const section = db.schedule_sections.find(s => s.id === id)
    if (section) {
      section.title = title
      writeDb(db)
    }
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase.from('schedule_sections').update({ title }).eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function deleteSection(id: string) {
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

export async function saveShifts(shifts: { nurseId: string, date: string, type: string }[]) {
  console.log('saveShifts called with:', JSON.stringify(shifts, null, 2))
  
  if (!shifts || !Array.isArray(shifts) || !shifts.length) {
    return { success: true }
  }

  if (isLocalMode()) {
    const db = readDb()
    
    shifts.forEach(shift => {
      // Check if exists
      const existingIndex = db.shifts.findIndex(s => s.nurse_id === shift.nurseId && s.shift_date === shift.date)
      
      if (shift.type === 'DELETE') {
        if (existingIndex !== -1) {
          db.shifts.splice(existingIndex, 1)
        }
      } else {
        const newShift = {
          id: existingIndex !== -1 ? db.shifts[existingIndex].id : randomUUID(),
          nurse_id: shift.nurseId,
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
  // We assume shifts are mostly for the same nurse, but we should handle mixed cases if any.
  // Group by nurse to optimize
  const shiftsByNurse: Record<string, typeof shifts> = {}
  shifts.forEach(s => {
    if (!shiftsByNurse[s.nurseId]) shiftsByNurse[s.nurseId] = []
    shiftsByNurse[s.nurseId].push(s)
  })

  for (const nurseId of Object.keys(shiftsByNurse)) {
    const nurseShifts = shiftsByNurse[nurseId]
    const dates = nurseShifts.map(s => s.date)

    // 1. Delete existing shifts for these dates (prevents duplicates if constraint is missing)
    const { error: deleteError } = await supabase
      .from('shifts')
      .delete()
      .eq('nurse_id', nurseId)
      .in('date', dates)

    if (deleteError) {
      console.error('Error deleting old shifts:', deleteError)
      return { success: false, message: 'Erro ao limpar turnos antigos: ' + deleteError.message }
    }

    // 2. Insert new shifts (filtering out DELETE type)
    const toInsert = nurseShifts
      .filter(s => s.type !== 'DELETE')
      .map(s => ({
        nurse_id: s.nurseId,
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
  
  revalidatePath('/')
  return { success: true }
}
