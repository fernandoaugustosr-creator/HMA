'use client'
 
 export const dynamic = 'force-dynamic'
 
 import React, { useEffect, useState } from 'react'
 import { getMonthlyScheduleData, getAllUnitNumbers, saveUnitNumber } from '@/app/actions'
 import { addUnit, updateUnit, deleteUnit } from '@/app/unit-actions'
 import { Save, Pencil, Trash2, Plus } from 'lucide-react'
 
 export default function SetoresPage() {
   const [units, setUnits] = useState<{ id: string; title: string }[]>([])
   const [numbers, setNumbers] = useState<Record<string, string>>({})
   const [loading, setLoading] = useState(true)
   const [newTitle, setNewTitle] = useState('')
   const [newNumber, setNewNumber] = useState('')
   const [editId, setEditId] = useState<string | null>(null)
   const [editTitle, setEditTitle] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [saved, setSaved] = useState<Record<string, boolean>>({})
 
   // Load units and numbers
   useEffect(() => {
     async function load() {
       setLoading(true)
       try {
         const now = new Date()
         const month = now.getMonth() + 1
         const year = now.getFullYear()
         const data = await getMonthlyScheduleData(month, year, undefined)
         setUnits(data.units || [])
         const map = await getAllUnitNumbers()
         setNumbers(map || {})
       } finally {
         setLoading(false)
       }
     }
     load()
   }, [])
 
   const refresh = async () => {
     const now = new Date()
     const month = now.getMonth() + 1
     const year = now.getFullYear()
     const data = await getMonthlyScheduleData(month, year, undefined)
     setUnits(data.units || [])
     const map = await getAllUnitNumbers()
     setNumbers(map || {})
   }
 
   const handleAdd = async () => {
     if (!newTitle.trim()) return
     setLoading(true)
     const res = await addUnit(newTitle, newNumber || undefined)
     if (!res.success) {
       alert(res.message || 'Erro ao criar setor')
       setLoading(false)
       return
     }
     setNewTitle('')
     setNewNumber('')
     await refresh()
     setLoading(false)
   }
 
   const startEdit = (u: { id: string; title: string }) => {
     setEditId(u.id)
     setEditTitle(u.title)
   }
 
   const saveTitle = async () => {
     if (!editId || !editTitle.trim()) {
       setEditId(null)
       setEditTitle('')
       return
     }
     setLoading(true)
     const res = await updateUnit(editId, editTitle)
     if (!res.success) alert(res.message || 'Erro ao atualizar setor')
     await refresh()
     setEditId(null)
     setEditTitle('')
     setLoading(false)
   }
 
  const saveNumber = async (id: string, value: string) => {
    if (!id) return
    const trimmed = (value || '').trim()
    setSavingId(id)
    try {
      const res = await saveUnitNumber(id, trimmed)
      if (!res || !res.success) {
        alert(res?.message || 'Erro ao salvar número do setor')
        return
      }
      await refresh()
      setSaved(prev => ({ ...prev, [id]: true }))
      setTimeout(() => setSaved(prev => {
        const next = { ...prev }
        delete next[id]
        return next
      }), 1500)
    } catch (e) {
      alert('Erro inesperado ao salvar número do setor')
    } finally {
      setSavingId(null)
    }
  }
 
   const handleDelete = async (id: string) => {
     if (!confirm('Excluir este setor? Isso apaga também o histórico de escalas deste setor.')) return
     setLoading(true)
     const res = await deleteUnit(id)
     if (!res.success) alert(res.message || 'Erro ao excluir setor')
     await refresh()
     setLoading(false)
   }
 
   const sortedUnits = [...units].sort((a, b) => {
     const na = parseInt(numbers[a.id] || '9999', 10)
     const nb = parseInt(numbers[b.id] || '9999', 10)
     if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb
     return a.title.localeCompare(b.title)
   })
 
   return (
     <div className="max-w-3xl mx-auto">
       <div className="mb-6">
         <h1 className="text-2xl font-bold text-gray-800">Cadastro de Setores</h1>
         <p className="text-gray-600">Gerencie os setores e suas numerações.</p>
       </div>
 
       <div className="bg-white rounded border p-4 mb-6">
         <h2 className="font-semibold mb-3 text-gray-800 flex items-center gap-2">
           <Plus size={18} /> Adicionar Novo Setor
         </h2>
         <div className="flex flex-col sm:flex-row gap-2">
           <input 
             value={newTitle}
             onChange={e => setNewTitle(e.target.value)}
             placeholder="Nome do setor (ex: POSTO 3)"
             className="flex-1 border rounded px-3 py-2 text-sm bg-white text-black"
           />
           <input 
             value={newNumber}
             onChange={e => setNewNumber(e.target.value)}
             placeholder="Número"
             className="w-28 border rounded px-3 py-2 text-sm bg-white text-black"
           />
           <button 
             onClick={handleAdd}
             className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
             disabled={loading}
           >
             Salvar
           </button>
         </div>
       </div>
 
       <div className="bg-white rounded border">
         <div className="grid grid-cols-12 gap-2 p-3 border-b font-semibold text-gray-700">
           <div className="col-span-7">Setor</div>
           <div className="col-span-3">Número</div>
           <div className="col-span-2 text-right">Ações</div>
         </div>
         {sortedUnits.map(u => (
           <div key={u.id} className="grid grid-cols-12 gap-2 p-3 border-b items-center">
             <div className="col-span-7">
               {editId === u.id ? (
                 <input 
                   value={editTitle}
                   onChange={e => setEditTitle(e.target.value)}
                   className="w-full border rounded px-3 py-2 text-sm bg-white text-black"
                   autoFocus
                 />
               ) : (
                 <span className="text-gray-900">{u.title}</span>
               )}
             </div>
             <div className="col-span-3">
               <div className="flex items-center gap-2">
                 <input 
                   value={numbers[u.id] || ''}
                   onChange={(e) => setNumbers({ ...numbers, [u.id]: e.target.value })}
                   onKeyDown={(e) => {
                     if (e.key === 'Enter') {
                       e.preventDefault()
                       saveNumber(u.id, (e.target as HTMLInputElement).value)
                     }
                   }}
                   placeholder="Nº"
                   className="flex-1 border rounded px-3 py-2 text-sm bg-white text-black"
                 />
                 <button 
                   onClick={() => saveNumber(u.id, numbers[u.id] || '')}
                   className="px-3 py-2 text-green-600 hover:bg-gray-100 rounded disabled:opacity-50"
                   title="Salvar número"
                   disabled={savingId === u.id}
                 >
                   {saved[u.id] ? 'Salvo' : <Save size={16} />}
                 </button>
               </div>
             </div>
             <div className="col-span-2 flex justify-end gap-2">
               {editId === u.id ? (
                 <button 
                   onClick={saveTitle}
                   className="px-3 py-2 text-green-600 hover:bg-gray-100 rounded"
                   title="Salvar nome"
                 >
                   <Save size={16} />
                 </button>
               ) : (
                 <button 
                   onClick={() => startEdit(u)}
                   className="px-3 py-2 text-blue-600 hover:bg-gray-100 rounded"
                   title="Editar nome"
                 >
                   <Pencil size={16} />
                 </button>
               )}
               <button 
                 onClick={() => handleDelete(u.id)}
                 className="px-3 py-2 text-red-600 hover:bg-gray-100 rounded"
                 title="Excluir setor"
               >
                 <Trash2 size={16} />
               </button>
             </div>
           </div>
         ))}
       </div>
     </div>
   )
 }
 
