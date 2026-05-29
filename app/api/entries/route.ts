import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const days = await prisma.day.findMany({
    orderBy: { date: 'desc' },
    include: {
      entries: {
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  return NextResponse.json(days)
}
