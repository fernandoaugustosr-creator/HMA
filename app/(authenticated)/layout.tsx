import { cookies } from 'next/headers'
import Sidebar from '@/components/Sidebar'
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
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar user={user} />
      <main className="flex-1 p-8 overflow-y-auto h-screen">
        {children}
      </main>
    </div>
  )
}
