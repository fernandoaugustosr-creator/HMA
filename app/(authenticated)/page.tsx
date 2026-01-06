import { cookies } from 'next/headers'
import Schedule from '@/components/Schedule'

export default function Home() {
  const session = cookies().get('session_user')
  const user = session ? JSON.parse(session.value) : null
  const isAdmin = user?.role === 'ADMIN' || user?.cpf === '02170025367'

  return (
    <div className="w-full">
      <Schedule isAdmin={isAdmin} />
    </div>
  )
}
