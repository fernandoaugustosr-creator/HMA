import { getNurses, getNursesBySection, checkUser, getCoordinationRequests } from '@/app/actions'
import CoordenacaoClient from './CoordenacaoClient'

export const dynamic = 'force-dynamic'

export default async function CoordenacaoPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const user = await checkUser()
  
  let nurses = []
  let sectionTitle = ''

  const isAdmin = user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'

  if (user.role === 'COORDENADOR' && user.section_id) {
      sectionTitle = user.section_title || ''
  }
  nurses = await getNurses()

  const { absences, paymentRequests, generalRequests } = await getCoordinationRequests()

  const initialTabParam = searchParams?.tab
  const initialTab = initialTabParam === 'pagamento' || initialTabParam === 'outros' ? initialTabParam : 'falta'

  return (
    <CoordenacaoClient
      nurses={nurses}
      sectionTitle={sectionTitle}
      isAdmin={isAdmin}
      initialTab={initialTab}
      absences={absences}
      paymentRequests={paymentRequests}
      generalRequests={generalRequests}
    />
  )
}
