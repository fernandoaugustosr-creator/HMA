'use server'

import { createClient } from '@/lib/supabase'
import { isLocalMode, readDb, writeDb } from '@/lib/local-db'
import { revalidatePath } from 'next/cache'

export async function checkCpf(prevState: any, formData: FormData) {
  const cpf = formData.get('cpf') as string

  if (!cpf) {
    return { success: false, message: 'CPF é obrigatório' }
  }

  if (isLocalMode()) {
    const db = readDb()
    const nurse = db.nurses.find(n => n.cpf === cpf)

    if (!nurse) {
      return { success: false, message: 'CPF não encontrado no sistema' }
    }

    return { success: true, cpf: nurse.cpf, name: nurse.name, id: nurse.id, coren: nurse.coren }
  }

  const supabase = createClient()
  const { data: nurse, error } = await supabase
    .from('nurses')
    .select('id, name, cpf, coren')
    .eq('cpf', cpf)
    .single()

  if (error || !nurse) {
    return { success: false, message: 'CPF não encontrado no sistema' }
  }

  return { success: true, cpf: nurse.cpf, name: nurse.name, id: nurse.id, coren: nurse.coren }
}

export async function updateRegistration(prevState: any, formData: FormData) {
  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const coren = formData.get('coren') as string
  const password = formData.get('password') as string
  const confirmPassword = formData.get('confirmPassword') as string

  if (!password || !confirmPassword) {
    return { success: false, message: 'Senhas são obrigatórias' }
  }

  if (password !== confirmPassword) {
    return { success: false, message: 'As senhas não coincidem' }
  }

  if (isLocalMode()) {
    const db = readDb()
    const nurse = db.nurses.find(n => n.id === id)

    if (!nurse) {
      return { success: false, message: 'Usuário não encontrado' }
    }

    nurse.password = password
    if (name) nurse.name = name
    if (coren) nurse.coren = coren
    
    writeDb(db)

    return { success: true, message: 'Cadastro atualizado com sucesso!' }
  }

  const supabase = createClient()
  
  const updateData: any = { password: password }
  if (name) updateData.name = name
  if (coren) updateData.coren = coren

  const { error } = await supabase
    .from('nurses')
    .update(updateData) // Nota: Em produção real, a senha deveria ser hasheada!
    .eq('id', id)

  if (error) {
    return { success: false, message: 'Erro ao atualizar cadastro: ' + error.message }
  }

  return { success: true, message: 'Cadastro atualizado com sucesso!' }
}
