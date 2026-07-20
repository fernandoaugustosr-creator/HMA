import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import PortalLandingPageContent from '@/components/PortalLandingPageContent'
import { loginSamu } from '@/app/actions'
import logoSamu from '@/public/logo_samu.png'

export default async function SamuIndexPage() {
  const cookieStore = cookies()
  const session = cookieStore.get('session_user_samu')

  if (session) {
    redirect('/samu/dashboard')
  }

  return (
    <PortalLandingPageContent
      loginAction={loginSamu}
      portalTitle="Sistema de Escalas do SAMU"
      portalSubtitle="Acesse o ambiente operacional do SAMU com as mesmas ferramentas do sistema principal."
      footerText="Serviço de Atendimento Móvel de Urgência • Gestão de Pessoas"
      showPublicSchedules={false}
      portalLogo={logoSamu}
      showPortalBadge={false}
      theme="red"
    />
  )
}
