export function formatRole(role: string | null | undefined): string {
  if (!role) return ''
  const upperRole = role.toUpperCase()
  switch (upperRole) {
    case 'TECNICO':
      return 'Téc. de Enfermagem'
    case 'ENFERMEIRO':
      return 'Enfermeiro(a)'
    case 'MOTORISTA':
      return 'Motorista'
    case 'RECEPCAO':
      return 'Recepção'
    case 'AGENTE_DE_PORTARIA':
      return 'Agente de Portaria'
    case 'COORDENADOR':
      return 'Coordenador(a)'
    case 'ADMIN':
      return 'Administrador'
    default:
      return role
  }
}
