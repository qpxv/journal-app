export function getJournalDate(date: Date): Date {
  if (date.getHours() < 3) {
    const prev = new Date(date)
    prev.setDate(prev.getDate() - 1)
    return new Date(Date.UTC(prev.getFullYear(), prev.getMonth(), prev.getDate()))
  }
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
}
