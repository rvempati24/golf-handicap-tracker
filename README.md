# Golf Handicap Tracker

A personal, single-user web app to log golf rounds, auto-calculate your
**Handicap Index** using the current **World Handicap System (WHS / GHIN,
post-2020)** rules, compute advanced performance stats, and generate AI
coaching insights from your data.

## Stack

- **Next.js (App Router) + TypeScript + Tailwind CSS v4**
- **Prisma + Postgres** (Neon-ready)
- **Recharts** for trend charts
- **Google Gemini API** (`@google/genai`) for AI insights
- **GolfCourseAPI** for course search/import
- Simple owner-key write gate for single-user score/course entry

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Set up env (copy the example, then fill in values)
cp .env.example .env

# 3. Create a Postgres database, then set DATABASE_URL and DIRECT_URL in .env
# Neon works well. Use pooled URL for DATABASE_URL and non-pooled URL for DIRECT_URL.

# 4. Apply migrations
npm run db:migrate

# 5. Seed a starter course (Coyote Crossing Golf Club)
npm run db:seed

# 6. Run the dev server
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Variable            | Required        | Purpose                                              |
| ------------------- | --------------- | ---------------------------------------------------- |
| `DATABASE_URL`      | yes             | Runtime Postgres connection string, usually pooled Neon |
| `DIRECT_URL`        | yes             | Direct/non-pooled Postgres URL for Prisma migrations |
| `OWNER_WRITE_KEY`   | yes for writes  | Private key required to create/edit/delete data      |
| `GEMINI_API_KEY`    | for AI Insights | Gemini API key. **Never hardcode** — env only.       |
| `GOLF_COURSE_API_KEY` | for course import | GolfCourseAPI key. **Never hardcode** — env only. |

## Deploying to Vercel + Neon

1. Create a Neon project and copy the Postgres connection string.
2. In Vercel, import this GitHub repo.
3. Add environment variables in Vercel:
   - `DATABASE_URL`: Neon pooled connection string, typically with `?sslmode=require`
   - `DIRECT_URL`: Neon direct/non-pooled connection string for the same database
   - `OWNER_WRITE_KEY`: a long private string only you know
   - `GEMINI_API_KEY`: optional, only needed for AI insights
   - `GOLF_COURSE_API_KEY`: optional, only needed for course import
4. Deploy. `vercel.json` makes Vercel run `npm run vercel-build`, which applies Prisma migrations with `prisma migrate deploy` before `next build`.
5. Seed the starter course against Neon once:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@POOLED_HOST/DB?sslmode=require" \
DIRECT_URL="postgresql://USER:PASSWORD@DIRECT_HOST/DB?sslmode=require" \
npm run db:seed
```

After deploy, public visitors can view the tracker, but write actions require
the owner key. Enter it in the app once; the browser stores it locally and sends
it with create/edit/delete requests.

Course import is available at `/courses/import` when `GOLF_COURSE_API_KEY` is
set. Search results come from GolfCourseAPI; the app only imports tee sets with
complete 18-hole par, stroke-index, rating, and slope data.

## Scripts

| Script             | Description                              |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Start the dev server                     |
| `npm run build`    | Production build                         |
| `npm run vercel-build` | Apply production migrations, then build |
| `npm run test`     | Run unit tests (Vitest)                  |
| `npm run db:migrate` | Apply Prisma migrations (dev)          |
| `npm run db:reset` | Drop, re-migrate, and re-seed the DB     |
| `npm run db:seed`  | Seed the starter course                  |
| `npm run db:recompute` | Recompute all differentials + handicap trend |
| `npm run db:studio`| Open Prisma Studio                       |

### Sample data (development)

`npx tsx prisma/seed-rounds.ts [count]` generates synthetic rounds so the
handicap, stats, and insights features have data to work with (it also runs the
handicap recompute). Clear them when you're ready to track real rounds:

```bash
npx tsx prisma/seed-rounds.ts --reset 0   # delete all rounds + snapshots
```

## Data model

`Course` → `TeeSet` (rating/slope/par/yardages) → `Round` → `HoleResult`
(per-hole strokes, putts, GIR, fairway, penalties, up-&-down, sand, drive).
`HandicapSnapshot` records the Index after each round for trend charting.

The 18-element per-hole arrays (pars, stroke index, yardages) are stored as
JSON strings to keep course import/export simple; see `src/lib/holes.ts`.

## Build progress

- [x] **M1** — Prisma schema, Courses/TeeSets CRUD, Coyote Crossing seed
- [x] **M2** — Round scorecard entry + history
- [x] **M3** — WHS handicap engine + unit tests
- [x] **M4** — Stats engine + dashboard + trend charts
- [x] **M5** — AI insights + ask-about-my-game
- [x] **M6** — Validation, error states, polish

## Testing

`npm run test` runs the Vitest suite. The handicap engine
(`src/lib/whs.test.ts`) is validated against the USGA worked example and the
WHS edge cases (3 / 6 / 19 / 20 rounds, Net Double Bogey capping, the Par + 5
cap before an Index is established). The stats engine has its own tests in
`src/lib/stats.test.ts`.

## Handicap method

Implements the current WHS method (Score Differential from
`(113 / Slope) × (AGS − CourseRating − PCC)`, Net Double Bogey adjustment,
best-N-of-20 selection table). **Not** the pre-2020 "best 10 × 0.96" formula.
The engine lives in `src/lib/whs.ts` (pure functions) with the reference test
suite in `src/lib/whs.test.ts` (validated against the USGA worked example).

### Feature flags

- `ENABLE_SOFT_HARD_CAP` (`src/lib/handicap.ts`, default **off**) — applies the
  WHS soft cap (50% suppression of increases >3.0 over the Low Handicap Index)
  and hard cap (max +5.0) to the trailing-12-month Index trend.
- `ENABLE_STROKES_GAINED` (`src/lib/stats.ts`, default **on**) — shows a
  **simplified, approximate** Strokes Gained breakdown (Off-the-Tee / Approach /
  Short Game / Putting). It is derived from accuracy/scoring stats vs. a
  mid-handicap baseline, **not** true shot-level Strokes Gained, and is labeled
  as such in the UI.
