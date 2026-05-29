# journal.

A personal journal web app — dark, cozy, no auth. Write from the browser, iOS Shortcut, or terminal. Backed by Neon (serverless Postgres) and deployed on Vercel.

---

## Setup

### 1. Clone and install

```bash
git clone <your-repo>
cd journal-app
npm install
```

### 2. Create a Neon database

1. Go to [neon.tech](https://neon.tech) and create a free project.
2. Copy the **pooled connection string** (it looks like `postgresql://user:password@ep-....neon.tech/neondb?sslmode=require`).

### 3. Configure environment variables

Create `.env.local` (for Next.js dev server):

```env
DATABASE_URL=postgresql://user:password@ep-....neon.tech/neondb?sslmode=require
JOURNAL_SECRET=pick_something_long_and_secret
```

Also add `DATABASE_URL` to `.env` so the Prisma CLI can connect for migrations:

```env
DATABASE_URL=postgresql://...same string...
```

> The `.env` file is loaded by `prisma.config.ts` when running CLI commands like `prisma migrate dev`.

### 4. Run database migrations

```bash
npx prisma migrate dev --name init
```

This creates the `Day` and `Entry` tables in your Neon database.

### 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment variables explained

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon pooled connection string. Required for all DB queries and migrations. |
| `JOURNAL_SECRET` | Token that protects write API routes. Include as `"token"` in request bodies or as `Authorization: Bearer <token>` header. |
| `NEXT_PUBLIC_JOURNAL_SECRET` | *(Optional)* If you want the browser UI to submit entries without manually entering a token, set this to the same value as `JOURNAL_SECRET`. Since this is a personal app, this is safe on a private deployment. |

---

## Journal day boundary

A journal day resets at **3:00 AM**, not midnight. An entry written at 2:45 AM on May 30 belongs to the May 29 journal day. This matches how most people think about "today" late at night.

---

## Deploying to Vercel

1. Push to GitHub.
2. Import the repo in [vercel.com/new](https://vercel.com/new).
3. Under **Environment Variables**, add:
   - `DATABASE_URL` — your Neon pooled connection string
   - `JOURNAL_SECRET` — your secret token
   - `NEXT_PUBLIC_JOURNAL_SECRET` — same as `JOURNAL_SECRET` (so the browser UI works)
4. Deploy. Vercel handles the build and serverless functions automatically.

> Neon's serverless driver is used via `@prisma/adapter-neon`, which works natively in Vercel's serverless environment without needing a persistent connection pool.

---

## API reference

All write routes require a secret token — either as `"token"` in the JSON body, a `token` field in FormData, or an `Authorization: Bearer <token>` header.

| Route | Method | Description |
|---|---|---|
| `/api/entries` | GET | All days with entries, newest first |
| `/api/entries/create` | POST | Create a new entry. Body: `{ body, token, createdAt? }` |
| `/api/entries/[id]` | PUT | Edit entry body. Body: `{ body, token }` |
| `/api/entries/[id]` | DELETE | Delete entry (and its day if now empty). Body: `{ token }` |
| `/api/entries/export` | GET | Download a day as .txt. Query: `?date=YYYY-MM-DD` |
| `/api/import` | POST | Import a .txt or .rtf file. FormData: `file` + `token` |

---

## iOS Shortcut and Mac keyboard shortcut

See [SHORTCUTS.md](./SHORTCUTS.md) for full instructions.

---

## Tech stack

- **Next.js 16** (App Router)
- **Prisma 7** ORM
- **Neon** serverless Postgres
- **Tailwind CSS v4**
- **date-fns** for date formatting
- **lucide-react** for icons
