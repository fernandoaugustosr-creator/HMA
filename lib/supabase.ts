import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export type SupabasePortalKey = 'hma' | 'samu'

function getPortalEnv(portal: SupabasePortalKey = 'hma') {
  if (portal === 'samu') {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL_SAMU,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY_SAMU,
    }
  }

  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

export const createClientForPortal = (portal: SupabasePortalKey = 'hma') => {
  const { url, key } = getPortalEnv(portal)

  if (!url || !key) {
    console.error(`Missing Supabase credentials for portal ${portal}. Check .env.local`)
    throw new Error(`Supabase credentials missing for ${portal.toUpperCase()}`)
  }

  return createSupabaseClient(url, key)
}

export const createClient = () => {
  return createClientForPortal('hma')
}
