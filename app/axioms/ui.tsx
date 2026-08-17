'use client'

import { useState, useRef } from 'react'
import { Trash2, X, Pencil, Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createAxiom, deleteAxiom, updateAxiom } from './actions'

interface Axiom {
  id: string
  title: string
  body: string
  createdAt: string
}

export function formatAxioms(axioms: Axiom[]): string {
  return axioms.map((a, i) => `axiom ${i + 1} (${a.title})\n${a.body}`).join('\n\n')
}

interface ToastState {
  message: string
  type: 'success' | 'error'
}

function getToken(): string {
  return (process.env.NEXT_PUBLIC_JOURNAL_SECRET as string) ?? ''
}

export function AxiomsUI({ initialAxioms }: { initialAxioms: Axiom[] }) {
  const [axioms, setAxioms] = useState<Axiom[]>(initialAxioms)
  const [titleInput, setTitleInput] = useState('')
  const [bodyInput, setBodyInput] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editingAxiom, setEditingAxiom] = useState<{ id: string; title: string; body: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(message: string, type: ToastState['type']) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  async function handleAdd() {
    if (!titleInput.trim() || !bodyInput.trim()) return
    const tempId = `optimistic-${Date.now()}`
    const optimistic: Axiom = {
      id: tempId,
      title: titleInput.trim(),
      body: bodyInput.trim(),
      createdAt: new Date().toISOString(),
    }
    setAxioms(prev => [...prev, optimistic])
    const savedTitle = titleInput.trim()
    const savedBody = bodyInput.trim()
    setTitleInput('')
    setBodyInput('')
    setAdding(true)
    try {
      const created = await createAxiom(savedTitle, savedBody, getToken())
      setAxioms(prev =>
        prev.map(a => (a.id === tempId ? { ...created, createdAt: created.createdAt.toString() } : a))
      )
    } catch {
      setAxioms(prev => prev.filter(a => a.id !== tempId))
      setTitleInput(savedTitle)
      setBodyInput(savedBody)
      showToast('could not save — try again', 'error')
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteConfirm(id: string) {
    const prevAxioms = axioms
    setAxioms(prev => prev.filter(a => a.id !== id))
    setConfirmDeleteId(null)
    try {
      await deleteAxiom(id, getToken())
    } catch {
      setAxioms(prevAxioms)
      showToast('could not delete — try again', 'error')
    }
  }

  async function handleCopyAll() {
    if (axioms.length === 0) return
    try {
      await navigator.clipboard.writeText(formatAxioms(axioms))
      showToast('copied!', 'success')
    } catch {
      showToast('copy failed', 'error')
    }
  }

  async function handleEditSave(id: string) {
    if (!editingAxiom || editingAxiom.id !== id) return
    const newTitle = editingAxiom.title.trim()
    const newBody = editingAxiom.body.trim()
    if (!newTitle || !newBody) return
    const prevAxioms = axioms
    setAxioms(prev => prev.map(a => (a.id === id ? { ...a, title: newTitle, body: newBody } : a)))
    setEditingAxiom(null)
    try {
      await updateAxiom(id, newTitle, newBody, getToken())
    } catch {
      setAxioms(prevAxioms)
      showToast('could not save — try again', 'error')
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-2 pb-8">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-8">
        <span className="text-text-muted text-sm">
          {axioms.length} {axioms.length === 1 ? 'axiom' : 'axioms'}
        </span>
        <button
          onClick={handleCopyAll}
          disabled={axioms.length === 0}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary border border-border hover:border-zinc-600 px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Copy size={12} />
          copy axioms
        </button>
      </div>

      {/* Add form */}
      <div className="flex flex-col gap-2 mb-6">
        <input
          type="text"
          value={titleInput}
          onChange={e => setTitleInput(e.target.value)}
          placeholder="title"
          className="w-full bg-card border border-border rounded-lg px-4 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-zinc-600 text-sm transition-colors"
        />
        <textarea
          value={bodyInput}
          onChange={e => setBodyInput(e.target.value)}
          placeholder="explanation"
          rows={3}
          className="w-full bg-card border border-border rounded-lg px-4 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-zinc-600 text-sm transition-colors resize-y"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !titleInput.trim() || !bodyInput.trim()}
          className="self-end bg-accent text-zinc-950 hover:bg-amber-400 px-4 py-3.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          add
        </button>
      </div>

      {/* Axiom list */}
      {axioms.length === 0 ? (
        <p className="text-text-muted text-xs text-center py-12">no axioms yet — add one above</p>
      ) : (
        <div className="flex flex-col gap-2">
          {axioms.map((a, i) => (
            <div
              key={a.id}
              className={cn(
                'bg-card border border-border rounded-lg px-4 py-3 flex flex-col gap-2 group',
                a.id.startsWith('optimistic-') && 'opacity-50'
              )}
            >
              {editingAxiom?.id === a.id ? (
                <div className="flex flex-col gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={editingAxiom.title}
                    onChange={e => setEditingAxiom({ ...editingAxiom, title: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Escape') setEditingAxiom(null)
                    }}
                    className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-accent text-sm font-medium focus:outline-none focus:border-zinc-600"
                  />
                  <textarea
                    value={editingAxiom.body}
                    onChange={e => setEditingAxiom({ ...editingAxiom, body: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Escape') setEditingAxiom(null)
                    }}
                    rows={3}
                    className="w-full bg-surface border border-border rounded-md px-2 py-1.5 text-text-secondary text-sm focus:outline-none focus:border-zinc-600 resize-y"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEditSave(a.id)}
                      className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
                    >
                      <Check size={11} />
                      save
                    </button>
                    <button
                      onClick={() => setEditingAxiom(null)}
                      className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                      <X size={11} />
                      cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-accent text-sm font-medium leading-relaxed break-words">
                      axiom {i + 1} ({a.title})
                    </span>
                    <div className="shrink-0 flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {confirmDeleteId === a.id ? (
                        <div className="flex items-center gap-2 text-xs text-text-muted">
                          <span>delete?</span>
                          <button
                            onClick={() => handleDeleteConfirm(a.id)}
                            className="text-red-400 hover:text-red-300 transition-colors"
                          >
                            yes
                          </button>
                          <span>/</span>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="hover:text-text-secondary transition-colors"
                          >
                            no
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => setEditingAxiom({ id: a.id, title: a.title, body: a.body })}
                            className="text-text-muted hover:text-text-secondary transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(a.id)}
                            className="text-text-muted hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-text-secondary text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {a.body}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm border shadow-xl',
            toast.type === 'success'
              ? 'bg-card border-border text-text-primary'
              : 'bg-card border-red-900/50 text-red-400'
          )}
        >
          {toast.message}
        </div>
      )}
    </div>
  )
}
