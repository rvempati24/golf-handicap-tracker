// Real (shot-level) Strokes Gained.
//
// Unlike the approximation in `stats.ts`, this walks the actual shot-by-shot
// data recorded for a round and applies Broadie's additivity property:
//
//   SG(shot i) = E(start_i) - E(end_i) - strokes_i
//
// where E is the PGA TOUR benchmark (see `sg-baseline.ts`), end_i is the start
// of the next shot (the hole-out state for the final shot, E = 0), and
// strokes_i counts the stroke plus any penalty incurred. Summed over a hole
// this telescopes to E(tee) - (strokes taken) — i.e. strokes gained vs. a tour
// pro for the whole hole.
//
// Distances: full shots are stored in yards (to the pin), putts in feet, and
// the tee shot is anchored to the hole's yardage. A hole is scored only when
// the recorded shots form a complete chain that ends holed; otherwise it is
// skipped so partial data never produces misleading numbers.

import type { RoundView, ShotView } from "@/lib/rounds";
import { expectedStrokes, type BaselineLie, type Benchmark } from "@/lib/sg-baseline";
import { AROUND_GREEN_YARDS } from "@/lib/shots";

export type SgCategory = "offTheTee" | "approach" | "aroundGreen" | "putting";

export const SG_CATEGORY_LABEL: Record<SgCategory, string> = {
  offTheTee: "Off the tee",
  approach: "Approach",
  aroundGreen: "Around the green",
  putting: "Putting",
};

const YARDS_PER_FOOT = 1 / 3;

function mapLie(lie: string | null | undefined, isTee: boolean): BaselineLie {
  if (isTee) return "tee";
  switch (lie) {
    case "fairway":
      return "fairway";
    case "rough":
      return "rough";
    case "bunker":
      return "sand";
    case "green":
      return "green";
    case "fringe":
      // Just off the green — plays much like a fairway lie at short range.
      return "fairway";
    case "tee":
      return "tee";
    default:
      return "rough";
  }
}

function isHoled(s: ShotView): boolean {
  return s.result === "holed" || s.endLie === "holed";
}

// A shot resolved into its starting state plus computed strokes gained.
export type SgShot = {
  holeNumber: number;
  shotNumber: number;
  category: SgCategory;
  lie: BaselineLie;
  /** Distance to the hole at the start of the shot (yards for non-putts). */
  startYards: number | null;
  /** Distance to the hole at the start of the shot (feet, putts only). */
  startFeet: number | null;
  /** Where the shot finished (start of the next shot, or holed). */
  finishLie: BaselineLie | "holed";
  /** Proximity left after the shot when it finished on the green (feet). */
  finishFeet: number | null;
  club: string | null;
  result: string | null;
  penalty: boolean;
  holed: boolean;
  sg: number;
};

type StartState = {
  lie: BaselineLie;
  expected: number;
  yards: number | null;
  feet: number | null;
};

function categorize(
  shotType: string,
  lie: BaselineLie,
  yards: number | null,
): SgCategory {
  if (lie === "green") return "putting";
  if (shotType === "tee") return "offTheTee";
  if (shotType === "short_game") return "aroundGreen";
  if (yards != null && yards <= AROUND_GREEN_YARDS) return "aroundGreen";
  return "approach";
}

/**
 * Compute strokes gained for every shot on one hole. Returns an empty array if
 * the hole's shot chain is incomplete or can't be anchored to a distance.
 */
export function computeHoleSG(
  shots: ShotView[],
  holeYardage: number | null,
  par: number,
  benchmark: Benchmark = "tour",
): SgShot[] {
  if (shots.length === 0) return [];
  const ordered = [...shots].sort((a, b) => a.shotNumber - b.shotNumber);
  if (!isHoled(ordered[ordered.length - 1])) return [];

  // Resolve the starting state of each shot.
  const states: StartState[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i];
    const isTee = i === 0;
    const lie = mapLie(s.startLie, isTee);

    if (lie === "green") {
      const feet = s.startDistanceYards ?? 0;
      states.push({
        lie,
        expected: expectedStrokes("green", feet, benchmark),
        yards: feet * YARDS_PER_FOOT,
        feet,
      });
      continue;
    }

    // Anchor the tee shot to the hole's length; for everything else the stored
    // distance is already "to the pin" in yards.
    let yards: number | null;
    if (isTee) {
      yards = holeYardage ?? (par === 3 ? s.startDistanceYards : null);
    } else {
      yards = s.startDistanceYards;
    }
    if (yards == null) return []; // chain not anchorable — skip the hole

    states.push({
      lie,
      expected: expectedStrokes(lie, yards, benchmark),
      yards,
      feet: null,
    });
  }

  const out: SgShot[] = [];
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i];
    const start = states[i];
    const next = states[i + 1]; // undefined for the final (holed) shot
    const endExpected = next ? next.expected : 0;
    const strokes = 1 + (s.penalty ? 1 : 0);
    const sg = start.expected - endExpected - strokes;

    out.push({
      holeNumber: s.holeNumber,
      shotNumber: s.shotNumber,
      category: categorize(s.shotType, start.lie, start.yards),
      lie: start.lie,
      startYards: start.lie === "green" ? null : start.yards,
      startFeet: start.lie === "green" ? start.feet : null,
      finishLie: next ? next.lie : "holed",
      finishFeet: next && next.lie === "green" ? next.feet : next ? null : 0,
      club: s.club,
      result: s.result,
      penalty: s.penalty,
      holed: !next,
      sg,
    });
  }
  return out;
}

