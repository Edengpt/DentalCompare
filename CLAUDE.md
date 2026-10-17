@AGENTS.md

## DentalCompare project
- Stack: TypeScript/Next.js, Prisma, Clerk auth, Stripe + PayPlus for clinic subscriptions, deployed to Vercel. Keep docs/HANDOFF.md updated after each feature.
- Workflow: implement → run tests (vitest) → commit → push → verify production deploy succeeded. If the deploy fails on a Google font fetch, retry once.
- Prices: show the patient's currency with a USD fallback. Be careful with decimal precision for currencies like HUF.
- Marketing and investor copy: the founder is seeking investors/partners, not a 'contractor' (קבלן). Include the founder's personal story.
- If another session may be active, work in a git worktree.
