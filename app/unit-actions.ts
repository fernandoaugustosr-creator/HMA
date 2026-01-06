'use server'

import { revalidatePath } from 'next/cache'
import { readDb, writeDb, isLocalMode } from '@/lib/local-db'
import { createClient } from '@/lib/supabase'
import { randomUUID } from 'crypto'

export async function addUnit(title: string) {
  if (isLocalMode()) {
    const db = readDb()
    db.units = db.units || []
    db.units.push({
      id: randomUUID(),
      title
    })
    writeDb(db)
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase.from('units').insert({ title })
  if (error) return { success: false, message: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function updateUnit(id: string, title: string) {
  if (isLocalMode()) {
    const db = readDb()
    const unit = db.units.find(u => u.id === id)
    if (unit) {
      unit.title = title
      writeDb(db)
    }
    revalidatePath('/')
    return { success: true }
  }

  const supabase = createClient()
  const { error } = await supabase.from('units').update({ title }).eq('id', id)
  if (error) return { success: false, message: error.message }
  revalidatePath('/')
  return { success: true }
}

export async function deleteUnit(id: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
        const db = readDb()
        db.units = db.units.filter(u => u.id !== id)
        // Reset nurses unit_id?
        db.nurses.forEach(n => {
            if (n.unit_id === id) n.unit_id = null
        })
        writeDb(db)
        revalidatePath('/')
        return { success: true }
    }

    const supabase = createClient()
    const { error } = await supabase.from('units').delete().eq('id', id)
    if (error) return { success: false, message: error.message }
    revalidatePath('/')
    return { success: true }
}
