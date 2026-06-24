import Anthropic from "@anthropic-ai/sdk";
import type { RoundView } from "@/lib/rounds";
import type { HandicapState } from "@/lib/handicap";
import {
  computeWindows,
  computeStrokesGained,
  computeTrend,
  type StatsSummary,
} from "@/lib/stats";

export const COACH_MODEL = "claude-opus-4-8";

/** Returns a configured client, or throws a clear error when the key is missing. */
export function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new MissingApiKeyError();
  }
  return new Anthropic({ apiKey });
}

export class MissingApiKeyError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Add it to your .env to enable AI insights.",
    );
    this.name = "MissingApiKeyError";
  }
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

  const recentRounds = roundsDesc.slice(0, 8).map((r) => {
    const total =
      r.totalStrokes ?? r.holes.reduce((a, h) => a + h.strokes, 0);
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
    indexTrend,
    recentRounds,
  };
}

/** Pull concatenated text out of a Claude message response. */
export function textFromMessage(content: Anthropic.Messages.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}
