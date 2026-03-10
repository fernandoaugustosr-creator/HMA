import { cookies } from 'next/headers'
import Sidebar from '@/components/Sidebar'
import SupabaseStatus from '@/components/SupabaseStatus'
import { redirect } from 'next/navigation'

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sessionCookie = cookies().get('session_user')
  
  // Se não tiver sessão, redireciona para login (dupla checagem além do middleware)
  if (!sessionCookie) {
    redirect('/login')
  }

  const user = JSON.parse(sessionCookie.value)

  return (
    <div className="flex flex-col md:flex-row h-screen bg-white overflow-hidden">
      <div className="no-print h-full overflow-y-auto md:overflow-visible">
        <Sidebar user={user} />
      </div>
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex-1 p-2 overflow-y-auto bg-gray-50/30">
            {children}
        </div>
      </main>
    </div>
  )
}
