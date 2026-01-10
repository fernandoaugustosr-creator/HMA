'use client'

import React, { useEffect, useState } from 'react'
import { getReleasedSchedules } from '@/app/actions'
import Schedule from '@/components/Schedule'
import { FileText, ArrowLeft, Download } from 'lucide-react'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export default function DownloadsPage() {
  const [releases, setReleases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRelease, setSelectedRelease] = useState<any | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const data = await getReleasedSchedules()
        setReleases(data)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (selectedRelease) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4 no-print p-4 bg-white border-b">
            <button 
                onClick={() => setSelectedRelease(null)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded hover:bg-gray-200 text-gray-700 transition-colors"
            >
                <ArrowLeft size={20} />
                Voltar
            </button>
            <h2 className="text-xl font-bold text-gray-800">
                Visualizando: {MONTHS[selectedRelease.month - 1]} {selectedRelease.year} - {selectedRelease.unit_name}
            </h2>
        </div>
        
        {/* We render Schedule with isAdmin=false so it's read-only. 
            We pass initial values to load the correct schedule. */}
        <Schedule 
            isAdmin={false} 
            printOnly={false}
            initialMonth={selectedRelease.month - 1}
            initialYear={selectedRelease.year}
            initialUnitId={selectedRelease.unit_id}
        />

        <div className="fixed bottom-8 right-8 no-print z-50">
            <button 
                onClick={() => window.print()}
                className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 flex items-center gap-2 transition-transform hover:scale-105"
                title="Imprimir ou Salvar como PDF"
            >
                <Download size={24} />
                <span className="font-bold">Baixar / Imprimir</span>
            </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Escalas Liberadas</h1>
        <p className="text-gray-600">Selecione uma escala abaixo para visualizar e baixar.</p>
      </div>
      
      {loading ? (
        <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Carregando escalas...</p>
        </div>
      ) : releases.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
            <FileText size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg">Nenhuma escala liberada encontrada.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {releases.map(release => (
                <div 
                    key={release.id}
                    onClick={() => setSelectedRelease(release)}
                    className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col gap-4 group border-l-4 border-l-blue-500"
                >
                    <div className="flex items-start justify-between">
                        <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors text-blue-600">
                            <FileText size={24} />
                        </div>
                        {release.released_at && (
                            <span className="text-[10px] uppercase font-bold text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                {new Date(release.released_at).toLocaleDateString('pt-BR')}
                            </span>
                        )}
                    </div>
                    
                    <div>
                        <h3 className="font-bold text-xl text-gray-900 mb-1">
                            {MONTHS[release.month - 1]} {release.year}
                        </h3>
                        <p className="text-gray-600 font-medium text-sm">
                            {release.unit_name}
                        </p>
                    </div>
                    
                    <div className="pt-4 mt-auto border-t border-gray-100 flex items-center text-blue-600 font-bold text-sm group-hover:translate-x-1 transition-transform">
                        Visualizar Escala &rarr;
                    </div>
                </div>
            ))}
        </div>
      )}
    </div>
  )
}
