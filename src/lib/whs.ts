// World Handicap System (WHS / GHIN, post-2020) calculation engine.
// Pure functions only — no I/O — so they can be unit-tested against
// published USGA worked examples. See src/lib/whs.test.ts.
//
// References: USGA Rules of Handicapping 5.1–5.8.

export const MAX_HANDICAP_INDEX = 54.0;
export const MIN_ROUNDS_TO_ESTABLISH = 3;

/**
 * Round half-up to one decimal place, robust against binary-float
 * representation error (e.g. 15.95 must round to 16.0, not 15.9).
 */
export function roundToTenth(x: number): number {
  // 1e-9 is larger than binary-float representation error (~1e-13) so a value
  // that is mathematically X.X5 but stored as X.X4999… still rounds up, yet
  // smaller than any real precision we deal with so genuine sub-half values
  // (e.g. 0.0499999) are not pushed over.
  return Math.round(x * 10 + 1e-9) / 10;
}

/** Round half-up to the nearest whole number (WHS: 0.5 rounds up). */
export function roundHalfUp(x: number): number {
  return Math.round(x + 1e-9);
}

/**
 * Score Differential for a single round:
 *   (113 / Slope) × (AdjustedGrossScore − CourseRating − PCC)
 * rounded to one decimal place.
 */
export function scoreDifferential(params: {
  adjustedGrossScore: number;
  courseRating: number;
  slopeRating: number;
  pcc?: number;
}): number {
  const { adjustedGrossScore, courseRating, slopeRating, pcc = 0 } = params;
  const raw =
    (113 / slopeRating) * (adjustedGrossScore - courseRating - pcc);
  return roundToTenth(raw);
}

/**
 * Course Handicap:
 *   round( HandicapIndex × (Slope / 113) + (CourseRating − Par) )
 */
export function courseHandicap(params: {
  handicapIndex: number;
  slopeRating: number;
  courseRating: number;
  par: number;
}): number {
  const { handicapIndex, slopeRating, courseRating, par } = params;
  return roundHalfUp(
    handicapIndex * (slopeRating / 113) + (courseRating - par),
  );
}

/**
 * Strokes received on a hole given a (possibly negative) Course Handicap
 * and the hole's Stroke Index (1 = hardest … 18 = easiest).
 *
 * Base strokes go to every hole; the remainder is distributed to the
 * lowest stroke-index holes first. For plus handicaps (negative course
 * handicap) strokes are given back from the easiest holes (highest SI).
 */
export function strokesReceivedOnHole(
  courseHandicap: number,
  strokeIndex: number,
): number {
  const base = Math.floor(courseHandicap / 18);
  const remainder = courseHandicap - base * 18; // always 0..17
  const extra = strokeIndex <= remainder ? 1 : 0;
  return base + extra;
}

/** Net Double Bogey = Par + 2 + strokes received on the hole. */
export function netDoubleBogey(par: number, strokesReceived: number): number {
  return par + 2 + strokesReceived;
}

export type HoleScore = { par: number; strokeIndex: number; strokes: number };

/**
 * Adjusted Gross Score. If a Course Handicap is supplied (an established
 * Handicap Index exists) each hole is capped at Net Double Bogey; otherwise
 * each hole is capped at Par + 5 (the WHS rule before an Index is established).
 */
export function adjustedGrossScore(
  holes: HoleScore[],
  courseHandicap: number | null,
): number {
  return holes.reduce((sum, h) => {
    let cap: number;
    if (courseHandicap === null) {
      cap = h.par + 5;
    } else {
      cap = netDoubleBogey(
        h.par,
        strokesReceivedOnHole(courseHandicap, h.strokeIndex),
      );
    }
    return sum + Math.min(h.strokes, cap);
  }, 0);
}

/**
 * The WHS selection table: how many of the lowest Score Differentials to
 * use, and the adjustment to apply, for a given count in the scoring record.
 * Returns null when there are too few differentials to establish an Index.
 */
