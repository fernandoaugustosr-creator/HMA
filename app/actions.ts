'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase'
import { readDb, writeDb } from '@/lib/local-db'
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

// Helper para verificar se usa DB Local
function isLocalMode() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !supabaseUrl || supabaseUrl.includes('sua_url')
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
    if (error.code === '23505') return { success: false, message: 'CPF já cadastrado' }
    return { success: false, message: 'Erro ao cadastrar servidor: ' + error.message }
  }

  revalidatePath('/')
  revalidatePath('/servidores')
  return { success: true, message: 'Servidor cadastrado com sucesso' }
}

export async function login(prevState: any, formData: FormData) {
  const cpf = formData.get('cpf') as string
  const password = formData.get('password') as string

  if (!cpf || !password) {
    return { message: 'CPF e Senha são obrigatórios' }
  }

  if (isLocalMode()) {
    const db = readDb()
    const nurse = db.nurses.find(n => n.cpf === cpf)

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
  const { data: nurse, error } = await supabase
    .from('nurses')
    .select('*')
    .eq('cpf', cpf)
    .single()

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
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  if (isLocalMode()) {
    const db = readDb()
    
    // Filter shifts
    const shifts = db.shifts.filter(s => s.shift_date >= startDate && s.shift_date <= endDate)
    
    // Filter timeOffs
    const timeOffs = db.time_off_requests.filter(t => 
      t.status === 'approved' && 
      ((t.start_date <= endDate && t.end_date >= startDate))
    )

    return {
      nurses: db.nurses || [],
      shifts: shifts || [],
      timeOffs: timeOffs || [],
      sections: db.schedule_sections || [],
      units: db.units || []
    }
  }

  const supabase = createClient()
  
  const { data: sections } = await supabase.from('schedule_sections').select('*').order('position')
  const { data: units } = await supabase.from('units').select('*') // Assuming 'units' table exists in supabase for symmetry, though we are focusing on local
  const { data: nurses } = await supabase.from('nurses').select('*').order('name')
  
  const { data: shifts } = await supabase
    .from('schedules')
    .select('*')
    .gte('shift_date', startDate)
    .lte('shift_date', endDate)

  const { data: timeOffs } = await supabase
    .from('time_off_requests')
    .select('*')
    .eq('status', 'approved')
    .or(`and(start_date.lte.${endDate},end_date.gte.${startDate})`)

  return {
    nurses: nurses || [],
    shifts: shifts || [],
    timeOffs: timeOffs || [],
    sections: sections || [],
    units: units || []
  }
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
    writeDb(db)
    revalidatePath('/')
    return { success: true, message: 'Servidor removido com sucesso (Local)' }
  }

  const supabase = createClient()
  await supabase.from('schedules').delete().eq('nurse_id', id)
  await supabase.from('time_off_requests').delete().eq('nurse_id', id)
  const { error } = await supabase.from('nurses').delete().eq('id', id)

  if (error) return { success: false, message: 'Erro ao remover servidor: ' + error.message }
  revalidatePath('/')
  return { success: true, message: 'Servidor removido com sucesso' }
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
  const { error: sError } = await supabase.from('schedules').update({ nurse_id: newId }).eq('nurse_id', oldId)
  const { error: tError } = await supabase.from('time_off_requests').update({ nurse_id: newId }).eq('nurse_id', oldId)

  if (sError || tError) return { success: false, message: 'Erro ao reatribuir dados' }
  revalidatePath('/')
  return { success: true }
}

export async function assignNurseToSection(nurseId: string, sectionId: string, unitId?: string) {
  if (isLocalMode()) {
    const db = readDb()
    const nurse = db.nurses.find(n => n.id === nurseId)
    if (nurse) {
      nurse.section_id = sectionId
      if (unitId !== undefined) {
        nurse.unit_id = unitId
      }
      writeDb(db)
    }
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const updates: any = { section_id: sectionId }
  if (unitId !== undefined) {
    updates.unit_id = unitId
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
  if (!shifts.length) return { success: true }

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
  
  // Process sequentially or batch? Batch is better but upsert might be tricky with DELETE mixed in.
  // Let's separate DELETEs and UPSERTs
  const toDelete = shifts.filter(s => s.type === 'DELETE')
  const toUpsert = shifts.filter(s => s.type !== 'DELETE')
  
  // Handle Deletes
  if (toDelete.length > 0) {
     // Use nurse_id and shift_date to delete
     // Supabase doesn't support array-based delete with composite key easily in one go without RPC or iteration.
     // Iteration is safest for now.
     await Promise.all(toDelete.map(s => 
       supabase.from('schedules').delete().match({ nurse_id: s.nurseId, shift_date: s.date })
     ))
  }
  
  // Handle Upserts
  if (toUpsert.length > 0) {
      const { error } = await supabase.from('schedules').upsert(
          toUpsert.map(s => ({
              nurse_id: s.nurseId,
              shift_date: s.date,
              shift_type: s.type,
              updated_at: new Date().toISOString()
          })),
          { onConflict: 'nurse_id,shift_date' }
      )
      if (error) return { success: false, message: error.message }
  }
  
  revalidatePath('/')
  return { success: true }
}
