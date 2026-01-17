'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase'
import { readDb, writeDb, isLocalMode } from '@/lib/local-db'
import { randomUUID } from 'crypto'

export async function getSwapRequests() {
  const session = cookies().get('session_user')
  if (!session) return []
  const user = JSON.parse(session.value)

  if (isLocalMode()) {
    const db = readDb()
    const swaps = db.shift_swaps || []
    
    // Enrich with nurse names
    return swaps.map((swap: any) => ({
      ...swap,
      requester_name: db.nurses.find((n: any) => n.id === swap.requester_id)?.name || 'Desconhecido',
      requested_name: db.nurses.find((n: any) => n.id === swap.requested_id)?.name || 'Desconhecido'
    })).filter((swap: any) => 
      swap.requester_id === user.id || 
      swap.requested_id === user.id || 
      user.role === 'ADMIN'
    )
  }

  const supabase = createClient()
  
  // Fetch swaps related to the user
  let query = supabase
    .from('shift_swaps')
    .select(`
      *,
      requester:nurses!requester_id(name),
      requested:nurses!requested_id(name)
    `)
    .order('created_at', { ascending: false })

  if (user.role !== 'ADMIN') {
    query = query.or(`requester_id.eq.${user.id},requested_id.eq.${user.id}`)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching swaps:', error)
    return []
  }

  return data.map(swap => ({
    ...swap,
    requester_name: swap.requester?.name,
    requested_name: swap.requested?.name
  }))
}

export async function getAvailableShiftsForNurse(nurseId: string) {
  const session = cookies().get('session_user')
  if (!session) return []
  
  const today = new Date()
  const cutoffDate = new Date(today)
  cutoffDate.setHours(0, 0, 0, 0)
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

  if (isLocalMode()) {
    const db = readDb()
    return (db.shifts || [])
      .filter((s: any) => s.nurse_id === nurseId && ((s.date || s.shift_date) >= cutoffDateStr))
      .sort((a: any, b: any) => (a.date || a.shift_date).localeCompare(b.date || b.shift_date))
      .map((s: any) => ({
        date: s.date || s.shift_date,
        type: s.type || s.shift_type
      }))
  }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('shifts')
    .select('*')
    .eq('nurse_id', nurseId)
    .gte('date', cutoffDateStr)
    .order('date', { ascending: true })

  if (error) {
    console.error('Error fetching nurse shifts:', error)
    return []
  }

  return (data || []).map((s: any) => ({
    date: s.date,
    type: s.type
  }))
}

