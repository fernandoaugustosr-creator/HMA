'use client'

import { useState } from 'react'

export default function CoordenacaoPage() {
  const [activeTab, setActiveTab] = useState('falta')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Painel do Coordenador</h1>
      
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'falta' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('falta')}
          >
            Lançar Falta
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'extra' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('extra')}
          >
            Solicitar Extra
          </button>
          <button
            className={`py-2 px-4 font-medium text-sm focus:outline-none ${activeTab === 'outros' ? 'border-b-2 border-indigo-500 text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            onClick={() => setActiveTab('outros')}
          >
            Outras Solicitações
          </button>
        </div>

        {activeTab === 'falta' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Registro de Falta</h3>
            <p className="text-gray-500 mb-4">Funcionalidade para lançar faltas de servidores.</p>
            {/* TODO: Implement form */}
            <form className="space-y-4 max-w-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Servidor</label>
                    <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="Nome do servidor" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Data</label>
                    <input type="date" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Motivo</label>
                    <textarea className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" rows={3}></textarea>
                </div>
                <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">Registrar Falta</button>
            </form>
          </div>
        )}

        {activeTab === 'extra' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Solicitação de Plantão Extra</h3>
            <p className="text-gray-500 mb-4">Funcionalidade para solicitar cobertura extra.</p>
            {/* TODO: Implement form */}
            <form className="space-y-4 max-w-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Data Necessária</label>
                    <input type="date" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Setor/Unidade</label>
                    <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Observações</label>
                    <textarea className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" rows={3}></textarea>
                </div>
                <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">Solicitar Extra</button>
            </form>
          </div>
        )}

        {activeTab === 'outros' && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Outras Solicitações</h3>
            <p className="text-gray-500 mb-4">Canal para demandas diversas da coordenação.</p>
            {/* TODO: Implement form */}
             <form className="space-y-4 max-w-lg">
                <div>
                    <label className="block text-sm font-medium text-gray-700">Tipo de Solicitação</label>
                    <select className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                        <option>Material</option>
                        <option>Manutenção</option>
                        <option>Administrativo</option>
                        <option>Outros</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700">Descrição</label>
                    <textarea className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" rows={4}></textarea>
                </div>
                <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">Enviar Solicitação</button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