/** All scored shots for a round (empty if the round has no usable shot data). */
export function computeRoundSG(
  round: RoundView,
  benchmark: Benchmark = "tour",
): SgShot[] {
  if (round.shots.length === 0) return [];
  const byHole = new Map<number, ShotView[]>();
  for (const s of round.shots) {
    const arr = byHole.get(s.holeNumber);
    if (arr) arr.push(s);
    else byHole.set(s.holeNumber, [s]);
  }
  const out: SgShot[] = [];
  for (const [holeNumber, holeShots] of byHole) {
    const par = round.holes.find((h) => h.holeNumber === holeNumber)?.par ?? 4;
    const yardage = round.yardages[holeNumber - 1] ?? null;
    out.push(...computeHoleSG(holeShots, yardage, par, benchmark));
  }
  return out;
}

// ── Aggregations for the dashboard ───────────────────────────────────────────

export type CategorySummary = {
  category: SgCategory;
  total: number;
  perRound: number;
  shots: number;
};

export type DistanceBucket = {
  label: string;
  min: number;
  max: number; // Infinity for the open-ended top bucket
  shots: number;
  sgTotal: number;
  sgPerShot: number | null;
  /** % of shots that finished on the green. */
  greenPct: number | null;
  /** Mean proximity to the hole for shots that found the green (feet). */
  avgProximityFeet: number | null;
};

export type LieSummary = {
  lie: BaselineLie;
  shots: number;
  sgTotal: number;
  sgPerShot: number;
};

export type MissProfile = {
  total: number;
  hitPct: number;
  shortPct: number;
  longPct: number;
  leftPct: number;
  rightPct: number;
  bunkerPct: number;
  penaltyPct: number;
};

export type PuttingBucket = {
  label: string;
  shots: number;
  makePct: number;
  sgPerShot: number;
};

export type ShotSgReport = {
  benchmark: Benchmark;
  roundsWithShots: number;
  totalShots: number;
  totalPerRound: number;
  byCategory: CategorySummary[];
  approachBuckets: DistanceBucket[];
  byLie: LieSummary[];
  approachMiss: MissProfile;
  teeMiss: MissProfile;
  puttingBuckets: PuttingBucket[];
  penaltyStrokesPerRound: number;
};

const APPROACH_BUCKETS: { label: string; min: number; max: number }[] = [
  { label: "< 75 yds", min: 0, max: 75 },
  { label: "75–100", min: 75, max: 100 },
  { label: "100–125", min: 100, max: 125 },
  { label: "125–150", min: 125, max: 150 },
  { label: "150–175", min: 150, max: 175 },
  { label: "175–200", min: 175, max: 200 },
  { label: "200+ yds", min: 200, max: Infinity },
];

