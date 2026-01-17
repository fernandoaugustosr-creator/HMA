import { getNurses, getSections } from '@/app/actions'
import NurseList from '@/components/NurseList'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function ServidoresPage() {
  const session = cookies().get('session_user')
  const user = session ? JSON.parse(session.value) : null
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'COORDENACAO_GERAL' || user?.cpf === '02170025367'

  if (!isAdmin) {
    redirect('/')
  }

  const [nurses, sections] = await Promise.all([getNurses(), getSections()])

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8 flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-gray-800">Servidores</h1>
           <p className="text-gray-600">Gerencie a equipe de enfermagem.</p>
        </div>
      </div>
      
      <NurseList nurses={nurses} sections={sections} />
    </div>
  )
}
