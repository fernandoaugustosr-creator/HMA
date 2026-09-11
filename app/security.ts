import { createClientForPortal } from '@/lib/supabase'
import { readDbForPortal, writeDbForPortal, isLocalModeForPortal } from '@/lib/local-db'
import { getCurrentPortalConfig, HMA_PORTAL, type PortalKey } from '@/lib/portal-session'
import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'

export type SecurityCheckResult = { ok: true } | { ok: false; locked?: boolean; needConfirm?: boolean; expectedConfirm?: string; message: string }

const resolvePortalKey = (portalKey?: PortalKey): PortalKey => portalKey || getCurrentPortalConfig().key
const createClient = (portalKey?: PortalKey) => createClientForPortal(resolvePortalKey(portalKey))
const readDb = (portalKey?: PortalKey) => readDbForPortal(resolvePortalKey(portalKey))
const writeDb = (data: any, portalKey?: PortalKey) => writeDbForPortal(data, resolvePortalKey(portalKey))
const isLocalMode = (portalKey?: PortalKey) => isLocalModeForPortal(resolvePortalKey(portalKey))

export async function checkIsReleasedLocal(month: number, year: number, unitId: string | null): Promise<{ released: boolean; unit_name: string | null }> {
  const db = readDb()
  const metas: any[] = db.monthly_schedule_metadata || []
  const m = metas.find(x => x.month === month && x.year === year && (unitId ? x.unit_id === unitId : !x.unit_id) && x.is_released)
  if (!m) return { released: false, unit_name: null }
  const u = (db.units || []).find((x: any) => x.id === unitId) as any
  return { released: true, unit_name: u?.title || null }
}

export async function checkIsReleasedSupabase(month: number, year: number, unitId: string | null): Promise<{ released: boolean; unit_name: string | null }> {
  try {
    const sb = createClient()
    let q = sb.from('monthly_schedule_metadata').select('is_released,units(title)').eq('month', month).eq('year', year).eq('is_released', true).limit(10)
    if (unitId) q = q.eq('unit_id', unitId)
    const { data, error } = await q
    if (error || !data || !data.length) return { released: false, unit_name: null }
    const md = data[0] as any
    return { released: true, unit_name: md?.units?.title || null }
  } catch { return { released: false, unit_name: null } }
}

export async function checkIsAnyReleasedSupabase(): Promise<{ released: boolean; month?: number; year?: number; unit_name?: string | null }> {
  try {
    const sb = createClient()
    const { data, error } = await sb
      .from('monthly_schedule_metadata')
      .select('month,year,is_released,units(title)')
      .eq('is_released', true).limit(1)
    if (error || !data || !data.length) return { released: false }
    const m = data[0] as any
    return { released: true, month: m.month, year: m.year, unit_name: m.units?.title || null }
  } catch { return { released: false } }
}

export async function checkAnyReleasedLocal(): Promise<{ released: boolean; month?: number; year?: number; unit_name?: string | null }> {
  const db = readDb()
  const metas: any[] = db.monthly_schedule_metadata || []
  const m = metas.find(x => x.is_released)
  if (!m) return { released: false }
  const u = (db.units || []).find((x: any) => x.id === m.unit_id) as any
  return { released: true, month: m.month, year: m.year, unit_name: u?.title || null }
}

/** Validação unificada: trava de escala liberada + confirmação de texto para ações destrutivas */
export function validateClearMonthly(month: number, year: number, unit_name: string | null) {
  return {
    failMessage: `ESCALA LIBERADA (TRAVA DE SEGURANÇA): A escala de ${month}/${year} do setor "${unit_name || 'geral'}" está liberada. NÃO É PERMITIDO apagar uma escala já liberada. Cancele a liberação primeiro (botão "Escala Liberada") antes de fazer qualquer limpeza.`
  }
}

export function appendAuditLocal(action: string, details: any, user: any) {
  try {
    const db = readDb()
    db.audit_logs = db.audit_logs || []
    db.audit_logs.push({
      id: randomUUID(),
      user_id: user?.id || 'system',
      user_name: user?.name || 'Sistema',
      action,
      details,
      created_at: new Date().toISOString()
    })
    writeDb(db)
  } catch(e) {}
}

export async function appendAuditSupabase(action: string, details: any, user: any) {
  if (!user) return
  try {
    const sb = createClient()
    await sb.from('audit_logs').insert({
      user_id: user.id,
      user_name: user.name,
      action,
      details: details || {}
    })
  } catch(e) {}
}

