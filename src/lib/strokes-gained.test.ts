import { describe, it, expect } from "vitest";
import { expectedStrokes, expectedPutts } from "./sg-baseline";
import { computeHoleSG, computeShotStrokesGained } from "./strokes-gained";
import type { RoundView, ShotView, HoleResultView } from "./rounds";

describe("sg-baseline", () => {
  it("matches Broadie's published anchor values", () => {
    // Table 9 exact rows.
    expect(expectedStrokes("fairway", 40)).toBeCloseTo(2.6, 5);
    expect(expectedStrokes("fairway", 100)).toBeCloseTo(2.8, 5);
    expect(expectedStrokes("rough", 200)).toBeCloseTo(3.42, 5);
    expect(expectedStrokes("tee", 400)).toBeCloseTo(3.99, 5);
    // Putting anchors (paper: ~1.1 from 4 ft, ~1.8 from 16 ft).
    expect(expectedPutts(4)).toBeCloseTo(1.147, 3);
    // Paper states ~1.8 from 16 ft; 16 ft is interpolated between the 15/20 rows.
    expect(expectedPutts(16)).toBeCloseTo(1.81, 2);
  });

  it("interpolates linearly between rows", () => {
    // Fairway 140 = 2.91, 160 = 2.98 → 150 = 2.945.
    expect(expectedStrokes("fairway", 150)).toBeCloseTo(2.945, 5);
  });
});

function putt(shotNumber: number, feet: number, holed: boolean): ShotView {
  return {
    holeNumber: 1,
    shotNumber,
    club: "Putter",
    shotType: "putt",
    startDistanceYards: feet, // putts are stored in feet
    endDistanceYards: null,
    startLie: "green",
    endLie: holed ? "holed" : "green",
    result: holed ? "holed" : null,
    penalty: false,
  };
}

describe("computeHoleSG", () => {
  // Par 4, 400 yds: drive to fairway @150, approach to 20 ft, lag to 2 ft, tap-in.
  const shots: ShotView[] = [
    {
      holeNumber: 1,
      shotNumber: 1,
      club: "Driver",
      shotType: "tee",
      startDistanceYards: 250, // drive length — ignored; hole yardage anchors
      endDistanceYards: null,
      startLie: "tee",
      endLie: "fairway",
      result: "fairway",
      penalty: false,
    },
    {
      holeNumber: 1,
      shotNumber: 2,
      club: "8i",
      shotType: "approach",
      startDistanceYards: 150,
      endDistanceYards: null,
      startLie: "fairway",
      endLie: "green",
      result: "green",
      penalty: false,
    },
    putt(3, 20, false),
    putt(4, 2, true),
  ];

  it("obeys the additivity property (sum SG = E(tee) - strokes)", () => {
    const sg = computeHoleSG(shots, 400, 4);
    expect(sg).toHaveLength(4);
    const total = sg.reduce((a, s) => a + s.sg, 0);
    // 4 strokes taken, benchmark from the tee at 400 yds = 3.99.
    expect(total).toBeCloseTo(3.99 - 4, 5);
  });

  it("assigns the right categories", () => {
    const sg = computeHoleSG(shots, 400, 4);
    expect(sg.map((s) => s.category)).toEqual([
      "offTheTee",
      "approach",
      "putting",
      "putting",
    ]);
  });

  it("counts a penalty stroke against the offending shot", () => {
    const withPenalty: ShotView[] = [
      {
        holeNumber: 1,
        shotNumber: 1,
        club: "Driver",
        shotType: "tee",
        startDistanceYards: 250,
        endDistanceYards: null,
        startLie: "tee",
        endLie: "rough",
        result: "water",
        penalty: true,
      },
      {
        holeNumber: 1,
        shotNumber: 2,
        club: "Driver",
        shotType: "approach",
        startDistanceYards: 230,
        endDistanceYards: null,
        startLie: "rough",
        endLie: "green",
        result: "green",
        penalty: false,
      },
      putt(3, 15, false),
      putt(4, 1, true),
    ];
    const sg = computeHoleSG(withPenalty, 460, 5);
    // 5 strokes incl. the penalty; benchmark from the tee at 460 = 4.17.
    const total = sg.reduce((a, s) => a + s.sg, 0);
    expect(total).toBeCloseTo(4.17 - 5, 5);
    // The water ball should be the worst shot of the hole.
    expect(sg[0].sg).toBeLessThan(sg[1].sg);
  });

  it("skips holes whose shot chain never holes out", () => {
    const incomplete = shots.slice(0, 2); // no holed putt
    expect(computeHoleSG(incomplete, 400, 4)).toEqual([]);
  });

  it("skips holes that cannot be anchored to a distance", () => {
    // Par 4 tee shot with no hole yardage → not anchorable.
    expect(computeHoleSG(shots, null, 4)).toEqual([]);
  });
});

describe("computeShotStrokesGained", () => {
  function holeResult(n: number, par: number): HoleResultView {
    return {
      holeNumber: n,
      par,
      strokeIndex: n,
      strokes: par,
      putts: 2,
      girHit: true,
      fairwayHit: true,
      penalties: 0,
      upDownAttempt: false,
      upDownSuccess: false,
      sandAttempt: false,
      sandSuccess: false,
      driveDistance: null,
    };
  }

  const round: RoundView = {
    id: "r",
    datePlayed: new Date("2026-06-01"),
    courseId: "c",
    teeSetId: "t",
    courseName: "Test",
    teeName: "Blue",
    courseRating: 72,
    slopeRating: 130,
    teePar: 72,
    pcc: 0,
    notes: null,
    weather: null,
    totalStrokes: 4,
    adjustedGrossScore: null,
    scoreDifferential: null,
    yardages: [400, ...Array(17).fill(null)],
    holes: [holeResult(1, 4)],
    shots: [
      {
        holeNumber: 1,
        shotNumber: 1,
        club: "Driver",
        shotType: "tee",
        startDistanceYards: 250,
        endDistanceYards: null,
        startLie: "tee",
        endLie: "fairway",
        result: "fairway",
        penalty: false,
      },
      {
        holeNumber: 1,
        shotNumber: 2,
        club: "8i",
        shotType: "approach",
        startDistanceYards: 150,
        endDistanceYards: null,
        startLie: "fairway",
        endLie: "green",
        result: "green",
        penalty: false,
      },
      putt(3, 20, false),
      putt(4, 2, true),
    ],
  };

  it("aggregates one round of shot data", () => {
    const report = computeShotStrokesGained([round]);
    expect(report).not.toBeNull();
    expect(report!.roundsWithShots).toBe(1);
    expect(report!.totalShots).toBe(4);
    const approach = report!.byCategory.find((c) => c.category === "approach");
    expect(approach!.shots).toBe(1);
    // The 150-yd approach finished on the green at 20 ft (150 ∈ [150,175)).
    const bucket = report!.approachBuckets.find((b) => b.label === "150–175");
    expect(bucket!.shots).toBe(1);
    expect(bucket!.greenPct).toBe(100);
  });

  it("returns null when no round carries shot data", () => {
    const bare: RoundView = { ...round, shots: [] };
    expect(computeShotStrokesGained([bare])).toBeNull();
  });

  it("scores higher SG against scratch than against tour", () => {
    const tour = computeShotStrokesGained([round], "tour");
    const scratch = computeShotStrokesGained([round], "scratch");
    expect(tour!.benchmark).toBe("tour");
    expect(scratch!.benchmark).toBe("scratch");
    // The scratch benchmark is easier to beat, so the same shots gain more.
    expect(scratch!.totalPerRound).toBeGreaterThan(tour!.totalPerRound);
  });
});
