'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase'

export async function getNurses() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl.includes('sua_url')) {
    return [
      { id: 'mock-1', name: 'Maria Silva (Mock)', cpf: '111.111.111-11' },
      { id: 'mock-2', name: 'João Santos (Mock)', cpf: '222.222.222-22' },
      { id: 'mock-3', name: 'Administrador', cpf: '02170025367' },
    ]
  }
  
  const supabase = createClient()
  const { data } = await supabase.from('nurses').select('*').order('name')
  return data || []
}

export async function createNurse(prevState: any, formData: FormData) {
  const name = formData.get('name') as string
  const cpf = formData.get('cpf') as string
  const password = formData.get('password') as string || '123456'

  if (!name || !cpf) {
    return { message: 'Nome e CPF são obrigatórios' }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl.includes('sua_url')) {
    return { success: true, message: 'Servidor cadastrado com sucesso (Modo Mock)' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('nurses').insert({ name, cpf, password })

  if (error) {
    if (error.code === '23505') return { message: 'CPF já cadastrado' }
    return { message: 'Erro ao cadastrar servidor: ' + error.message }
  }

  revalidatePath('/servidores')
  return { success: true, message: 'Servidor cadastrado com sucesso' }
}

export async function login(prevState: any, formData: FormData) {
  const cpf = formData.get('cpf') as string
  const password = formData.get('password') as string

  if (!cpf || !password) {
    return { message: 'CPF e Senha são obrigatórios' }
  }

  // Verificar variáveis de ambiente
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('sua_url')) {
    // Modo Mock para testes locais sem Supabase configurado
    if ((cpf === '111.111.111-11' || cpf === '02170025367') && password === '123456') {
      const name = cpf === '02170025367' ? 'Administrador' : 'Maria Silva (Mock)'
      cookies().set('session_user', JSON.stringify({ name, id: 'mock-1', cpf }), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 7, // 1 semana
        path: '/',
      })
      redirect('/')
    }
    return { message: 'Credenciais inválidas (Mock: Use 02170025367 / 123456)' }
  }

  const supabase = createClient()
  
  // Buscar usuário pelo CPF
  const { data: nurse, error } = await supabase
    .from('nurses')
    .select('*')
    .eq('cpf', cpf)
    .single()

  if (error) {
    console.error('Erro no login:', error)
    if (error.code === 'PGRST116') { // Código para "No rows found" no PostgREST
       return { message: 'CPF não encontrado' }
    }
    // Retorna erro técnico para facilitar debug (tabelas inexistentes, etc)
    return { message: 'Erro no banco de dados: ' + error.message }
  }

  if (!nurse) {
    return { message: 'CPF não encontrado' }
  }

  // Verificar senha (texto plano por enquanto, conforme solicitado)
  // Em produção, usar bcrypt.compare(password, nurse.password)
  if (nurse.password !== password) {
    return { message: 'Senha incorreta' }
  }

  // Login com sucesso
  cookies().set('session_user', JSON.stringify({ name: nurse.name, id: nurse.id, cpf: nurse.cpf }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7, // 1 semana
    path: '/',
  })

  redirect('/')
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
  
  if (!startDate) {
    return { message: 'Data da folga é obrigatória' }
  }

  // Se não tiver data de fim, assume que é apenas um dia (data de fim = data de início)
  if (!endDate) {
    endDate = startDate
  }

  const session = cookies().get('session_user')
  if (!session) return { message: 'Usuário não autenticado' }
  const user = JSON.parse(session.value)
  const isAdmin = user.cpf === '02170025367'

  // Se for admin e tiver nurseId no form, usa o do form. Senão usa o do usuário logado.
  const targetNurseId = (isAdmin && nurseIdFromForm) ? nurseIdFromForm : user.id
  // Se for admin criando, já aprova automaticamente.
  const initialStatus = (isAdmin && nurseIdFromForm) ? 'approved' : 'pending'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl.includes('sua_url')) {
    return { success: true, message: 'Solicitação enviada (Modo Mock)' }
  }

  const supabase = createClient()
  const { error } = await supabase.from('time_off_requests').insert({
    nurse_id: targetNurseId,
    start_date: startDate,
    end_date: endDate,
    reason,
    status: initialStatus
  })

  if (error) {
    return { message: 'Erro ao solicitar folga: ' + error.message }
  }

  revalidatePath('/folgas')
  return { success: true, message: 'Solicitação enviada com sucesso' }
}

export async function getTimeOffRequests() {
  const session = cookies().get('session_user')
  if (!session) return []
  const user = JSON.parse(session.value)
  const isAdmin = user.cpf === '02170025367'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl.includes('sua_url')) {
    // Mock Data
    const mockData = [
      { 
        id: '1', 
        nurse_id: 'mock-1', 
        start_date: '2026-02-10', 
        end_date: '2026-02-15', 
        reason: 'Viagem', 
        status: 'pending',
        nurses: { name: 'Maria Silva (Mock)' }
      },
      { 
        id: '2', 
        nurse_id: 'mock-2', 
        start_date: '2026-03-01', 
        end_date: '2026-03-05', 
        reason: 'Descanso', 
        status: 'approved',
        nurses: { name: 'João Santos (Mock)' }
      }
    ]
    if (isAdmin) return mockData
    return mockData.filter(r => r.nurse_id === user.id)
  }

  const supabase = createClient()
  
  let query = supabase
    .from('time_off_requests')
    .select(`
      *,
      nurses (name)
    `)
    .order('created_at', { ascending: false })

  if (!isAdmin) {
    query = query.eq('nurse_id', user.id)
  }

  const { data, error } = await query
  
  if (error) {
    console.error('Erro ao buscar folgas:', error)
    return []
  }

  return data
}

export async function updateTimeOffStatus(requestId: string, newStatus: 'approved' | 'rejected') {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl || supabaseUrl.includes('sua_url')) {
    return { success: true } // Mock
  }

  const supabase = createClient()
  const { error } = await supabase
    .from('time_off_requests')
    .update({ status: newStatus })
    .eq('id', requestId)

  if (error) {
    throw new Error('Erro ao atualizar status: ' + error.message)
  }

  revalidatePath('/folgas')
  return { success: true }
}
