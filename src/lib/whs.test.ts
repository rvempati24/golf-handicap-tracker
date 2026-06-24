import { describe, it, expect } from "vitest";
import {
  roundToTenth,
  roundHalfUp,
  scoreDifferential,
  courseHandicap,
  strokesReceivedOnHole,
  netDoubleBogey,
  adjustedGrossScore,
  selectionFor,
  handicapIndexFromDifferentials,
  applyCaps,
  computeRoundDifferentials,
  MAX_HANDICAP_INDEX,
  type HoleScore,
  type RoundForCompute,
} from "./whs";

// ── Rounding ───────────────────────────────────────────────────────────────
describe("rounding", () => {
  it("rounds half-up to a tenth, robust to float error", () => {
    // The USGA example resolves to 15.95, which must round to 16.0.
    expect(roundToTenth(15.95)).toBe(16.0);
    expect(roundToTenth(13.80214)).toBe(13.8);
    expect(roundToTenth(17.7125)).toBe(17.7);
    expect(roundToTenth(0.04999999)).toBe(0.0);
    expect(roundToTenth(-2.05)).toBe(-2.0); // half up toward +inf
  });

  it("rounds half-up to whole numbers", () => {
    expect(roundHalfUp(20.723)).toBe(21);
    expect(roundHalfUp(20.5)).toBe(21);
    expect(roundHalfUp(-2.5)).toBe(-2);
    expect(roundHalfUp(19.49)).toBe(19);
  });
});

// ── Score Differential ───────────────────────────────────────────────────
describe("scoreDifferential", () => {
  it("computes (113/Slope)(AGS - CR - PCC) to one decimal", () => {
    // (113/140)(90 - 72.9 - 0) = 13.802... → 13.8
    expect(
      scoreDifferential({
        adjustedGrossScore: 90,
        courseRating: 72.9,
        slopeRating: 140,
        pcc: 0,
      }),
    ).toBe(13.8);
  });

  it("subtracts PCC", () => {
    // (113/113)(85 - 70 - 1) = 14.0
    expect(
      scoreDifferential({
        adjustedGrossScore: 85,
        courseRating: 70,
        slopeRating: 113,
        pcc: 1,
      }),
    ).toBe(14.0);
  });
});

// ── Course Handicap ────────────────────────────────────────────────────────
describe("courseHandicap", () => {
  it("applies Index x Slope/113 + (CR - Par), rounded", () => {
    // 16.0 * 140/113 + (72.9 - 72) = 20.723 → 21
    expect(
      courseHandicap({
        handicapIndex: 16.0,
        slopeRating: 140,
        courseRating: 72.9,
        par: 72,
      }),
    ).toBe(21);
  });

  it("supports plus (negative) handicaps", () => {
    // -1.4 * 113/113 + (70 - 72) = -3.4 → -3
    expect(
      courseHandicap({
        handicapIndex: -1.4,
        slopeRating: 113,
        courseRating: 70,
        par: 72,
      }),
    ).toBe(-3);
  });
});

// ── Strokes received / Net Double Bogey ─────────────────────────────────────
describe("strokesReceivedOnHole", () => {
  it("distributes the remainder to the lowest stroke indexes", () => {
    // Course handicap 20: SI 1 & 2 get 2, the rest get 1. Total = 20.
    expect(strokesReceivedOnHole(20, 1)).toBe(2);
    expect(strokesReceivedOnHole(20, 2)).toBe(2);
    expect(strokesReceivedOnHole(20, 3)).toBe(1);
    let total = 0;
    for (let si = 1; si <= 18; si++) total += strokesReceivedOnHole(20, si);
    expect(total).toBe(20);
  });

  it("handles course handicap of 10 and 0", () => {
    expect(strokesReceivedOnHole(10, 10)).toBe(1);
    expect(strokesReceivedOnHole(10, 11)).toBe(0);
    expect(strokesReceivedOnHole(0, 1)).toBe(0);
  });

  it("gives strokes back from the easiest holes for plus handicaps", () => {
    // Course handicap -2: SI 18 and 17 receive -1; total = -2.
    expect(strokesReceivedOnHole(-2, 18)).toBe(-1);
    expect(strokesReceivedOnHole(-2, 17)).toBe(-1);
    expect(strokesReceivedOnHole(-2, 16)).toBe(0);
    let total = 0;
    for (let si = 1; si <= 18; si++) total += strokesReceivedOnHole(-2, si);
    expect(total).toBe(-2);
  });

  it("computes net double bogey", () => {
    expect(netDoubleBogey(4, 1)).toBe(7);
    expect(netDoubleBogey(3, 0)).toBe(5);
  });
});

