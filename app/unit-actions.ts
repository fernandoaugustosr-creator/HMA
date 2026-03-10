'use server'

import { revalidatePath } from 'next/cache'
import { readDb, writeDb, isLocalMode } from '@/lib/local-db'
import { createClient } from '@/lib/supabase'
import { randomUUID } from 'crypto'
import { checkAdmin } from '@/app/actions'

export async function addUnit(title: string, unitNumber?: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

  if (isLocalMode()) {
    const db = readDb()
    db.units = db.units || []
    const newId = randomUUID()
    db.units.push({
      id: newId,
      title
    })
    if (unitNumber !== undefined) {
      db.settings = db.settings || {}
      db.settings.unit_numbers = db.settings.unit_numbers || {}
      db.settings.unit_numbers[newId] = (unitNumber || '').trim()
    }
    writeDb(db)
    revalidatePath('/')
    return { success: true, id: newId }
  }

  const supabase = createClient()
  const { data, error } = await supabase.from('units').insert({ title }).select('id').single()
  if (error) return { success: false, message: error.message }
  const newId = data?.id
  if (newId && unitNumber !== undefined) {
    await supabase
      .from('app_settings')
      .upsert({ key: `unit_number_${newId}`, value: (unitNumber || '').trim() }, { onConflict: 'key' })
  }
  revalidatePath('/')
  return { success: true, id: newId }
}

export async function updateUnit(id: string, title: string) {
  try {
    await checkAdmin()
  } catch (e) {
    return { success: false, message: 'Acesso negado.' }
  }

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
        
        // Delete rosters and shifts first (Cleanup)
        const rostersToDelete = db.monthly_rosters.filter((r: any) => r.unit_id === id)
        const rosterIds = rostersToDelete.map((r: any) => r.id)
        
        if (rosterIds.length > 0) {
             db.shifts = db.shifts.filter((s: any) => {
                if (s.roster_id && rosterIds.includes(s.roster_id)) return false
                return true
             })
             db.monthly_rosters = db.monthly_rosters.filter((r: any) => !rosterIds.includes(r.id))
        }

        if (db.monthly_schedule_metadata) {
             db.monthly_schedule_metadata = db.monthly_schedule_metadata.filter((m: any) => m.unit_id !== id)
        }

        if (db.time_offs) {
             db.time_offs = db.time_offs.filter((t: any) => t.unit_id !== id)
        }

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
    
    // Cleanup rosters first
    const { data: rosters } = await supabase.from('monthly_rosters').select('id').eq('unit_id', id)
    const rosterIds = rosters?.map(r => r.id) || []
    
    if (rosterIds.length > 0) {
         await supabase.from('shifts').delete().in('roster_id', rosterIds)
         await supabase.from('monthly_rosters').delete().in('id', rosterIds)
    }
    
    await supabase.from('time_offs').delete().eq('unit_id', id)
    await supabase.from('monthly_schedule_metadata').delete().eq('unit_id', id)

    // Reset nurses unit_id before deleting the unit to avoid FK constraints
    await supabase.from('nurses').update({ unit_id: null }).eq('unit_id', id)

    const { error } = await supabase.from('units').delete().eq('id', id)
    if (error) {
        console.error('Error deleting unit:', error)
        return { success: false, message: error.message }
    }
    revalidatePath('/')
    return { success: true }
}
