'use client'

import { useState, useRef } from 'react'
import { Search, Trash2, X, Copy, Pencil, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createWord, deleteWord, updateWord } from './actions'

interface Word {
  id: string
  word: string
  definition: string
  createdAt: string
}

interface ToastState {
  message: string
  type: 'success' | 'error'
}

function getToken(): string {
  return (process.env.NEXT_PUBLIC_JOURNAL_SECRET as string) ?? ''
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-accent-dim text-accent rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

export function WordsUI({ initialWords }: { initialWords: Word[] }) {
  const [words, setWords] = useState<Word[]>(initialWords)
  const [wordInput, setWordInput] = useState('')
  const [definitionInput, setDefinitionInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [editingWord, setEditingWord] = useState<{ id: string; word: string; definition: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(message: string, type: ToastState['type']) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  async function handleAdd() {
    if (!wordInput.trim() || !definitionInput.trim()) return
    const tempId = `optimistic-${Date.now()}`
    const optimistic: Word = {
      id: tempId,
      word: wordInput.trim(),
      definition: definitionInput.trim(),
      createdAt: new Date().toISOString(),
    }
    setWords(prev => [...prev, optimistic].sort((a, b) => a.word.localeCompare(b.word)))
    const savedWord = wordInput.trim()
    const savedDef = definitionInput.trim()
    setWordInput('')
    setDefinitionInput('')
    setAdding(true)
    try {
      const created = await createWord(savedWord, savedDef, getToken())
      setWords(prev =>
        prev.map(w => (w.id === tempId ? { ...created, createdAt: created.createdAt.toString() } : w))
      )
    } catch {
      setWords(prev => prev.filter(w => w.id !== tempId))
      setWordInput(savedWord)
      setDefinitionInput(savedDef)
      showToast('could not save — try again', 'error')
    } finally {
      setAdding(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && wordInput.trim() && definitionInput.trim()) {
      handleAdd()
    }
  }

  async function handleDeleteConfirm(id: string) {
    const removed = words.find(w => w.id === id)
    setWords(prev => prev.filter(w => w.id !== id))
    setConfirmDeleteId(null)
    try {
      await deleteWord(id, getToken())
    } catch {
      if (removed) {
        setWords(prev => [...prev, removed].sort((a, b) => a.word.localeCompare(b.word)))
      }
      showToast('could not delete — try again', 'error')
    }
  }

  async function handleEditSave(id: string) {
    if (!editingWord || editingWord.id !== id) return
    const newWord = editingWord.word.trim()
    const newDef = editingWord.definition.trim()
    if (!newWord || !newDef) return
    const prevWords = words
    setWords(prev =>
      prev
        .map(w => (w.id === id ? { ...w, word: newWord, definition: newDef } : w))
        .sort((a, b) => a.word.localeCompare(b.word))
    )
    setEditingWord(null)
    try {
      await updateWord(id, newWord, newDef, getToken())
    } catch {
      setWords(prevWords)
      showToast('could not save — try again', 'error')
    }
  }

  async function handleCopyAll() {
    if (words.length === 0) return
    const text = words.map(w => `${w.word}: ${w.definition}`).join('\n')
    try {
      await navigator.clipboard.writeText(text)
      showToast('copied!', 'success')
    } catch {
      showToast('copy failed', 'error')
    }
  }

  const filtered =
    searchQuery.trim()
      ? words.filter(
          w =>
            w.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
            w.definition.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : words

  return (
    <div className="max-w-2xl mx-auto px-4 pt-2 pb-8">
      {/* Top bar */}
      <div className="flex justify-end mb-8">
        <button
          onClick={handleCopyAll}
          disabled={words.length === 0}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary border border-border hover:border-zinc-600 px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Copy size={12} />
          copy all
        </button>
      </div>
      {/* Add form */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
        <input
          type="text"
          value={wordInput}
          onChange={e => setWordInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="word"
          className="w-full sm:w-40 sm:shrink-0 bg-card border border-border rounded-lg px-4 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-zinc-600 text-base sm:text-sm transition-colors"
        />
        <input
          type="text"
          value={definitionInput}
          onChange={e => setDefinitionInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="definition"
          className="flex-1 bg-card border border-border rounded-lg px-4 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-zinc-600 text-base sm:text-sm transition-colors"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !wordInput.trim() || !definitionInput.trim()}
          className="w-full sm:w-auto shrink-0 bg-accent text-zinc-950 hover:bg-amber-400 px-4 py-3.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          add
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search
          size={13}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="search words..."
          className="w-full bg-card border border-border rounded-lg pl-8 pr-8 py-2.5 text-text-secondary placeholder:text-text-muted focus:outline-none focus:border-zinc-600 text-base sm:text-xs transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Word list */}
      {words.length === 0 ? (
        <p className="text-text-muted text-xs text-center py-12">no words yet — add one above</p>
      ) : filtered.length === 0 ? (
        <p className="text-text-muted text-xs text-center py-8">no results</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(w => (
            <div
              key={w.id}
              className={cn(
                'bg-card border border-border rounded-lg px-4 py-3 flex items-start gap-3 group',
                w.id.startsWith('optimistic-') && 'opacity-50'
              )}
            >
              {editingWord?.id === w.id ? (
                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={editingWord.word}
                      onChange={e => setEditingWord({ ...editingWord, word: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleEditSave(w.id)
                        if (e.key === 'Escape') setEditingWord(null)
                      }}
                      className="w-36 shrink-0 bg-surface border border-border rounded-md px-2 py-1.5 text-accent text-base sm:text-sm font-medium focus:outline-none focus:border-zinc-600"
                    />
                    <input
                      type="text"
                      value={editingWord.definition}
                      onChange={e => setEditingWord({ ...editingWord, definition: e.target.value })}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleEditSave(w.id)
                        if (e.key === 'Escape') setEditingWord(null)
                      }}
                      className="flex-1 bg-surface border border-border rounded-md px-2 py-1.5 text-text-secondary text-base sm:text-sm focus:outline-none focus:border-zinc-600"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleEditSave(w.id)}
                      className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
                    >
                      <Check size={11} />
                      save
                    </button>
                    <button
                      onClick={() => setEditingWord(null)}
                      className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
                    >
                      <X size={11} />
                      cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="w-36 shrink-0 text-accent text-sm font-medium leading-relaxed break-words">
                    {highlightText(w.word, searchQuery)}
                  </span>
                  <span className="flex-1 min-w-0 text-text-secondary text-sm leading-relaxed break-words">
                    {highlightText(w.definition, searchQuery)}
                  </span>
                  <div className="shrink-0 flex items-center gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {confirmDeleteId === w.id ? (
                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>delete?</span>
                        <button
                          onClick={() => handleDeleteConfirm(w.id)}
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
                          onClick={() => setEditingWord({ id: w.id, word: w.word, definition: w.definition })}
                          className="text-text-muted hover:text-text-secondary transition-colors"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(w.id)}
                          className="text-text-muted hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
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
