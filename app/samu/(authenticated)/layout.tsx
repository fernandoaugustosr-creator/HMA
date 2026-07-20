import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { getEditableUnits, logoutSamu } from '@/app/actions'

export default async function SamuAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const sessionCookie = cookies().get('session_user_samu')

  if (!sessionCookie) {
    redirect('/samu')
  }

  const user = JSON.parse(sessionCookie.value)
  const editableUnits = await getEditableUnits()

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-white">
      <div className="no-print md:h-screen md:sticky md:top-0">
        <Sidebar user={user} initialEditableUnits={editableUnits || []} basePath="/samu" portalLabel="SAMU" showPortalBadge={false} logoutAction={logoutSamu} />
      </div>
      <main className="flex-1 flex flex-col w-full overflow-x-hidden">
        <div className="flex-1 w-full relative bg-gradient-to-b from-rose-50 via-red-50/70 to-orange-50">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -left-20 h-80 w-80 rounded-full bg-red-400/12 blur-3xl" />
            <div className="absolute -bottom-24 -right-20 h-80 w-80 rounded-full bg-rose-400/12 blur-3xl" />
            <div className="absolute top-48 right-16 h-56 w-56 rounded-full bg-orange-400/10 blur-3xl hidden md:block" />
          </div>
          <div className="relative w-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
