import { subDays, startOfDay } from 'date-fns'

export function getJournalDate(date: Date): Date {
  if (date.getHours() < 3) {
    return startOfDay(subDays(date, 1))
  }
  return startOfDay(date)
}
