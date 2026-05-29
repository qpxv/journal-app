import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getJournalDate } from '@/lib/journalDate'
import { parse, isValid } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'

const ENTRY_RE = /\[(\d{2}\.\d{2}\.\d{2}),\s*(\d{1,2}:\d{2}\s*[AP]M)\]\s*—\s*(.+)/

function stripRtf(raw: string): string {
  return raw
    .replace(/\\\'([0-9a-fA-F]{2})/g, (_m, hex) => {
      const code = parseInt(hex, 16)
      if (code === 0x97) return '—'
      if (code === 0x92) return '’'
      if (code === 0x91) return '‘'
      if (code === 0x93) return '“'
      if (code === 0x94) return '”'
      if (code === 0x96) return '–'
      return String.fromCharCode(code)
    })
    .replace(/\\uc0\\u(\d+)\s*/g, (_m, n) => String.fromCharCode(parseInt(n)))
    .replace(/\\u(\d+)\?/g, (_m, n) => String.fromCharCode(parseInt(n)))
    .replace(/\\\*[\s\S]*?\}/g, '')
    .replace(/\{[^{}]*\}/g, '')
    .replace(/\\[a-zA-Z]+\d*\s?/g, '')
    .replace(/[{}\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.JOURNAL_SECRET

  let tokenValid = false
  if (authHeader?.startsWith('Bearer ')) {
    tokenValid = authHeader.slice(7) === secret
  }

  const form = await req.formData()
  if (!tokenValid) {
    tokenValid = form.get('token') === secret
  }
  if (!tokenValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const file = form.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const raw = await file.text()
  const text = file.name.toLowerCase().endsWith('.rtf') ? stripRtf(raw) : raw

  // Parse all valid lines first
  interface ParsedEntry {
    body: string
    createdAt: Date
    journalDay: Date
    dayKey: string
  }

  const parsed: ParsedEntry[] = []
  // Normalize line endings (\r\n and \r → \n) before splitting
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  for (const line of lines) {
    const match = ENTRY_RE.exec(line.trim())
    if (!match) continue
    const [, datePart, timePart, body] = match
    const localDt = parse(`${datePart} ${timePart.replace(/\s+/g, ' ').trim()}`, 'dd.MM.yy h:mm a', new Date())
    if (!isValid(localDt)) continue
    // Convert from Europe/Berlin local time to UTC
    const dt = fromZonedTime(localDt, 'Europe/Berlin')
    const journalDay = getJournalDate(dt)
    parsed.push({ body: body.trim(), createdAt: dt, journalDay, dayKey: journalDay.toISOString() })
  }

  if (parsed.length === 0) {
    return NextResponse.json({ imported: 0, days: 0 })
  }

  // Upsert all unique days in one pass
  const uniqueDays = [...new Set(parsed.map((e) => e.dayKey))]
  await Promise.all(
    uniqueDays.map((key) => {
      const date = new Date(key)
      return prisma.day.upsert({ where: { date }, create: { date }, update: {} })
    })
  )

  // Fetch all day IDs we just upserted
  const days = await prisma.day.findMany({
    where: { date: { in: uniqueDays.map((k) => new Date(k)) } },
    select: { id: true, date: true },
  })
  const dayMap = new Map(days.map((d) => [d.date.toISOString(), d.id]))

  // Fetch existing createdAt timestamps for these days to avoid duplicates
  const existingEntries = await prisma.entry.findMany({
    where: { dayId: { in: [...dayMap.values()] } },
    select: { createdAt: true, dayId: true },
  })
  const existingKeys = new Set(
    existingEntries.map((e) => `${e.dayId}__${e.createdAt.toISOString()}`)
  )

  const toInsert = parsed.filter(
    (e) => !existingKeys.has(`${dayMap.get(e.dayKey)}__${e.createdAt.toISOString()}`)
  )

  // Bulk insert in batches of 200
  const BATCH = 200
  for (let i = 0; i < toInsert.length; i += BATCH) {
    const batch = toInsert.slice(i, i + BATCH)
    await prisma.entry.createMany({
      data: batch.map((e) => ({
        body: e.body,
        createdAt: e.createdAt,
        dayId: dayMap.get(e.dayKey)!,
      })),
    })
  }

  return NextResponse.json({ imported: parsed.length, days: uniqueDays.length })
}
