'use client'

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-gray-50 p-4 text-center">
      <div className="rounded-lg bg-white p-8 shadow-xl">
        <h2 className="mb-4 text-2xl font-bold text-red-600">Algo deu errado!</h2>
        <p className="mb-6 text-gray-600">
          Ocorreu um erro inesperado ao carregar esta página.
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={
              // Attempt to recover by trying to re-render the segment
              () => reset()
            }
            className="rounded bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="rounded bg-gray-600 px-4 py-2 font-bold text-white hover:bg-gray-700 transition-colors"
          >
            Voltar ao Início
          </button>
        </div>
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 max-w-lg overflow-auto rounded bg-gray-100 p-4 text-left text-xs text-red-800">
            <p className="font-mono">{error.message}</p>
            {error.digest && <p className="mt-2 font-mono text-gray-500">Digest: {error.digest}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
