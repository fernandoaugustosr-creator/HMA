// ============================================================
// 🧩 DEFINIÇÕES DO MENU LATERAL (fora de "use server" para client+server)
//    - Usado por actions.ts (server), layout.tsx (RSC) e client components
// ============================================================
export type MenuAccessLevel = 'EVERYONE' | 'COORD_SETOR' | 'COORD_GERAL_ONLY'

export const SIDEBAR_MENU_ITEMS = [
  { id: 'dashboard',       label: 'Dashboard',          defaultLevel: 'EVERYONE' as MenuAccessLevel },
  { id: 'escala',          label: 'Escala',             defaultLevel: 'COORD_SETOR' as MenuAccessLevel },
  { id: 'servidores',      label: 'Servidores',         defaultLevel: 'COORD_SETOR' as MenuAccessLevel },
  { id: 'relatorios',      label: 'Relatórios',         defaultLevel: 'COORD_SETOR' as MenuAccessLevel },
  { id: 'permultas',       label: 'Permultas',          defaultLevel: 'COORD_GERAL_ONLY' as MenuAccessLevel },
  { id: 'coordenacao',     label: 'Coordenação',        defaultLevel: 'COORD_GERAL_ONLY' as MenuAccessLevel },
  { id: 'logs',            label: 'Logs de Login',      defaultLevel: 'COORD_GERAL_ONLY' as MenuAccessLevel },
  { id: 'trocas',          label: 'Trocas / Permutas',  defaultLevel: 'COORD_SETOR' as MenuAccessLevel },
  { id: 'folgas',          label: 'Faltas e Folgas',    defaultLevel: 'COORD_SETOR' as MenuAccessLevel },
  { id: 'downloads',       label: 'Downloads',          defaultLevel: 'EVERYONE' as MenuAccessLevel },
  { id: 'frases',          label: 'Frases Motivacionais', defaultLevel: 'COORD_GERAL_ONLY' as MenuAccessLevel },
] as const

export type SidebarMenuItemId = typeof SIDEBAR_MENU_ITEMS[number]['id']

export interface SidebarMenuPermissions {
  items: Record<SidebarMenuItemId, MenuAccessLevel>
  reports: {
    management: MenuAccessLevel
    scheduled: MenuAccessLevel
  }
  updatedAt?: string
  updatedBy?: string
}

export const DEFAULT_REPORTS_PERMISSIONS = {
  management: 'COORD_GERAL_ONLY' as MenuAccessLevel,
  scheduled: 'COORD_SETOR' as MenuAccessLevel,
}
