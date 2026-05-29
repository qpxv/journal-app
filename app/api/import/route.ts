import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getJournalDate } from '@/lib/journalDate'
import { parse, isValid } from 'date-fns'

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
  const cloned = req.clone()
  const authHeader = req.headers.get('authorization')
  const secret = process.env.JOURNAL_SECRET

  let tokenValid = false

  if (authHeader?.startsWith('Bearer ')) {
    tokenValid = authHeader.slice(7) === secret
  }

  const form = await req.formData()

  if (!tokenValid) {
    const formToken = form.get('token')
    tokenValid = formToken === secret
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

  const lines = text.split('\n')
  let importedEntries = 0
  const seenDayDates = new Set<string>()

  for (const line of lines) {
    const match = ENTRY_RE.exec(line.trim())
    if (!match) continue

    const [, datePart, timePart, body] = match
    const dateTimeStr = `${datePart} ${timePart.replace(/\s+/g, ' ').trim()}`
    const parsed = parse(dateTimeStr, 'dd.MM.yy h:mm a', new Date())
    if (!isValid(parsed)) continue

    const journalDay = getJournalDate(parsed)
    seenDayDates.add(journalDay.toISOString())

    const day = await prisma.day.upsert({
      where: { date: journalDay },
      create: { date: journalDay },
      update: {},
    })

    await prisma.entry.create({
      data: { body: body.trim(), createdAt: parsed, dayId: day.id },
    })

    importedEntries++
  }

  return NextResponse.json({
    imported: importedEntries,
    days: seenDayDates.size,
  })
}
