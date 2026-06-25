// PGA TOUR Strokes Gained baselines — the "benchmark" expected number of
// strokes to hole out from a given distance and lie.
//
// Source: Mark Broadie, "Assessing Golfer Performance on the PGA TOUR"
// (Columbia / Interfaces, 2011), Appendix A, Table 9 — estimated from ~8M
// ShotLink shots, 2003–2010. Distances in yards for non-green lies.
//
// The putting baseline (green, by feet) is Broadie's published PGA TOUR
// putting benchmark from "Every Shot Counts"; it is consistent with the worked
// examples in the same paper (≈1.1 strokes from 4 ft, ≈1.8 from 16 ft).
//
// These are tour-pro benchmarks: a shot's strokes gained is measured relative
// to what a tour pro would average from the same spot. A scratch amateur runs
// roughly flat to slightly negative against them; higher handicaps negative.

export type BaselineLie = "tee" | "fairway" | "rough" | "sand" | "recovery" | "green";

// Which population's expected strokes to compare against.
export type Benchmark = "tour" | "scratch";

export const BENCHMARK_LABEL: Record<Benchmark, string> = {
  tour: "PGA Tour",
  scratch: "Scratch",
};

// Table 9 rows. `null` where Broadie reports no value (tee shots < 100 yds).
// [distanceYards, tee, fairway, rough, sand, recovery]
const LONG_GAME: [number, number | null, number, number, number, number][] = [
  [10, null, 2.18, 2.34, 2.43, 3.45],
  [20, null, 2.4, 2.59, 2.53, 3.51],
  [30, null, 2.52, 2.7, 2.66, 3.57],
  [40, null, 2.6, 2.78, 2.82, 3.71],
  [50, null, 2.66, 2.87, 2.92, 3.79],
  [60, null, 2.7, 2.91, 3.15, 3.83],
  [70, null, 2.72, 2.93, 3.21, 3.84],
  [80, null, 2.75, 2.96, 3.24, 3.84],
  [90, null, 2.77, 2.99, 3.24, 3.82],
  [100, 2.92, 2.8, 3.02, 3.23, 3.8],
  [120, 2.99, 2.85, 3.08, 3.21, 3.78],
  [140, 2.97, 2.91, 3.15, 3.22, 3.8],
  [160, 2.99, 2.98, 3.23, 3.28, 3.81],
  [180, 3.05, 3.08, 3.31, 3.4, 3.82],
  [200, 3.12, 3.19, 3.42, 3.55, 3.87],
  [220, 3.17, 3.32, 3.53, 3.7, 3.92],
  [240, 3.25, 3.45, 3.64, 3.84, 3.97],
  [260, 3.45, 3.58, 3.74, 3.93, 4.03],
  [280, 3.65, 3.69, 3.83, 4.0, 4.1],
  [300, 3.71, 3.78, 3.9, 4.04, 4.2],
  [320, 3.79, 3.84, 3.95, 4.12, 4.31],
  [340, 3.86, 3.88, 4.02, 4.26, 4.44],
  [360, 3.92, 3.95, 4.11, 4.41, 4.56],
  [380, 3.96, 4.03, 4.21, 4.55, 4.66],
  [400, 3.99, 4.11, 4.3, 4.69, 4.75],
  [420, 4.02, 4.19, 4.4, 4.83, 4.84],
  [440, 4.08, 4.27, 4.49, 4.97, 4.94],
  [460, 4.17, 4.34, 4.58, 5.11, 5.03],
  [480, 4.28, 4.42, 4.68, 5.25, 5.13],
  [500, 4.41, 4.5, 4.77, 5.4, 5.22],
  [520, 4.54, 4.58, 4.87, 5.54, 5.32],
  [540, 4.65, 4.66, 4.96, 5.68, 5.41],
  [560, 4.74, 4.74, 5.06, 5.82, 5.51],
  [580, 4.79, 4.82, 5.15, 5.96, 5.6],
  [600, 4.82, 4.89, 5.25, 6.1, 5.7],
];

const COLUMN: Record<Exclude<BaselineLie, "green">, number> = {
  tee: 1,
  fairway: 2,
  rough: 3,
  sand: 4,
  recovery: 5,
};

