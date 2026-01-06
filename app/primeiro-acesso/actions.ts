'use server'

import { createClient } from '@/lib/supabase'
import { isLocalMode, readDb, writeDb } from '@/lib/local-db'
import { revalidatePath } from 'next/cache'

export async function checkCpf(prevState: any, formData: FormData) {
  const rawCpf = formData.get('cpf') as string

  if (!rawCpf) {
    return { success: false, message: 'CPF é obrigatório', cpf: '', name: '', id: '', coren: '' }
  }

  // Remove caracteres não numéricos para comparação
  const cleanCpf = rawCpf.replace(/\D/g, '')

  if (isLocalMode()) {
    const db = readDb()
    // Compara apenas os números do CPF
    const nurse = db.nurses.find(n => n.cpf.replace(/\D/g, '') === cleanCpf)

    if (!nurse) {
      return { success: false, message: 'CPF não encontrado no sistema', cpf: '', name: '', id: '', coren: '' }
    }

    return { success: true, message: '', cpf: nurse.cpf, name: nurse.name, id: nurse.id, coren: nurse.coren }
  }

  const supabase = createClient()
  // Tenta buscar exato primeiro (caso esteja salvo formatado) ou faz busca manual se precisar
  // Supabase não tem replace direto no select simples, então buscamos e filtramos ou assumimos padronização.
  // Idealmente o banco teria CPFs limpos. Vamos tentar buscar direto o cleanCpf ou o rawCpf.
  // Como não sabemos como está no banco, vamos tentar buscar ambas as formas ou usar uma function RPC se existisse.
  // Simplificação: Assumindo que no Supabase pode estar limpo ou formatado igual o input.
  
  // Estratégia melhor: Trazer enfermeiros e filtrar no código (se forem poucos) ou tentar match exato.
  // Para produção com muitos dados, o ideal é ter coluna cpf_clean.
  // Vamos tentar buscar match exato com o que o usuário digitou, e se falhar, tentar o limpo.
  
  let { data: nurse, error } = await supabase
    .from('nurses')
    .select('id, name, cpf, coren')
    .eq('cpf', rawCpf)
    .single()

  if (!nurse) {
     // Tenta buscar pelo limpo
     const { data: nurseClean } = await supabase
      .from('nurses')
      .select('id, name, cpf, coren')
      .eq('cpf', cleanCpf)
      .single()
     nurse = nurseClean
  }
  
  // Se ainda não achou, e se estivermos lidando com banco inconsistente, última tentativa:
  // (Isso é pesado se tiver muitos registros, use com cautela)
  if (!nurse) {
      const { data: allNurses } = await supabase.from('nurses').select('id, name, cpf, coren')
      if (allNurses) {
          nurse = allNurses.find(n => n.cpf.replace(/\D/g, '') === cleanCpf) || null
      }
  }

  if (!nurse) {
    return { success: false, message: 'CPF não encontrado no sistema', cpf: '', name: '', id: '', coren: '' }
  }

  return { success: true, message: '', cpf: nurse.cpf, name: nurse.name, id: nurse.id, coren: nurse.coren }
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
    console.error('Supabase Update Error:', error)
    return { success: false, message: 'Erro ao atualizar cadastro (Supabase): ' + error.message }
  }

  return { success: true, message: 'Cadastro atualizado com sucesso (Supabase)!' }
}
