'use client'

import PublicScheduleList from '@/components/PublicScheduleList'

export default function SamuDownloadsPage() {
  return (
    <div className="min-h-[calc(100vh-0px)] bg-gradient-to-b from-rose-50 via-red-50/70 to-orange-50 print:min-h-0 print:h-auto print:bg-white print:m-0 print:p-0">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-6 print:max-w-none print:m-0 print:px-0 print:py-0 print:space-y-0">
        <div className="bg-white/90 backdrop-blur rounded-3xl shadow-sm border border-red-100 px-6 py-5 print:hidden">
          <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-red-600 via-rose-500 to-orange-400 mb-4" />
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Escalas Liberadas</h1>
          <p className="text-slate-600 font-medium mt-1">Consulte e baixe as escalas liberadas do SAMU</p>
        </div>
        <div className="bg-white rounded-3xl shadow-sm border border-red-100 p-6 print:bg-transparent print:shadow-none print:border-0 print:m-0 print:p-0">
          <PublicScheduleList portalVariant="samu" />
        </div>
      </div>
    </div>
  )
}
