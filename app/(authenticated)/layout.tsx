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
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-100">
      <div className="no-print">
        <Sidebar user={user} />
      </div>
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 p-2 overflow-y-auto">
            {children}
        </div>
        <SupabaseStatus />
      </main>
    </div>
  )
}