// Putting benchmark: distance in feet → expected putts to hole out.
const PUTTING: [number, number][] = [
  [1, 1.001],
  [2, 1.009],
  [3, 1.053],
  [4, 1.147],
  [5, 1.256],
  [6, 1.357],
  [7, 1.443],
  [8, 1.515],
  [9, 1.575],
  [10, 1.626],
  [12, 1.703],
  [15, 1.787],
  [20, 1.894],
  [25, 1.97],
  [30, 2.017],
  [35, 2.052],
  [40, 2.092],
  [50, 2.165],
  [60, 2.23],
  [70, 2.29],
  [80, 2.35],
  [90, 2.404],
  [100, 2.448],
];

/** Linear interpolation over a sorted [x, y] table, clamped at both ends. */
function interp(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      const t = (x - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return last[1];
}

// ── Scratch-golfer model ─────────────────────────────────────────────────────
// A complete, publicly-tabulated scratch (0-handicap) expected-strokes table by
// distance and lie is not openly available. Instead the scratch benchmark is
// modeled as the tour benchmark plus a documented "scratch penalty" — the extra
// strokes a scratch amateur averages from the same spot — anchored to public
// Arccos / Lou Stagner figures:
//   • ~3.04 strokes to hole out from 100 yds fairway (tour 2.80 → +0.24)
//   • ~56% GIR and ~26 ft average GIR proximity (vs tour ~67% / ~footage)
//   • ~259-yd driving vs ~290 tour, ~51% fairways
//   • short putting nearly tour-level; long lag putting slightly worse
// The penalty grows with distance and with lie difficulty. It is a transparent
// model, not measured per-distance data — treat scratch numbers as indicative.

function scratchPenaltyYards(
  lie: Exclude<BaselineLie, "green">,
  d: number,
): number {
  // Base approach penalty from the fairway, anchored at ~+0.20 around 100 yds
  // and widening with distance.
  const fairway = 0.18 + 0.0012 * Math.max(0, d - 80);
  switch (lie) {
    case "fairway":
      return fairway;
    case "rough":
      return fairway + 0.1;
    case "sand":
      return fairway + 0.14;
    case "recovery":
      return fairway + 0.25;
    case "tee":
      // Driving gap (distance + accuracy); par-3 tee shots (<100) play like an
      // approach, so reuse the fairway penalty there.
      return d < 100 ? fairway : 0.15 + 0.0012 * Math.max(0, d - 100);
  }
}

function scratchPenaltyPutt(feet: number): number {
  // Scratch make rates track tour closely on short putts; the gap shows up on
  // lag putting and 3-putt avoidance.
  return Math.min(0.12, 0.004 * Math.max(0, feet));
}

/** Expected putts to hole out from `feet` on the green. */
export function expectedPutts(feet: number, benchmark: Benchmark = "tour"): number {
  const base = interp(PUTTING, Math.max(0, feet));
  return benchmark === "scratch" ? base + scratchPenaltyPutt(feet) : base;
}

/**
 * Expected strokes to hole out from `distanceYards` at the given lie.
 * Putting (green) must use {@link expectedPutts} (distance is in feet there).
 */
export function expectedStrokesYards(
  lie: Exclude<BaselineLie, "green">,
  distanceYards: number,
  benchmark: Benchmark = "tour",
): number {
  // Tour data has no teed-shot benchmark under 100 yds (those are par-3 tee
  // shots that play like a fairway approach) — fall back to the fairway curve.
  const col = lie === "tee" && distanceYards < 100 ? COLUMN.fairway : COLUMN[lie];
  const table: [number, number][] = [];
  for (const row of LONG_GAME) {
    const v = row[col];
    if (v != null) table.push([row[0], v]);
  }
  const base = interp(table, Math.max(0, distanceYards));
  return benchmark === "scratch"
    ? base + scratchPenaltyYards(lie, Math.max(0, distanceYards))
    : base;
}

/**
 * Generic expected-strokes lookup. For the green, pass distance in feet;
 * for every other lie, pass distance in yards.
 */
export function expectedStrokes(
  lie: BaselineLie,
  distance: number,
  benchmark: Benchmark = "tour",
): number {
  if (lie === "green") return expectedPutts(distance, benchmark);
  return expectedStrokesYards(lie, distance, benchmark);
}
