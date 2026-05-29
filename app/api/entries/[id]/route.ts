import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { validateToken } from '@/lib/auth'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cloned = req.clone()
  const valid = await validateToken(cloned)
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const { body } = await req.json()

  if (!body || typeof body !== 'string') {
    return NextResponse.json({ error: 'body is required' }, { status: 400 })
  }

  const entry = await prisma.entry.update({
    where: { id },
    data: { body },
  })

  return NextResponse.json(entry)
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cloned = req.clone()
  const valid = await validateToken(cloned)
  if (!valid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  const entry = await prisma.entry.delete({ where: { id } })

  const remaining = await prisma.entry.count({ where: { dayId: entry.dayId } })
  if (remaining === 0) {
    await prisma.day.delete({ where: { id: entry.dayId } })
  }

  return NextResponse.json({ success: true })
}
