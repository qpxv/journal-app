import { put, list } from '@vercel/blob'

const QUEUE_PATHNAME = 'journal-server-queue.json'

export interface ServerQueuedEntry {
  body: string
  createdAt: string
}

export async function readServerQueue(): Promise<ServerQueuedEntry[]> {
  try {
    const { blobs } = await list({ prefix: QUEUE_PATHNAME })
    const blob = blobs.find((b) => b.pathname === QUEUE_PATHNAME)
    if (!blob) return []
    const res = await fetch(blob.url, {
      headers: { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const text = await res.text()
    return text ? (JSON.parse(text) as ServerQueuedEntry[]) : []
  } catch {
    return []
  }
}

export async function writeServerQueue(entries: ServerQueuedEntry[]): Promise<void> {
  await put(QUEUE_PATHNAME, JSON.stringify(entries), {
    access: 'private',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true,
  })
}

export async function appendToServerQueue(entry: ServerQueuedEntry): Promise<void> {
  const current = await readServerQueue()
  await writeServerQueue([...current, entry])
}
