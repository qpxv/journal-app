import { prisma } from '@/lib/prisma'
import { format } from 'date-fns'
import { formatInTimeZone } from 'date-fns-tz'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const tz = searchParams.get('tz') ?? 'UTC'

  if (!date) {
    return new Response(JSON.stringify({ error: 'date param required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const day = await prisma.day.findFirst({
    where: { date: new Date(date + 'T00:00:00.000Z') },
    include: { entries: { orderBy: { createdAt: 'asc' } } },
  })

  if (!day) {
    return new Response('No entries found for that date.', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const lines = day.entries.map((entry) => {
    const ts = formatInTimeZone(new Date(entry.createdAt), tz, 'dd.MM.yy, h:mm a')
    return `[${ts}] — ${entry.body}`
  })

  const text = lines.join('\n')

  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain',
      'Content-Disposition': `attachment; filename="${format(new Date(date + 'T00:00:00'), 'MMMM d yyyy').toLowerCase()}.txt"`,
    },
  })
}
