import { cookies } from 'next/headers'
import Sidebar from '@/components/Sidebar'
import SupabaseStatus from '@/components/SupabaseStatus'
import { redirect } from 'next/navigation'
import { getEditableUnits } from '@/app/actions'

export default async function AuthenticatedLayout({
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
  const editableUnits = await getEditableUnits()

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white">
      <div className="no-print md:h-screen md:sticky md:top-0">
        <Sidebar user={user} initialEditableUnits={editableUnits || []} />
      </div>
      <main className="flex-1 flex flex-col w-full overflow-x-hidden">
        <div className="flex-1 w-full relative bg-gradient-to-b from-slate-50 via-indigo-50/40 to-slate-100">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl" />
            <div className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-blue-400/10 blur-3xl" />
            <div className="absolute top-48 right-16 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl hidden md:block" />
          </div>
          <div className="relative w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
