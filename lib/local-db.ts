import fs from 'fs'
import path from 'path'

const DB_FILE = path.join(process.cwd(), 'data', 'db.json')

export function isLocalMode() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  // Local mode if credentials are missing, or if explicitly forced
  if (!url || url === 'sua_url_do_supabase' || !key || key === 'sua_chave_anon_do_supabase') {
    return true
  }
  
  if (process.env.FORCE_LOCAL_DB === 'true') {
    return true
  }

  return false
}

export function readDb() {
  if (!fs.existsSync(DB_FILE)) {
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
  const content = fs.readFileSync(DB_FILE, 'utf-8')
  try {
    return JSON.parse(content)
  } catch (e) {
    console.error('Error parsing db.json:', e)
    return {}
  }
}

export function writeDb(data: any) {
  const dir = path.dirname(DB_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8')
}
