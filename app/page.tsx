'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format, subDays, startOfDay, isThisYear } from 'date-fns'
import {
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Download,
  Upload,
  X,
  Check,
  Search,
  Copy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { enqueue, getQueue, removeFromQueue } from '@/lib/queue'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Entry {
  id: string
  body: string
  createdAt: string
  dayId: string
}

interface Day {
  id: string
  date: string
  entries: Entry[]
}

interface ToastState {
  message: string
  type: 'success' | 'error'
}

// ─── Token helper ──────────────────────────────────────────────────────────────

function getToken(): string {
  return (process.env.NEXT_PUBLIC_JOURNAL_SECRET as string) ?? ''
}

// ─── Highlight helper ─────────────────────────────────────────────────────────

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

// ─── Journal day helpers ────────────────────────────────────────────────────────

// A "journal day" doesn't roll over until 3am, so a late-night entry still
// belongs to the previous calendar day.
function getJournalDateStr(date: Date): string {
  return format(date.getHours() < 3 ? subDays(date, 1) : date, 'yyyy-MM-dd')
}

function formatEntryLine(e: Entry): string {
  return `[${format(new Date(e.createdAt), 'dd.MM.yy, h:mm a')}] — ${e.body}`
}

function formatDayBlock(day: Day, withHeader: boolean): string {
  const entries = [...day.entries].reverse().map(formatEntryLine).join('\n')
  if (!withHeader) return entries
  const header = format(new Date(day.date), 'EEE MMM d')
  return `## ${header}\n${entries}`
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function JournalPage() {
  const [days, setDays] = useState<Day[]>([])
  const [loading, setLoading] = useState(true)
  const [input, setInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingEntry, setEditingEntry] = useState<{ id: string; body: string } | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; days: number } | null>(null)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [exportDate, setExportDate] = useState('')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [queueCount, setQueueCount] = useState(0)
  const [flushingQueue, setFlushingQueue] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Toast helper ──────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: ToastState['type']) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ message, type })
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }, [])

  // ── Fetch all entries ──────────────────────────────────────────────────────

  const fetchDays = useCallback(async () => {
    try {
      const res = await fetch('/api/entries')
      const data: Day[] = await res.json()
      setDays(data)
      if (data.length > 0) {
        setExpandedIds((prev) => {
          const next = new Set(prev)
          next.add(data[0].id)
          return next
        })
      }
    } catch {
      showToast('Failed to load entries', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    // Fetch-on-mount: intentional, not derivable from props/state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDays()
  }, [fetchDays])

  // ── Queue flush on load ────────────────────────────────────────────────────

  const flushQueue = useCallback(async () => {
    setFlushingQueue(true)
    const queue = getQueue()
    for (const item of queue) {
      try {
        const res = await fetch('/api/entries/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: item.body, token: getToken(), createdAt: item.createdAt }),
        })
        if (!res.ok) break
        removeFromQueue(item.createdAt)
      } catch {
        break
      }
    }
    const remaining = getQueue()
    setQueueCount(remaining.length)
    setFlushingQueue(false)
    await fetchDays()
  }, [fetchDays])

  useEffect(() => {
    // Reads localStorage on mount: intentional, not derivable from props/state.
    const queue = getQueue()
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQueueCount(queue.length)
    if (queue.length > 0) {
      flushQueue()
    }
  }, [flushQueue])

  // ── Submit new entry ──────────────────────────────────────────────────────

  async function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !input.trim()) return
    e.preventDefault()
    const body = input.trim()
    setInput('')
    const now = new Date()
    const nowISO = now.toISOString()

    const optimisticId = `optimistic-${nowISO}`
    const todayStr = getJournalDateStr(now)
    const optimisticEntry: Entry = { id: optimisticId, body, createdAt: nowISO, dayId: '' }

    setDays((prev) => {
      const existing = prev.find((d) => d.date.startsWith(todayStr))
      if (existing) {
        return prev.map((d) =>
          d.id === existing.id ? { ...d, entries: [...d.entries, optimisticEntry] } : d
        )
      }
      const newDay: Day = {
        id: `${optimisticId}-day`,
        date: `${todayStr}T00:00:00.000Z`,
        entries: [optimisticEntry],
      }
      return [newDay, ...prev]
    })

    setExpandedIds((prev) => {
      const next = new Set(prev)
      const existing = days.find((d) => d.date.startsWith(todayStr))
      next.add(existing ? existing.id : `${optimisticId}-day`)
      return next
    })

    try {
      const res = await fetch('/api/entries/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, token: getToken() }),
      })
      if (!res.ok) throw new Error('failed')
      await fetchDays()
    } catch {
      setDays((prev) =>
        prev
          .map((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== optimisticId) }))
          .filter((d) => d.entries.length > 0 || !d.id.startsWith('optimistic'))
      )
      enqueue({ body, createdAt: nowISO })
      setQueueCount(getQueue().length)
      showToast('Could not save — queued for retry', 'error')
    }
  }

  // ── Edit entry ────────────────────────────────────────────────────────────

  async function saveEdit(id: string) {
    if (!editingEntry || editingEntry.id !== id) return
    const newBody = editingEntry.body.trim()
    if (!newBody) return
    const prevDays = days
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        entries: d.entries.map((e) => (e.id === id ? { ...e, body: newBody } : e)),
      }))
    )
    setEditingEntry(null)
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newBody, token: getToken() }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      setDays(prevDays)
      showToast('Failed to update entry', 'error')
    }
  }

  // ── Delete entry ──────────────────────────────────────────────────────────

  async function confirmDelete(id: string) {
    setConfirmDeleteId(null)
    const prevDays = days
    setDays((prev) =>
      prev
        .map((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== id) }))
        .filter((d) => d.entries.length > 0)
    )
    try {
      const res = await fetch(`/api/entries/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: getToken() }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      setDays(prevDays)
      showToast('Failed to delete entry', 'error')
    }
  }

  // ── Copy to clipboard ────────────────────────────────────────────────────

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      showToast('copied!', 'success')
    } catch {
      showToast('copy failed', 'error')
    }
  }

  async function handleCopyToday() {
    const day = days.find((d) => d.date.startsWith(getJournalDateStr(new Date())))
    if (!day || day.entries.length === 0) return
    await copyText(formatDayBlock(day, false))
  }

  async function handleCopyYesterday() {
    const todayLogical = getJournalDateStr(new Date())
    const yesterdayLogical = format(subDays(new Date(`${todayLogical}T00:00:00`), 1), 'yyyy-MM-dd')
    const day = days.find((d) => d.date.startsWith(yesterdayLogical))
    if (!day || day.entries.length === 0) return
    await copyText(formatDayBlock(day, false))
  }

  async function handleCopyLastWeek() {
    const cutoff = subDays(startOfDay(new Date()), 6)
    const recent = days.filter((d) => new Date(d.date) >= cutoff)
    if (recent.length === 0) return
    const text = [...recent].reverse().map((d) => formatDayBlock(d, true)).join('\n\n')
    await copyText(text)
  }

  async function handleCopyAll() {
    if (days.length === 0) return
    const text = [...days].reverse().map((d) => formatDayBlock(d, true)).join('\n\n')
    await copyText(text)
  }

  // ── Export ────────────────────────────────────────────────────────────────

  function triggerExport(date: string) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const a = document.createElement('a')
    a.href = `/api/entries/export?date=${date}&tz=${encodeURIComponent(tz)}`
    const label = format(new Date(date + 'T00:00:00'), 'MMMM d').toLowerCase()
    a.download = `${label}.txt`
    a.click()
  }

  // ── Import ────────────────────────────────────────────────────────────────

  async function handleImport(e: React.FormEvent) {
    e.preventDefault()
    if (!importFile) return
    setImportLoading(true)
    setImportResult(null)
    const form = new FormData()
    form.append('file', importFile)
    form.append('token', getToken())
    try {
      const res = await fetch('/api/import', { method: 'POST', body: form })
      const data = await res.json()
      setImportResult(data)
      await fetchDays()
    } catch {
      showToast('Import failed', 'error')
    } finally {
      setImportLoading(false)
    }
  }

  // ── Derived: search results ───────────────────────────────────────────────

  const searchActive = searchQuery.trim().length > 0
  const filteredEntries = searchActive
    ? days.flatMap((d) =>
        d.entries
          .filter((e) => e.body.toLowerCase().includes(searchQuery.toLowerCase()))
          .map((e) => ({ entry: e, dayDate: d.date }))
      )
    : []

  function formatDayLabel(dateStr: string) {
    const d = new Date(dateStr)
    const base = format(d, 'EEEE, MMMM d')
    return isThisYear(d) ? base : `${base}, ${format(d, 'yyyy')}`
  }

  const bestDay = days.reduce<Day | null>(
    (best, d) => (d.entries.length > (best?.entries.length ?? 0) ? d : best),
    null
  )

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface">
      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm border shadow-xl',
            toast.type === 'error'
              ? 'bg-red-950 border-red-800/60 text-red-300'
              : 'bg-zinc-900 border-border text-text-primary'
          )}
        >
          {toast.message}
        </div>
      )}

      {/* Queue banner */}
      {queueCount > 0 && (
        <div className="bg-accent-dim border-b border-amber-900/40 px-4 py-2 text-center">
          <span className="text-amber-300 text-xs">
            {queueCount} {queueCount === 1 ? 'entry' : 'entries'} queued offline
          </span>
          {!flushingQueue && (
            <button
              onClick={flushQueue}
              className="ml-3 text-amber-400 text-xs underline underline-offset-2 hover:text-amber-300 transition-colors"
            >
              retry
            </button>
          )}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pt-2 pb-8">
        {/* Top bar */}
        <div className="flex flex-wrap items-center gap-3 justify-between mb-8">
          {bestDay && bestDay.entries.length > 0 && (
            <div className="text-sm text-text-muted">
              record: {bestDay.entries.length} {bestDay.entries.length === 1 ? 'entry' : 'entries'} (
              {format(new Date(bestDay.date), 'MMM d')})
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopyToday}
              disabled={loading || days.length === 0}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary border border-border hover:border-zinc-600 px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Copy size={12} />
              copy today
            </button>
            <button
              onClick={handleCopyYesterday}
              disabled={loading || days.length === 0}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary border border-border hover:border-zinc-600 px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Copy size={12} />
              copy yesterday
            </button>
            <button
              onClick={handleCopyLastWeek}
              disabled={loading || days.length === 0}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary border border-border hover:border-zinc-600 px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Copy size={12} />
              copy last 7d
            </button>
            <button
              onClick={handleCopyAll}
              disabled={loading || days.length === 0}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary border border-border hover:border-zinc-600 px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Copy size={12} />
              copy all
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <button
                onClick={() => triggerExport(format(subDays(new Date(), 1), 'yyyy-MM-dd'))}
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary border border-border hover:border-zinc-600 px-3 py-1.5 rounded-md transition-colors"
              >
                <Download size={12} />
                yesterday
              </button>
              <input
                type="date"
                value={exportDate}
                onChange={(e) => setExportDate(e.target.value)}
                className="text-xs bg-card border border-border rounded-md px-2 py-1.5 text-text-secondary focus:outline-none focus:border-zinc-600 w-[130px]"
              />
              <button
                onClick={() => exportDate && triggerExport(exportDate)}
                disabled={!exportDate}
                className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary border border-border hover:border-zinc-600 px-3 py-1.5 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download size={12} />
                export
              </button>
            </div>
          </div>
        </div>

        {/* Capture input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="what's on your mind..."
          className="w-full bg-card border border-border rounded-lg px-4 py-3.5 text-text-primary placeholder:text-text-muted focus:outline-none focus:border-zinc-600 text-sm leading-relaxed mb-3 transition-colors"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Search */}
        <div className="relative mb-6">
          <Search
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="search entries..."
            className="w-full bg-card border border-border rounded-lg pl-8 pr-8 py-2.5 text-text-secondary placeholder:text-text-muted focus:outline-none focus:border-zinc-600 text-xs transition-colors"
          />
          {searchActive && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <p className="text-text-muted text-xs text-center py-12">loading...</p>
        )}

        {/* Search results */}
        {!loading && searchActive && (
          <div className="space-y-2">
            {filteredEntries.length === 0 ? (
              <p className="text-text-muted text-xs text-center py-8">no results</p>
            ) : (
              filteredEntries.map(({ entry, dayDate }) => (
                <div key={entry.id} className="bg-card border border-border rounded-lg overflow-hidden">
                  <p className="text-xs text-text-muted px-4 pt-2.5 pb-1">{formatDayLabel(dayDate)}</p>
                  <EntryRow
                    entry={entry}
                    searchQuery={searchQuery}
                    isEditing={editingEntry?.id === entry.id}
                    editBody={editingEntry?.id === entry.id ? editingEntry.body : ''}
                    onEditChange={(v) => setEditingEntry({ id: entry.id, body: v })}
                    onEditStart={() => setEditingEntry({ id: entry.id, body: entry.body })}
                    onEditSave={() => saveEdit(entry.id)}
                    onEditCancel={() => setEditingEntry(null)}
                    confirmingDelete={confirmDeleteId === entry.id}
                    onDeleteStart={() => setConfirmDeleteId(entry.id)}
                    onDeleteConfirm={() => confirmDelete(entry.id)}
                    onDeleteCancel={() => setConfirmDeleteId(null)}
                  />
                </div>
              ))
            )}
          </div>
        )}

        {/* Day list */}
        {!loading && !searchActive && (
          <div className="space-y-2">
            {days.length === 0 && (
              <p className="text-text-muted text-xs text-center py-12">
                no entries yet — write something above
              </p>
            )}
            {days.map((day) => {
              const isOpen = expandedIds.has(day.id)
              return (
                <div
                  key={day.id}
                  className="bg-card border border-border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() =>
                      setExpandedIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(day.id)) {
                          next.delete(day.id)
                        } else {
                          next.add(day.id)
                        }
                        return next
                      })
                    }
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-card-hover transition-colors group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-accent text-sm font-medium truncate">
                        {formatDayLabel(day.date)}
                      </span>
                      <span className="text-text-muted text-xs shrink-0">
                        {day.entries.length}{' '}
                        {day.entries.length === 1 ? 'entry' : 'entries'}
                      </span>
                    </div>
                    <span className="text-text-muted group-hover:text-text-secondary transition-colors shrink-0 ml-2">
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-border-subtle divide-y divide-border-subtle">
                      {day.entries.map((entry) => (
                        <EntryRow
                          key={entry.id}
                          entry={entry}
                          searchQuery=""
                          isEditing={editingEntry?.id === entry.id}
                          editBody={editingEntry?.id === entry.id ? editingEntry.body : ''}
                          onEditChange={(v) => setEditingEntry({ id: entry.id, body: v })}
                          onEditStart={() => setEditingEntry({ id: entry.id, body: entry.body })}
                          onEditSave={() => saveEdit(entry.id)}
                          onEditCancel={() => setEditingEntry(null)}
                          confirmingDelete={confirmDeleteId === entry.id}
                          onDeleteStart={() => setConfirmDeleteId(entry.id)}
                          onDeleteConfirm={() => confirmDelete(entry.id)}
                          onDeleteCancel={() => setConfirmDeleteId(null)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Import button */}
        {!loading && (
          <div className="mt-10 flex justify-center">
            <button
              onClick={() => {
                setShowImport(true)
                setImportResult(null)
                setImportFile(null)
              }}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              <Upload size={12} />
              import from file
            </button>
          </div>
        )}
      </div>

      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-text-primary text-sm font-medium">import entries</h2>
              <button
                onClick={() => setShowImport(false)}
                className="text-text-muted hover:text-text-secondary transition-colors"
              >
                <X size={14} />
              </button>
            </div>
            <p className="text-text-muted text-xs mb-4 leading-relaxed">
              accepts .txt or .rtf — lines matching{' '}
              <code className="text-text-secondary font-mono">
                [DD.MM.YY, H:MM AM] — text
              </code>{' '}
              are imported.
            </p>
            <form onSubmit={handleImport} className="space-y-3">
              <input
                type="file"
                accept=".txt,.rtf"
                onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                className="w-full text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:bg-card-hover file:text-text-secondary file:text-xs file:cursor-pointer cursor-pointer"
              />
              <button
                type="submit"
                disabled={!importFile || importLoading}
                className="w-full py-2 rounded-md text-xs font-medium bg-accent text-zinc-950 hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {importLoading ? 'importing...' : 'import'}
              </button>
            </form>
            {importResult && (
              <p className="mt-3 text-xs text-green-400 text-center">
                imported {importResult.imported}{' '}
                {importResult.imported === 1 ? 'entry' : 'entries'} across {importResult.days}{' '}
                {importResult.days === 1 ? 'day' : 'days'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EntryRow ─────────────────────────────────────────────────────────────────

interface EntryRowProps {
  entry: Entry
  searchQuery: string
  isEditing: boolean
  editBody: string
  onEditChange: (v: string) => void
  onEditStart: () => void
  onEditSave: () => void
  onEditCancel: () => void
  confirmingDelete: boolean
  onDeleteStart: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}

function EntryRow({
  entry,
  searchQuery,
  isEditing,
  editBody,
  onEditChange,
  onEditStart,
  onEditSave,
  onEditCancel,
  confirmingDelete,
  onDeleteStart,
  onDeleteConfirm,
  onDeleteCancel,
}: EntryRowProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isOptimistic = entry.id.startsWith('optimistic-')

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [isEditing])

  const timestamp = format(new Date(entry.createdAt), 'h:mm a')

  return (
    <div className="group flex items-start gap-3 px-4 py-3 hover:bg-card-hover transition-colors">
      <span className="text-text-muted text-xs font-mono w-14 shrink-0 pt-0.5 tabular-nums select-none">
        {timestamp}
      </span>
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              ref={textareaRef}
              value={editBody}
              onChange={(e) => onEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  onEditSave()
                }
                if (e.key === 'Escape') onEditCancel()
              }}
              rows={3}
              className="w-full bg-surface border border-border rounded-md px-3 py-2 text-text-primary text-sm leading-relaxed resize-none focus:outline-none focus:border-zinc-600"
            />
            <div className="flex gap-3">
              <button
                onClick={onEditSave}
                className="flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition-colors"
              >
                <Check size={11} />
                save
              </button>
              <button
                onClick={onEditCancel}
                className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                <X size={11} />
                cancel
              </button>
            </div>
          </div>
        ) : (
          <p
            className={cn(
              'text-sm leading-relaxed break-words',
              isOptimistic && 'opacity-50'
            )}
          >
            {highlightText(entry.body, searchQuery)}
          </p>
        )}
      </div>

      {!isEditing && !isOptimistic && (
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
          {confirmingDelete ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-text-muted">delete?</span>
              <button
                onClick={onDeleteConfirm}
                className="text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                yes
              </button>
              <button
                onClick={onDeleteCancel}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                no
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={onEditStart}
                className="p-1 text-text-muted hover:text-text-secondary transition-colors rounded"
              >
                <Pencil size={12} />
              </button>
              <button
                onClick={onDeleteStart}
                className="p-1 text-text-muted hover:text-red-400 transition-colors rounded"
              >
                <Trash2 size={12} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
