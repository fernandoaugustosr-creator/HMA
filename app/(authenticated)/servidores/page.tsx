import { getNurses } from '@/app/actions'
import NurseList from '@/components/NurseList'

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
      
      <NurseList nurses={nurses} />
    </div>
  )
}
