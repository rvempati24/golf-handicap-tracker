# Golf Handicap Tracker

A personal, single-user web app to log golf rounds, auto-calculate your
**Handicap Index** using the current **World Handicap System (WHS / GHIN,
post-2020)** rules, compute advanced performance stats, and generate AI
coaching insights from your data.

## Stack

- **Next.js (App Router) + TypeScript + Tailwind CSS v4**
- **Prisma + SQLite** (single-file, zero-config DB; easy to move to Postgres later)
- **Recharts** for trend charts
- **Anthropic API** (`@anthropic-ai/sdk`) for AI insights

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Set up env (copy the example, then fill in values)
cp .env.example .env

# 3. Create the database and apply migrations
npm run db:migrate

# 4. Seed a starter course (Coyote Crossing Golf Club)
npm run db:seed

# 5. Run the dev server
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable            | Required        | Purpose                                              |
| ------------------- | --------------- | ---------------------------------------------------- |
| `DATABASE_URL`      | yes             | SQLite file location (default `file:./dev.db`)       |
| `ANTHROPIC_API_KEY` | for AI Insights | Anthropic API key. **Never hardcode** — env only.    |

## Scripts

| Script             | Description                              |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Start the dev server                     |
| `npm run build`    | Production build                         |
| `npm run test`     | Run unit tests (Vitest)                  |
| `npm run db:migrate` | Apply Prisma migrations (dev)          |
| `npm run db:reset` | Drop, re-migrate, and re-seed the DB     |
| `npm run db:seed`  | Seed the starter course                  |
| `npm run db:studio`| Open Prisma Studio                       |

## Data model

`Course` → `TeeSet` (rating/slope/par/yardages) → `Round` → `HoleResult`
(per-hole strokes, putts, GIR, fairway, penalties, up-&-down, sand, drive).
`HandicapSnapshot` records the Index after each round for trend charting.

The 18-element per-hole arrays (pars, stroke index, yardages) are stored as
JSON strings because SQLite has no native array type; see `src/lib/holes.ts`.

## Build progress

- [x] **M1** — Prisma schema, Courses/TeeSets CRUD, Coyote Crossing seed
- [ ] **M2** — Round scorecard entry + history
- [ ] **M3** — WHS handicap engine + unit tests
- [ ] **M4** — Stats engine + dashboard + trend charts
- [ ] **M5** — AI insights + ask-about-my-game
- [ ] **M6** — Validation, error states, polish

## Handicap method

Implements the current WHS method (Score Differential from
`(113 / Slope) × (AGS − CourseRating − PCC)`, Net Double Bogey adjustment,
best-N-of-20 selection table). **Not** the pre-2020 "best 10 × 0.96" formula.
Details and reference tests land in milestone 3.
