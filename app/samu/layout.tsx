import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sistema de Escalas do SAMU',
  description: 'Sistema de gerenciamento de escalas do SAMU Açailândia-MA',
}

export default function SamuLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return children
}
