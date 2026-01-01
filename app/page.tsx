import { cookies } from 'next/headers'
import Schedule from '@/components/Schedule'
import { logout } from './actions'

export default function Home() {
  const sessionCookie = cookies().get('session_user')
  const user = sessionCookie ? JSON.parse(sessionCookie.value) : null

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 bg-gray-100">
      <div className="w-full max-w-5xl flex justify-between items-center mb-8 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div>
          <h1 className="text-xl font-bold text-gray-800">Sistema ENF-HMA</h1>
          {user && <p className="text-sm text-gray-600">Bem-vindo(a), <span className="font-medium">{user.name}</span></p>}
        </div>
        
        <form action={logout}>
          <button 
            type="submit" 
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm transition-colors"
          >
            Sair
          </button>
        </form>
      </div>

      <div className="w-full max-w-5xl">
        <Schedule />
      </div>
    </main>
  )
}
