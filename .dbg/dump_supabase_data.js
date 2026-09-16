/**
 * DUMP COMPLETO DOS DADOS DO SUPABASE PRODUÇÃO → INSERTs .sql
 * Uso: node .dbg/dump_supabase_data.js
 * Saída: supabase/HMA_FULL_DATA_DUMP.sql
 */
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!URL || !KEY) {
  console.error('ERRO: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não definidas em .env.local')
  process.exit(1)
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } })

const ORDEM_TABLES = [
  'schedule_sections',
  'units',
  'nurses',
  'nurse_vinculos',
  'monthly_rosters',
  'shifts',
  'time_off_requests',
  'shift_swaps',
  'monthly_notes',
  'monthly_schedule_metadata',
  'absences',
  'payment_requests',
  'general_requests',
  'login_logs',
  'schedules',
  'audit_logs',
  'scale_permissions',
  'app_settings',
  'system_roles',
  'council_types',
  'motivational_phrases',
  'units_users',
]

/** Escape de SQL (previne injection e quebras) */
function sqlEscapeValue(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  if (typeof v === 'number') return String(v)
  if (typeof v === 'bigint') return String(v)
  if (v instanceof Date) {
    return `'${v.toISOString().replace(/T/, ' ').slice(0, 19)}'::timestamptz`
  }
  if (typeof v === 'object') {
    try {
      const s = JSON.stringify(v)
      return `'${s.replace(/'/g, "''")}'::jsonb`
    } catch { return "'{}'::jsonb" }
  }
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `'${s}'::date`
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const dt = s.replace(/T/, ' ').slice(0, 19)
    return `'${dt.replace(/'/g, "''")}'::timestamptz`
  }
  return `'${s.replace(/'/g, "''")}'`
}

function identifier(i) { return `"${String(i).replace(/"/g, '""')}"` }

/** SELECT paginado com range 0..9999 e chunks de 1000 para não estourar limite */
async function fetchAllRows(table) {
  const PAGE = 1000
  const MAX = 500000
  const rows = []
  for (let i = 0; i < MAX; i += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select('*', { count: 'exact' })
      .range(i, i + PAGE - 1)
    if (error) throw new Error(`Erro em ${table}: ${error.message}`)
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

async function dumpTable(table, out) {
  console.log(`Baixando ${table}...`)
  const rows = await fetchAllRows(table)
  if (rows.length === 0) {
    out.write(`-- ${table}: 0 linhas (tabela vazia)\n\n`)
    return 0
  }
  const cols = Object.keys(rows[0])
  const colsList = cols.map(identifier).join(', ')
  out.write(`-- ${table}: ${rows.length} linhas\n`)
  out.write(`ALTER TABLE "${table}" DISABLE TRIGGER ALL;\n`)
  // Pagina INSERTs em blocos de 1000 linhas por performance
  const CHUNK = 1000
  for (let i = 0; i < rows.length; i += CHUNK) {
    const parte = rows.slice(i, i + CHUNK)
    const lines = parte.map(r => {
      const vals = cols.map(c => sqlEscapeValue(r[c])).join(', ')
      return `  (${vals})`
    })
    out.write(`INSERT INTO "${table}" (${colsList}) VALUES\n${lines.join(',\n')};\n`)
  }
  out.write(`ALTER TABLE "${table}" ENABLE TRIGGER ALL;\n\n`)
  return rows.length
}

;(async () => {
  const OUT = path.resolve(__dirname, '..', 'supabase', 'HMA_FULL_DATA_DUMP.sql')
  const out = fs.createWriteStream(OUT, { encoding: 'utf8' })
  out.write('-- ============================================================\n')
  out.write('-- HMA - DUMP COMPLETO DOS DADOS (INSERTs)\n')
  out.write(`-- Gerado em: ${new Date().toISOString()}\n`)
  out.write('-- Como usar: RODUE PRIMEIRO HMA_FULL_SCHEMA_CREATE_FROM_SCRATCH.sql\n')
  out.write('-- Depois: SQL Editor > New Query > Cole este arquivo > Run.\n')
  out.write('-- Dicas: rode em Banco NOVO (destino) ou TRUNCATE antes.\n')
  out.write('-- ============================================================\n\n')
  out.write(`SET search_path TO public;\n`)
  out.write(`SET session_replication_role = 'replica'; -- desativa triggers temporariamente\n\n`)

  let totalLinhas = 0
  const contagens = []
  for (const table of ORDEM_TABLES) {
    try {
      const n = await dumpTable(table, out)
      totalLinhas += n
      contagens.push({ table, rows: n })
    } catch (e) {
      console.error(`  ❌ ${table}: ${e.message}`)
      out.write(`-- ERRO AO DUMPAR ${table}: ${e.message}\n\n`)
    }
  }

  out.write(`SET session_replication_role = 'origin';\n\n`)
  out.write('-- ============================================================\n')
  out.write('-- RESUMO DO DUMP:\n')
  contagens.forEach(c => {
    out.write(`--   ${c.table.padEnd(28)} ${String(c.rows).padStart(7)} linhas\n`)
  })
  out.write(`--   ${'TOTAL'.padEnd(28)} ${String(totalLinhas).padStart(7)} linhas\n`)
  out.write('-- ============================================================\n')
  await new Promise(r => out.end(r))
  console.log(`\n✅ DUMP concluído: ${OUT}`)
  console.log(`📊 Total de linhas: ${totalLinhas}`)
  console.table(contagens)
})()
  .catch(e => { console.error(e); process.exit(1) })