function missProfile(shots: SgShot[]): MissProfile {
  const total = shots.length;
  const has = (r: string | null, frag: string) => (r ? r.includes(frag) : false);
  let hit = 0,
    short = 0,
    long = 0,
    left = 0,
    right = 0,
    bunker = 0,
    penalty = 0;
  for (const s of shots) {
    const r = s.result;
    if (s.penalty || has(r, "water") || has(r, "ob")) penalty++;
    if (has(r, "bunker")) bunker++;
    if (has(r, "short")) short++;
    if (has(r, "long")) long++;
    if (has(r, "left")) left++;
    if (has(r, "right")) right++;
    if (s.holed || r === "green" || r === "fairway" || r === "fringe") hit++;
  }
  const p = (n: number) => (total ? (n / total) * 100 : 0);
  return {
    total,
    hitPct: p(hit),
    shortPct: p(short),
    longPct: p(long),
    leftPct: p(left),
    rightPct: p(right),
    bunkerPct: p(bunker),
    penaltyPct: p(penalty),
  };
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Aggregate real strokes gained across rounds. Returns null when none of the
 * supplied rounds carry usable shot-level data.
 */
export function computeShotStrokesGained(
  rounds: RoundView[],
  benchmark: Benchmark = "tour",
): ShotSgReport | null {
  const perRoundShots: SgShot[][] = [];
  for (const r of rounds) {
    const shots = computeRoundSG(r, benchmark);
    if (shots.length > 0) perRoundShots.push(shots);
  }
  const roundsWithShots = perRoundShots.length;
  if (roundsWithShots === 0) return null;

  const all = perRoundShots.flat();

  // By category
  const cats: SgCategory[] = ["offTheTee", "approach", "aroundGreen", "putting"];
  const byCategory: CategorySummary[] = cats.map((category) => {
    const cs = all.filter((s) => s.category === category);
    const total = cs.reduce((a, s) => a + s.sg, 0);
    return {
      category,
      total: round2(total),
      perRound: round2(total / roundsWithShots),
      shots: cs.length,
    };
  });
  const totalPerRound = round2(
    all.reduce((a, s) => a + s.sg, 0) / roundsWithShots,
  );

  // Approach distance buckets
  const approachShots = all.filter((s) => s.category === "approach");
  const approachBuckets: DistanceBucket[] = APPROACH_BUCKETS.map((b) => {
    const bs = approachShots.filter(
      (s) => s.startYards != null && s.startYards >= b.min && s.startYards < b.max,
    );
    const onGreen = bs.filter((s) => s.finishLie === "green" || s.holed);
    const proximities = bs
      .map((s) => s.finishFeet)
      .filter((f): f is number => f != null);
    const sgTotal = bs.reduce((a, s) => a + s.sg, 0);
    return {
      label: b.label,
      min: b.min,
      max: b.max,
      shots: bs.length,
      sgTotal: round2(sgTotal),
      sgPerShot: bs.length ? round2(sgTotal / bs.length) : null,
      greenPct: bs.length ? (onGreen.length / bs.length) * 100 : null,
      avgProximityFeet: proximities.length
        ? round2(proximities.reduce((a, f) => a + f, 0) / proximities.length)
        : null,
    };
  });

  // By starting lie (non-putt shots)
  const lieOrder: BaselineLie[] = ["tee", "fairway", "rough", "sand"];
  const byLie: LieSummary[] = lieOrder
    .map((lie) => {
      const ls = all.filter((s) => s.lie === lie && s.category !== "putting");
      const sgTotal = ls.reduce((a, s) => a + s.sg, 0);
      return {
        lie,
        shots: ls.length,
        sgTotal: round2(sgTotal),
        sgPerShot: ls.length ? round2(sgTotal / ls.length) : 0,
      };
    })
    .filter((l) => l.shots > 0);

  // Miss tendencies (the dial)
  const approachMiss = missProfile(approachShots);
  const teeMiss = missProfile(all.filter((s) => s.category === "offTheTee"));

  // Putting buckets
  const putts = all.filter((s) => s.category === "putting");
  const puttDefs: { label: string; min: number; max: number }[] = [
    { label: "Short (< 6 ft)", min: 0, max: 6 },
    { label: "Mid (6–20 ft)", min: 6, max: 20 },
    { label: "Long (20+ ft)", min: 20, max: Infinity },
  ];
  const puttingBuckets: PuttingBucket[] = puttDefs
    .map((d) => {
      const ps = putts.filter(
        (s) => s.startFeet != null && s.startFeet >= d.min && s.startFeet < d.max,
      );
      const made = ps.filter((s) => s.holed).length;
      const sgTotal = ps.reduce((a, s) => a + s.sg, 0);
      return {
        label: d.label,
        shots: ps.length,
        makePct: ps.length ? (made / ps.length) * 100 : 0,
        sgPerShot: ps.length ? round2(sgTotal / ps.length) : 0,
      };
    })
    .filter((b) => b.shots > 0);

  const penaltyStrokes = all.filter((s) => s.penalty).length;

  return {
    benchmark,
    roundsWithShots,
    totalShots: all.length,
    totalPerRound,
    byCategory,
    approachBuckets,
    byLie,
    approachMiss,
    teeMiss,
    puttingBuckets,
    penaltyStrokesPerRound: round2(penaltyStrokes / roundsWithShots),
  };
}