export async function createSwapRequest(formData: FormData) {
  const session = cookies().get('session_user')
  if (!session) return { success: false, message: 'Não autorizado' }
  const user = JSON.parse(session.value)

  const requested_id = formData.get('requested_id') as string
  const requester_shift_date = formData.get('requester_shift_date') as string
  const requested_shift_date = formData.get('requested_shift_date') as string

  if (!requested_id || !requester_shift_date || !requested_shift_date) {
    return { success: false, message: 'Dados incompletos: selecione enfermeiro e ambas as datas' }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const requesterDateObj = new Date((requester_shift_date || '') + 'T12:00:00')
  const diffMs = requesterDateObj.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (isNaN(diffDays) || diffDays !== 1) {
    return { success: false, message: 'Permuta só pode ser solicitada no dia anterior ao plantão.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.shift_swaps = db.shift_swaps || []
    
    const requesterHasShift = db.shifts.some((s: any) => 
      s.nurse_id === user.id && ((s.date && s.date === requester_shift_date) || (s.shift_date && s.shift_date === requester_shift_date))
    )
    if (!requesterHasShift) {
      return { success: false, message: 'Você não possui plantão cadastrado nesta data' }
    }
    const requestedHasShift = db.shifts.some((s: any) => 
      s.nurse_id === requested_id && ((s.date && s.date === requested_shift_date) || (s.shift_date && s.shift_date === requested_shift_date))
    )
    if (!requestedHasShift) {
      return { success: false, message: 'O servidor selecionado não possui plantão nesta data' }
    }
    
    const newSwap = {
      id: randomUUID(),
      requester_id: user.id,
      requested_id,
      requester_shift_date,
      requested_shift_date,
      status: 'pending',
      created_at: new Date().toISOString()
    }
    
    db.shift_swaps.push(newSwap)
    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  
  // Validate existence of both shifts in Supabase
  const { data: requesterShift } = await supabase
    .from('shifts')
    .select('id')
    .eq('nurse_id', user.id)
    .eq('date', requester_shift_date)
    .limit(1)
    .maybeSingle()
  if (!requesterShift) {
    return { success: false, message: 'Você não possui plantão cadastrado nesta data' }
  }
  const { data: requestedShift } = await supabase
    .from('shifts')
    .select('id')
    .eq('nurse_id', requested_id)
    .eq('date', requested_shift_date)
    .limit(1)
    .maybeSingle()
  if (!requestedShift) {
    return { success: false, message: 'O servidor selecionado não possui plantão nesta data' }
  }
  
  const { error } = await supabase.from('shift_swaps').insert({
    requester_id: user.id,
    requested_id,
    requester_shift_date,
    requested_shift_date,
    status: 'pending'
  })

  if (error) {
    console.error('Error creating swap:', error)
    return { success: false, message: 'Erro ao criar solicitação: ' + (error.message || 'Falha ao inserir em shift_swaps') }
  }

  revalidatePath('/')
  return { success: true }
}

export async function approveSwapRequest(swapId: string) {
  const session = cookies().get('session_user')
  if (!session) return { success: false, message: 'Não autorizado' }
  const user = JSON.parse(session.value)

  if (isLocalMode()) {
    const db = readDb()
    const swapIndex = db.shift_swaps?.findIndex((s: any) => s.id === swapId)
    if (swapIndex === -1) return { success: false, message: 'Solicitação não encontrada' }
    
    const swap = db.shift_swaps[swapIndex]
    
    // Verify permission (must be the requested user or admin)
    if (swap.requested_id !== user.id && user.role !== 'ADMIN') {
      return { success: false, message: 'Sem permissão para aprovar' }
    }

    // Perform the swap logic locally
    // 1. Find Requester's shift
    const reqShiftIndex = db.shifts.findIndex((s: any) => s.nurse_id === swap.requester_id && s.date === swap.requester_shift_date)
    if (reqShiftIndex !== -1) {
       db.shifts[reqShiftIndex].nurse_id = swap.requested_id
    }

    // 2. Find Requested's shift (if exists)
    if (swap.requested_shift_date) {
      const requestedShiftIndex = db.shifts.findIndex((s: any) => s.nurse_id === swap.requested_id && s.date === swap.requested_shift_date)
      if (requestedShiftIndex !== -1) {
        db.shifts[requestedShiftIndex].nurse_id = swap.requester_id
      }
    }

    db.shift_swaps[swapIndex].status = 'approved'
    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  
  // 1. Get the swap details
  const { data: swap, error: fetchError } = await supabase
    .from('shift_swaps')
    .select('*')
    .eq('id', swapId)
    .single()
    
  if (fetchError || !swap) return { success: false, message: 'Solicitação não encontrada' }

  // 2. Verify permission
  if (swap.requested_id !== user.id && user.role !== 'ADMIN') {
    return { success: false, message: 'Sem permissão para aprovar' }
  }

  // 3. Perform the swap (Transaction would be ideal, but for now sequential updates)
  // Update Requester's shift -> Requested
  const { error: error1 } = await supabase
    .from('shifts')
    .update({ nurse_id: swap.requested_id })
    .match({ nurse_id: swap.requester_id, date: swap.requester_shift_date })

  if (error1) {
    console.error('Error swapping shift 1:', error1)
    return { success: false, message: 'Erro ao processar troca (parte 1)' }
  }

  // Update Requested's shift -> Requester (if exists)
  if (swap.requested_shift_date) {
    const { error: error2 } = await supabase
      .from('shifts')
      .update({ nurse_id: swap.requester_id })
      .match({ nurse_id: swap.requested_id, date: swap.requested_shift_date })
      
    if (error2) {
       console.error('Error swapping shift 2:', error2)
       // Potential inconsistency here if part 1 succeeded. Ideally use RPC or rollback logic.
       return { success: false, message: 'Erro ao processar troca (parte 2)' }
    }
  }

  // 4. Update status
  const { error: updateError } = await supabase
    .from('shift_swaps')
    .update({ status: 'approved' })
    .eq('id', swapId)

  if (updateError) return { success: false, message: 'Erro ao atualizar status' }

  revalidatePath('/dashboard')
  revalidatePath('/') // Revalidate schedule view
  return { success: true }
}

export async function rejectSwapRequest(swapId: string) {
  const session = cookies().get('session_user')
  if (!session) return { success: false, message: 'Não autorizado' }
  const user = JSON.parse(session.value)

  if (isLocalMode()) {
    const db = readDb()
    const swapIndex = db.shift_swaps?.findIndex((s: any) => s.id === swapId)
    if (swapIndex === -1) return { success: false, message: 'Solicitação não encontrada' }
    
    const swap = db.shift_swaps[swapIndex]
    if (swap.requested_id !== user.id && user.role !== 'ADMIN') {
      return { success: false, message: 'Sem permissão para rejeitar' }
    }

    db.shift_swaps[swapIndex].status = 'rejected'
    writeDb(db)
    revalidatePath('/dashboard')
    return { success: true }
  }

  const supabase = createClient()
  
  // Verify permission first (similar to approve)
  const { data: swap } = await supabase.from('shift_swaps').select('requested_id').eq('id', swapId).single()
  if (!swap) return { success: false, message: 'Solicitação não encontrada' }
  
  if (swap.requested_id !== user.id && user.role !== 'ADMIN') {
    return { success: false, message: 'Sem permissão para rejeitar' }
  }

  const { error } = await supabase
    .from('shift_swaps')
    .update({ status: 'rejected' })
    .eq('id', swapId)

  if (error) return { success: false, message: 'Erro ao rejeitar' }

  revalidatePath('/dashboard')
  return { success: true }
}

export async function cancelSwapRequest(id: string) {
  const session = cookies().get('session_user')
  if (!session) return { success: false, message: 'Não autorizado' }
  const user = JSON.parse(session.value)

  if (isLocalMode()) {
    const db = readDb()
    const index = (db.shift_swaps || []).findIndex((s: any) => s.id === id)
    if (index === -1) return { success: false, message: 'Solicitação não encontrada' }
    
    // Only requester or admin can cancel
    if (db.shift_swaps[index].requester_id !== user.id && user.role !== 'ADMIN') {
        return { success: false, message: 'Você não tem permissão para cancelar esta solicitação' }
    }

    db.shift_swaps.splice(index, 1)
    writeDb(db)
    revalidatePath('/trocas')
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  
  // Verify ownership first
  const { data: swap } = await supabase
    .from('shift_swaps')
    .select('requester_id')
    .eq('id', id)
    .single()
    
  if (!swap) return { success: false, message: 'Solicitação não encontrada' }
  
  if (swap.requester_id !== user.id && user.role !== 'ADMIN') {
    return { success: false, message: 'Você não tem permissão para cancelar esta solicitação' }
  }

  const { error } = await supabase
    .from('shift_swaps')
    .delete()
    .eq('id', id)

  if (error) return { success: false, message: error.message }
  
  revalidatePath('/trocas')
  revalidatePath('/')
  return { success: true }
}
