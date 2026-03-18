import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import LandingPageContent from '@/components/LandingPageContent'

export default async function IndexPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('session_user')

  if (session) {
    redirect('/dashboard')
  }

  return <LandingPageContent />
}
