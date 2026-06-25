import { GoogleGenAI } from "@google/genai";
import type { RoundView } from "@/lib/rounds";
import type { HandicapState } from "@/lib/handicap";
import {
  computeWindows,
  computeStrokesGained,
  computeTrend,
  type StatsSummary,
} from "@/lib/stats";
import { computeShotStrokesGained } from "@/lib/strokes-gained";

// Gemini 2.5 Flash: fast, free-tier friendly, supports JSON-schema structured output.
export const COACH_MODEL = "gemini-2.5-flash";

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "GEMINI_API_KEY is not set. Add it to your .env to enable AI insights.",
    );
    this.name = "MissingApiKeyError";
  }
}

/** Returns a configured Gemini client, or throws a clear error when the key is missing. */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new MissingApiKeyError();
  return new GoogleGenAI({ apiKey });
}

function round1(x: number | null): number | null {
  return x == null ? null : Math.round(x * 10) / 10;
}

function summarize(s: StatsSummary) {
  return {
    rounds: s.rounds,
    scoringAvg: round1(s.scoringAvg),
    toParAvg: round1(s.toParAvg),
    par3Avg: round1(s.par3Avg),
    par4Avg: round1(s.par4Avg),
    par5Avg: round1(s.par5Avg),
    girPct: round1(s.girPct),
    fairwaysPct: s.firTracked ? round1(s.firPct) : null,
    puttsPerRound: round1(s.puttsPerRound),
    puttsPerGir: round1(s.puttsPerGir),
    threePuttsPerRound: round1(s.threePuttsPerRound),
    upAndDownPct: s.upDownTracked ? round1(s.upDownPct) : null,
    scramblingPct: round1(s.scramblingPct),
    sandSavePct: s.sandTracked ? round1(s.sandSavePct) : null,
    penaltiesPerRound: round1(s.penaltiesPerRound),
    doublesOrWorsePerRound: round1(s.doublesPerRound),
    holeDistribution: s.distribution,
  };
}

/**
 * Build a compact, grounded snapshot of the player's data for the model.
 * Everything here is computed from stored rounds — no invented numbers.
 */
export function buildCoachingPayload(
  roundsDesc: RoundView[],
  hcp: HandicapState,
) {
  const windows = computeWindows(roundsDesc);
  const sg = computeStrokesGained(windows.last20);
  const trend = computeTrend([...roundsDesc].reverse());

  // Real shot-by-shot strokes gained (Broadie baselines) when shot data exists.
  const shotTour = computeShotStrokesGained(roundsDesc, "tour");
  const shotScratch = computeShotStrokesGained(roundsDesc, "scratch");
  const shotLevelStrokesGained = shotTour
    ? {
        note: "Real per-shot strokes gained from the dial/shot data, via Broadie PGA Tour baselines. Negative = losing strokes vs that benchmark per round.",
        roundsWithShotData: shotTour.roundsWithShots,
        perRoundVsTour: {
          total: shotTour.totalPerRound,
          byCategory: shotTour.byCategory.map((c) => ({
            category: c.category,
            perRound: c.perRound,
          })),
        },
        perRoundVsScratch: shotScratch
          ? {
              total: shotScratch.totalPerRound,
              byCategory: shotScratch.byCategory.map((c) => ({
                category: c.category,
                perRound: c.perRound,
              })),
            }
          : null,
        approachByDistance: shotTour.approachBuckets
          .filter((b) => b.shots > 0)
          .map((b) => ({
            distance: b.label,
            shots: b.shots,
            sgPerShot: b.sgPerShot,
            greenPct: b.greenPct == null ? null : Math.round(b.greenPct),
            avgProximityFeet: b.avgProximityFeet,
          })),
        byStartingLie: shotTour.byLie.map((l) => ({
          lie: l.lie,
          shots: l.shots,
          sgPerShot: l.sgPerShot,
        })),
        missTendencies: {
          approach: shotTour.approachMiss,
          tee: shotTour.teeMiss,
        },
        putting: shotTour.puttingBuckets,
        penaltyStrokesPerRound: shotTour.penaltyStrokesPerRound,
      }
    : null;

  const recentRounds = roundsDesc.slice(0, 8).map((r) => {
    const total = r.totalStrokes ?? r.holes.reduce((a, h) => a + h.strokes, 0);
    return {
      date: r.datePlayed.toISOString().slice(0, 10),
      course: r.courseName,
      tee: `${r.teeName} (${r.courseRating}/${r.slopeRating})`,
      score: total,
      toPar: total - r.teePar,
      differential: r.scoreDifferential,
      putts: r.holes.reduce((a, h) => a + h.putts, 0),
      gir: r.holes.filter((h) => h.girHit).length,
      doublesOrWorse: r.holes.filter((h) => h.strokes - h.par >= 2).length,
    };
  });

  const indexTrend = trend
    .filter((t) => t.index != null)
    .map((t) => ({ date: t.date.slice(0, 10), index: t.index }));

  return {
    handicap: {
      index: hcp.index,
      established: hcp.established,
      roundCount: hcp.roundCount,
      lowIndexTrailing12mo: hcp.lowIndex,
    },
    scoringWindows: {
      last5: summarize(windows.last5),
      last20: summarize(windows.last20),
      allTime: summarize(windows.allTime),
    },
    approximateStrokesGained: sg,
    shotLevelStrokesGained,
    indexTrend,
    recentRounds,
  };
}
