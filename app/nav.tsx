'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export function NavTabs() {
  const pathname = usePathname()

  return (
    <nav className="max-w-2xl mx-auto px-4 pt-8 pb-4 flex items-center gap-6">
      <Link
        href="/"
        className={cn(
          'text-xl font-medium tracking-tight transition-colors',
          pathname === '/' ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
        )}
      >
        journal.
      </Link>
      <Link
        href="/words"
        className={cn(
          'text-xl font-medium tracking-tight transition-colors',
          pathname === '/words' ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
        )}
      >
        words.
      </Link>
      <Link
        href="/axioms"
        className={cn(
          'text-xl font-medium tracking-tight transition-colors',
          pathname === '/axioms' ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
        )}
      >
        axioms.
      </Link>
    </nav>
  )
}
