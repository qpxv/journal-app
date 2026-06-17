import { getWords } from './actions'
import { WordsUI } from './ui'

export default async function WordsPage() {
  const words = (await getWords()).map(w => ({ ...w, createdAt: w.createdAt.toISOString() }))
  return <WordsUI initialWords={words} />
}
