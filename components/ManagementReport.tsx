'use client'

import React, { useMemo, useState } from 'react'
import { X, FileText, CheckCircle, AlertCircle, Users, Briefcase, UserPlus, Filter } from 'lucide-react'

interface ManagementReportProps {
  data: {
    totalSchedules: number
    releasedSchedules: number
    concursados: number
    seletivados: number
    escalaDupla: number
    descoberta: number
    totalEntries: number
    professions: {
      enfermeiros: { total: number, concursados: number, seletivados: number, escalaDupla: number, descoberta: number }
      tecnicos: { total: number, concursados: number, seletivados: number, escalaDupla: number, descoberta: number }
      auxiliares: { total: number, concursados: number, seletivados: number, escalaDupla: number, descoberta: number }
      medicos: { total: number, concursados: number, seletivados: number, escalaDupla: number, descoberta: number }
      outros: { total: number, concursados: number, seletivados: number, escalaDupla: number, descoberta: number }
    }
    sectors: { 
      id: string; 
      title: string; 
      isReleased: boolean; 
      professions: string[];
      stats: {
        [key: string]: { concursados: number, seletivados: number, escalaDupla: number, descoberta: number, total: number }
      }
    }[]
  }
  monthName: string
  year: number
  onClose: () => void
}

export default function ManagementReport({ data, monthName, year, onClose }: ManagementReportProps) {
  const [selectedProf, setSelectedProf] = useState<'ENFERMEIRO' | 'TECNICO' | 'AUXILIAR' | 'MEDICO' | 'OUTROS' | null>(null)

  const filteredSectors = selectedProf 
    ? data.sectors.filter(s => s.professions.some(p => p.includes(selectedProf)))
    : data.sectors

  const tableTotals = useMemo(() => {
    const acc = { concursados: 0, seletivados: 0, escalaDupla: 0, descoberta: 0, total: 0 }
    filteredSectors.forEach(sector => {
      const sData = selectedProf ? sector.stats[selectedProf] : sector.stats.total
      acc.concursados += sData.concursados || 0
      acc.seletivados += sData.seletivados || 0
      acc.escalaDupla += sData.escalaDupla || 0
      acc.descoberta += sData.descoberta || 0
      acc.total += sData.total || 0
    })
    return acc
  }, [filteredSectors, selectedProf])

  const handleGeneratePdf = () => {
    const profLabel = selectedProf ? `${selectedProf}s` : 'Todos'
    const title = `Relatório Gerencial Mensal - ${monthName} ${year}`

    const rowsHtml = filteredSectors.map(sector => {
      const sData = selectedProf ? sector.stats[selectedProf] : sector.stats.total
      const status = sector.isReleased ? 'LIBERADA' : 'PENDENTE'
      return `
        <tr>
          <td class="sector">${escapeHtml(sector.title)}</td>
          <td class="center">${status}</td>
          <td class="center">${sData.concursados ?? 0}</td>
          <td class="center">${sData.seletivados ?? 0}</td>
          <td class="center red">${sData.escalaDupla ?? 0}</td>
          <td class="center amber">${sData.descoberta ?? 0}</td>
          <td class="center total">${sData.total ?? 0}</td>
        </tr>
      `
    }).join('')

    const totalsHtml = `
      <tr class="totals">
        <td class="sector">TOTAL</td>
        <td class="center">-</td>
        <td class="center">${tableTotals.concursados}</td>
        <td class="center">${tableTotals.seletivados}</td>
        <td class="center red">${tableTotals.escalaDupla}</td>
        <td class="center amber">${tableTotals.descoberta}</td>
        <td class="center total">${tableTotals.total}</td>
      </tr>
    `

    const html = `
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${escapeHtml(title)}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            body { font-family: Arial, Helvetica, sans-serif; color: #111827; }
            h1 { font-size: 16px; margin: 0 0 6px 0; }
            .subtitle { font-size: 11px; color: #4b5563; margin-bottom: 10px; }
            .meta { font-size: 10px; color: #374151; margin: 0 0 10px 0; display: flex; gap: 12px; flex-wrap: wrap; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #e5e7eb; padding: 6px; }
            th { background: #f3f4f6; text-align: left; }
            .center { text-align: center; }
            .sector { font-weight: 700; text-transform: uppercase; }
            .red { color: #dc2626; font-weight: 700; }
            .amber { color: #d97706; font-weight: 700; }
            .total { color: #4f46e5; font-weight: 800; }
            .totals td { background: #eef2ff; font-weight: 800; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(title)}</h1>
          <div class="subtitle">Relatório em formato A4</div>
          <div class="meta">
            <div><strong>Filtro:</strong> ${escapeHtml(profLabel)}</div>
            <div><strong>Setores:</strong> ${filteredSectors.length}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Setor</th>
                <th class="center">Status</th>
                <th class="center">Concurso</th>
                <th class="center">Seletivo</th>
                <th class="center">Esc. Dupla</th>
                <th class="center">Descoberta</th>
                <th class="center">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || `<tr><td colspan="7" class="center">Nenhum setor encontrado.</td></tr>`}
              ${filteredSectors.length ? totalsHtml : ''}
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

    iframe.contentWindow.focus()
    iframe.contentWindow.print()
  }

  // Obter as estatísticas baseadas no filtro selecionado
  const getDisplayStats = () => {
    if (!selectedProf) {
      return {
        concursados: data.concursados,
        seletivados: data.seletivados,
        escalaDupla: data.escalaDupla,
        descoberta: data.descoberta,
        totalEntries: data.totalEntries
      }
    }

    const profData = selectedProf === 'ENFERMEIRO' ? data.professions.enfermeiros :
                    selectedProf === 'TECNICO' ? data.professions.tecnicos :
                    selectedProf === 'AUXILIAR' ? data.professions.auxiliares :
                    selectedProf === 'MEDICO' ? data.professions.medicos :
                    data.professions.outros

    return {
      concursados: profData.concursados,
      seletivados: profData.seletivados,
      escalaDupla: profData.escalaDupla,
      descoberta: profData.descoberta,
      totalEntries: profData.total
    }
  }

  const displayStats = getDisplayStats()

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-white">
        
        {/* Header */}
        <div className="bg-indigo-600 p-6 text-white flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <FileText size={28} />
              Relatório Gerencial Mensal
            </h2>
            <p className="text-indigo-100 font-medium uppercase tracking-widest text-xs mt-1">
              {monthName} {year} • Visão Geral do Sistema
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          
          {/* Main Metrics - Reduced to 3 cards as requested */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard 
              label="Escalas Criadas" 
              value={data.totalSchedules} 
              icon={<FileText className="text-blue-600" />} 
              subValue={`${data.releasedSchedules} Liberadas`}
              color="bg-blue-50"
            />
            <MetricCard 
              label={selectedProf ? `Fixos (${selectedProf}s)` : "Concursados"} 
              value={displayStats.concursados} 
              icon={<Briefcase className="text-emerald-600" />} 
              subValue="Vínculo Efetivo"
              color="bg-emerald-50"
            />
            <MetricCard 
              label={selectedProf ? `Seletivados (${selectedProf}s)` : "Seletivados"} 
              value={displayStats.seletivados} 
              icon={<UserPlus className="text-orange-600" />} 
              subValue="Processo Seletivo"
              color="bg-orange-50"
            />
          </div>

          {/* Profession Division */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                <Users size={20} className="text-indigo-600" />
                Divisão por Profissão
                </h3>
                {selectedProf && (
                    <button 
                        onClick={() => setSelectedProf(null)}
                        className="text-[10px] font-bold text-red-500 uppercase tracking-widest hover:underline"
                    >
                        Limpar Filtro
                    </button>
                )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <ProfessionBadge 
                label="Enfermeiros" 
                value={data.professions.enfermeiros.total} 
                color={selectedProf === 'ENFERMEIRO' ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"} 
                onClick={() => setSelectedProf('ENFERMEIRO')}
              />
              <ProfessionBadge 
                label="Técnicos" 
                value={data.professions.tecnicos.total} 
                color={selectedProf === 'TECNICO' ? "bg-indigo-600 text-white" : "bg-purple-100 text-indigo-700"} 
                onClick={() => setSelectedProf('TECNICO')}
              />
              <ProfessionBadge 
                label="Auxiliares" 
                value={data.professions.auxiliares.total} 
                color={selectedProf === 'AUXILIAR' ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700"} 
                onClick={() => setSelectedProf('AUXILIAR')}
              />
              <ProfessionBadge 
                label="Médicos" 
                value={data.professions.medicos.total} 
                color={selectedProf === 'MEDICO' ? "bg-rose-600 text-white" : "bg-rose-100 text-red-700"} 
                onClick={() => setSelectedProf('MEDICO')}
              />
              <ProfessionBadge 
                label="Outros" 
                value={data.professions.outros.total} 
                color={selectedProf === 'OUTROS' ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-700"} 
                onClick={() => setSelectedProf('OUTROS')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* Sector Breakdown Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight flex items-center gap-2">
                    <CheckCircle size={20} className="text-indigo-600" />
                    Detalhamento por Setor
                </h3>
                {selectedProf && (
                    <div className="flex items-center gap-1 text-indigo-600 font-black text-[10px] uppercase bg-indigo-50 px-3 py-1 rounded-full">
                        <Filter size={12} />
                        Filtrado: {selectedProf}s
                    </div>
                )}
              </div>
              
              <div className="bg-gray-50 rounded-[2.5rem] p-4 border border-gray-100 overflow-hidden shadow-inner">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-separate border-spacing-y-2">
                    <thead>
                      <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                        <th className="px-6 py-2">Setor</th>
                        <th className="px-4 py-2 text-center">Status</th>
                        <th className="px-4 py-2 text-center">Concurso</th>
                        <th className="px-4 py-2 text-center">Seletivo</th>
                        <th className="px-4 py-2 text-center text-red-500">Esc. Dupla</th>
                        <th className="px-4 py-2 text-center text-amber-600">Descoberta</th>
                        <th className="px-4 py-2 text-center font-bold text-indigo-600">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSectors.length > 0 ? filteredSectors.map(sector => {
                        const sData = selectedProf ? sector.stats[selectedProf] : sector.stats.total
                        return (
                          <tr key={sector.id} className="bg-white hover:bg-indigo-50/30 transition-colors group">
                            <td className="px-6 py-4 rounded-l-3xl border-y border-l border-gray-100">
                              <span className="text-sm font-black text-gray-700 uppercase group-hover:text-indigo-700">{sector.title}</span>
                            </td>
                            <td className="px-4 py-4 border-y border-gray-100 text-center">
                              {sector.isReleased ? (
                                <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-black uppercase">Liberada</span>
                              ) : (
                                <span className="text-[9px] bg-gray-100 text-gray-400 px-2 py-1 rounded-full font-black uppercase">Pendente</span>
                              )}
                            </td>
                            <td className="px-4 py-4 border-y border-gray-100 text-center font-bold text-gray-600">{sData.concursados}</td>
                            <td className="px-4 py-4 border-y border-gray-100 text-center font-bold text-gray-600">{sData.seletivados}</td>
                            <td className="px-4 py-4 border-y border-gray-100 text-center font-bold text-red-600 bg-red-50/30">{sData.escalaDupla}</td>
                            <td className="px-4 py-4 border-y border-gray-100 text-center font-bold text-amber-600 bg-amber-50/30">{sData.descoberta}</td>
                            <td className="px-4 py-4 border-r border-y border-gray-100 rounded-r-3xl text-center font-black text-indigo-600 bg-indigo-50/50">
                              {sData.total}
                            </td>
                          </tr>
                        )
                      }) : (
                        <tr>
                          <td colSpan={7} className="py-12 text-center text-gray-400 font-medium italic text-sm bg-white rounded-3xl border border-gray-100">
                            Nenhum setor encontrado para os critérios selecionados.
                          </td>
                        </tr>
                      )}
                      {filteredSectors.length > 0 && (
                        <tr className="bg-indigo-50/70">
                          <td className="px-6 py-4 rounded-l-3xl border-y border-l border-indigo-100">
                            <span className="text-sm font-black text-gray-800 uppercase">Total</span>
                          </td>
                          <td className="px-4 py-4 border-y border-indigo-100 text-center">
                            <span className="text-[9px] bg-white text-gray-400 px-2 py-1 rounded-full font-black uppercase border border-indigo-100">-</span>
                          </td>
                          <td className="px-4 py-4 border-y border-indigo-100 text-center font-black text-gray-700">{tableTotals.concursados}</td>
                          <td className="px-4 py-4 border-y border-indigo-100 text-center font-black text-gray-700">{tableTotals.seletivados}</td>
                          <td className="px-4 py-4 border-y border-indigo-100 text-center font-black text-red-700 bg-red-50/30">{tableTotals.escalaDupla}</td>
                          <td className="px-4 py-4 border-y border-indigo-100 text-center font-black text-amber-700 bg-amber-50/30">{tableTotals.descoberta}</td>
                          <td className="px-4 py-4 border-r border-y border-indigo-100 rounded-r-3xl text-center font-black text-indigo-700 bg-indigo-100/40">
                            {tableTotals.total}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <button
            onClick={handleGeneratePdf}
            className="px-6 py-3 bg-white text-indigo-700 font-black rounded-2xl hover:bg-indigo-50 transition-all shadow-sm uppercase tracking-widest text-sm border border-indigo-200"
          >
            Gerar PDF (A4)
          </button>
          <button 
            onClick={onClose}
            className="px-8 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 uppercase tracking-widest text-sm"
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

function ProfessionBadge({ label, value, color, onClick }: { label: string, value: number, color: string, onClick: () => void }) {
  return (
    <button 
        onClick={onClick}
        className={`${color} p-4 rounded-2xl flex flex-col items-center justify-center border border-white shadow-sm hover:scale-105 active:scale-95 transition-all w-full`}
    >
      <span className="text-[10px] font-black uppercase tracking-tighter opacity-70 mb-1">{label}</span>
      <span className="text-xl font-black">{value}</span>
    </button>
  )
}

function MetricCard({ label, value, icon, subValue, color }: { label: string, value: number, icon: React.ReactNode, subValueText?: string, color: string, subValue?: string }) {
  return (
    <div className={`${color} p-6 rounded-[2rem] border border-white shadow-sm flex flex-col items-center text-center group hover:scale-[1.02] transition-transform`}>
      <div className="bg-white p-3 rounded-2xl shadow-sm mb-4">
        {icon}
      </div>
      <span className="text-gray-500 font-bold text-[10px] uppercase tracking-widest mb-1">{label}</span>
      <span className="text-3xl font-black text-gray-900">{value}</span>
      {subValue && <span className="text-[10px] font-bold text-gray-400 mt-2 uppercase">{subValue}</span>}
    </div>
  )
}
