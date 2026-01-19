import { getUserDashboardData, getNurses } from '@/app/actions'
import { getSwapRequests } from '@/app/swap-actions'
import { redirect } from 'next/navigation'
import SwapSection from '@/components/SwapSection'

export default async function TrocasPage() {
  const data = await getUserDashboardData()

  if (!data) {
    redirect('/login')
  }

  const { shifts, user } = data
  const swaps = await getSwapRequests()
  const nurses = await getNurses()
  const isAdmin = user.role === 'ADMIN' || user.role === 'COORDENACAO_GERAL' || user.cpf === '02170025367'

  return (
    <div className="container mx-auto p-4 h-[calc(100vh-theme(spacing.20))]">
      <div className="h-full">
        <SwapSection 
          swaps={swaps} 
          nurses={nurses} 
          userShifts={shifts} 
          currentUserId={user.id}
          isAdmin={isAdmin}
        />
      </div>
    </div>
  )
}
