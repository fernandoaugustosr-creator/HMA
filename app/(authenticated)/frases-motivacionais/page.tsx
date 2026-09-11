import FrasesClient from './FrasesClient'

export default function FrasesMotivacionaisPage() {
  return (
    <div className="min-h-[calc(100vh-0px)] bg-gradient-to-b from-slate-50 via-indigo-50/40 to-slate-100 print:min-h-0 print:h-auto print:bg-white print:m-0 print:p-0">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-6 print:max-w-none print:m-0 print:px-0 print:py-0 print:space-y-0">
        <FrasesClient />
      </div>
    </div>
  )
}
