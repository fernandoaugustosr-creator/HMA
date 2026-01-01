import { getNurses } from '@/app/actions'
import NurseForm from './NurseForm'

export const dynamic = 'force-dynamic'

export default async function ServidoresPage() {
  const nurses = await getNurses()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-800">Servidores</h1>
           <p className="text-gray-600">Gerencie a equipe de enfermagem.</p>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4 text-gray-700">Novo Cadastro</h2>
        <NurseForm />
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">CPF</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {nurses.map((nurse: any) => (
              <tr key={nurse.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{nurse.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{nurse.cpf}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button className="text-indigo-600 hover:text-indigo-900">Editar</button>
                </td>
              </tr>
            ))}
            {nurses.length === 0 && (
              <tr>
                <td colSpan={3} className="px-6 py-4 text-center text-gray-500">Nenhum servidor cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
