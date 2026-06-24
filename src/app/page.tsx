import Link from "next/link";
import { getRounds } from "@/lib/rounds";
import { getHandicapState } from "@/lib/handicap";
import { getInsightReports } from "@/lib/insights";
import { computeStats } from "@/lib/stats";
import { fmtIndex, fmtNum, fmtPct } from "@/lib/format";
import {
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  StatTile,
} from "@/components/ui";
import { TrendLineChart } from "@/components/charts";
import { MIN_ROUNDS_TO_ESTABLISH } from "@/lib/whs";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [rounds, hcp, insightReports] = await Promise.all([
    getRounds(),
    getHandicapState(),
    getInsightReports(5),
  ]);
  const latestInsight = insightReports.find((r) => r.kind === "insight");

  if (rounds.length === 0) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Your handicap at a glance" />
        <EmptyState
          title="No rounds yet"
          description="Log your first round to start tracking your handicap and stats."
          action={
            <div className="flex gap-2">
              <LinkButton href="/rounds/new">Log a round</LinkButton>
              <LinkButton href="/courses" variant="ghost">
                Manage courses
              </LinkButton>
            </div>
          }
        />
      </div>
    );
  }

  const recent = computeStats(rounds.slice(0, 20));
  const trendData = hcp.trend.map((t) => ({
    label: new Date(t.date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    index: t.index,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        subtitle="Your handicap and recent form"
        action={<LinkButton href="/rounds/new">+ New round</LinkButton>}
      />

      {/* Handicap hero */}
      <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">
            Handicap Index
          </p>
          {hcp.established ? (
            <p className="text-5xl font-semibold tabular-nums">
              {fmtIndex(hcp.index)}
            </p>
          ) : (
            <div>
              <p className="text-2xl font-semibold">Not yet established</p>
              <p className="text-sm text-muted">
                {hcp.roundCount}/{MIN_ROUNDS_TO_ESTABLISH} rounds — log{" "}
                {Math.max(0, MIN_ROUNDS_TO_ESTABLISH - hcp.roundCount)} more.
              </p>
            </div>
          )}
          {hcp.established && hcp.lowIndex !== null && (
            <p className="mt-1 text-xs text-muted">
              Low Index (12 mo): {fmtIndex(hcp.lowIndex)} · {hcp.roundCount} rounds
            </p>
          )}
        </div>
        <div className="w-full sm:w-1/2">
          <TrendLineChart
            data={trendData}
            lines={[{ key: "index", label: "Index", color: "var(--color-accent)" }]}
            height={150}
            reversed
          />
        </div>
      </Card>

      {/* Stat tiles (last 20 rounds) */}
      <div>
        <h2 className="mb-2 text-sm font-medium text-muted">
          Recent form · last {Math.min(20, rounds.length)} rounds
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile label="Scoring avg" value={fmtNum(recent.scoringAvg)} sub={`${recent.toParAvg != null ? (recent.toParAvg > 0 ? "+" : "") + recent.toParAvg.toFixed(1) : "—"} to par`} />
          <StatTile label="GIR" value={fmtPct(recent.girPct)} />
          <StatTile label="Fairways" value={recent.firTracked ? fmtPct(recent.firPct) : "—"} />
          <StatTile label="Putts / rd" value={fmtNum(recent.puttsPerRound)} />
          <StatTile
            label="Up & down"
            value={recent.upDownTracked ? fmtPct(recent.upDownPct) : "—"}
          />
          <StatTile label="Doubles+ / rd" value={fmtNum(recent.doublesPerRound)} />
          <StatTile label="Putts / GIR" value={fmtNum(recent.puttsPerGir, 2)} />
          <StatTile label="Penalties / rd" value={fmtNum(recent.penaltiesPerRound, 1)} />
          <StatTile label="Scrambling" value={fmtPct(recent.scramblingPct)} />
          <StatTile label="3-putt avoid" value={fmtPct(recent.threePuttAvoidancePct)} />
        </div>
      </div>

      {/* Latest insight */}
      <Card className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium">AI coaching insights</p>
          <Link href="/insights" className="text-sm font-medium text-accent">
            Open →
          </Link>
        </div>
        {latestInsight && latestInsight.kind === "insight" ? (
          <div>
            <p className="text-sm">{latestInsight.insight.headline}</p>
            {latestInsight.insight.weaknesses[0] && (
              <p className="mt-1 text-xs text-muted">
                Top focus: {latestInsight.insight.weaknesses[0].area} —{" "}
                {latestInsight.insight.weaknesses[0].impactSummary}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">
            Generate weaknesses, what&apos;s improving, and practice priorities
            from your data.
          </p>
        )}
      </Card>
    </div>
  );
}
