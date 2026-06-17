<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Project: journal-app

A personal journal + word dictionary app. Next.js 16 App Router, Prisma 7 + Neon (PostgreSQL), Tailwind v4, IBM Plex Mono throughout.

## Routes

- `/` — journal: add entries, expand/collapse day cards, search, export, import
- `/words` — word dictionary: define words, search, copy all for LLM context

## Key files

- `app/page.tsx` — entire journal UI (`'use client'`, ~750 lines)
- `app/words/ui.tsx` — entire words UI (`'use client'`)
- `app/words/actions.ts` — server actions for words (no API routes: `getWords`, `createWord`, `deleteWord`)
- `app/nav.tsx` — shared tab nav (`'use client'`, reads pathname)
- `app/layout.tsx` — root layout; renders `<NavTabs />` above `{children}`
- `lib/prisma.ts` — Prisma singleton with `@prisma/adapter-neon`
- `app/generated/prisma/` — generated Prisma client (do not edit manually; run `prisma generate`)

## Data models

```prisma
model Day     { id, date (unique), entries Entry[], createdAt }
model Entry   { id, body, createdAt, dayId }
model Word    { id, word, definition, createdAt }
```

## Patterns

- **Journal mutations** go through API routes at `app/api/entries/` with Bearer token auth (`lib/auth.ts`) and a two-tier offline queue (localStorage + Vercel Blob)
- **Words mutations** use Next.js Server Actions; token validated server-side against `process.env.JOURNAL_SECRET`; client passes `process.env.NEXT_PUBLIC_JOURNAL_SECRET`
- **No `tailwind.config.ts`** — all tokens live in `app/globals.css` `@theme {}` (Tailwind v4)
- **No `components/` directory** — UI is colocated with its page; extract to `components/ui/` only if two pages need the same piece
- After running `prisma migrate dev`, always restart the dev server — Turbopack does not hot-reload the generated Prisma client
