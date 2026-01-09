import { CheckCircle } from 'lucide-react'

export default function SupabaseStatus() {
  return (
    <div className="w-full bg-lime-400 text-green-900 p-1 flex items-center justify-center gap-2 text-xs font-bold border-t border-lime-500">
      <CheckCircle size={14} />
      Conectado ao Supabase
    </div>
  )
}
