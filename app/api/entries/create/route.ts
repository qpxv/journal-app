import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateToken } from '@/lib/auth'
import { getJournalDate } from '@/lib/journalDate'

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
  const journalDay = getJournalDate(createdAt)

  const day = await prisma.day.upsert({
    where: { date: journalDay },
    create: { date: journalDay },
    update: {},
  })

  const entry = await prisma.entry.create({
    data: {
      body: entryBody,
      createdAt,
      dayId: day.id,
    },
    include: { day: true },
  })

  return NextResponse.json(entry, { status: 201 })
}
