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
