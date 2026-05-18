'use client'

import React, { useMemo, useState } from 'react'
import { X, FileText, Users } from 'lucide-react'
import Image from 'next/image'
import logoHma from '@/public/logo-hma.png'
import logoPrefeitura from '@/public/logo-prefeitura.png'

interface ScheduledStaffReportProps {
  data: {
    totalRows: number
    rows: {
      id: string
      name: string
      role: string
      roleGroup: 'ENF' | 'TEC' | 'AUX' | 'MED' | 'OUTROS'
      coren: string
      sector: string
      corenExpiryDate: string
    }[]
  }
  monthName: string
  year: number
  onClose: () => void
}

export default function ScheduledStaffReport({ data, monthName, year, onClose }: ScheduledStaffReportProps) {
  const [selectedRoleGroups, setSelectedRoleGroups] = useState<Array<'ENF' | 'TEC' | 'AUX' | 'MED' | 'OUTROS'>>([])
  const [selectedSectors, setSelectedSectors] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 15

  const sectorOptions = useMemo(() => {
    return Array.from(new Set(data.rows.map(row => row.sector).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }, [data.rows])

  const filteredRows = useMemo(() => {
    return data.rows
      .filter(row => selectedRoleGroups.length === 0 || selectedRoleGroups.includes(row.roleGroup))
      .filter(row => selectedSectors.length === 0 || selectedSectors.includes(row.sector))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
  }, [data.rows, selectedRoleGroups, selectedSectors])

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

  const handleGeneratePdf = () => {
    const title = `Relatório de Profissionais Escalados - ${monthName} ${year}`
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const filterLabel = selectedRoleGroups.length === 0
      ? 'Todas as funções'
      : selectedRoleGroups.map(role => roleLabelMap[role]).join(', ')
    const sectorLabel = selectedSectors.length === 0
      ? 'Todos os setores'
      : selectedSectors.join(', ')

    const rowsHtml = filteredRows.map((row, index) => `
      <tr>
        <td class="center">${index + 1}</td>
        <td>${escapeHtml(row.name)}</td>
        <td class="center">${escapeHtml(row.role)}</td>
        <td class="center">${escapeHtml(row.coren)}</td>
        <td>${escapeHtml(row.sector)}</td>
        <td class="center">${escapeHtml(row.corenExpiryDate)}</td>
      </tr>
    `).join('')

    const html = `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(title)}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
            .brand { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
            .brand img { height: 44px; width: auto; object-fit: contain; }
            .brand-center { flex: 1; text-align: center; }
            .brand-title { font-size: 16px; font-weight: 800; margin: 0; }
            .subtitle { font-size: 11px; color: #4b5563; margin: 4px 0 12px 0; }
            .meta { font-size: 10px; color: #374151; margin: 0 0 12px 0; display: flex; gap: 14px; flex-wrap: wrap; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #d1d5db; padding: 6px; }
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
          </div>
          <table>
            <thead>
              <tr>
                <th class="center">#</th>
                <th>Nome Completo</th>
                <th class="center">Função</th>
                <th class="center">COREN</th>
                <th>Setor</th>
                <th class="center">Venc. Carteira</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="6" class="center">Nenhum profissional escalado neste mês.</td></tr>`}
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden border border-white">
        <div className="bg-slate-800 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Image src={logoPrefeitura} alt="Prefeitura de Açailândia" width={120} height={44} className="h-10 w-auto object-contain" priority />
              <Image src={logoHma} alt="HMA" width={120} height={44} className="h-10 w-auto object-contain" priority />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <FileText size={28} />
                Relatório de Profissionais Escalados
              </h2>
              <p className="text-slate-200 font-medium uppercase tracking-widest text-xs mt-1">
                {monthName} {year}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-6">
              <div className="flex items-center gap-3">
                <div className="bg-white p-3 rounded-2xl shadow-sm">
                  <Users className="text-indigo-600" />
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-indigo-500">Total do mês</div>
                  <div className="text-3xl font-black text-slate-900">{filteredRows.length}</div>
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtro por função</div>
              <div className="mt-3 grid grid-cols-2 gap-2">
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
                      className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm font-bold cursor-pointer transition-colors ${
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
                        className="h-4 w-4 accent-indigo-600"
                      />
                      <span>{label}</span>
                    </label>
                  )
                })}
              </div>
              <div className="mt-3 text-xs font-semibold text-slate-500">
                {selectedRoleGroups.length === 0
                  ? 'Nenhuma função marcada: mostra todas.'
                  : `Selecionadas: ${selectedRoleGroups.map(role => roleLabelMap[role]).join(', ')}`}
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-[2rem] p-6">
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Filtro por setor</div>
              <div className="mt-3 max-h-48 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                {sectorOptions.map((sector) => {
                  const checked = selectedSectors.includes(sector)
                  return (
                    <label
                      key={sector}
                      className={`flex items-start gap-2 rounded-2xl border px-3 py-3 text-sm font-bold cursor-pointer transition-colors ${
                        checked
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSelectedSectors(prev => {
                            const next = prev.includes(sector)
                              ? prev.filter(item => item !== sector)
                              : [...prev, sector]
                            return next.sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
                          })
                          setCurrentPage(1)
                        }}
                        className="mt-0.5 h-4 w-4 accent-indigo-600"
                      />
                      <span className="leading-5 uppercase">{sector}</span>
                    </label>
                  )
                })}
              </div>
              <div className="mt-3 text-xs font-semibold text-slate-500">
                {selectedSectors.length === 0
                  ? 'Nenhum setor marcado: mostra todos.'
                  : `Setores: ${selectedSectors.join(', ')}`}
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-[2.5rem] p-4 border border-gray-100 overflow-hidden shadow-inner">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <th className="px-4 py-2 text-center">#</th>
                    <th className="px-6 py-2">Nome Completo</th>
                    <th className="px-4 py-2 text-center">Função</th>
                    <th className="px-4 py-2 text-center">COREN</th>
                    <th className="px-6 py-2">Setor</th>
                    <th className="px-4 py-2 text-center">Venc. Carteira</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length > 0 ? paginatedRows.map((row, index) => (
                    <tr key={row.id} className="bg-white hover:bg-indigo-50/30 transition-colors group">
                      <td className="px-4 py-4 rounded-l-3xl border-y border-l border-gray-100 text-center font-black text-indigo-600">
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>
                      <td className="px-6 py-4 border-y border-gray-100">
                        <span className="text-sm font-black text-gray-800 uppercase">{row.name}</span>
                      </td>
                      <td className="px-4 py-4 border-y border-gray-100 text-center font-bold text-gray-700 uppercase">
                        {row.role}
                      </td>
                      <td className="px-4 py-4 border-y border-gray-100 text-center font-bold text-gray-700">
                        {row.coren}
                      </td>
                      <td className="px-6 py-4 border-y border-gray-100">
                        <span className="text-sm font-semibold text-gray-700 uppercase">{row.sector}</span>
                      </td>
                      <td className="px-4 py-4 border-r border-y border-gray-100 rounded-r-3xl text-center font-bold text-gray-700">
                        {row.corenExpiryDate}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400 font-medium italic text-sm bg-white rounded-3xl border border-gray-100">
                        Nenhum profissional escalado neste mês.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredRows.length > 0 && (
              <div className="mt-4 flex items-center justify-between gap-4 px-2">
                <div className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Páginas: {totalPages}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {Array.from({ length: totalPages }, (_, index) => {
                    const page = index + 1
                    const isActive = page === currentPage
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-10 rounded-xl px-3 py-2 text-sm font-black transition-colors ${
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

        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <button
            onClick={handleGeneratePdf}
            className="px-6 py-3 bg-white text-slate-700 font-black rounded-2xl hover:bg-slate-100 transition-all shadow-sm uppercase tracking-widest text-sm border border-slate-200"
          >
            Gerar PDF (A4)
          </button>
          <button
            onClick={onClose}
            className="px-8 py-3 bg-slate-800 text-white font-black rounded-2xl hover:bg-slate-900 transition-all shadow-lg uppercase tracking-widest text-sm"
          >
            Fechar Relatório
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
