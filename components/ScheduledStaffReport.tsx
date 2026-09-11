'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { X, FileText, Users, LayoutGrid, Square, CheckSquare } from 'lucide-react'
import Image from 'next/image'
import logoHma from '@/public/logo-hma.png'
import logoPrefeitura from '@/public/logo-prefeitura.png'

interface ScheduledStaffReportProps {
  data: {
    totalRows: number
    sectors?: string[]
    rows: {
      id: string
      name: string
      role: string
      roleGroup: 'ENF' | 'TEC' | 'AUX' | 'MED' | 'OUTROS'
      councilType: string
      councilNumber: string
      sector: string
      corenExpiryDate: string
      birthDate: string
      phone: string
      address: string
      houseNumber: string
      city: string
      email: string
    }[]
  }
  monthName: string
  year: number
  onClose: () => void
}

type ColumnKey = 'name' | 'role' | 'councilType' | 'councilNumber' | 'sector' | 'corenExpiryDate' | 'birthDate' | 'phone' | 'address' | 'houseNumber' | 'city' | 'email'

interface ColumnDef {
  key: ColumnKey
  label: string
  align: 'left' | 'center' | 'right'
  defaultSelected: boolean
  headerClass: string
  bodyClass: string
  cellValue: (row: any) => string
}

const COLUMNS: ColumnDef[] = [
  {
    key: 'name',
    label: 'Nome Completo',
    align: 'left',
    defaultSelected: true,
    headerClass: 'px-6 py-2',
    bodyClass: 'px-6 py-4 border-y border-gray-100',
    cellValue: (row) => row.name
  },
  {
    key: 'role',
    label: 'Função',
    align: 'center',
    defaultSelected: true,
    headerClass: 'px-4 py-2 text-center',
    bodyClass: 'px-4 py-4 border-y border-gray-100 text-center font-bold text-gray-700 uppercase',
    cellValue: (row) => row.role
  },
  {
    key: 'councilType',
    label: 'Conselho',
    align: 'center',
    defaultSelected: true,
    headerClass: 'px-4 py-2 text-center',
    bodyClass: 'px-4 py-4 border-y border-gray-100 text-center font-bold text-gray-700 uppercase',
    cellValue: (row) => row.councilType
  },
  {
    key: 'councilNumber',
    label: 'Nº Inscr.',
    align: 'center',
    defaultSelected: true,
    headerClass: 'px-4 py-2 text-center',
    bodyClass: 'px-4 py-4 border-y border-gray-100 text-center font-bold text-gray-700',
    cellValue: (row) => row.councilNumber
  },
  {
    key: 'sector',
    label: 'Setor',
    align: 'left',
    defaultSelected: true,
    headerClass: 'px-6 py-2',
    bodyClass: 'px-6 py-4 border-y border-gray-100',
    cellValue: (row) => row.sector
  },
  {
    key: 'corenExpiryDate',
    label: 'Venc. Carteira',
    align: 'center',
    defaultSelected: true,
    headerClass: 'px-4 py-2 text-center',
    bodyClass: 'px-4 py-4 border-y border-gray-100 text-center font-bold text-gray-700',
    cellValue: (row) => row.corenExpiryDate
  },
  {
    key: 'birthDate',
    label: 'Nasc.',
    align: 'center',
    defaultSelected: true,
    headerClass: 'px-4 py-2 text-center',
    bodyClass: 'px-4 py-4 border-y border-gray-100 text-center font-bold text-gray-700',
    cellValue: (row) => row.birthDate
  },
  {
    key: 'phone',
    label: 'Telefone',
    align: 'center',
    defaultSelected: false,
    headerClass: 'px-4 py-2 text-center',
    bodyClass: 'px-4 py-4 border-y border-gray-100 text-center text-gray-700 text-sm',
    cellValue: (row) => row.phone
  },
  {
    key: 'address',
    label: 'Endereço',
    align: 'left',
    defaultSelected: false,
    headerClass: 'px-6 py-2',
    bodyClass: 'px-6 py-4 border-y border-gray-100 text-gray-700 text-sm max-w-[260px] truncate',
    cellValue: (row) => row.address
  },
  {
    key: 'houseNumber',
    label: 'Nº Casa',
    align: 'center',
    defaultSelected: false,
    headerClass: 'px-4 py-2 text-center',
    bodyClass: 'px-4 py-4 border-y border-gray-100 text-center text-gray-700 text-sm',
    cellValue: (row) => row.houseNumber
  },
  {
    key: 'city',
    label: 'Cidade',
    align: 'left',
    defaultSelected: false,
    headerClass: 'px-6 py-2',
    bodyClass: 'px-6 py-4 border-y border-gray-100 text-gray-700 text-sm',
    cellValue: (row) => row.city
  },
  {
    key: 'email',
    label: 'E-mail',
    align: 'left',
    defaultSelected: false,
    headerClass: 'px-6 py-2',
    bodyClass: 'px-6 py-4 border-y border-gray-100 text-gray-700 text-sm max-w-[260px] truncate',
    cellValue: (row) => row.email
  }
]

