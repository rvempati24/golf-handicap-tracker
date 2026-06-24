// Dev-only: generate sample rounds so the handicap/stats/insights milestones
// have data to work with. Run: `npx tsx prisma/seed-rounds.ts [count]`.
// Pass `--reset` to delete existing rounds first.
import { PrismaClient } from "@prisma/client";
import { parseHoleArray } from "../src/lib/holes";
import { deriveGir } from "../src/lib/scoring";

const prisma = new PrismaClient();

// Deterministic PRNG so runs are reproducible.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function main() {
  const args = process.argv.slice(2);
  const reset = args.includes("--reset");
  const count = Number(args.find((a) => /^\d+$/.test(a))) || 12;

  const course = await prisma.course.findFirst({
    where: { name: "Coyote Crossing Golf Club" },
    include: { teeSets: true },
  });
  if (!course || course.teeSets.length === 0) {
    throw new Error("Seed the course first: npm run db:seed");
  }
  const tee = course.teeSets[0];
  const pars = parseHoleArray(course.holePars);
  const si = parseHoleArray(course.holeStrokeIndex);

  if (reset) {
    await prisma.round.deleteMany({});
    await prisma.handicapSnapshot.deleteMany({});
    console.log("Cleared existing rounds and snapshots.");
  }

  const rand = mulberry32(42);
  const today = new Date();

  for (let r = 0; r < count; r++) {
    // Trend: gently improving target over the gross score.
    const skill = 14 - r * 0.4; // strokes over par target-ish
    const datePlayed = new Date(today);
    datePlayed.setDate(today.getDate() - (count - r) * 6);

    const holes = pars.map((par, i) => {
      // Per-hole over/under relative to skill.
      const base = skill / 18;
      const noise = rand() * 2.4 - 0.7;
      let over = Math.round(base + noise);
      if (over < -1) over = -1;
      if (over > 4) over = 4;
      const strokes = Math.max(2, par + over);

      // Putts: 2 typical, sometimes 1 or 3.
      let putts = 2;
      const pr = rand();
      if (pr < 0.18) putts = 1;
      else if (pr > 0.82) putts = 3;
      putts = Math.min(putts, strokes - 1);

      const gir = deriveGir(strokes, putts, par);
      const isPar3 = par === 3;
      const fairwayHit = isPar3 ? null : rand() > 0.45;
      const penalties = rand() > 0.9 ? 1 : 0;
      const missedGreen = !gir;
      const upDownAttempt = missedGreen && rand() > 0.4;
      const upDownSuccess = upDownAttempt && rand() > 0.55;
      const sandAttempt = missedGreen && rand() > 0.85;
      const sandSuccess = sandAttempt && rand() > 0.6;
      const driveDistance = isPar3 ? null : 230 + Math.round(rand() * 60);

      return {
        holeNumber: i + 1,
        par,
        strokeIndex: si[i],
        strokes,
        putts,
        girHit: gir,
        fairwayHit,
        penalties,
        upDownAttempt,
        upDownSuccess,
        sandAttempt,
        sandSuccess,
        driveDistance,
      };
    });

    const totalStrokes = holes.reduce((a, h) => a + h.strokes, 0);

    await prisma.round.create({
      data: {
        datePlayed,
        courseId: course.id,
        teeSetId: tee.id,
        pcc: 0,
        notes: r === count - 1 ? "Felt good off the tee today." : null,
        totalStrokes,
        holes: { create: holes },
      },
    });
    console.log(
      `Round ${r + 1}/${count}: ${datePlayed.toISOString().slice(0, 10)} — ${totalStrokes}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
