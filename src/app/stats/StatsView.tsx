"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { TrendLineChart } from "@/components/charts";
import { WarningIcon } from "@/components/icons";
import { fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import type { StatsSummary, StrokesGained, TrendPoint } from "@/lib/stats";
import type { ShotSgReport } from "@/lib/strokes-gained";
import { BENCHMARK_LABEL, type Benchmark } from "@/lib/sg-baseline";
import AdvancedStrokesGained from "./AdvancedStrokesGained";

type WindowKey = "last5" | "last20" | "allTime";
const WINDOW_LABELS: Record<WindowKey, string> = {
  last5: "Last 5",
  last20: "Last 20",
  allTime: "All time",
};

type MetricKey = keyof typeof METRICS;
const METRICS = {
  index: { label: "Handicap Index", key: "index", reversed: true, pct: false },
  toPar: { label: "Score to par", key: "toPar", reversed: true, pct: false },
  girPct: { label: "GIR %", key: "girPct", reversed: false, pct: true },
  firPct: { label: "Fairways %", key: "firPct", reversed: false, pct: true },
  putts: { label: "Putts", key: "putts", reversed: true, pct: false },
  upDownPct: { label: "Up & down %", key: "upDownPct", reversed: false, pct: true },
  doubles: { label: "Doubles+ / round", key: "doubles", reversed: true, pct: false },
} as const;

function StatRow({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex items-baseline justify-between border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-semibold tabular-nums">
        {value}
        {sub && <span className="ml-1 font-normal text-muted">{sub}</span>}
      </span>
    </div>
  );
}

export default function StatsView({
  windows,
  strokesGained,
  shotSg,
  trend,
  enableStrokesGained,
}: {
  windows: Record<WindowKey, StatsSummary>;
  strokesGained: Record<WindowKey, StrokesGained | null>;
  shotSg: Record<Benchmark, Record<WindowKey, ShotSgReport | null>>;
  trend: TrendPoint[];
  enableStrokesGained: boolean;
}) {
  const [win, setWin] = useState<WindowKey>("last20");
  const [benchmark, setBenchmark] = useState<Benchmark>("scratch");
  const [metric, setMetric] = useState<MetricKey>("index");
  const [range, setRange] = useState<number>(20);

  const s = windows[win];
  const sg = strokesGained[win];
  const sgReport = shotSg[benchmark][win];
  const m = METRICS[metric];

  const chartData = trend
    .slice(-range)
    .map((p) => ({
      label: p.label,
      value: (p as unknown as Record<string, number | null>)[m.key],
    }));

  return (
    <div className="flex flex-col gap-6">
      {/* Window toggle */}
      <div className="flex gap-2">
        {(Object.keys(WINDOW_LABELS) as WindowKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setWin(k)}
            className={`rounded-full border px-3 py-1 text-sm font-medium ${
              win === k ? "border-accent bg-accent text-accent-fg" : "border-border text-muted"
            }`}
          >
            {WINDOW_LABELS[k]}
          </button>
        ))}
        <span className="self-center text-xs text-muted">
          {s.rounds} round{s.rounds === 1 ? "" : "s"}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Scoring */}
        <Card>
          <h2 className="mb-2 font-medium">Scoring</h2>
          <StatRow
            label="Scoring average"
            value={fmtNum(s.scoringAvg)}
            sub={s.toParAvg != null ? `(${fmtSigned(s.toParAvg, 1)})` : ""}
          />
          <StatRow label="Par 3 average" value={fmtNum(s.par3Avg, 2)} />
          <StatRow label="Par 4 average" value={fmtNum(s.par4Avg, 2)} />
          <StatRow label="Par 5 average" value={fmtNum(s.par5Avg, 2)} />
          <StatRow label="Doubles or worse / round" value={fmtNum(s.doublesPerRound, 2)} />
          <StatRow label="Penalties / round" value={fmtNum(s.penaltiesPerRound, 2)} />
        </Card>

        {/* Ball striking */}
        <Card>
          <h2 className="mb-2 font-medium">Ball striking &amp; greens</h2>
          <StatRow label="Greens in regulation" value={fmtPct(s.girPct)} />
          <StatRow
            label="Fairways hit"
            value={s.firTracked ? fmtPct(s.firPct) : "not tracked"}
          />
          <StatRow
            label="Scrambling"
            value={fmtPct(s.scramblingPct)}
            sub="par+ when GIR missed"
          />
          <StatRow
            label="Up & down"
            value={s.upDownTracked ? fmtPct(s.upDownPct) : "not tracked"}
          />
          <StatRow
            label="Sand saves"
            value={s.sandTracked ? fmtPct(s.sandSavePct) : "not tracked"}
          />
        </Card>

        {/* Putting */}
        <Card>
          <h2 className="mb-2 font-medium">Putting</h2>
          <StatRow label="Putts / round" value={fmtNum(s.puttsPerRound, 1)} />
          <StatRow label="Putts / GIR" value={fmtNum(s.puttsPerGir, 2)} />
          <StatRow label="3-putts / round" value={fmtNum(s.threePuttsPerRound, 2)} />
          <StatRow label="3-putt avoidance" value={fmtPct(s.threePuttAvoidancePct)} />
        </Card>

        {/* Distribution */}
        <Card>
          <h2 className="mb-2 font-medium">Hole distribution</h2>
          {(() => {
            const d = s.distribution;
            const total =
              d.eaglesOrBetter + d.birdies + d.pars + d.bogeys + d.doublesPlus;
            const row = (label: string, count: number, color: string) => (
              <div className="mb-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">{label}</span>
                  <span className="tabular-nums">
                    {count} ({total ? Math.round((count / total) * 100) : 0}%)
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${total ? (count / total) * 100 : 0}%`, background: color }}
                  />
                </div>
              </div>
            );
            return (
              <>
                {row("Eagles or better", d.eaglesOrBetter, "#eab308")}
                {row("Birdies", d.birdies, "#ef4444")}
                {row("Pars", d.pars, "var(--color-accent)")}
                {row("Bogeys", d.bogeys, "#0ea5e9")}
                {row("Doubles or worse", d.doublesPlus, "#71717a")}
              </>
            );
          })()}
        </Card>
      </div>

      {/* Real shot-level Strokes Gained takes precedence when shot data exists. */}
      {sgReport ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">Compare against</span>
            {(["scratch", "tour"] as Benchmark[]).map((b) => (
              <button
                key={b}
                onClick={() => setBenchmark(b)}
                className={`rounded-full border px-3 py-1 text-sm font-medium ${
                  benchmark === b
                    ? "border-accent bg-accent text-accent-fg"
                    : "border-border text-muted"
                }`}
              >
                {BENCHMARK_LABEL[b]}
              </button>
            ))}
          </div>
          <AdvancedStrokesGained report={sgReport} />
        </div>
      ) : (
        enableStrokesGained &&
        sg && (
          <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Strokes Gained (approximation)</h2>
            <span className="text-xs font-semibold tabular-nums">
              Total {fmtSigned(sg.total)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Off the tee", sg.offTheTee],
              ["Approach", sg.approach],
              ["Short game", sg.shortGame],
              ["Putting", sg.putting],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-xl border border-border bg-background px-3 py-2">
                <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
                <p className={`text-lg font-semibold tabular-nums ${(val as number) >= 0 ? "text-accent" : "text-red-600"}`}>
                  {fmtSigned(val as number)}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 flex gap-2 text-xs text-muted">
            <WarningIcon width={14} height={14} className="mt-0.5 shrink-0" />
            <span>
              Approximation only. True Strokes Gained requires shot-level
              distance data and published PGA baselines; this estimate is derived
              from your accuracy/scoring stats versus a mid-handicap baseline and
              is directional, not exact.
            </span>
          </p>
          </Card>
        )
      )}

      {/* Trends */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Trends</h2>
          <div className="flex flex-wrap gap-2">
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as MetricKey)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
            >
              {(Object.keys(METRICS) as MetricKey[]).map((k) => (
                <option key={k} value={k}>
                  {METRICS[k].label}
                </option>
              ))}
            </select>
            <select
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
              className="rounded-lg border border-border bg-background px-2 py-1 text-sm"
            >
              <option value={10}>Last 10</option>
              <option value={20}>Last 20</option>
              <option value={9999}>All</option>
            </select>
          </div>
        </div>
        <TrendLineChart
          data={chartData}
          lines={[{ key: "value", label: m.label, color: "var(--color-accent)" }]}
          reversed={m.reversed}
        />
      </Card>
    </div>
  );
}
