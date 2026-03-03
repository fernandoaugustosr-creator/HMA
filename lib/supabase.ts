import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const createClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('Missing Supabase credentials. Check .env.local')
    // Return a dummy client or throw a handled error
    throw new Error('Supabase credentials missing')
  }

  return createSupabaseClient(url, key)
}
