import { getRounds } from "@/lib/rounds";
import { getHandicapState } from "@/lib/handicap";
import {
  computeWindows,
  computeStrokesGained,
  computeTrend,
  ENABLE_STROKES_GAINED,
} from "@/lib/stats";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import StatsView from "./StatsView";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const [roundsDesc, hcp] = await Promise.all([getRounds(), getHandicapState()]);

  if (roundsDesc.length === 0) {
    return (
      <div>
        <PageHeader title="Stats" subtitle="Performance metrics and trends" />
        <EmptyState
          title="No rounds yet"
          description="Log a round to see your stats and trends."
          action={<LinkButton href="/rounds/new">+ New round</LinkButton>}
        />
      </div>
    );
  }

  const windows = computeWindows(roundsDesc);
  const strokesGained = {
    last5: computeStrokesGained(windows.last5),
    last20: computeStrokesGained(windows.last20),
    allTime: computeStrokesGained(windows.allTime),
  };

  const indexByDate = new Map(hcp.trend.map((t) => [t.date, t.index]));
  const roundsAsc = [...roundsDesc].reverse();
  const trend = computeTrend(roundsAsc, indexByDate);

  return (
    <div>
      <PageHeader
        title="Stats"
        subtitle="Performance metrics and trends"
        action={<LinkButton href="/rounds/new">+ New round</LinkButton>}
      />
      <StatsView
        windows={windows}
        strokesGained={strokesGained}
        trend={trend}
        enableStrokesGained={ENABLE_STROKES_GAINED}
      />
    </div>
  );
}
