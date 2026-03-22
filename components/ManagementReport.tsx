'use client'

import React, { useState } from 'react'
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
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end">
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
