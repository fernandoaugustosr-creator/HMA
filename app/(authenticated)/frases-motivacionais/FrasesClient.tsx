'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, CheckCircle2, XCircle, Sparkles, RefreshCw, Save, X } from 'lucide-react'
import {
  getMotivationalPhrases,
  addMotivationalPhrase,
  updateMotivationalPhrase,
  deleteMotivationalPhrase,
  type MotivationalPhrase,
} from '@/app/actions'

function formatDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function FrasesClient() {
  const [items, setItems] = useState<MotivationalPhrase[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newText, setNewText] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  const [toast, setToast] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 2600)
  }

  const loadAll = async () => {
    setLoading(true)
    try {
      const data = await getMotivationalPhrases()
      setItems(data || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  const totalAtivas = items.filter(i => i.active).length

  const handleAdd = async () => {
    const t = newText.trim()
    if (!t) {
      showToast('err', 'Digite uma frase antes de cadastrar.')
      return
    }
    setSaving(true)
    try {
      const res: any = await addMotivationalPhrase(t)
      if (res?.success) {
        setNewText('')
        showToast('ok', 'Frase cadastrada com sucesso!')
        await loadAll()
      } else {
        showToast('err', res?.message || 'Erro ao cadastrar.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (id: string, current: boolean) => {
    const res: any = await updateMotivationalPhrase(id, { active: !current })
    if (res?.success) {
      setItems(prev => prev.map(i => i.id === id ? { ...i, active: !current } : i))
      showToast('ok', current ? 'Frase desativada.' : 'Frase ativada.')
    } else {
      showToast('err', res?.message || 'Erro.')
    }
  }

  const startEdit = (p: MotivationalPhrase) => {
    setEditingId(p.id)
    setEditingText(p.text)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingText('')
  }

  const saveEdit = async () => {
    if (!editingId) return
    const t = editingText.trim()
    if (!t) {
      showToast('err', 'A frase não pode ficar vazia.')
      return
    }
    setSaving(true)
    try {
      const res: any = await updateMotivationalPhrase(editingId, { text: t })
      if (res?.success) {
        setItems(prev => prev.map(i => i.id === editingId ? { ...i, text: t } : i))
        setEditingId(null)
        setEditingText('')
        showToast('ok', 'Frase atualizada.')
      } else {
        showToast('err', res?.message || 'Erro.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja EXCLUIR esta frase?')) return
    const res: any = await deleteMotivationalPhrase(id)
    if (res?.success) {
      setItems(prev => prev.filter(i => i.id !== id))
      showToast('ok', 'Frase excluída.')
    } else {
      showToast('err', res?.message || 'Erro.')
    }
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-6 right-6 z-[100] rounded-xl px-4 py-3 shadow-xl border text-sm font-semibold transition-all ${
            toast.type === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <div className="bg-white/90 backdrop-blur rounded-3xl shadow-sm border border-slate-200/70 px-6 py-5">
        <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-blue-800 via-blue-600 to-indigo-500 mb-4" />
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-blue-200/60 flex items-center justify-center shrink-0">
              <Sparkles size={24} className="text-blue-700" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Frases Motivacionais
              </h1>
              <p className="text-slate-600 font-medium mt-1 text-sm">
                Cadastre frases que aparecerão em pop-up para TODOS os colaboradores ao entrarem no sistema.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-4 px-4 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total</span>
                <span className="text-lg font-black text-slate-800">{items.length}</span>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Ativas</span>
                <span className="text-lg font-black text-emerald-700">{totalAtivas}</span>
              </div>
            </div>
            <button
              onClick={loadAll}
              disabled={loading}
              title="Atualizar lista"
              className="h-11 w-11 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-sm disabled:opacity-60"
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* FORM ADICIONAR */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Plus size={18} className="text-blue-700" />
          <h2 className="text-base font-bold text-slate-800">Cadastrar nova frase</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
          <textarea
            value={newText}
            onChange={e => setNewText(e.target.value.slice(0, 500))}
            placeholder="Escreva aqui uma frase inspiradora, motivacional ou de boas-vindas..."
            rows={3}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50/40 px-4 py-3 text-sm text-slate-800 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none resize-y"
          />
          <div className="flex flex-col gap-2 justify-between">
            <div className="text-[11px] text-slate-400 font-bold text-right lg:text-right">
              {newText.length}/500
            </div>
            <button
              onClick={handleAdd}
              disabled={saving || !newText.trim()}
              className="h-11 px-6 rounded-xl font-bold text-white bg-gradient-to-r from-blue-800 via-blue-700 to-indigo-600 hover:from-blue-900 hover:via-blue-800 hover:to-indigo-700 shadow-md shadow-blue-900/10 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center transition-all"
            >
              <Plus size={17} />
              Cadastrar frase
            </button>
          </div>
        </div>
      </div>

      {/* TABELA */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/70 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100/60 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider w-[12%]">
                  Data
                </th>
                <th className="px-6 py-3.5 text-left text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Frase
                </th>
                <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-600 uppercase tracking-wider w-[10%]">
                  Status
                </th>
                <th className="px-4 py-3.5 text-center text-[11px] font-bold text-slate-600 uppercase tracking-wider w-[14%]">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-slate-400 font-medium">
                    Carregando...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-1">
                        <Sparkles size={24} className="text-slate-300" />
                      </div>
                      <p className="font-semibold text-slate-600">Nenhuma frase cadastrada ainda.</p>
                      <p className="text-xs text-slate-400">
                        Use o formulário acima para cadastrar frases que aparecerão aos colaboradores.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-semibold text-[13px] align-top">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-slate-800 font-medium leading-relaxed align-top">
                      {editingId === p.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingText}
                            onChange={e => setEditingText(e.target.value.slice(0, 500))}
                            rows={3}
                            className="w-full rounded-xl border border-blue-200 bg-blue-50/40 px-3 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 outline-none"
                          />
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 font-bold">
                              {editingText.length}/500
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={cancelEdit}
                                disabled={saving}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 flex items-center gap-1"
                              >
                                <X size={13} />
                                Cancelar
                              </button>
                              <button
                                onClick={saveEdit}
                                disabled={saving}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-blue-700 to-blue-600 hover:from-blue-800 hover:to-blue-700 shadow-sm flex items-center gap-1 disabled:opacity-60"
                              >
                                <Save size={13} />
                                Salvar
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap break-words">{p.text}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center align-top">
                      {p.active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={13} />
                          ATIVA
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                          <XCircle size={13} />
                          INATIVA
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex items-center gap-1.5 justify-center">
                        <button
                          onClick={() => handleToggle(p.id, p.active)}
                          disabled={editingId !== null}
                          title={p.active ? 'Desativar frase' : 'Ativar frase'}
                          className={`h-9 w-9 flex items-center justify-center rounded-xl shadow-sm border transition-all disabled:opacity-50 ${
                            p.active
                              ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {p.active ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                        </button>
                        <button
                          onClick={() => startEdit(p)}
                          disabled={editingId !== null}
                          title="Editar frase"
                          className="h-9 w-9 flex items-center justify-center rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 shadow-sm disabled:opacity-50 transition-all"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={editingId !== null}
                          title="Excluir frase"
                          className="h-9 w-9 flex items-center justify-center rounded-xl bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 shadow-sm disabled:opacity-50 transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-slate-400 font-semibold px-2">
        💡 Dica: frases marcadas como INATIVAS não aparecerão nos pop-ups de boas-vindas. Ideal para manter frases sazonais sem perder o histórico.
      </div>
    </div>
  )
}
