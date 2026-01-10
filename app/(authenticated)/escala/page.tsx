import { cookies } from 'next/headers'
import Schedule from '@/components/Schedule'

export const dynamic = 'force-dynamic'

export default function SchedulePage() {
  const session = cookies().get('session_user')
  const user = session ? JSON.parse(session.value) : null
  const isAdmin = user?.role === 'ADMIN' || user?.cpf === '02170025367'
  return <Schedule isAdmin={isAdmin} />
}
