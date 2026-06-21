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
NEXT_PUBLIC_JOURNAL_SECRET=same_value_as_journal_secret
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
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

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon pooled connection string. Required for all DB queries and migrations. |
| `JOURNAL_SECRET` | Token that protects write API routes. Include as `"token"` in request bodies or as `Authorization: Bearer <token>` header. |
| `NEXT_PUBLIC_JOURNAL_SECRET` | Same value as `JOURNAL_SECRET`. Exposes the token to the browser so the UI can submit entries without a manual token. Safe on a private deployment. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token. Required for the server-side entry queue (see below). Add via the Vercel Storage tab or Marketplace. |

---

## Journal day boundary

A journal day resets at **3:00 AM**, not midnight. An entry written at 2:45 AM on May 30 belongs to the May 29 journal day. This matches how most people think about "today" late at night.

---

## Reliability — server-side retry and blob queue

The `/api/entries/create` route is built to handle transient Neon connection timeouts:

1. **Retry** — the DB insert is retried up to 3 times with incremental back-off (400 ms, 800 ms).
2. **Blob queue** — if all retries fail, the entry is serialized to a private Vercel Blob file (`journal-server-queue.json`). The next successful `POST /api/entries/create` flushes the queue before inserting the new entry.
3. **202 response** — if the entry lands in the queue rather than the DB, the route returns `{ queued: true }` with a `202` status. The entry will appear in the journal on the next request.

This means `BLOB_READ_WRITE_TOKEN` is required in production; without it, a DB outage will return a `503` instead of queuing gracefully.

---

## Deploying to Vercel

1. Push to GitHub.
2. Import the repo in [vercel.com/new](https://vercel.com/new).
3. Add a **Vercel Blob** store via the Storage tab (generates `BLOB_READ_WRITE_TOKEN` automatically).
4. Under **Environment Variables**, add:
   - `DATABASE_URL` — your Neon pooled connection string
   - `JOURNAL_SECRET` — your secret token
   - `NEXT_PUBLIC_JOURNAL_SECRET` — same as `JOURNAL_SECRET`
5. Deploy. Vercel handles the build and serverless functions automatically.

> Neon's serverless driver is used via `@prisma/adapter-neon`, which works natively in Vercel's serverless environment without needing a persistent connection pool.

---

## API reference

All write routes require a secret token — either as `"token"` in the JSON body, a `token` field in FormData, or an `Authorization: Bearer <token>` header.

| Route | Method | Description |
|---|---|---|
| `/api/entries` | GET | All days with entries, newest first |
| `/api/entries/create` | POST | Create a new entry. Body: `{ body, token, createdAt? }`. Returns `201` on success, `202` if queued. |
| `/api/entries/[id]` | PUT | Edit entry body. Body: `{ body, token }` |
| `/api/entries/[id]` | DELETE | Delete entry (and its day if now empty). Body: `{ token }` |
| `/api/entries/export` | GET | Download a day as .txt. Query: `?date=YYYY-MM-DD&tz=America/New_York` (tz defaults to UTC). Filename: `"month day.txt"` e.g. `may 30.txt`. |
| `/api/import` | POST | Import a .txt or .rtf file. FormData: `file` + `token`. Timestamps in the file must use `Europe/Berlin` local time. |

---

## iOS Shortcut and Mac keyboard shortcut

See [SHORTCUTS.md](./SHORTCUTS.md) for full instructions.

---

## Tech stack

- **Next.js 16** (App Router)
- **Prisma 7** ORM
- **Neon** serverless Postgres
- **Vercel Blob** for the server-side entry queue
- **Tailwind CSS v4**
- **date-fns** + **date-fns-tz** for date formatting and timezone handling
- **lucide-react** for icons
