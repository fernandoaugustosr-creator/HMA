'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/app/actions'
import { ChevronLeft, ChevronRight, LogOut } from 'lucide-react'

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const role = user?.role || ''
  const isAdmin = role === 'ADMIN' || role === 'COORDENACAO_GERAL' || user?.cpf === '02170025367'

  const allNavItems = [
    { name: 'Dashboard', href: '/', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    )},
    { name: 'Escala', href: '/escala', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )},
    { name: 'Servidores', href: '/servidores', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    )},
    { name: 'Trocas', href: '/trocas', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
      </svg>
    )},
    { name: 'Folgas', href: '/folgas', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )},
    { name: 'Faltas', href: '/coordenacao', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2zm4-8h6m-6 4h3" />
      </svg>
    )},
    { name: 'Baixar Escala', href: '/downloads', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    )},
    { name: 'Coordenação', href: '/coordenacao', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    )},
  ]

  const dashboardIcon = allNavItems.find(item => item.name === 'Dashboard')?.icon
  const folgasIcon = allNavItems.find(item => item.name === 'Folgas')?.icon
  const trocasIcon = allNavItems.find(item => item.name === 'Trocas')?.icon
  const downloadsIcon = allNavItems.find(item => item.name === 'Baixar Escala')?.icon
  const faltasIcon = allNavItems.find(item => item.name === 'Faltas')?.icon

  let navItems: { name: string; href: string; icon: JSX.Element }[] = []

  if (isAdmin) {
    navItems = allNavItems.filter(item => item.name !== 'Faltas')
  } else if (role === 'COORDENADOR') {
    navItems = [
      dashboardIcon && { name: 'Dashboard', href: '/', icon: dashboardIcon },
      faltasIcon && { name: 'Lançar Falta', href: '/coordenacao?tab=falta', icon: faltasIcon },
      faltasIcon && { name: 'Solicitar Pagamentos', href: '/coordenacao?tab=pagamento', icon: faltasIcon },
      faltasIcon && { name: 'Outras Solicitações', href: '/coordenacao?tab=outros', icon: faltasIcon },
      folgasIcon && { name: 'Folgas', href: '/folgas', icon: folgasIcon },
      trocasIcon && { name: 'Trocas', href: '/trocas', icon: trocasIcon },
      downloadsIcon && { name: 'Baixar Escala', href: '/downloads', icon: downloadsIcon },
    ].filter((item): item is { name: string; href: string; icon: JSX.Element } => Boolean(item))
  } else {
    navItems = allNavItems.filter(item => item.name === 'Dashboard' || item.name === 'Baixar Escala' || item.name === 'Folgas' || item.name === 'Trocas')
  }

  return (
    <>
      {/* Mobile Navbar */}
      <div className="flex md:!hidden bg-white border-b border-gray-200 p-4 sticky top-0 z-30 justify-between items-center shadow-sm w-full">
        <h2 className="text-xl font-bold text-indigo-600">ENF-HMA</h2>
        <button 
          onClick={() => setIsMobileMenuOpen(true)}
          className="text-gray-600 focus:outline-none p-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>

          {/* Sidebar Content */}
          <div className="relative flex flex-col w-64 max-w-xs h-full bg-white shadow-xl transform transition-transform duration-300 ease-in-out">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-indigo-600">ENF-HMA</h2>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 space-y-2 px-2">
              {role === 'COORDENADOR' && user?.section_title && (
                <div className="px-4 pb-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
                  {`Login: Coordenador de ${user.section_title}`}
                </div>
              )}
              {navItems.map((item) => {
                const itemPath = item.href.split('?')[0]
                const isCoord = itemPath === '/coordenacao'
                const isActive = pathname === itemPath || (isCoord && pathname.startsWith('/coordenacao'))
                return (
                  <div key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="mr-3">{item.icon}</span>
                      {item.name}
                    </Link>
                    {isCoord && isAdmin && (
                      <Link
                        href="/coordenacao?tab=falta"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="ml-10 mt-1 flex items-center px-4 py-2 text-xs font-medium rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                      >
                        <span className="truncate">Faltas</span>
                      </Link>
                    )}
                    {isCoord && isAdmin && (
                      <Link
                        href="/coordenacao?tab=pagamento"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="ml-10 mt-1 flex items-center px-4 py-2 text-xs font-medium rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                      >
                        <span className="truncate">Solicitações de Pagamentos</span>
                      </Link>
                    )}
                    {isCoord && isAdmin && (
                      <Link
                        href="/coordenacao?tab=outros"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="ml-10 mt-1 flex items-center px-4 py-2 text-xs font-medium rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                      >
                        <span className="truncate">Outras Solicitações</span>
                      </Link>
                    )}
                    {isCoord && isAdmin && (
                      <Link
                        href="/coordenacao/gestao"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`ml-10 mt-1 flex items-center px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                          pathname === '/coordenacao/gestao'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <span className="truncate">Gestão de Coordenações</span>
                      </Link>
                    )}
                  </div>
                )
              })}
            </nav>

            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="ml-3 overflow-hidden">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'Usuário'}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.cpf || ''}</p>
                  <p className="text-xs text-indigo-500 truncate font-semibold">{user?.role || ''}</p>
                </div>
              </div>
              
              <form action={logout}>
                <button
                  type="submit"
                  className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  Sair
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className={`hidden md:flex flex-col ${isCollapsed ? 'w-20' : 'w-64'} h-screen bg-white border-r border-gray-200 sticky top-0 transition-all duration-300`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-4'} py-8 mb-2`}>
            {!isCollapsed && <h2 className="text-2xl font-bold text-indigo-600 truncate">ENF-HMA</h2>}
            <button 
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                title={isCollapsed ? "Expandir menu" : "Recolher menu"}
            >
                {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </button>
        </div>

        <nav className="flex-1 space-y-2 px-2">
          {role === 'COORDENADOR' && user?.section_title && !isCollapsed && (
            <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
              {`Login: Coordenador de ${user.section_title}`}
            </div>
          )}
          {navItems.map((item) => {
            const itemPath = item.href.split('?')[0]
            const isCoord = itemPath === '/coordenacao'
            const isActive = pathname === itemPath || (isCoord && pathname.startsWith('/coordenacao'))
            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  title={isCollapsed ? item.name : ''}
                >
                  <span className={`${isCollapsed ? '' : 'mr-3'}`}>{item.icon}</span>
                  {!isCollapsed && <span className="truncate">{item.name}</span>}
                </Link>
                {isCoord && isAdmin && !isCollapsed && (
                  <>
                    <Link
                      href="/coordenacao?tab=falta"
                      className="ml-10 mt-1 flex items-center px-4 py-2 text-xs font-medium rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    >
                      <span className="truncate">Faltas</span>
                    </Link>
                    <Link
                      href="/coordenacao?tab=pagamento"
                      className="ml-10 mt-1 flex items-center px-4 py-2 text-xs font-medium rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    >
                      <span className="truncate">Solicitações de Pagamentos</span>
                    </Link>
                    <Link
                      href="/coordenacao?tab=outros"
                      className="ml-10 mt-1 flex items-center px-4 py-2 text-xs font-medium rounded-lg text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                    >
                      <span className="truncate">Outras Solicitações</span>
                    </Link>
                    <Link
                      href="/coordenacao/gestao"
                      className={`ml-10 mt-1 flex items-center px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                        pathname === '/coordenacao/gestao'
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="truncate">Gestão de Coordenações</span>
                    </Link>
                  </>
                )}
              </div>
            )
          })}
        </nav>

        <div className="mt-auto pt-4 border-t border-gray-200 p-2">
          <div className={`flex items-center mb-4 ${isCollapsed ? 'justify-center' : 'px-2'}`}>
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
              {user?.name?.charAt(0) || 'U'}
            </div>
            {!isCollapsed && (
                <div className="ml-3 overflow-hidden">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'Usuário'}</p>
                <p className="text-xs text-gray-500 truncate max-w-[140px]">{user?.cpf || ''}</p>
                <p className="text-xs text-indigo-500 truncate font-semibold max-w-[140px]">{user?.role || ''}</p>
                </div>
            )}
          </div>
          
          <form action={logout}>
            <button
              type="submit"
              className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'justify-start px-4'} py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors`}
              title={isCollapsed ? "Sair" : ""}
            >
              <LogOut className={`w-5 h-5 ${isCollapsed ? '' : 'mr-2'}`} />
              {!isCollapsed && 'Sair'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
