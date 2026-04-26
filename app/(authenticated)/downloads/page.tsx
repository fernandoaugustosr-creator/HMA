'use client'

import PublicScheduleList from '@/components/PublicScheduleList'

export default function DownloadsPage() {
  return (
    <div className="min-h-[calc(100vh-0px)] bg-gradient-to-b from-slate-50 via-indigo-50/40 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6">
        <div className="bg-white/85 backdrop-blur rounded-3xl shadow-sm border border-slate-200/70 px-6 py-5">
          <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-500 mb-4" />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Escalas Liberadas</h1>
          <p className="text-slate-600 font-medium mt-1">Consulte e baixe as escalas liberadas no sistema</p>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 p-6">
          <PublicScheduleList />
        </div>
      </div>
    </div>
  )
}
