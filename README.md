# DentalCompare

פלטפורמה ישראלית להשוואת מחירים בין רופאי שיניים — המטופל מעלה פעם אחת תוכנית
טיפול וצילום, בוחר עד 10 רופאים, והצעות המחיר חוזרות להשוואה במקום אחד.

**Live:** https://dentalcompare.vercel.app

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 · PostgreSQL (Neon) ·
Clerk (auth) · PayPlus (payments) · Vercel Blob (files) · Resend (email) · Vercel.

## Development

```bash
npm install
npm run db:migrate   # apply migrations to your DATABASE_URL
npm run dev          # http://localhost:3000
```

Copy `.env.example` to `.env.local` and fill in the values.

## Scripts

- `npm run dev` — dev server
- `npm test` — Vitest (unit + real-DB integration)
- `npm run lint` — ESLint
- `npm run build` — `prisma migrate deploy` + `prisma generate` + `next build`

## CI / Deploy

- **CI:** GitHub Actions runs lint + tests + build on every push and PR.
- **Deploy:** pushes to `main` auto-deploy to production on Vercel; other branches
  and PRs get preview deployments.
