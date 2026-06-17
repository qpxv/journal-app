'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function getWords() {
  return prisma.word.findMany({
    orderBy: { word: 'asc' },
  })
}

export async function createWord(word: string, definition: string, token: string) {
  if (token !== process.env.JOURNAL_SECRET) throw new Error('Unauthorized')
  if (!word.trim() || !definition.trim()) throw new Error('word and definition required')
  const result = await prisma.word.create({
    data: { word: word.trim(), definition: definition.trim() },
  })
  revalidatePath('/words')
  return result
}

export async function deleteWord(id: string, token: string) {
  if (token !== process.env.JOURNAL_SECRET) throw new Error('Unauthorized')
  await prisma.word.delete({ where: { id } })
  revalidatePath('/words')
}