export function selectionFor(
  n: number,
): { count: number; adjustment: number } | null {
  if (n < 3) return null;
  if (n === 3) return { count: 1, adjustment: -2.0 };
  if (n === 4) return { count: 1, adjustment: -1.0 };
  if (n === 5) return { count: 1, adjustment: 0 };
  if (n === 6) return { count: 2, adjustment: -1.0 };
  if (n <= 8) return { count: 2, adjustment: 0 };
  if (n <= 11) return { count: 3, adjustment: 0 };
  if (n <= 14) return { count: 4, adjustment: 0 };
  if (n <= 16) return { count: 5, adjustment: 0 };
  if (n <= 18) return { count: 6, adjustment: 0 };
  if (n === 19) return { count: 7, adjustment: 0 };
  return { count: 8, adjustment: 0 }; // 20
}

/**
 * Handicap Index from a scoring record of Score Differentials given in
 * chronological order (oldest → newest). Uses the most recent 20, selects
 * the lowest N per the table, averages, applies the adjustment, rounds to
 * one decimal, and caps at 54.0. Returns null if fewer than 3 differentials.
 */
export function handicapIndexFromDifferentials(
  differentialsChronological: number[],
): number | null {
  const recent = differentialsChronological.slice(-20);
  const sel = selectionFor(recent.length);
  if (!sel) return null;
  const lowest = [...recent].sort((a, b) => a - b).slice(0, sel.count);
  const avg = lowest.reduce((a, b) => a + b, 0) / sel.count;
  const index = roundToTenth(avg + sel.adjustment);
  return Math.min(index, MAX_HANDICAP_INDEX);
}

// ── Soft cap / hard cap (advanced, feature-flagged) ────────────────────────
// Limits upward movement of the Handicap Index relative to the Low Handicap
// Index (the lowest Index over the trailing 12 months). Disabled by default;
// see ENABLE_SOFT_HARD_CAP in handicap.ts. Soft cap: increases beyond 3.0 over
// the Low HI are reduced by 50%. Hard cap: total increase limited to 5.0.

export function applyCaps(
  rawIndex: number,
  lowHandicapIndex: number | null,
): number {
  if (lowHandicapIndex === null) return rawIndex;
  const increase = rawIndex - lowHandicapIndex;
  if (increase <= 3.0) return rawIndex;
  // Soft cap: 50% suppression of the portion above 3.0.
  const soft = lowHandicapIndex + 3.0 + (increase - 3.0) * 0.5;
  // Hard cap: never more than 5.0 above the Low HI.
  const hardCeiling = lowHandicapIndex + 5.0;
  return roundToTenth(Math.min(soft, hardCeiling));
}

// ── Round-by-round orchestration (pure) ────────────────────────────────────

export type RoundForCompute = {
  id: string;
  courseRating: number;
  slopeRating: number;
  teePar: number;
  pcc: number;
  holes: HoleScore[];
};

export type RoundComputation = {
  id: string;
  adjustedGrossScore: number;
  scoreDifferential: number;
  /** Handicap Index after this round was posted, or null if not yet established. */
  indexAfter: number | null;
};

/**
 * Compute Adjusted Gross Score, Score Differential, and the running Handicap
 * Index for each round, in chronological order.
 *
 * For each round the Adjusted Gross Score uses the Course Handicap derived
 * from the Handicap Index *in effect before that round* (i.e. computed from
 * earlier rounds only). Before an Index is established, the Par + 5 cap is
 * used. This mirrors how WHS posts scores and avoids self-reference.
 */
export function computeRoundDifferentials(
  roundsChronological: RoundForCompute[],
): RoundComputation[] {
  const diffs: number[] = [];
  const out: RoundComputation[] = [];

  for (const round of roundsChronological) {
    const priorIndex = handicapIndexFromDifferentials(diffs);
    const ch =
      priorIndex === null
        ? null
        : courseHandicap({
            handicapIndex: priorIndex,
            slopeRating: round.slopeRating,
            courseRating: round.courseRating,
            par: round.teePar,
          });
    const ags = adjustedGrossScore(round.holes, ch);
    const differential = scoreDifferential({
      adjustedGrossScore: ags,
      courseRating: round.courseRating,
      slopeRating: round.slopeRating,
      pcc: round.pcc,
    });
    diffs.push(differential);
    const indexAfter = handicapIndexFromDifferentials(diffs);
    out.push({
      id: round.id,
      adjustedGrossScore: ags,
      scoreDifferential: differential,
      indexAfter,
    });
  }

  return out;
}
