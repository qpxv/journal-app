import { getAxioms } from './actions'
import { AxiomsUI } from './ui'

export default async function AxiomsPage() {
  const axioms = (await getAxioms()).map(a => ({ ...a, createdAt: a.createdAt.toISOString() }))
  return <AxiomsUI initialAxioms={axioms} />
}
