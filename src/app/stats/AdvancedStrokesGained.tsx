import { Card } from "@/components/ui";
import { fmtNum, fmtPct, fmtSigned } from "@/lib/format";
import { SG_CATEGORY_LABEL, type ShotSgReport } from "@/lib/strokes-gained";
import type { MissProfile } from "@/lib/strokes-gained";

function sgColor(v: number | null): string {
  if (v == null) return "text-muted";
  return v >= 0 ? "text-accent" : "text-red-600";
}

function SgStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${sgColor(value)}`}>
        {value == null ? "—" : fmtSigned(value)}
      </p>
    </div>
  );
}

// Compact dispersion read-out: center is on-target %, arms are miss directions.
function MissDial({ title, miss }: { title: string; miss: MissProfile }) {
  if (miss.total === 0) return null;
  const cell = (label: string, pct: number, strong = false) => (
    <div
      className={`flex flex-col items-center justify-center rounded-lg py-1.5 ${
        strong ? "bg-accent-soft" : "bg-background"
      }`}
    >
      <span className="text-sm font-semibold tabular-nums">{Math.round(pct)}%</span>
      <span className="text-[10px] uppercase tracking-wide text-muted">{label}</span>
    </div>
  );
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted">{miss.total} shots</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <div />
        {cell("Long", miss.longPct)}
        <div />
        {cell("Left", miss.leftPct)}
        {cell("On target", miss.hitPct, true)}
        {cell("Right", miss.rightPct)}
        <div />
        {cell("Short", miss.shortPct)}
        <div />
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Bunker {Math.round(miss.bunkerPct)}% · Penalty {Math.round(miss.penaltyPct)}%
      </p>
    </div>
  );
}

export default function AdvancedStrokesGained({
  report,
}: {
  report: ShotSgReport;
}) {
  const cat = (key: keyof typeof SG_CATEGORY_LABEL) =>
    report.byCategory.find((c) => c.category === key)?.perRound ?? null;

  return (
    <div className="flex flex-col gap-4">
      {/* Category breakdown (real, shot-level) */}
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Strokes Gained — shot by shot</h2>
          <span className="text-xs font-semibold tabular-nums">
            Total <span className={sgColor(report.totalPerRound)}>{fmtSigned(report.totalPerRound)}</span> / round
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SgStat label={SG_CATEGORY_LABEL.offTheTee} value={cat("offTheTee")} />
          <SgStat label={SG_CATEGORY_LABEL.approach} value={cat("approach")} />
          <SgStat label={SG_CATEGORY_LABEL.aroundGreen} value={cat("aroundGreen")} />
          <SgStat label={SG_CATEGORY_LABEL.putting} value={cat("putting")} />
        </div>
        <p className="mt-3 text-xs text-muted">
          Per-round strokes gained vs. the PGA TOUR benchmark (Broadie, 2003–2010
          ShotLink). Computed from your shot-by-shot data across{" "}
          {report.roundsWithShots} round{report.roundsWithShots === 1 ? "" : "s"}.
          Positive means you beat tour average from those spots.
        </p>
      </Card>

      {/* Approach by distance */}
      {report.approachBuckets.some((b) => b.shots > 0) && (
        <Card>
          <h2 className="mb-2 font-medium">Approaches by distance</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-1.5 font-medium">Distance</th>
                  <th className="py-1.5 text-right font-medium">Shots</th>
                  <th className="py-1.5 text-right font-medium">SG / shot</th>
                  <th className="py-1.5 text-right font-medium">Greens</th>
                  <th className="py-1.5 text-right font-medium">Proximity</th>
                </tr>
              </thead>
              <tbody>
                {report.approachBuckets
                  .filter((b) => b.shots > 0)
                  .map((b) => (
                    <tr key={b.label} className="border-t border-border">
                      <td className="py-1.5">{b.label}</td>
                      <td className="py-1.5 text-right tabular-nums">{b.shots}</td>
                      <td
                        className={`py-1.5 text-right font-semibold tabular-nums ${sgColor(b.sgPerShot)}`}
                      >
                        {b.sgPerShot == null ? "—" : fmtSigned(b.sgPerShot)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {fmtPct(b.greenPct)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {b.avgProximityFeet == null
                          ? "—"
                          : `${fmtNum(b.avgProximityFeet, 0)} ft`}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Miss tendencies */}
        <Card className="flex flex-col gap-4">
          <h2 className="font-medium">Miss tendencies</h2>
          <MissDial title="Approach shots" miss={report.approachMiss} />
          <MissDial title="Tee shots" miss={report.teeMiss} />
        </Card>

        <div className="flex flex-col gap-4">
          {/* By lie */}
          {report.byLie.length > 0 && (
            <Card>
              <h2 className="mb-2 font-medium">SG by starting lie</h2>
              {report.byLie.map((l) => (
                <div
                  key={l.lie}
                  className="flex items-baseline justify-between border-b border-border py-2 last:border-0"
                >
                  <span className="text-sm capitalize text-muted">
                    {l.lie === "sand" ? "Bunker" : l.lie}
                    <span className="ml-1 text-xs">({l.shots})</span>
                  </span>
                  <span
                    className={`text-sm font-semibold tabular-nums ${sgColor(l.sgPerShot)}`}
                  >
                    {fmtSigned(l.sgPerShot)} / shot
                  </span>
                </div>
              ))}
            </Card>
          )}

          {/* Putting */}
          {report.puttingBuckets.length > 0 && (
            <Card>
              <h2 className="mb-2 font-medium">Putting</h2>
              {report.puttingBuckets.map((b) => (
                <div
                  key={b.label}
                  className="flex items-baseline justify-between border-b border-border py-2 last:border-0"
                >
                  <span className="text-sm text-muted">
                    {b.label}
                    <span className="ml-1 text-xs">({b.shots})</span>
                  </span>
                  <span className="text-sm tabular-nums">
                    {fmtPct(b.makePct)} made
                    <span
                      className={`ml-2 font-semibold ${sgColor(b.sgPerShot)}`}
                    >
                      {fmtSigned(b.sgPerShot)}
                    </span>
                  </span>
                </div>
              ))}
              <div className="flex items-baseline justify-between pt-2 text-xs text-muted">
                <span>Penalty strokes / round</span>
                <span className="tabular-nums">
                  {fmtNum(report.penaltyStrokesPerRound, 2)}
                </span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
