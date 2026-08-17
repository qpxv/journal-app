'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getAxioms() {
  return prisma.axiom.findMany({
    orderBy: { createdAt: 'asc' },
  })
}

export async function createAxiom(title: string, body: string, token: string) {
  if (token !== process.env.JOURNAL_SECRET) throw new Error('Unauthorized')
  if (!title.trim() || !body.trim()) throw new Error('title and body required')
  const result = await prisma.axiom.create({
    data: { title: title.trim(), body: body.trim() },
  })
  revalidatePath('/axioms')
  return result
}

export async function updateAxiom(id: string, title: string, body: string, token: string) {
  if (token !== process.env.JOURNAL_SECRET) throw new Error('Unauthorized')
  if (!title.trim() || !body.trim()) throw new Error('title and body required')
  const result = await prisma.axiom.update({
    where: { id },
    data: { title: title.trim(), body: body.trim() },
  })
  revalidatePath('/axioms')
  return result
}

export async function deleteAxiom(id: string, token: string) {
  if (token !== process.env.JOURNAL_SECRET) throw new Error('Unauthorized')
  await prisma.axiom.delete({ where: { id } })
  revalidatePath('/axioms')
}
