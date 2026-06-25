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
  SectionTitle,
  StatTile,
} from "@/components/ui";
import { TrendLineChart } from "@/components/charts";
import { MIN_ROUNDS_TO_ESTABLISH } from "@/lib/whs";
import { FlagIcon, PlusIcon } from "@/components/icons";
import { OwnerOnly } from "@/components/OwnerOnly";
import DashboardInsightCard from "./DashboardInsightCard";

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
          icon={<FlagIcon width={22} height={22} />}
          title="No rounds yet"
          description="Log your first round to start tracking your handicap and stats."
          action={
            <OwnerOnly>
              <div className="flex gap-2">
                <LinkButton href="/rounds/new">Log a round</LinkButton>
                <LinkButton href="/courses" variant="ghost">
                  Manage courses
                </LinkButton>
              </div>
            </OwnerOnly>
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
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Dashboard"
        subtitle="Your handicap and recent form"
        action={
          <OwnerOnly>
            <LinkButton href="/rounds/new">
              <PlusIcon width={16} height={16} />
              New round
            </LinkButton>
          </OwnerOnly>
        }
      />

      {/* Handicap hero */}
      <Card className="overflow-hidden p-0">
        <div className="grid gap-0 sm:grid-cols-[1fr_1.3fr]">
          <div className="flex flex-col justify-center gap-2 border-b border-border bg-accent-soft p-6 sm:border-b-0 sm:border-r">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              Handicap Index
            </span>
            {hcp.established ? (
              <>
                <span className="font-display text-6xl font-medium leading-none tabular-nums text-foreground">
                  {fmtIndex(hcp.index)}
                </span>
                <span className="text-xs text-muted">
                  {hcp.lowIndex !== null && (
                    <>Low {fmtIndex(hcp.lowIndex)} (12&nbsp;mo) · </>
                  )}
                  {hcp.roundCount} rounds
                </span>
              </>
            ) : (
              <>
                <span className="font-display text-2xl font-medium leading-tight">
                  Not yet established
                </span>
                <span className="text-sm text-muted">
                  {hcp.roundCount}/{MIN_ROUNDS_TO_ESTABLISH} rounds — log{" "}
                  {Math.max(0, MIN_ROUNDS_TO_ESTABLISH - hcp.roundCount)} more to
                  get an index.
                </span>
              </>
            )}
          </div>
          <div className="p-4">
            <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-muted">
              Index trend
            </p>
            <TrendLineChart
              data={trendData}
              lines={[
                { key: "index", label: "Index", color: "var(--color-accent)" },
              ]}
              height={150}
              reversed
            />
          </div>
        </div>
      </Card>

      {/* Stat tiles */}
      <div>
        <SectionTitle>
          Recent form · last {Math.min(20, rounds.length)} rounds
        </SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatTile
            label="Scoring avg"
            value={fmtNum(recent.scoringAvg)}
            sub={`${recent.toParAvg != null ? (recent.toParAvg > 0 ? "+" : "") + recent.toParAvg.toFixed(1) : "—"} to par`}
            accent
          />
          <StatTile label="GIR" value={fmtPct(recent.girPct)} />
          <StatTile
            label="Fairways"
            value={recent.firTracked ? fmtPct(recent.firPct) : "—"}
          />
          <StatTile label="Putts / rd" value={fmtNum(recent.puttsPerRound)} />
          <StatTile
            label="Up & down"
            value={recent.upDownTracked ? fmtPct(recent.upDownPct) : "—"}
          />
          <StatTile label="Doubles+ / rd" value={fmtNum(recent.doublesPerRound)} />
          <StatTile label="Putts / GIR" value={fmtNum(recent.puttsPerGir, 2)} />
          <StatTile
            label="Penalties / rd"
            value={fmtNum(recent.penaltiesPerRound, 1)}
          />
          <StatTile label="Scrambling" value={fmtPct(recent.scramblingPct)} />
          <StatTile label="3-putt avoid" value={fmtPct(recent.threePuttAvoidancePct)} />
        </div>
      </div>

      {/* Latest insight — only routes into Insights when owner-unlocked. */}
      <DashboardInsightCard
        headline={
          latestInsight && latestInsight.kind === "insight"
            ? latestInsight.insight.headline
            : null
        }
        topFocus={
          latestInsight &&
          latestInsight.kind === "insight" &&
          latestInsight.insight.weaknesses[0]
            ? `${latestInsight.insight.weaknesses[0].area} — ${latestInsight.insight.weaknesses[0].impactSummary}`
            : null
        }
      />
    </div>
  );
}
