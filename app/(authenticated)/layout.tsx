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
    <div className="flex flex-col md:flex-row min-h-screen bg-white">
      <div className="no-print md:h-screen md:sticky md:top-0">
        <Sidebar user={user} />
      </div>
      <main className="flex-1 flex flex-col">
        <div className="flex-1 p-2 bg-gray-50/30">
            {children}
        </div>
      </main>
    </div>
  )
}
