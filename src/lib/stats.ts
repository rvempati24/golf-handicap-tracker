import type { RoundView, HoleResultView } from "@/lib/rounds";

// Simplified Strokes Gained is an approximation (true SG needs shot-level
// distance data and published baselines). Flagged on, clearly disclaimed.
export const ENABLE_STROKES_GAINED = true;

export type StatsSummary = {
  rounds: number;
  scoringAvg: number | null;
  toParAvg: number | null;
  par3Avg: number | null;
  par4Avg: number | null;
  par5Avg: number | null;
  girPct: number | null;
  firPct: number | null;
  firTracked: boolean;
  puttsPerRound: number | null;
  puttsPerGir: number | null;
  threePuttsPerRound: number | null;
  threePuttAvoidancePct: number | null;
  upDownPct: number | null;
  upDownTracked: boolean;
  scramblingPct: number | null;
  sandSavePct: number | null;
  sandTracked: boolean;
  penaltiesPerRound: number | null;
  doublesPerRound: number | null;
  distribution: {
    eaglesOrBetter: number;
    birdies: number;
    pars: number;
    bogeys: number;
    doublesPlus: number;
  };
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return (numerator / denominator) * 100;
}

export function computeStats(rounds: RoundView[]): StatsSummary {
  const n = rounds.length;
  const allHoles: HoleResultView[] = rounds.flatMap((r) => r.holes);

  const par3 = allHoles.filter((h) => h.par === 3);
  const par4 = allHoles.filter((h) => h.par === 4);
  const par5 = allHoles.filter((h) => h.par >= 5);

  const girHoles = allHoles.filter((h) => h.girHit);
  const fairwayTracked = allHoles.filter((h) => h.fairwayHit !== null);
  const fairwaysHit = fairwayTracked.filter((h) => h.fairwayHit).length;

  const totalPutts = allHoles.reduce((a, h) => a + h.putts, 0);
  const puttsOnGir = girHoles.reduce((a, h) => a + h.putts, 0);
  const threePutts = allHoles.filter((h) => h.putts >= 3).length;

  const udAtt = allHoles.filter((h) => h.upDownAttempt).length;
  const udMade = allHoles.filter((h) => h.upDownAttempt && h.upDownSuccess).length;

  // Scrambling: par-or-better on holes where the green was missed in regulation.
  const missedGir = allHoles.filter((h) => !h.girHit);
  const scrambled = missedGir.filter((h) => h.strokes <= h.par).length;

  const sandAtt = allHoles.filter((h) => h.sandAttempt).length;
  const sandMade = allHoles.filter((h) => h.sandAttempt && h.sandSuccess).length;

  const penalties = allHoles.reduce((a, h) => a + h.penalties, 0);
  const doubles = allHoles.filter((h) => h.strokes - h.par >= 2).length;

  const distribution = {
    eaglesOrBetter: allHoles.filter((h) => h.strokes - h.par <= -2).length,
    birdies: allHoles.filter((h) => h.strokes - h.par === -1).length,
    pars: allHoles.filter((h) => h.strokes - h.par === 0).length,
    bogeys: allHoles.filter((h) => h.strokes - h.par === 1).length,
    doublesPlus: doubles,
  };

  const scoringAvg = avg(
    rounds.map((r) => r.totalStrokes ?? r.holes.reduce((a, h) => a + h.strokes, 0)),
  );
  const toParAvg = avg(
    rounds.map(
      (r) =>
        (r.totalStrokes ?? r.holes.reduce((a, h) => a + h.strokes, 0)) - r.teePar,
    ),
  );

  return {
    rounds: n,
    scoringAvg,
    toParAvg,
    par3Avg: avg(par3.map((h) => h.strokes)),
    par4Avg: avg(par4.map((h) => h.strokes)),
    par5Avg: avg(par5.map((h) => h.strokes)),
    girPct: pct(girHoles.length, allHoles.length),
    firPct: pct(fairwaysHit, fairwayTracked.length),
    firTracked: fairwayTracked.length > 0,
    puttsPerRound: n ? totalPutts / n : null,
    puttsPerGir: girHoles.length ? puttsOnGir / girHoles.length : null,
    threePuttsPerRound: n ? threePutts / n : null,
    threePuttAvoidancePct: pct(allHoles.length - threePutts, allHoles.length),
    upDownPct: pct(udMade, udAtt),
    upDownTracked: udAtt > 0,
    scramblingPct: pct(scrambled, missedGir.length),
    sandSavePct: pct(sandMade, sandAtt),
    sandTracked: sandAtt > 0,
    penaltiesPerRound: n ? penalties / n : null,
    doublesPerRound: n ? doubles / n : null,
    distribution,
  };
}

