'use server'

import { revalidatePath } from 'next/cache'
import { readDb, writeDb } from '@/lib/local-db'
import { createClient } from '@/lib/supabase'

function isLocalMode() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return !supabaseUrl || supabaseUrl.includes('sua_url')
}

export async function addUnit(title: string) {
  if (isLocalMode()) {
    const db = readDb()
    db.units = db.units || []
    db.units.push({
      id: crypto.randomUUID(),
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

export async function deleteUnit(id: string) {
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