// ── Adjusted Gross Score ────────────────────────────────────────────────────
function holes(strokesByHole: number[], pars: number[], si: number[]): HoleScore[] {
  return strokesByHole.map((strokes, i) => ({
    par: pars[i],
    strokeIndex: si[i],
    strokes,
  }));
}

const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 5, 3, 4, 4, 3, 5, 4]; // par 72
const SI = [7, 3, 15, 1, 11, 5, 17, 13, 9, 4, 8, 2, 18, 6, 12, 16, 10, 14];

describe("adjustedGrossScore", () => {
  it("caps each hole at Par + 5 when no Index is established", () => {
    const scores = [...PARS]; // all pars = gross 72
    scores[0] = 12; // par 4 blow-up → capped at 9
    const h = holes(scores, PARS, SI);
    // Gross would be 72 - 4 + 12 = 80; capped contribution is 9 → AGS 77.
    expect(adjustedGrossScore(h, null)).toBe(77);
  });

  it("caps each hole at Net Double Bogey when a Course Handicap exists", () => {
    // Course handicap 18 → every hole gets 1 stroke → NDB = par + 3.
    const scores = [...PARS];
    scores[0] = 12; // par 4 → NDB = 7 → capped
    scores[3] = 6; // par 5 → NDB = 8 → not capped, stays 6
    const h = holes(scores, PARS, SI);
    // Base par 72; hole0 +3 over par capped to +3 (7 vs par4 => +3); hole3 +1.
    // 72 - 4 + 7 = 75, then - 5 + 6 = 76.
    expect(adjustedGrossScore(h, 18)).toBe(76);
  });

  it("does not cap scores at or below the maximum", () => {
    const h = holes([...PARS], PARS, SI);
    expect(adjustedGrossScore(h, null)).toBe(72);
    expect(adjustedGrossScore(h, 18)).toBe(72);
  });
});

// ── Selection table ─────────────────────────────────────────────────────────
describe("selectionFor", () => {
  it("matches the published WHS table", () => {
    expect(selectionFor(2)).toBeNull();
    expect(selectionFor(3)).toEqual({ count: 1, adjustment: -2.0 });
    expect(selectionFor(4)).toEqual({ count: 1, adjustment: -1.0 });
    expect(selectionFor(5)).toEqual({ count: 1, adjustment: 0 });
    expect(selectionFor(6)).toEqual({ count: 2, adjustment: -1.0 });
    expect(selectionFor(7)).toEqual({ count: 2, adjustment: 0 });
    expect(selectionFor(8)).toEqual({ count: 2, adjustment: 0 });
    expect(selectionFor(9)).toEqual({ count: 3, adjustment: 0 });
    expect(selectionFor(11)).toEqual({ count: 3, adjustment: 0 });
    expect(selectionFor(12)).toEqual({ count: 4, adjustment: 0 });
    expect(selectionFor(14)).toEqual({ count: 4, adjustment: 0 });
    expect(selectionFor(15)).toEqual({ count: 5, adjustment: 0 });
    expect(selectionFor(16)).toEqual({ count: 5, adjustment: 0 });
    expect(selectionFor(17)).toEqual({ count: 6, adjustment: 0 });
    expect(selectionFor(18)).toEqual({ count: 6, adjustment: 0 });
    expect(selectionFor(19)).toEqual({ count: 7, adjustment: 0 });
    expect(selectionFor(20)).toEqual({ count: 8, adjustment: 0 });
  });
});

