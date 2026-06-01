import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateToken } from '@/lib/auth'
import { getJournalDate } from '@/lib/journalDate'
import { withRetry } from '@/lib/retry'
import { readServerQueue, writeServerQueue, appendToServerQueue } from '@/lib/server-queue'

async function insertEntry(body: string, createdAt: Date) {
  const journalDay = getJournalDate(createdAt)
  const day = await prisma.day.upsert({
    where: { date: journalDay },
    create: { date: journalDay },
    update: {},
  })
  return prisma.entry.create({
    data: { body, createdAt, dayId: day.id },
    include: { day: true },
  })
}

export async function POST(req: Request) {
  const cloned = req.clone()
  const valid = await validateToken(cloned)
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { body: entryBody, createdAt: createdAtRaw } = body

  if (!entryBody || typeof entryBody !== 'string') {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  const createdAt = createdAtRaw ? new Date(createdAtRaw) : new Date()

  // Flush any entries that failed in previous requests
  try {
    const queued = await readServerQueue()
    if (queued.length > 0) {
      let flushed = 0
      for (const item of queued) {
        try {
          await insertEntry(item.body, new Date(item.createdAt))
          flushed++
        } catch {
          break
        }
      }
      if (flushed > 0) {
        await writeServerQueue(queued.slice(flushed))
      }
    }
  } catch {
    // Blob unavailable — skip flushing, proceed with new entry
  }

  // Create the new entry with retries for transient DB timeouts
  try {
    const entry = await withRetry(() => insertEntry(entryBody, createdAt))
    return NextResponse.json(entry, { status: 201 })
  } catch {
    // All retries failed — save to Blob queue for next request
    try {
      await appendToServerQueue({ body: entryBody, createdAt: createdAt.toISOString() })
      return NextResponse.json({ queued: true }, { status: 202 })
    } catch {
      return NextResponse.json({ error: 'DB unavailable' }, { status: 503 })
    }
  }
}