// ── Rolling windows ─────────────────────────────────────────────────────────
export type StatsWindows = {
  last5: StatsSummary;
  last20: StatsSummary;
  allTime: StatsSummary;
};

/** Rounds must be sorted most-recent first. */
export function computeWindows(roundsDesc: RoundView[]): StatsWindows {
  return {
    last5: computeStats(roundsDesc.slice(0, 5)),
    last20: computeStats(roundsDesc.slice(0, 20)),
    allTime: computeStats(roundsDesc),
  };
}

// ── Per-round trend points ──────────────────────────────────────────────────
export type TrendPoint = {
  date: string;
  label: string;
  score: number;
  toPar: number;
  girPct: number;
  firPct: number | null;
  putts: number;
  upDownPct: number | null;
  doubles: number;
  index: number | null;
};

/** Rounds in chronological (oldest first) order; indexByRoundId optional. */
export function computeTrend(
  roundsAsc: RoundView[],
  indexByRoundDate?: Map<string, number>,
): TrendPoint[] {
  return roundsAsc.map((r) => {
    const single = computeStats([r]);
    const score =
      r.totalStrokes ?? r.holes.reduce((a, h) => a + h.strokes, 0);
    return {
      date: r.datePlayed.toISOString(),
      label: r.datePlayed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      score,
      toPar: score - r.teePar,
      girPct: single.girPct ?? 0,
      firPct: single.firPct,
      putts: r.holes.reduce((a, h) => a + h.putts, 0),
      upDownPct: single.upDownPct,
      doubles: single.distribution.doublesPlus,
      index: indexByRoundDate?.get(r.datePlayed.toISOString()) ?? null,
    };
  });
}

// ── Simplified Strokes Gained (approximation, flagged) ──────────────────────
// Baselines roughly approximate a mid-single-digit handicap. Each category is
// derived from available stats vs. baseline and scaled to per-round strokes.
// This is NOT true Strokes Gained — it has no shot-level distance data.
export type StrokesGained = {
  offTheTee: number;
  approach: number;
  shortGame: number;
  putting: number;
  total: number;
};

const SG_BASELINE = {
  firPct: 55, // fairways hit
  penaltiesPerRound: 1.5,
  girPct: 50,
  scramblingPct: 50,
  sandSavePct: 40,
  puttsPerRound: 31,
};

export function computeStrokesGained(s: StatsSummary): StrokesGained | null {
  if (s.rounds === 0) return null;

  // Off-the-tee: fairway accuracy + penalty avoidance.
  const firDelta = s.firTracked && s.firPct !== null ? (s.firPct - SG_BASELINE.firPct) / 100 : 0;
  const penDelta =
    s.penaltiesPerRound !== null
      ? SG_BASELINE.penaltiesPerRound - s.penaltiesPerRound
      : 0;
  const offTheTee = firDelta * 3.5 + penDelta * 1.0;

  // Approach: greens in regulation.
  const girDelta = s.girPct !== null ? (s.girPct - SG_BASELINE.girPct) / 100 : 0;
  const approach = girDelta * 9.0;

  // Short game: scrambling + sand saves on missed greens.
  const scrDelta =
    s.scramblingPct !== null ? (s.scramblingPct - SG_BASELINE.scramblingPct) / 100 : 0;
  const sandDelta =
    s.sandTracked && s.sandSavePct !== null
      ? (s.sandSavePct - SG_BASELINE.sandSavePct) / 100
      : 0;
  const shortGame = scrDelta * 4.5 + sandDelta * 1.0;

  // Putting: putts per round vs baseline (fewer is better).
  const putting =
    s.puttsPerRound !== null ? SG_BASELINE.puttsPerRound - s.puttsPerRound : 0;

  const round2 = (x: number) => Math.round(x * 100) / 100;
  return {
    offTheTee: round2(offTheTee),
    approach: round2(approach),
    shortGame: round2(shortGame),
    putting: round2(putting),
    total: round2(offTheTee + approach + shortGame + putting),
  };
}
