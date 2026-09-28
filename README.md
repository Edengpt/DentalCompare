# DentalCompare

A platform for comparing dental treatment quotes. The patient uploads their treatment plan and an x-ray once, sends the request to **up to 3 clinics** whose licence was reviewed by a person, and compares the written quotes side by side: price, what's included, number of trips and visits, and warranty. It's free for patients; clinics pay a subscription.

It works across borders (dental tourism): clinics in several countries, prices in each clinic's currency, and a Hebrew and English interface.

**Live site:** https://dentalcompare.co.il

## Main flows

| Side | What it does |
|---|---|
| **Patient** | Upload plan + x-ray → choose up to 3 clinics (filter sidebar) → send → compare quotes → accept (with confirmation) → track treatment (contact details, timeline, "treatment started" / "still ongoing") |
| **Clinic** | Register (3-step wizard + licence documents) → admin review → incoming-requests tabs → request page with the files and a quote form → treatment card |
| **Admin** | Pending clinics table → review page with documents shown in place → approve / request a better document / reject with a reason |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Prisma 7 · PostgreSQL (Neon) · Clerk (auth) · Vercel Blob (files: a private store for medical files and licences, a public one for logos) · Resend (email) · PayPlus + Stripe (clinic subscriptions) · Tailwind 4 · Vitest · Vercel.

## Local development

```bash
npm install
cp .env.example .env.local   # and fill in the values
npm run db:migrate           # apply the migrations to DATABASE_URL
npm run dev                  # http://localhost:3000
```

A local database in Docker is enough (`postgresql://…@localhost:5432/dentalcompare`). Clerk runs locally in keyless mode; the sign-in flow itself can't be tested locally (see `docs/HANDOFF.md`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Vitest: unit tests + integration tests against a real DB |
| `npm run lint` | ESLint |
| `npm run build` | `prisma generate` → migrations (in a Vercel production build only) → `next build` |
| `npm run db:migrate` | `prisma migrate dev` — **read the generated `migration.sql` before committing** |
| `npm run db:studio` | Prisma Studio |
| `npm run db:seed` | Seed data |

## CI and deployment

- **CI (`verify`):** GitHub Actions runs `npm ci` → migrations against a clean DB → lint → tests → build on every PR and on `main`.
- **Deployment:** a merge to `main` goes to production on Vercel automatically. Migrations run during the **production** build only (`scripts/migrate-on-build.mjs`); preview builds skip them.
- **`package-lock.json`:** CI runs on Linux. Running `npm install` on Windows can drop optional Linux packages from the lock file and break `npm ci`. If that happens, regenerate the lock file inside a `node:24` container.

## Documentation

- `docs/HANDOFF.md` — the project's current state, decisions and open items (the main document to read)
- `docs/superpowers/` — design specs and implementation plans per feature
- `docs/product/` — the PRD, flowcharts, user guide and business materials (see the index there)
- `docs/security-checklist.md`
