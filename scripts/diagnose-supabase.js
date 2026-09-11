const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const envPath = path.join(__dirname, '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envConfig = {}

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/)
  if (match) {
    envConfig[match[1].trim()] = match[2].trim()
  }
})

const supabaseUrl = envConfig['NEXT_PUBLIC_SUPABASE_URL']
const supabaseKey = envConfig['NEXT_PUBLIC_SUPABASE_ANON_KEY']

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

const TABLES = [
  'nurses',
  'monthly_rosters',
  'shifts',
  'schedule_sections',
  'units',
  'monthly_schedule_metadata',
  'time_off_requests',
  'shift_swaps',
  'audit_logs',
  'absences',
  'monthly_notes',
  'scale_permissions',
  'unit_numbers'
]

async function diagnose() {
  console.log('=== DIAGNÓSTICO SUPABASE HMA ===')
  console.log('Data:', new Date().toISOString())
  console.log('')

  for (const table of TABLES) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.log(`[${table}] ERRO: ${error.message}`)
      } else {
        console.log(`[${table}] ${count} registros`)

        if (count > 0 && count <= 10) {
          const { data } = await supabase.from(table).select('*').limit(10)
          console.log('  Amostra:', JSON.stringify(data, null, 2).substring(0, 500))
        }

        if (table === 'monthly_rosters' && count > 0) {
          const { data: grouping } = await supabase
            .from(table)
            .select('month,year,unit_id')
            .limit(100)
          const byMonthYear = {}
          grouping.forEach(r => {
            const key = `${r.year}-${String(r.month).padStart(2,'0')} (unit=${r.unit_id || 'NULL'})`
            byMonthYear[key] = (byMonthYear[key] || 0) + 1
          })
          console.log('  Agrupados:', byMonthYear)
        }

        if (table === 'shifts' && count > 0) {
          const { data: grouping } = await supabase
            .from(table)
            .select('date')
            .limit(500)
          const byMonth = {}
          grouping.forEach(r => {
            if (r.date) {
              const key = r.date.substring(0, 7)
              byMonth[key] = (byMonth[key] || 0) + 1
            }
          })
          console.log('  Shifts por mês:', byMonth)
        }
      }
    } catch (err) {
      console.log(`[${table}] EXCEÇÃO:`, err.message)
    }
    console.log('')
  }

  console.log('=== FIM DO DIAGNÓSTICO ===')
}

diagnose()