// ── Handicap Index ──────────────────────────────────────────────────────────
describe("handicapIndexFromDifferentials", () => {
  it("returns null below the 3-round minimum", () => {
    expect(handicapIndexFromDifferentials([])).toBeNull();
    expect(handicapIndexFromDifferentials([10.0])).toBeNull();
    expect(handicapIndexFromDifferentials([10.0, 11.0])).toBeNull();
  });

  it("USGA worked example: 6 differentials → lowest 2, -1.0 → 16.0", () => {
    // lowest two are 16.8 and 17.1: (16.8 + 17.1)/2 - 1.0 = 15.95 → 16.0
    const diffs = [16.8, 17.1, 20.0, 21.0, 22.0, 23.0];
    expect(handicapIndexFromDifferentials(diffs)).toBe(16.0);
  });

  it("exactly 3 differentials → lowest 1, adjustment -2.0", () => {
    expect(handicapIndexFromDifferentials([10.0, 12.0, 15.0])).toBe(8.0);
  });

  it("4 differentials → lowest 1, adjustment -1.0", () => {
    expect(handicapIndexFromDifferentials([10.0, 12.0, 15.0, 18.0])).toBe(9.0);
  });

  it("5 differentials → lowest 1, adjustment 0", () => {
    expect(
      handicapIndexFromDifferentials([10.0, 12.0, 15.0, 18.0, 20.0]),
    ).toBe(10.0);
  });

  it("19 differentials → lowest 7, adjustment 0", () => {
    const diffs = Array.from({ length: 19 }, (_, i) => 10 + i); // 10..28
    // lowest 7: 10..16 → avg 13.0
    expect(handicapIndexFromDifferentials(diffs)).toBe(13.0);
  });

  it("full 20-differential record → average of lowest 8", () => {
    const diffs = [
      20.5, 18.2, 22.1, 19.8, 17.4, 21.0, 16.9, 23.3, 18.8, 20.1, 19.2, 17.7,
      24.0, 18.5, 21.6, 16.2, 22.8, 19.0, 20.9, 18.0,
    ];
    // lowest 8: 16.2,16.9,17.4,17.7,18.0,18.2,18.5,18.8 → 141.7/8 = 17.7125 → 17.7
    expect(handicapIndexFromDifferentials(diffs)).toBe(17.7);
  });

  it("only considers the most recent 20 scores", () => {
    // 25 differentials; the oldest 5 are very low and must be ignored.
    const old = [1, 1, 1, 1, 1];
    const recent20 = Array(20).fill(20.0);
    expect(handicapIndexFromDifferentials([...old, ...recent20])).toBe(20.0);
  });

  it("caps the Index at 54.0", () => {
    const diffs = Array(20).fill(80.0);
    expect(handicapIndexFromDifferentials(diffs)).toBe(MAX_HANDICAP_INDEX);
  });
});

// ── Soft cap / hard cap ─────────────────────────────────────────────────────
describe("applyCaps", () => {
  it("does nothing within 3.0 of the Low Handicap Index", () => {
    expect(applyCaps(12.5, 10.0)).toBe(12.5);
    expect(applyCaps(13.0, 10.0)).toBe(13.0);
  });

  it("soft-caps increases beyond 3.0 by 50%", () => {
    // Low 10.0, raw 15.0 → 3 free + (2.0 * 0.5) = 10 + 3 + 1 = 14.0
    expect(applyCaps(15.0, 10.0)).toBe(14.0);
  });

  it("hard-caps total increase at 5.0", () => {
    // Low 10.0, raw 30.0 → soft would be 10+3+8.5=21.5, hard ceiling 15.0
    expect(applyCaps(30.0, 10.0)).toBe(15.0);
  });

  it("no-op when there is no Low Handicap Index yet", () => {
    expect(applyCaps(20.0, null)).toBe(20.0);
  });
});

// ── Round-by-round orchestration ────────────────────────────────────────────
function makeRound(id: string, strokesByHole: number[]): RoundForCompute {
  return {
    id,
    courseRating: 72.9,
    slopeRating: 140,
    teePar: 72,
    pcc: 0,
    holes: holes(strokesByHole, PARS, SI),
  };
}

describe("computeRoundDifferentials", () => {
  it("uses Par+5 until established, then Net Double Bogey", () => {
    // Four identical rounds with one big blow-up on hole 1 (par 4, strokes 12).
    const scores = [...PARS];
    scores[0] = 12;
    const rounds = [
      makeRound("r1", scores),
      makeRound("r2", scores),
      makeRound("r3", scores),
      makeRound("r4", scores),
    ];
    const res = computeRoundDifferentials(rounds);

    // Index only establishes after the 3rd differential exists.
    expect(res[0].indexAfter).toBeNull();
    expect(res[1].indexAfter).toBeNull();
    expect(res[2].indexAfter).not.toBeNull();

    // Rounds 1-3 use the Par+5 cap (no prior Index): hole1 12 → 9 → AGS 77.
    expect(res[0].adjustedGrossScore).toBe(77);
    expect(res[1].adjustedGrossScore).toBe(77);
    expect(res[2].adjustedGrossScore).toBe(77);

    // Round 4 has a prior Index, so hole 1 is capped at Net Double Bogey,
    // which is lower than Par+5 here → a smaller AGS.
    expect(res[3].adjustedGrossScore).toBeLessThan(77);
  });

  it("produces a differential and running Index for each round", () => {
    const rounds = Array.from({ length: 5 }, (_, i) =>
      makeRound(`r${i}`, [...PARS]),
    );
    const res = computeRoundDifferentials(rounds);
    expect(res).toHaveLength(5);
    // All even-par rounds → differential (113/140)(72 - 72.9) = -0.7
    for (const r of res) expect(r.scoreDifferential).toBe(-0.7);
    // After 5 even-par rounds: lowest 1 of 5, adj 0 → -0.7
    expect(res[4].indexAfter).toBe(-0.7);
  });
});
