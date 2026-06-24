import { describe, it, expect } from "vitest";
import { computeStats } from "./stats";
import type { RoundView, HoleResultView } from "./rounds";

const PARS = [4, 4, 3, 5, 4, 4, 3, 4, 5, 4, 4, 5, 3, 4, 4, 3, 5, 4];
const SI = [7, 3, 15, 1, 11, 5, 17, 13, 9, 4, 8, 2, 18, 6, 12, 16, 10, 14];

function hole(i: number, over: number, putts: number, opts: Partial<HoleResultView> = {}): HoleResultView {
  const par = PARS[i];
  const strokes = par + over;
  return {
    holeNumber: i + 1,
    par,
    strokeIndex: SI[i],
    strokes,
    putts,
    girHit: opts.girHit ?? strokes - putts <= par - 2,
    fairwayHit:
      "fairwayHit" in opts ? opts.fairwayHit! : par === 3 ? null : true,
    penalties: opts.penalties ?? 0,
    upDownAttempt: opts.upDownAttempt ?? false,
    upDownSuccess: opts.upDownSuccess ?? false,
    sandAttempt: opts.sandAttempt ?? false,
    sandSuccess: opts.sandSuccess ?? false,
    driveDistance: null,
  };
}

function round(holes: HoleResultView[]): RoundView {
  return {
    id: "r",
    datePlayed: new Date("2026-06-01"),
    courseId: "c",
    teeSetId: "t",
    courseName: "Test",
    teeName: "Black",
    courseRating: 72.9,
    slopeRating: 140,
    teePar: 72,
    pcc: 0,
    notes: null,
    weather: null,
    totalStrokes: holes.reduce((a, h) => a + h.strokes, 0),
    adjustedGrossScore: null,
    scoreDifferential: null,
    holes,
    shots: [],
  };
}

describe("computeStats", () => {
  it("computes a clean even-par round", () => {
    const holes = PARS.map((_, i) => hole(i, 0, 2)); // every hole par, GIR, 2 putts
    const s = computeStats([round(holes)]);
    expect(s.rounds).toBe(1);
    expect(s.scoringAvg).toBe(72);
    expect(s.toParAvg).toBe(0);
    expect(s.girPct).toBe(100);
    expect(s.puttsPerRound).toBe(36);
    expect(s.puttsPerGir).toBe(2);
    expect(s.threePuttsPerRound).toBe(0);
    expect(s.distribution.pars).toBe(18);
    // 14 par-4/5 holes are fairways (par 3s excluded); all hit.
    expect(s.firPct).toBe(100);
  });

  it("computes GIR%, scrambling, up-and-down, and distribution", () => {
    // Hole 1: bogey, missed GIR, up&down attempted+made (par-or-better? no, bogey)
    const holes = PARS.map((_, i) => hole(i, 0, 2));
    // Make hole 1 a missed-green bogey with a made up-and-down that failed to save par.
    holes[0] = hole(0, 1, 1, {
      girHit: false,
      fairwayHit: false,
      upDownAttempt: true,
      upDownSuccess: true,
    });
    // Make hole 2 a missed-green par save (scramble success).
    holes[1] = hole(1, 0, 1, {
      girHit: false,
      upDownAttempt: true,
      upDownSuccess: true,
    });
    const s = computeStats([round(holes)]);

    expect(s.girPct).toBeCloseTo((16 / 18) * 100, 5);
    // Missed greens: holes 1 and 2. Par-or-better on those: only hole 2.
    expect(s.scramblingPct).toBe(50);
    // Up-and-down attempts: 2, both made.
    expect(s.upDownPct).toBe(100);
    expect(s.distribution.bogeys).toBe(1);
    expect(s.distribution.pars).toBe(17);
  });

  it("returns nulls for untracked categories", () => {
    const holes = PARS.map((_, i) =>
      hole(i, 0, 2, { fairwayHit: null, sandAttempt: false }),
    );
    const s = computeStats([round(holes)]);
    expect(s.firPct).toBeNull();
    expect(s.firTracked).toBe(false);
    expect(s.sandSavePct).toBeNull();
    expect(s.upDownPct).toBeNull();
  });
});
