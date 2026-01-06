import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 p-4 text-center">
      <h2 className="mb-4 text-3xl font-bold text-gray-800">Página não encontrada</h2>
      <p className="mb-8 text-gray-600">Não conseguimos encontrar o recurso que você está procurando.</p>
      <Link
        href="/"
        className="rounded bg-blue-600 px-6 py-3 font-bold text-white hover:bg-blue-700 transition-colors"
      >
        Voltar ao Início
      </Link>
    </div>
  )
}
