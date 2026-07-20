import fs from 'fs'
import path from 'path'

export type DbPortalKey = 'hma' | 'samu'

const DB_FILES: Record<DbPortalKey, string> = {
  hma: path.join(process.cwd(), 'data', 'db.json'),
  samu: path.join(process.cwd(), 'data', 'db-samu.json'),
}

function getDbFile(portal: DbPortalKey = 'hma') {
  return DB_FILES[portal] || DB_FILES.hma
}

function createEmptyDb() {
  return {
    nurses: [],
    schedule_sections: [],
    units: [],
    schedules: [],
    shifts: [],
    shift_swaps: [],
    time_off_requests: [],
    monthly_rosters: [],
    monthly_notes: [],
    monthly_schedule_metadata: [],
    users: [],
    audit_logs: [],
    settings: {}
  }
}

export function isLocalModeForPortal(portal: DbPortalKey = 'hma') {
  const suffix = portal === 'samu' ? '_SAMU' : ''
  const url = process.env[`NEXT_PUBLIC_SUPABASE_URL${suffix}`]
  const key = process.env[`NEXT_PUBLIC_SUPABASE_ANON_KEY${suffix}`]
  
  // Local mode if credentials are missing, or if explicitly forced
  if (!url || url === 'sua_url_do_supabase' || !key || key === 'sua_chave_anon_do_supabase') {
    return true
  }
  
  if (process.env.FORCE_LOCAL_DB === 'true') {
    return true
  }

  return false
}

export function isLocalMode() {
  return isLocalModeForPortal('hma')
}

export function readDbForPortal(portal: DbPortalKey = 'hma') {
  const dbFile = getDbFile(portal)

  if (!fs.existsSync(dbFile)) {
    return createEmptyDb()
  }
  const content = fs.readFileSync(dbFile, 'utf-8')
  try {
    return JSON.parse(content)
  } catch (e) {
    console.error(`Error parsing local database for ${portal}:`, e)
    return {}
  }
}

export function readDb() {
  return readDbForPortal('hma')
}

export function writeDbForPortal(data: any, portal: DbPortalKey = 'hma') {
  const dbFile = getDbFile(portal)
  const dir = path.dirname(dbFile)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), 'utf-8')
}

export function writeDb(data: any) {
  writeDbForPortal(data, 'hma')
}

export function ensureDbForPortal(portal: DbPortalKey = 'hma') {
  const dbFile = getDbFile(portal)
  if (!fs.existsSync(dbFile)) {
    writeDbForPortal(createEmptyDb(), portal)
  }
}

export function ensureDb() {
  ensureDbForPortal('hma')
}
