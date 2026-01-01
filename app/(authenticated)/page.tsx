import Schedule from '@/components/Schedule'

export default function Home() {
  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Escala de Enfermagem</h1>
        <p className="text-gray-600">Visualize e gerencie as escalas do mês.</p>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <Schedule />
      </div>
    </div>
  )
}
