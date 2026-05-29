const QUEUE_KEY = 'journal_queue'

export interface QueuedEntry {
  body: string
  createdAt: string
}

export function enqueue(entry: QueuedEntry): void {
  const queue = getQueue()
  queue.push(entry)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function getQueue(): QueuedEntry[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY)
}

export function removeFromQueue(createdAt: string): void {
  const queue = getQueue().filter((e) => e.createdAt !== createdAt)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}
