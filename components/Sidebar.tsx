'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import type { StaticImageData } from 'next/image'
import logoSamu from '@/public/logo_samu.png'
import logoPrefeitura from '@/public/logo-prefeitura.png'
import { usePathname } from 'next/navigation'
import { ChevronLeft, ChevronRight, FileBarChart, FileSpreadsheet, LogOut, LayoutDashboard, CalendarCheck2, Users2, Repeat2, CalendarRange, ClipboardList, Download, ShieldCheck, History, ArrowLeftRight, Pause, Sparkles, Plus } from 'lucide-react'
import { SidebarReportLink, useReportLauncher } from './ReportLauncher'
import type { SidebarMenuItemId } from '@/lib/sidebar-menu-items'

export default function Sidebar({
  user,
  initialEditableUnits = [],
  basePath = '',
  portalLabel = 'HMA',
  showPortalBadge = true,
  logoutAction,
  canSeeReports = true,
  menuPerms,
}: {
  user: any
  initialEditableUnits?: { id: string, title: string }[]
  basePath?: string
  portalLabel?: string
  showPortalBadge?: boolean
  logoutAction: (formData: FormData) => void | Promise<void>
  canSeeReports?: boolean
  menuPerms?: Record<SidebarMenuItemId, boolean>
}) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [editableUnits, setEditableUnits] = useState<{ id: string, title: string }[]>(initialEditableUnits)
  const isSamuPortal = basePath === '/samu'
  const withBasePath = useCallback((path: string) => `${basePath}${path}`, [basePath])
  const coordPath = withBasePath('/coordenacao')
  const folgasPath = withBasePath('/folgas')
  const escalaPath = withBasePath('/escala')

  // ================================================================
  // 🎨 THEME HMA AZUL (moderno, com gradiente e profundidade)
  // ================================================================
  const HMA_BLUE_DEEP = '#1e3a8a'
  const HMA_BLUE_PRIMARY = '#2563eb'
  const HMA_BLUE_SOFT = '#3b82f6'
  const HMA_BLUE_PALE = '#dbeafe'

  const theme = isSamuPortal
    ? {
        bgSidebar: 'bg-gradient-to-b from-white via-white to-rose-50/50',
        topGradient: `linear-gradient(90deg, #dc2626 0%, #ef4444 40%, #f97316 100%)`,
        active: {
          box: 'shadow-[0_4px_14px_rgba(220,38,38,0.15)] bg-gradient-to-r from-rose-50 via-red-50 to-orange-50 border border-red-200/60',
          text: 'text-red-900',
          iconBox: 'bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-md',
          accentBar: 'from-red-500 via-rose-500 to-orange-400',
        },
        hover: {
          box: 'hover:bg-slate-100/60 text-slate-600 hover:text-slate-800',
          iconBox: 'bg-slate-100 text-slate-500 group-hover:bg-red-100 group-hover:text-red-700',
        },
        badge: 'bg-red-500/10 text-red-700 border border-red-200/50',
        avatar: 'bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-sm',
        role: 'text-red-600',
        section: 'text-red-600',
        divider: 'border-red-100/60',
      }
    : {
        bgSidebar: 'bg-gradient-to-b from-white via-white to-[#eff6ff]/60',
        topGradient: `linear-gradient(135deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 55%, ${HMA_BLUE_SOFT} 100%)`,
        active: {
          box: `shadow-[0_4px_14px_rgba(37,99,235,0.14)] border border-blue-200/70`,
          bgActive: `linear-gradient(110deg, ${HMA_BLUE_PALE} 0%, #ffffff 35%, #eff6ff 100%)`,
          text: 'text-blue-900',
          iconBox: `shadow-[0_3px_10px_rgba(37,99,235,0.25)] text-white`,
          iconBg: `linear-gradient(135deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 55%, ${HMA_BLUE_SOFT} 100%)`,
          accentBar: `from-[${HMA_BLUE_DEEP}] via-[${HMA_BLUE_PRIMARY}] to-[${HMA_BLUE_SOFT}]`,
        },
        hover: {
          box: 'hover:bg-slate-100/70 text-slate-600 hover:text-slate-800',
          iconBox: 'bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700',
        },
        badge: 'bg-blue-500/10 text-blue-800 border border-blue-200/60',
        avatar: `text-white shadow-[0_3px_10px_rgba(37,99,235,0.25)]`,
        avatarBg: `linear-gradient(135deg, ${HMA_BLUE_DEEP} 0%, ${HMA_BLUE_PRIMARY} 100%)`,
        role: 'text-blue-700',
        section: 'text-blue-700',
        divider: 'border-blue-100/70',
      }

  // Força a re-renderização para garantir que o botão de logout apareça
  const role = user?.role || ''
  const isAdmin = role === 'ADMIN' || role === 'COORDENACAO_GERAL' || String(user?.cpf || '').replace(/\D/g, '') === '02170025367'
  const canSeeScaleMenu = isAdmin || editableUnits.length > 0

  useEffect(() => {
    setEditableUnits(initialEditableUnits)
  }, [initialEditableUnits])

  // Helper: pode ver este item? (pode ser undefined -> true por default)
  const canSee = (id: SidebarMenuItemId): boolean => {
    if (!menuPerms) return true
    const val = menuPerms[id]
    return typeof val === 'boolean' ? val : true
  }

  // ==================== ÍCONES MODERNOS LUCIDE ====================
  const Icons = {
    dashboard: <LayoutDashboard size={19} strokeWidth={2} />,
    escala: <CalendarCheck2 size={19} strokeWidth={2} />,
    servidores: <Users2 size={19} strokeWidth={2} />,
    permultas: <Repeat2 size={19} strokeWidth={2} />,
    folgas: <CalendarRange size={19} strokeWidth={2} />,
    faltas: <ClipboardList size={19} strokeWidth={2} />,
    downloads: <Download size={19} strokeWidth={2} />,
    coordenacao: <ShieldCheck size={19} strokeWidth={2} />,
    logs: <History size={19} strokeWidth={2} />,
    trocas: <ArrowLeftRight size={19} strokeWidth={2} />,
    pause: <Pause size={19} strokeWidth={2} />,
    frases: <Sparkles size={19} strokeWidth={2} />,
  }

  // ==================== DEFINIÇÃO ESTRUTURADA DOS MENUS ====================
  interface MenuItemDef {
    name: string
    id: SidebarMenuItemId
    href: string
    icon: JSX.Element
    submenu?: { name: string; href: string }[]
    badge?: string
  }

  const buildMainMenu = (): MenuItemDef[] => {
    const items: MenuItemDef[] = []

    if (canSee('dashboard')) {
      items.push({ name: 'Dashboard', id: 'dashboard', href: withBasePath('/dashboard'), icon: Icons.dashboard })
    }

    if (canSee('escala') && (isAdmin || role === 'COORDENADOR' ? canSeeScaleMenu : canSeeScaleMenu)) {
      items.push({ name: 'Escala', id: 'escala', href: escalaHref, icon: Icons.escala })
    }

    if (canSee('servidores')) {
      items.push({ name: 'Servidores', id: 'servidores', href: withBasePath('/servidores'), icon: Icons.servidores })
    }

    if (canSee('relatorios') && canSeeReports) {
      // Submenu será renderizado abaixo via SidebarReportLink
      items.push({ name: 'Relatórios', id: 'relatorios', href: withBasePath('/dashboard#reports'), icon: Icons.coordenacao })
    }

    if (canSee('permultas') && (isAdmin || role === 'COORDENADOR')) {
      items.push({ name: 'Permultas', id: 'permultas', href: withBasePath('/trocas'), icon: Icons.permultas })
    }

    if (canSee('trocas') && (isAdmin || role === 'COORDENADOR')) {
      items.push({ name: 'Trocas / Permutas', id: 'trocas', href: withBasePath('/trocas'), icon: Icons.trocas })
    }

    if (canSee('folgas') && (isAdmin || role === 'COORDENADOR')) {
      items.push({ name: 'Faltas e Folgas', id: 'folgas', href: folgasPath, icon: Icons.folgas })
    }

    if (canSee('coordenacao') && (isAdmin || role === 'COORDENADOR')) {
      const submenu: MenuItemDef['submenu'] = []
      if (isAdmin) {
        submenu.push({ name: 'Faltas', href: withBasePath('/coordenacao?tab=falta') })
        submenu.push({ name: 'Solicitações de Pagamentos', href: withBasePath('/coordenacao?tab=pagamento') })
        submenu.push({ name: 'Outras Solicitações', href: withBasePath('/coordenacao?tab=outros') })
        submenu.push({ name: 'Folgas', href: withBasePath('/folgas') })
        submenu.push({ name: 'Gestão de Coordenações', href: withBasePath('/coordenacao/gestao') })
      } else if (role === 'COORDENADOR') {
        submenu.push({ name: 'Faltas', href: withBasePath('/coordenacao?tab=falta') })
        submenu.push({ name: 'Solicitações de Pagamentos', href: withBasePath('/coordenacao?tab=pagamento') })
        submenu.push({ name: 'Outras Solicitações', href: withBasePath('/coordenacao?tab=outros') })
        submenu.push({ name: 'Folgas', href: withBasePath('/folgas') })
      } else {
        submenu.push({ name: 'Faltas', href: withBasePath('/coordenacao') })
        submenu.push({ name: 'Folgas', href: withBasePath('/folgas') })
      }
      items.push({ name: 'Coordenação', id: 'coordenacao', href: coordPath, icon: Icons.coordenacao, submenu })
    }

    if (canSee('downloads')) {
      items.push({ name: 'Escalas Liberadas', id: 'downloads', href: withBasePath('/downloads'), icon: Icons.downloads })
    }

    if (canSee('frases') && isAdmin) {
      items.push({ name: 'Frases Motivacionais', id: 'frases', href: withBasePath('/frases-motivacionais'), icon: Icons.frases })
    }

    if (canSee('logs') && isAdmin) {
      items.push({ name: 'Logs de Login', id: 'logs', href: withBasePath('/logs?label=Logs%20de%20Login'), icon: Icons.logs })
    }

    return items
  }

  const escalaHref = escalaPath
  const navItems = buildMainMenu()

  // ================================================================
  // 🎯 HELPERS DE CLASSE PARA NAV ITEMS (MODERNO, COM DEPTH)
  // ================================================================
  const getItemClass = (isActive: boolean, isCollapsedView: boolean) => {
    const pad = isCollapsedView ? 'justify-center px-2 py-2.5' : 'px-3.5 py-2.5'
    const base = `group relative flex items-center rounded-2xl transition-all duration-300 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-white overflow-hidden`
    if (isActive) {
      return `${base} ${pad} ${theme.active.box} ${theme.active.text}`
    }
    return `${base} ${pad} ${theme.hover.box}`
  }

  const getIconBoxClass = (isActive: boolean) => {
    const base = `w-9 h-9 rounded-xl shrink-0 flex items-center justify-center transition-all duration-300`
    if (isActive) return `${base}`
    return `${base} ${theme.hover.iconBox}`
  }

  const getSubItemClass = (isActive: boolean) => {
    const base = `ml-12 flex items-center gap-2.5 px-3 py-2 text-[12.5px] font-semibold rounded-xl transition-all duration-200 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1 focus-visible:ring-offset-white`
    if (isActive) return `${base} bg-blue-50 text-blue-900 border border-blue-200/60 shadow-sm`
    return `${base} text-slate-500 hover:bg-slate-100 hover:text-slate-800`
  }

  const isPathActiveFor = (item: MenuItemDef): boolean => {
    const itemPath = item.href.split('?')[0]
    if (itemPath === coordPath) {
      return pathname === coordPath || pathname.startsWith(coordPath) || pathname === folgasPath
    }
    if (itemPath === escalaPath) {
      return pathname.startsWith(escalaPath)
    }
    if (itemPath === withBasePath('/servidores')) {
      return pathname.startsWith(withBasePath('/servidores'))
    }
    if (itemPath === withBasePath('/dashboard')) {
      return pathname === withBasePath('/dashboard')
    }
    return pathname.startsWith(itemPath)
  }

  const IconStyle = { isSamu: isSamuPortal }

  return (
    <>
      {/* ============================================================ */}
      {/* 📱 MOBILE NAVBAR (LOGO + TEXTO ABAIXO + BOTÃO ABRIR MENU)    */}
      {/* ============================================================ */}
      <div className={`flex md:!hidden ${theme.bgSidebar} border-b ${theme.divider} p-3 sticky top-0 z-30 justify-between items-start shadow-sm w-full bg-white`}>
        <div className="flex flex-col items-start gap-1.5 min-w-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* LOGO — moderno sem img (monograma HMA); SAMU usa img original */}
            {isSamuPortal ? (
              <div
                className="h-11 w-[62px] rounded-xl flex items-center justify-center shrink-0 bg-white border border-slate-200/70 shadow-[0_2px_8px_rgba(15,23,42,0.06)]"
              >
                <Image src={logoSamu} alt="SAMU Logo" width={60} height={60} className="h-8 w-[50px] object-contain" />
              </div>
            ) : (
              <div
                className="h-11 w-[62px] rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-blue-200/80 shadow-[0_2px_10px_rgba(37,99,235,0.25)] relative"
                style={{ backgroundImage: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)' }}
              >
                <div className="absolute inset-[2px] rounded-[10px] bg-white/95 flex items-center justify-center gap-1">
                  <Plus size={14} strokeWidth={3} className="text-blue-700 shrink-0" />
                  <span className="text-[15px] font-black tracking-tight text-blue-900 leading-none">
                    HMA
                  </span>
                </div>
              </div>
            )}
          </div>
          {!isSamuPortal && (
            <p className="text-[10.5px] font-black tracking-tight text-blue-900 leading-tight pl-0.5">
              Hospital Municipal
              <br />
              de Açailândia
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className={`p-2.5 h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 border border-slate-200/70 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm`}
          aria-label="Abrir menu"
        >
          <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>

      {/* ============================================================ */}
      {/* 📱 MOBILE DRAWER (Header limpo: só logo + fechar)            */}
      {/* ============================================================ */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-[2px] transition-opacity duration-200"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className={`relative flex flex-col w-72 max-w-[85vw] h-full bg-white shadow-2xl transform transition-transform duration-300 ease-out border-r ${theme.divider}`}>
            {/* Header (LOGO ESQUERDA + TEXTO ABAIXO / FECHAR DIREITA) */}
            <div className={`flex items-start justify-between p-4 border-b ${theme.divider} bg-white gap-2`}>
              <div className="flex flex-col items-start gap-2 min-w-0 shrink-0">
                {isSamuPortal ? (
                  <div
                    className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 bg-white border border-slate-200/70 shadow-[0_2px_10px_rgba(15,23,42,0.07)]"
                  >
                    <Image src={logoSamu} alt="SAMU Logo" width={48} height={48} className="h-8 w-8 object-contain" />
                  </div>
                ) : (
                  <div
                    className="h-12 w-[68px] rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-blue-200/80 shadow-[0_2px_12px_rgba(37,99,235,0.3)] relative"
                    style={{ backgroundImage: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)' }}
                  >
                    <div className="absolute inset-[2px] rounded-[10px] bg-white/95 flex items-center justify-center gap-1.5">
                      <Plus size={15} strokeWidth={3} className="text-blue-700 shrink-0" />
                      <span className="text-[15.5px] font-black tracking-tight text-blue-900 leading-none">
                        HMA
                      </span>
                    </div>
                  </div>
                )}
                {!isSamuPortal && (
                  <p className="text-[10.5px] font-black tracking-tight text-blue-900 leading-tight pl-0.5">
                    Hospital Municipal
                    <br />
                    de Açailândia
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/60 bg-white shadow-sm"
                aria-label="Fechar menu"
              >
                <svg className="w-5 h-5" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.3} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Barra gradiente status */}
            <div className="px-4 pt-3.5 pb-2 bg-white">
              <div
                className="h-1.5 w-full rounded-full shadow-inner"
                style={{ backgroundImage: theme.topGradient }}
              />
            </div>

            {/* NAV */}
            <nav className="flex-1 overflow-y-auto py-3 space-y-1 px-2.5 custom-scrollbar">
              {role === 'COORDENADOR' && user?.section_title && (
                <div className={`px-2 pt-2 pb-1 text-[10.5px] font-black uppercase tracking-[0.12em] ${theme.section}`}>
                  Coordenador · {user.section_title}
                </div>
              )}
              {navItems.map((item) => {
                const isActive = isPathActiveFor(item)
                const isRelatorios = item.id === 'relatorios'
                const isCoord = item.id === 'coordenacao'
                return (
                  <div key={item.id}>
                    <a
                      href={item.href}
                      onClick={() => { if (!isRelatorios) setIsMobileMenuOpen(false) }}
                      className={getItemClass(isActive, false)}
                      aria-current={isActive ? 'page' : undefined}
                      style={isActive && !IconStyle.isSamu ? { backgroundImage: theme.active.bgActive } : undefined}
                    >
                      {/* Barrinha de destaque esquerda no ativo */}
                      {isActive && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-r-full bg-gradient-to-b"
                          style={{ backgroundImage: theme.topGradient }}
                        />
                      )}
                      <div
                        className={getIconBoxClass(isActive)}
                        style={isActive && !IconStyle.isSamu ? { backgroundImage: theme.active.iconBg, boxShadow: '0 3px 10px rgba(37,99,235,0.25)' } : undefined}
                      >
                        {item.icon}
                      </div>
                      <div className="ml-3 flex-1 flex items-center gap-2 min-w-0">
                        <span className={`truncate font-bold text-[14px] leading-none ${isActive ? theme.active.text : ''}`}>
                          {item.name}
                        </span>
                        {item.badge && (
                          <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border ${theme.badge}`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                    </a>

                    {/* Submenu Relatórios */}
                    {isRelatorios && !isCollapsed && (
                      <div className="mt-1.5 space-y-1">
                        <SidebarReportLink
                          kind="management"
                          label="Relatório Gerencial"
                          Icon={FileBarChart}
                          iconClass=""
                          submenu
                          compact
                          containerClass="ml-10"
                          onClick={() => setIsMobileMenuOpen(false)}
                        />
                        <SidebarReportLink
                          kind="scheduled"
                          label="Relatório de Escalados"
                          Icon={FileSpreadsheet}
                          iconClass=""
                          submenu
                          compact
                          containerClass="ml-10"
                          onClick={() => setIsMobileMenuOpen(false)}
                        />
                      </div>
                    )}

                    {/* Submenu Coordenação */}
                    {isCoord && !isCollapsed && item.submenu?.map((subItem) => {
                      const subPath = subItem.href.split('?')[0]
                      const isSubActive = pathname === subPath || (subPath === coordPath && pathname.startsWith(coordPath))
                      return (
                        <a
                          key={subItem.href}
                          href={subItem.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={getSubItemClass(isSubActive)}
                          aria-current={isSubActive ? 'page' : undefined}
                        >
                          <span className="truncate">{subItem.name}</span>
                        </a>
                      )
                    })}
                  </div>
                )
              })}
            </nav>

            {/* Footer usuário + logout */}
            <div className={`p-3.5 border-t ${theme.divider} ${isSamuPortal ? 'bg-rose-50/40' : 'bg-gradient-to-t from-blue-50/40 to-transparent'}`}>
              <div className="flex items-center mb-3 px-1">
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black shrink-0 ${theme.avatar}`}
                  style={!isSamuPortal ? { backgroundImage: theme.avatarBg } : undefined}
                >
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="ml-3 overflow-hidden min-w-0 flex-1">
                  <p className="text-[13.5px] font-bold text-slate-900 truncate leading-tight">{user?.name || 'Usuário'}</p>
                  <p className="text-[11px] text-slate-500 truncate mt-0.5">{user?.cpf || ''}</p>
                  <p className={`text-[10.5px] truncate font-black uppercase tracking-wider mt-1 ${theme.role}`}>
                    {user?.role || ''}
                  </p>
                </div>
              </div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 text-[13px] font-bold text-red-600 bg-gradient-to-b from-red-50 to-red-50/60 hover:from-red-100 hover:to-red-50 border border-red-200/60 rounded-2xl transition-all duration-200 active:scale-[0.98] shadow-sm"
                >
                  <LogOut size={16} strokeWidth={2.3} />
                  Sair da Conta
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* 💻 DESKTOP SIDEBAR (MODERNO, AZUL HMA)                       */}
      {/* ============================================================ */}
      <div className={`hidden md:flex flex-col ${isCollapsed ? 'w-[84px]' : 'w-[272px]'} h-full ${theme.bgSidebar} border-r ${theme.divider} sticky top-0 z-40 pointer-events-auto transition-all duration-300 ease-out`}>
        {/* Header com LOGO + TEXTO ABAIXO + botão colapsar */}
        <div className={`relative px-4 pt-5 pb-4 bg-white border-b ${theme.divider}`}>
          {!isCollapsed ? (
            <div className="flex items-start justify-between gap-2">
              {/* LOGO + TEXTO */}
              <div className="relative z-10 shrink-0 flex flex-col items-start gap-2">
                {isSamuPortal ? (
                  <div
                    className="h-14 w-14 rounded-2xl flex items-center justify-center bg-white border border-slate-200/70 shadow-[0_3px_10px_rgba(15,23,42,0.07)]"
                  >
                    <Image src={logoSamu} alt="SAMU Logo" width={56} height={56} className="h-10 w-10 object-contain" />
                  </div>
                ) : (
                  <div
                    className="h-14 w-[84px] rounded-2xl flex items-center justify-center overflow-hidden border border-blue-200/80 shadow-[0_3px_12px_rgba(37,99,235,0.28)] relative"
                    style={{ backgroundImage: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)' }}
                  >
                    <div className="absolute inset-[2.5px] rounded-[14px] bg-white/95 flex items-center justify-center gap-1.5">
                      <Plus size={17} strokeWidth={3} className="text-blue-700 shrink-0" />
                      <span className="text-[19px] font-black tracking-tight text-blue-900 leading-none">
                        HMA
                      </span>
                    </div>
                  </div>
                )}
                {!isSamuPortal && (
                  <div className="leading-tight pl-0.5">
                    <p className="text-[11px] font-black tracking-tight text-blue-900">
                      Hospital Municipal
                    </p>
                    <p className="text-[11px] font-black tracking-tight text-blue-700">
                      de Açailândia
                    </p>
                  </div>
                )}
              </div>

              {/* BOTÃO RECOLHER — sempre aparece no expandido */}
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                className="relative z-10 p-2.5 h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/70 bg-white shadow-sm"
                title="Recolher menu"
                aria-label="Recolher menu"
              >
                <ChevronLeft size={19} strokeWidth={2.3} />
              </button>
            </div>
          ) : (
            // === COLAPSADO: centraliza logo, texto minúsculo, botão expandir ABAIXO ===
            <div className="flex flex-col items-center justify-start gap-2.5">
              {isSamuPortal ? (
                <div
                  className="h-12 w-12 rounded-2xl flex items-center justify-center bg-white border border-slate-200/70 shadow-[0_3px_10px_rgba(15,23,42,0.07)] shrink-0"
                >
                  <Image src={logoSamu} alt="SAMU Logo" width={48} height={48} className="h-8 w-8 object-contain" />
                </div>
              ) : (
                <div
                  className="h-12 w-[68px] rounded-2xl flex items-center justify-center overflow-hidden border border-blue-200/70 shadow-[0_3px_10px_rgba(37,99,235,0.25)] shrink-0 relative"
                  style={{ backgroundImage: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)' }}
                >
                  <div className="absolute inset-[2px] rounded-[14px] bg-white/95 flex items-center justify-center gap-1">
                    <Plus size={13} strokeWidth={3} className="text-blue-700 shrink-0" />
                    <span className="text-[13.5px] font-black tracking-tight text-blue-900 leading-none">
                      HMA
                    </span>
                  </div>
                </div>
              )}
              {!isSamuPortal && (
                <p className="text-[8.5px] font-black tracking-tight text-blue-800 leading-[1.05] text-center">
                  Hospital
                  <br />
                  Municipal
                  <br />
                  Açailândia
                </p>
              )}

              {/* BOTÃO EXPANDIR — sempre aparece no colapsado (abaixo da logo, posição normal não flutuante) */}
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                className="p-2 h-8 w-8 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 hover:bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200/60 bg-white shadow-sm"
                title="Expandir menu"
                aria-label="Expandir menu"
              >
                <ChevronRight size={16} strokeWidth={2.4} />
              </button>
            </div>
          )}
        </div>

        {/* Barra gradiente topo */}
        <div className={`${isCollapsed ? 'px-4' : 'px-5'} mb-4`}>
          <div
            className="h-1.5 w-full rounded-full shadow-inner opacity-90"
            style={{ backgroundImage: theme.topGradient }}
          />
        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 space-y-1 px-2.5 overflow-y-auto min-h-0 custom-scrollbar relative z-10 pointer-events-auto">
          {role === 'COORDENADOR' && user?.section_title && !isCollapsed && (
            <div className={`px-3 pt-1 pb-1.5 text-[10px] font-black uppercase tracking-[0.14em] ${theme.section}`}>
              Coordenador · {user.section_title}
            </div>
          )}
          {navItems.map((item) => {
            const isActive = isPathActiveFor(item)
            const isRelatorios = item.id === 'relatorios'
            const isCoord = item.id === 'coordenacao'
            return (
              <div key={item.id} className="relative">
                <a
                  href={item.href}
                  className={getItemClass(isActive, isCollapsed)}
                  title={isCollapsed ? item.name : ''}
                  aria-current={isActive ? 'page' : undefined}
                  style={isActive && !IconStyle.isSamu ? { backgroundImage: theme.active.bgActive } : undefined}
                >
                  {/* Barrinha de destaque esquerda no ativo (desktop) */}
                  {isActive && (
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3.5px] h-8 rounded-r-full"
                      style={{ backgroundImage: theme.topGradient }}
                    />
                  )}
                  <div
                    className={getIconBoxClass(isActive)}
                    style={isActive && !IconStyle.isSamu ? { backgroundImage: theme.active.iconBg } : undefined}
                  >
                    {item.icon}
                  </div>
                  {!isCollapsed && (
                    <div className="ml-3 flex-1 flex items-center gap-2 min-w-0">
                      <span className={`truncate font-bold text-[14px] leading-none ${isActive ? theme.active.text : ''}`}>
                        {item.name}
                      </span>
                      {item.badge && (
                        <span className={`shrink-0 text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md border ${theme.badge}`}>
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </a>

                {/* Submenu Relatórios */}
                {isRelatorios && !isCollapsed && (
                  <div className="mt-1.5 space-y-1">
                    <SidebarReportLink
                      kind="management"
                      label="Relatório Gerencial"
                      Icon={FileBarChart}
                      iconClass=""
                      submenu
                      compact
                      containerClass="ml-12"
                    />
                    <SidebarReportLink
                      kind="scheduled"
                      label="Relatório de Escalados"
                      Icon={FileSpreadsheet}
                      iconClass=""
                      submenu
                      compact
                      containerClass="ml-12"
                    />
                  </div>
                )}

                {/* Submenu Coordenação */}
                {isCoord && !isCollapsed && item.submenu?.map((subItem) => {
                  const subPath = subItem.href.split('?')[0]
                  const isSubActive = pathname === subPath || (subPath === coordPath && pathname.startsWith(coordPath))
                  return (
                    <a
                      key={subItem.href}
                      href={subItem.href}
                      className={getSubItemClass(isSubActive)}
                      aria-current={isSubActive ? 'page' : undefined}
                    >
                      <span className="truncate">{subItem.name}</span>
                    </a>
                  )
                })}
              </div>
            )
          })}
        </nav>

        {/* Footer: Usuário + Sair */}
        <div className={`mt-auto pt-3 border-t ${theme.divider} p-2.5 relative overflow-hidden`}>
          {/* Gradiente sutil no footer */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/3 w-56 h-56 rounded-full opacity-[0.06] blur-3xl pointer-events-none"
            style={{ backgroundImage: theme.topGradient }}
          />
          <div className={`relative z-10 flex items-center mb-3 ${isCollapsed ? 'justify-center' : 'px-2'}`}>
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black shrink-0 ${theme.avatar}`}
              style={!isSamuPortal ? { backgroundImage: theme.avatarBg } : undefined}
            >
              {user?.name?.charAt(0) || 'U'}
            </div>
            {!isCollapsed && (
              <div className="ml-3 overflow-hidden min-w-0 flex-1">
                <p className="text-[13.5px] font-bold text-slate-900 truncate leading-tight">{user?.name || 'Usuário'}</p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">{user?.cpf || ''}</p>
                <p className={`text-[10.5px] truncate font-black uppercase tracking-wider mt-1 ${theme.role}`}>
                  {user?.role || ''}
                </p>
              </div>
            )}
          </div>
          <form action={logoutAction} className="relative z-10">
            <button
              type="submit"
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start gap-2 px-3.5'} py-2.5 text-[13px] font-bold text-red-600 bg-gradient-to-b from-red-50 to-red-50/60 hover:from-red-100 hover:to-red-50 border border-red-200/50 rounded-2xl transition-all duration-200 active:scale-[0.98] shadow-sm`}
              title={isCollapsed ? 'Sair da Conta' : ''}
            >
              <LogOut size={16} strokeWidth={2.3} />
              {!isCollapsed && 'Sair da Conta'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