const DEFAULT_COLUMNS: ColumnKey[] = COLUMNS.filter(c => c.defaultSelected).map(c => c.key)

export default function ScheduledStaffReport({ data, monthName, year, onClose }: ScheduledStaffReportProps) {
  const [selectedRoleGroups, setSelectedRoleGroups] = useState<Array<'ENF' | 'TEC' | 'AUX' | 'MED' | 'OUTROS'>>([])
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [sectorSearch, setSectorSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(DEFAULT_COLUMNS)
  const pageSize = 15

  const sectorCounts = useMemo(() => {
    const counts = new Map<string, number>()
    data.rows.forEach((row) => {
      const sector = String(row.sector || '').trim()
      if (!sector) return
      counts.set(sector, (counts.get(sector) || 0) + 1)
    })
    return counts
  }, [data.rows])

  const sectorOptions = useMemo(() => {
    const source = data.sectors && data.sectors.length > 0
      ? data.sectors
      : data.rows.map(row => row.sector)

    return Array.from(new Set(source.filter(Boolean)))
      .map((sector) => ({
        name: sector,
        count: sectorCounts.get(sector) || 0
      }))
      .sort((a, b) => {
        if (a.count === 0 && b.count > 0) return 1
        if (a.count > 0 && b.count === 0) return -1
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
      })
  }, [data.rows, data.sectors, sectorCounts])

  const filteredRows = useMemo(() => {
    return data.rows
      .filter(row => selectedRoleGroups.length === 0 || selectedRoleGroups.includes(row.roleGroup))
      .filter(row => selectedSectors.length === 0 || selectedSectors.includes(row.sector))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
  }, [data.rows, selectedRoleGroups, selectedSectors])

  const filteredSectorOptions = useMemo(() => {
    const query = sectorSearch.trim().toLocaleLowerCase('pt-BR')
    if (!query) return sectorOptions
    return sectorOptions.filter(sector =>
      sector.name.toLocaleLowerCase('pt-BR').includes(query)
    )
  }, [sectorOptions, sectorSearch])

  const activeColumns = useMemo(() => {
    if (selectedColumns.length === 0) return COLUMNS.filter(c => c.key === 'name')
    return selectedColumns.map(k => COLUMNS.find(c => c.key === k)!).filter(Boolean)
  }, [selectedColumns])

  const activeColumnCount = activeColumns.length + 1 // +1 para a coluna #

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize))

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, currentPage])

  const roleLabelMap: Record<'ENF' | 'TEC' | 'AUX' | 'MED' | 'OUTROS', string> = {
    ENF: 'Enfermeiros',
    TEC: 'Técnicos',
    AUX: 'Auxiliares',
    MED: 'Médicos',
    OUTROS: 'Outros'
  }

  useEffect(() => {
    setCurrentPage(prev => Math.min(prev, totalPages))
  }, [totalPages])

  const toggleSector = (sector: string) => {
    setSelectedSectors(prev => {
      const next = prev.includes(sector)
        ? prev.filter(item => item !== sector)
        : [...prev, sector]

      return next.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    })
    setCurrentPage(1)
  }

  const selectAllVisibleSectors = () => {
    setSelectedSectors(prev => {
      const next = new Set(prev)
      filteredSectorOptions.forEach(sector => next.add(sector.name))
      return Array.from(next).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
    })
    setCurrentPage(1)
  }

  const clearSectorFilters = () => {
    setSelectedSectors([])
    setSectorSearch('')
    setCurrentPage(1)
  }

  const toggleColumn = (key: ColumnKey) => {
    setSelectedColumns(prev => {
      if (prev.includes(key)) {
        const next = prev.filter(k => k !== key)
        return next.length === 0 ? [key] : next
      }
      const order = COLUMNS.map(c => c.key)
      return [...prev, key].sort((a, b) => order.indexOf(a) - order.indexOf(b))
    })
  }

  const selectAllColumns = () => {
    setSelectedColumns(COLUMNS.map(c => c.key))
  }

  const resetDefaultColumns = () => {
    setSelectedColumns(DEFAULT_COLUMNS)
  }

  const handleGeneratePdf = () => {
    const title = `Relatório de Profissionais Escalados - ${monthName} ${year}`
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const filterLabel = selectedRoleGroups.length === 0
      ? 'Todas as funções'
      : selectedRoleGroups.map(role => roleLabelMap[role]).join(', ')
    const sectorLabel = selectedSectors.length === 0
      ? 'Todos os setores'
      : selectedSectors.join(', ')

    const theadCells = activeColumns.map(col => `
      <th class="${col.align === 'center' ? 'center' : ''}">${escapeHtml(col.label)}</th>
    `).join('')

    const rowsHtml = filteredRows.map((row, index) => {
      const cells = activeColumns.map(col => {
        const value = escapeHtml(col.cellValue(row))
        const extra = col.key === 'name' ? ' class="name"' : (col.align === 'center' ? ' class="center"' : '')
        return `<td${extra}>${value || '-'}</td>`
      }).join('')

      return `
        <tr>
          <td class="center">${index + 1}</td>
          ${cells}
        </tr>
      `
    }).join('')

    const html = `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(title)}</title>
          <style>
            @page { size: A4 landscape; margin: 10mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
            .brand { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
            .brand img { height: 40px; width: auto; object-fit: contain; }
            .brand-center { flex: 1; text-align: center; }
            .brand-title { font-size: 16px; font-weight: 800; margin: 0; }
            .subtitle { font-size: 11px; color: #4b5563; margin: 4px 0 12px 0; }
            .meta { font-size: 10px; color: #374151; margin: 0 0 12px 0; display: flex; gap: 14px; flex-wrap: wrap; }
            table { width: 100%; border-collapse: collapse; font-size: 9px; }
            th, td { border: 1px solid #d1d5db; padding: 5px; word-break: break-word; }
            th { background: #e0ecff; text-align: left; font-weight: 700; }
            .center { text-align: center; }
            .name { font-weight: 700; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="brand">
            <img src="${escapeHtml(origin)}/logo-prefeitura.png" alt="Prefeitura de Açailândia" />
            <div class="brand-center">
              <div class="brand-title">${escapeHtml(title)}</div>
            </div>
            <img src="${escapeHtml(origin)}/logo-hma.png" alt="HMA" />
          </div>
          <div class="subtitle">Relatório mensal dos profissionais que estão escalados</div>
          <div class="meta">
            <div><strong>Função:</strong> ${escapeHtml(filterLabel)}</div>
            <div><strong>Setor:</strong> ${escapeHtml(sectorLabel)}</div>
            <div><strong>Total de registros:</strong> ${filteredRows.length}</div>
            <div><strong>Colunas:</strong> ${activeColumns.length + 1} (inclui #)</div>
          </div>
          <table>
            <thead>
              <tr>
                <th class="center">#</th>
                ${theadCells}
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="${activeColumnCount}" class="center">Nenhum profissional escalado neste mês.</td></tr>`}
            </tbody>
          </table>
        </body>
      </html>
    `

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.style.opacity = '0'
    iframe.setAttribute('aria-hidden', 'true')

    document.body.appendChild(iframe)
    const doc = iframe.contentWindow?.document
    if (!doc || !iframe.contentWindow) {
      iframe.remove()
      alert('Não foi possível gerar o PDF neste navegador.')
      return
    }

    doc.open()
    doc.write(html)
    doc.close()

    const cleanup = () => {
      try { iframe.remove() } catch {}
    }

    iframe.contentWindow.onafterprint = cleanup
    setTimeout(cleanup, 30000)

    const win = iframe.contentWindow
    const start = Date.now()
    const maxWaitMs = 5000

    const tryPrint = () => {
      const images = Array.from(doc.images || [])
      const allReady = images.every(img => img.complete && img.naturalWidth > 0)
      if (allReady || Date.now() - start >= maxWaitMs) {
        win.focus()
        win.print()
        return
      }
      setTimeout(tryPrint, 100)
    }

    tryPrint()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-[9999] p-3 md:p-6 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.35)] ring-1 ring-gray-200/60 w-full max-w-6xl lg:max-w-7xl max-h-[90vh] md:max-h-[88vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 px-5 py-4 text-white flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-3">
            <div className="bg-white/15 rounded-xl p-2 ring-1 ring-white/20">
              <FileText size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base md:text-lg font-black tracking-tight truncate">
                Relatório de Profissionais Escalados
              </h2>
              <p className="text-slate-300 font-semibold uppercase tracking-wider text-[10px] md:text-xs truncate">
                {monthName} de {year}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/15 transition-colors text-white/80 hover:text-white"
          >
            <X size={20} strokeWidth={2.2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-5 space-y-3 md:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 md:col-span-1">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2.5 rounded-xl shadow-sm">
                  <Users className="text-indigo-600" size={20} />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Total do mês</div>
                  <div className="text-2xl md:text-3xl font-black text-slate-900">{filteredRows.length}</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 md:col-span-2 flex flex-col lg:flex-row gap-4 lg:gap-5">
              <div className="flex-shrink-0 min-w-0 w-full lg:w-[46%]">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtro por função</div>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 w-full">
                  {([
                    ['ENF', 'Enfermeiro'],
                    ['TEC', 'Técnico'],
                    ['AUX', 'Auxiliar'],
                    ['MED', 'Médico'],
                    ['OUTROS', 'Outros']
                  ] as const).map(([value, label]) => {
                    const checked = selectedRoleGroups.includes(value)
                    return (
                      <label
                        key={value}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold cursor-pointer transition-colors ${
                          checked
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedRoleGroups(prev => {
                              const next = prev.includes(value)
                                ? prev.filter(item => item !== value)
                                : [...prev, value]
                              return next
                            })
                            setCurrentPage(1)
                          }}
                          className="h-3.5 w-3.5 accent-indigo-600"
                        />
                        <span className="truncate">{label}</span>
                      </label>
                    )
                  })}
                </div>
                <div className="mt-2.5 text-[11px] font-semibold text-slate-500">
                  {selectedRoleGroups.length === 0
                    ? 'Nenhuma função marcada: mostra todas.'
                    : `Selecionadas: ${selectedRoleGroups.map(role => roleLabelMap[role]).join(', ')}`}
                </div>
              </div>

              <div className="min-w-0 flex-1 w-full">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-2">
                    <LayoutGrid size={14} /> Colunas do relatório
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 mb-2">
                  <button
                    type="button"
                    onClick={selectAllColumns}
                    className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest text-indigo-700 hover:bg-indigo-100 transition-colors"
                  >
                    <span className="inline-flex items-center gap-1.5"><CheckSquare size={13} /> Todas</span>
                  </button>
                  <button
                    type="button"
                    onClick={resetDefaultColumns}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100 transition-colors"
                  >
                    <span className="inline-flex items-center gap-1.5"><Square size={13} /> Padrão</span>
                  </button>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 gap-1.5 w-full">
                  {COLUMNS.map(col => {
                    const checked = selectedColumns.includes(col.key)
                    return (
                      <label
                        key={col.key}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-bold cursor-pointer transition-colors ${
                          checked
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleColumn(col.key)}
                          className="h-3 w-3 accent-indigo-600 flex-shrink-0"
                        />
                        <span className="truncate">{col.label}</span>
                      </label>
                    )
                  })}
                </div>
                <div className="mt-2.5 text-[11px] font-semibold text-slate-500">
                  {selectedColumns.length} coluna(s) selecionada(s) + coluna #. Total de {activeColumnCount} colunas.
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtro por setor</div>
                <div className="mt-1 text-[11px] font-semibold text-slate-500 truncate">
                  {filteredSectorOptions.length} de {sectorOptions.length} escalas visiveis
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={selectAllVisibleSectors}
                  className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-indigo-700 hover:bg-indigo-100 transition-colors whitespace-nowrap"
                >
                  Marcar visiveis
                </button>
                <button
                  type="button"
                  onClick={clearSectorFilters}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap"
                >
                  Limpar
                </button>
              </div>
            </div>
            <input
              type="text"
              value={sectorSearch}
              onChange={(e) => setSectorSearch(e.target.value)}
              placeholder="Buscar escala ou setor"
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {filteredSectorOptions.map((sector) => {
                const checked = selectedSectors.includes(sector.name)
                const isEmpty = sector.count === 0
                return (
                  <label
                    key={sector.name}
                    className={`flex items-start gap-3 rounded-2xl border px-3 py-3 text-sm font-bold cursor-pointer transition-colors ${
                      checked
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                        : isEmpty
                          ? 'border-amber-200 bg-amber-50/70 text-amber-800 hover:bg-amber-50'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSector(sector.name)}
                      className="mt-0.5 h-4 w-4 accent-indigo-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="leading-5 uppercase">{sector.name}</div>
                      <div className={`mt-1 text-[11px] font-black uppercase tracking-wider ${
                        isEmpty ? 'text-amber-700' : 'text-slate-400'
                      }`}>
                        {isEmpty ? 'Sem profissionais neste mes' : `${sector.count} profissional(is)`}
                      </div>
                    </div>
                  </label>
                )
              })}
              </div>
              {filteredSectorOptions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm font-semibold text-slate-400">
                  Nenhuma escala encontrada com esse filtro.
                </div>
              )}
            </div>
            <div className="mt-3 text-xs font-semibold text-slate-500">
              {selectedSectors.length === 0
                ? 'Nenhum setor marcado: mostra todos.'
                : `${selectedSectors.length} setor(es) selecionado(s).`}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedSectors.map((sector) => (
                <button
                  key={sector}
                  type="button"
                  onClick={() => toggleSector(sector)}
                  className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold uppercase text-indigo-700 hover:bg-indigo-100 transition-colors"
                >
                  {sector}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl sm:rounded-[2.5rem] p-2 sm:p-4 border border-gray-100 overflow-hidden shadow-inner">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-1 sm:border-spacing-y-2 min-w-max">
                <thead>
                  <tr className="text-[9px] sm:text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-2 sm:px-4 py-1.5 sm:py-2 text-center w-12 sm:w-auto">#</th>
                    {activeColumns.map(col => (
                      <th key={col.key} className={`${col.headerClass.replace(/px-6/g, 'px-2 sm:px-6').replace(/px-4/g, 'px-2 sm:px-4').replace(/py-2/g, 'py-1.5 sm:py-2')} whitespace-nowrap`}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length > 0 ? paginatedRows.map((row, rowIndex) => (
                    <tr key={row.id} className="bg-white hover:bg-indigo-50/30 transition-colors group">
                      {activeColumns.map((col, colIndex) => {
                        const isFirst = colIndex === 0
                        const isLast = colIndex === activeColumns.length - 1
                        const cellValue = col.cellValue(row) || '-'
                        const classes = [col.bodyClass
                          .replace(/px-6/g, isFirst ? 'px-2 sm:px-6' : 'px-2 sm:px-6')
                          .replace(/px-4/g, 'px-2 sm:px-4')
                          .replace(/py-4/g, 'py-2 sm:py-4')]
                        if (isFirst) classes.push('rounded-l-2xl sm:rounded-l-3xl border-l border-gray-100')
                        if (isLast) classes.push('border-r border-gray-100 rounded-r-2xl sm:rounded-r-3xl')
                        const extra =
                          col.key === 'name'
                            ? 'text-xs sm:text-sm font-black text-gray-800 uppercase'
                            : col.key === 'sector'
                              ? 'text-xs sm:text-sm font-semibold text-gray-700 uppercase'
                              : 'text-xs sm:text-base'
                        return (
                          <td
                            key={col.key}
                            className={`${classes.join(' ')} ${extra}`}
                            title={col.key === 'address' || col.key === 'name' || col.key === 'email' ? col.cellValue(row) : undefined}
                          >
                            {col.key === 'name' && isFirst ? (
                              <div className="flex items-center gap-2 sm:gap-3 min-w-[180px] sm:min-w-[240px]">
                                <span className="inline-flex items-center justify-center rounded-xl sm:rounded-2xl bg-indigo-100 text-indigo-700 font-black min-w-[2rem] sm:min-w-[2.5rem] h-8 sm:h-10 px-2 sm:px-3 text-xs sm:text-base">
                                  {(currentPage - 1) * pageSize + rowIndex + 1}
                                </span>
                                <span className="truncate max-w-[140px] sm:max-w-none">{cellValue}</span>
                              </div>
                            ) : cellValue}
                          </td>
                        )
                      })}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={activeColumnCount} className="py-8 sm:py-12 text-center text-gray-400 font-medium italic text-xs sm:text-sm bg-white rounded-2xl sm:rounded-3xl border border-gray-100">
                        Nenhum profissional escalado neste mês.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredRows.length > 0 && (
              <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-4 px-1 sm:px-2">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500 text-center sm:text-left">
                  Páginas: {totalPages}
                </div>
                <div className="flex flex-wrap items-center justify-center sm:justify-end gap-1 sm:gap-2 overflow-x-auto py-1">
                  {Array.from({ length: Math.min(totalPages, 15) }, (_, index) => {
                    const page = totalPages > 15 ? (index < 7 ? index + 1 : totalPages - (14 - index)) : index + 1
                    const isActive = page === currentPage
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-8 sm:min-w-10 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-black transition-colors flex-shrink-0 ${
                          isActive
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 md:px-5 md:py-4 border-t border-gray-200 bg-gray-50/80 flex flex-col-reverse md:flex-row items-stretch md:items-center justify-end gap-2 md:gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-white text-slate-700 font-bold rounded-lg hover:bg-gray-100 transition-all shadow-sm uppercase tracking-wider text-xs border border-gray-300 w-full md:w-auto"
          >
            Fechar
          </button>
          <button
            onClick={handleGeneratePdf}
            className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200 uppercase tracking-wider text-xs w-full md:w-auto"
          >
            <span className="inline-flex items-center justify-center gap-2">
              <FileText size={14} />
              Gerar PDF
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

function escapeHtml(input: any) {
  return String(input ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
