import { prisma } from "@/lib/prisma";
import {
  computeRoundDifferentials,
  handicapIndexFromDifferentials,
  applyCaps,
  type RoundForCompute,
} from "@/lib/whs";

// Advanced WHS soft cap / hard cap. Off by default — it limits upward movement
// of the Index relative to the Low Handicap Index over a trailing 12 months.
// Enable to apply it inside recomputeHandicap(). Documented in the README.
export const ENABLE_SOFT_HARD_CAP = false;

/**
 * Recompute every round's Adjusted Gross Score and Score Differential, and
 * rebuild the HandicapSnapshot trend, in chronological order. Call after any
 * round is created, edited, or deleted.
 *
 * Returns the current Handicap Index (or null if not yet established).
 */
export async function recomputeHandicap(): Promise<number | null> {
  const rounds = await prisma.round.findMany({
    orderBy: [{ datePlayed: "asc" }, { createdAt: "asc" }],
    include: {
      teeSet: true,
      holes: { orderBy: { holeNumber: "asc" } },
    },
  });

  const forCompute: RoundForCompute[] = rounds.map((r) => ({
    id: r.id,
    courseRating: r.teeSet.courseRating,
    slopeRating: r.teeSet.slopeRating,
    teePar: r.teeSet.par,
    pcc: r.pcc,
    holes: r.holes.map((h) => ({
      par: h.par,
      strokeIndex: h.strokeIndex,
      strokes: h.strokes,
    })),
  }));

  const results = computeRoundDifferentials(forCompute);
  const dateById = new Map(rounds.map((r) => [r.id, r.datePlayed]));

  // Optionally apply soft/hard caps to the running Index snapshots, using the
  // Low Handicap Index over the trailing 12 months at each point.
  const snapshots = results
    .filter((r) => r.indexAfter !== null)
    .map((r) => ({
      date: dateById.get(r.id)!,
      roundId: r.id,
      indexValue: r.indexAfter as number,
    }));

  if (ENABLE_SOFT_HARD_CAP) {
    for (let i = 0; i < snapshots.length; i++) {
      const cutoff = new Date(snapshots[i].date);
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      const trailing = snapshots
        .slice(0, i)
        .filter((s) => s.date >= cutoff)
        .map((s) => s.indexValue);
      const lowIndex = trailing.length ? Math.min(...trailing) : null;
      snapshots[i].indexValue = applyCaps(snapshots[i].indexValue, lowIndex);
    }
  }

  await prisma.$transaction([
    ...results.map((r) =>
      prisma.round.update({
        where: { id: r.id },
        data: {
          adjustedGrossScore: r.adjustedGrossScore,
          scoreDifferential: r.scoreDifferential,
        },
      }),
    ),
    prisma.handicapSnapshot.deleteMany({}),
    ...(snapshots.length
      ? [prisma.handicapSnapshot.createMany({ data: snapshots })]
      : []),
  ]);

  const lastEstablished = [...snapshots].pop();
  return lastEstablished ? lastEstablished.indexValue : null;
}

export type HandicapState = {
  index: number | null;
  established: boolean;
  roundCount: number;
  lowIndex: number | null;
  trend: { date: string; index: number }[];
};

/** Read the current handicap state for the dashboard and stats pages. */
export async function getHandicapState(): Promise<HandicapState> {
  const [roundCount, snapshots] = await Promise.all([
    prisma.round.count(),
    prisma.handicapSnapshot.findMany({ orderBy: { date: "asc" } }),
  ]);

  const trend = snapshots.map((s) => ({
    date: s.date.toISOString(),
    index: s.indexValue,
  }));

  const index = snapshots.length
    ? snapshots[snapshots.length - 1].indexValue
    : null;

  // Low Handicap Index over the trailing 12 months.
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - 1);
  const trailing = snapshots
    .filter((s) => s.date >= cutoff)
    .map((s) => s.indexValue);
  const lowIndex = trailing.length ? Math.min(...trailing) : null;

  return {
    index,
    established: index !== null,
    roundCount,
    lowIndex,
    trend,
  };
}

/** Re-export so callers needn't import whs directly for ad-hoc display. */
export { handicapIndexFromDifferentials };
