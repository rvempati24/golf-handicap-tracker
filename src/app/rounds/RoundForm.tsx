"use client";

import { useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { ChevronDown, MoreHorizontalIcon, TargetIcon } from "@/components/icons";
import { OwnerKeyField, useOwnerKey } from "@/components/OwnerKeyField";
import { deriveGir, toParLabel } from "@/lib/scoring";
import type { RoundInput } from "./actions";

export type CourseOption = {
  id: string;
  name: string;
  par: number;
  holePars: number[];
  holeStrokeIndex: number[];
  teeSets: {
    id: string;
    name: string;
    courseRating: number;
    slopeRating: number;
    par: number;
  }[];
};

type HoleState = {
  par: number;
  strokeIndex: number;
  strokes: string;
  putts: string;
  fairwayHit: boolean | null;
  girOverride: boolean | null;
  penalties: string;
  upDownAttempt: boolean;
  upDownSuccess: boolean;
  sandAttempt: boolean;
  sandSuccess: boolean;
  driveDistance: string;
};

const fieldClass =
  "h-10 rounded-lg border border-border bg-background px-3 text-sm transition placeholder:text-muted/70";

const compactFieldClass =
  "h-9 rounded-md border border-border bg-surface px-2 text-sm transition";

function RoundField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 text-sm ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function SummaryChip({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "accent";
}) {
  return (
    <div
      className={`rounded-lg border px-2 py-2 sm:px-3 ${
        tone === "accent"
          ? "border-accent/25 bg-accent-soft"
          : "border-border bg-background"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-display text-lg font-medium tabular-nums leading-none sm:text-xl">
        {value}
      </p>
    </div>
  );
}

function ScoreInput({
  label,
  value,
  min,
  invalid = false,
  onChange,
}: {
  label: string;
  value: string;
  min: number;
  invalid?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      placeholder="-"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-11 w-full rounded-lg border bg-background px-2 text-center text-lg font-medium tabular-nums transition placeholder:text-muted/60 sm:h-10 sm:text-base ${
        invalid ? "border-red-500" : "border-border"
      }`}
      aria-label={label}
    />
  );
}

function blankHoles(pars: number[], si: number[]): HoleState[] {
  return Array.from({ length: 18 }, (_, i) => ({
    par: pars[i] ?? 4,
    strokeIndex: si[i] ?? i + 1,
    strokes: "",
    putts: "",
    fairwayHit: null,
    girOverride: null,
    penalties: "0",
    upDownAttempt: false,
    upDownSuccess: false,
    sandAttempt: false,
    sandSuccess: false,
    driveDistance: "",
  }));
}

export type RoundFormInitial = {
  id: string;
  datePlayed: string;
  courseId: string;
  teeSetId: string;
  pcc: number;
  notes: string | null;
  weather: string | null;
  holes: {
    par: number;
    strokeIndex: number;
    strokes: number;
    putts: number;
    fairwayHit: boolean | null;
    girHit: boolean;
    penalties: number;
    upDownAttempt: boolean;
    upDownSuccess: boolean;
    sandAttempt: boolean;
    sandSuccess: boolean;
    driveDistance: number | null;
  }[];
};

export default function RoundForm({
  courses,
  initial,
  action,
}: {
  courses: CourseOption[];
  initial?: RoundFormInitial;
  action: (input: RoundInput) => Promise<{ ok: boolean; error?: string; id?: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { ownerKey, setOwnerKey } = useOwnerKey();

  const [courseId, setCourseId] = useState(initial?.courseId ?? courses[0]?.id ?? "");
  const course = courses.find((c) => c.id === courseId);

  const [teeSetId, setTeeSetId] = useState(
    initial?.teeSetId ?? courses[0]?.teeSets[0]?.id ?? "",
  );
  const [date, setDate] = useState(
    initial?.datePlayed ?? new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [weather, setWeather] = useState(initial?.weather ?? "");
  const [pcc, setPcc] = useState(String(initial?.pcc ?? 0));

  const [holes, setHoles] = useState<HoleState[]>(() => {
    if (initial) {
      return initial.holes.map((h) => ({
        par: h.par,
        strokeIndex: h.strokeIndex,
        strokes: String(h.strokes),
        putts: String(h.putts),
        fairwayHit: h.fairwayHit,
        girOverride: h.girHit === deriveGir(h.strokes, h.putts, h.par) ? null : h.girHit,
        penalties: String(h.penalties),
        upDownAttempt: h.upDownAttempt,
        upDownSuccess: h.upDownSuccess,
        sandAttempt: h.sandAttempt,
        sandSuccess: h.sandSuccess,
        driveDistance: h.driveDistance != null ? String(h.driveDistance) : "",
      }));
    }
    const c = courses[0];
    return blankHoles(c?.holePars ?? [], c?.holeStrokeIndex ?? []);
  });

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function onCourseChange(id: string) {
    setCourseId(id);
    const c = courses.find((x) => x.id === id);
    setTeeSetId(c?.teeSets[0]?.id ?? "");
    // Re-fill par/SI but preserve any entered strokes/putts.
    setHoles((prev) =>
      prev.map((h, i) => ({
        ...h,
        par: c?.holePars[i] ?? h.par,
        strokeIndex: c?.holeStrokeIndex[i] ?? h.strokeIndex,
      })),
    );
  }

  function setHole(i: number, patch: Partial<HoleState>) {
    setHoles((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }

  function toggleExpand(i: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const totals = useMemo(() => {
    let strokes = 0,
      putts = 0,
      par = 0,
      entered = 0,
      frontStrokes = 0,
      backStrokes = 0,
      gir = 0,
      fairwaysHit = 0,
      fairwaysTracked = 0;
    holes.forEach((h, i) => {
      const s = Number(h.strokes);
      const p = Number(h.putts);
      if (h.strokes !== "" && s > 0) {
        strokes += s;
        par += h.par;
        entered++;
        if (i < 9) frontStrokes += s;
        else backStrokes += s;
        if (h.putts !== "") {
          const girHit =
            h.girOverride != null ? h.girOverride : deriveGir(s, p, h.par);
          if (girHit) gir++;
        }
      }
      if (h.putts !== "") putts += p;
      if (h.par !== 3 && h.fairwayHit != null) {
        fairwaysTracked++;
        if (h.fairwayHit) fairwaysHit++;
      }
    });
    return {
      strokes,
      putts,
      par,
      entered,
      frontStrokes,
      backStrokes,
      gir,
      fairwaysHit,
      fairwaysTracked,
    };
  }, [holes]);

  function validate(): { ok: boolean; error?: string; input?: RoundInput } {
    if (!courseId) return { ok: false, error: "Pick a course." };
    if (!teeSetId) return { ok: false, error: "Pick a tee set." };
    for (let i = 0; i < 18; i++) {
      const h = holes[i];
      const s = Number(h.strokes);
      const p = Number(h.putts);
      if (h.strokes === "" || !Number.isInteger(s) || s < 1)
        return { ok: false, error: `Hole ${i + 1}: enter strokes (1 or more).` };
      if (h.putts === "" || !Number.isInteger(p) || p < 0)
        return { ok: false, error: `Hole ${i + 1}: enter putts (0 or more).` };
      if (p > s)
        return { ok: false, error: `Hole ${i + 1}: putts cannot exceed strokes.` };
    }
    const input: RoundInput = {
      ownerKey,
      datePlayed: date,
      courseId,
      teeSetId,
      pcc: Number(pcc) || 0,
      notes: notes || null,
      weather: weather || null,
      holes: holes.map((h, i) => ({
        holeNumber: i + 1,
        par: h.par,
        strokeIndex: h.strokeIndex,
        strokes: Number(h.strokes),
        putts: Number(h.putts),
        fairwayHit: h.par === 3 ? null : h.fairwayHit,
        girOverride: h.girOverride,
        penalties: Number(h.penalties) || 0,
        upDownAttempt: h.upDownAttempt,
        upDownSuccess: h.upDownSuccess,
        sandAttempt: h.sandAttempt,
        sandSuccess: h.sandSuccess,
        driveDistance: h.driveDistance === "" ? null : Number(h.driveDistance),
      })),
    };
    return { ok: true, input };
  }

  function onSubmit() {
    setError(null);
    const v = validate();
    if (!v.ok || !v.input) {
      setError(v.error ?? "Invalid input");
      return;
    }
    startTransition(async () => {
      const res = await action(v.input!);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong");
        return;
      }
      router.push(res.id ? `/rounds/${res.id}` : "/rounds");
      router.refresh();
    });
  }

  const progress = Math.round((totals.entered / 18) * 100);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.1fr_1fr]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RoundField label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={fieldClass}
              />
            </RoundField>
            <RoundField label="Course">
              <select
                value={courseId}
                onChange={(e) => onCourseChange(e.target.value)}
                className={fieldClass}
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </RoundField>
            <RoundField label="Tee set">
              <select
                value={teeSetId}
                onChange={(e) => setTeeSetId(e.target.value)}
                className={fieldClass}
              >
                {course?.teeSets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} / {t.courseRating}/{t.slopeRating}
                  </option>
                ))}
                {course && course.teeSets.length === 0 && (
                  <option value="">No tee sets - add one first</option>
                )}
              </select>
            </RoundField>
            <RoundField label="Weather">
              <input
                value={weather}
                onChange={(e) => setWeather(e.target.value)}
                placeholder="Optional"
                className={fieldClass}
              />
            </RoundField>
          </div>

          <div className="grid grid-cols-4 gap-2 md:grid-cols-2 lg:grid-cols-4">
            <SummaryChip
              label="Total"
              value={
                totals.strokes
                  ? totals.entered === 18
                    ? `${totals.strokes} ${toParLabel(totals.strokes - totals.par)}`
                    : totals.strokes
                  : "-"
              }
              tone="accent"
            />
            <SummaryChip label="Putts" value={totals.putts || "-"} />
            <SummaryChip label="GIR" value={`${totals.gir}/${totals.entered || 0}`} />
            <SummaryChip
              label="Fairways"
              value={
                totals.fairwaysTracked
                  ? `${totals.fairwaysHit}/${totals.fairwaysTracked}`
                  : "-"
              }
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <TargetIcon width={17} height={17} className="text-accent" />
                <h2 className="text-sm font-semibold">Scorecard</h2>
              </div>
              <p className="mt-1 text-xs text-muted">
                {totals.entered}/18 holes entered
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              <span className="rounded-md border border-border bg-surface px-2 py-1 text-muted">
                Out{" "}
                <strong className="font-semibold text-foreground tabular-nums">
                  {totals.frontStrokes || "-"}
                </strong>
              </span>
              <span className="rounded-md border border-border bg-surface px-2 py-1 text-muted">
                In{" "}
                <strong className="font-semibold text-foreground tabular-nums">
                  {totals.backStrokes || "-"}
                </strong>
              </span>
            </div>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="hidden grid-cols-[3rem_2.5rem_2.5rem_1fr_1fr_3.5rem_2.5rem] gap-3 border-b border-border px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted sm:grid">
          <span>Hole</span>
          <span className="text-center">Par</span>
          <span className="text-center">SI</span>
          <span className="text-center">Strokes</span>
          <span className="text-center">Putts</span>
          <span className="text-center">GIR</span>
          <span />
        </div>

        <ul className="divide-y divide-border">
          {holes.map((h, i) => {
            const s = Number(h.strokes);
            const p = Number(h.putts);
            const hasScore = h.strokes !== "" && s > 0;
            const gir =
              h.girOverride != null
                ? h.girOverride
                : hasScore && h.putts !== ""
                  ? deriveGir(s, p, h.par)
                  : false;
            const puttsInvalid = h.putts !== "" && h.strokes !== "" && p > s;
            const toPar = hasScore ? s - h.par : null;
            const isOpen = expanded.has(i);

            return (
              <li key={i} className={isOpen ? "bg-accent-soft/40" : "bg-surface"}>
                <div className="grid grid-cols-[3rem_1fr_1fr_2.5rem] items-center gap-2 px-3 py-2 sm:grid-cols-[3rem_2.5rem_2.5rem_1fr_1fr_3.5rem_2.5rem] sm:gap-3 sm:px-4">
                  <div>
                    <p className="font-semibold tabular-nums">{i + 1}</p>
                    <p className="text-[11px] text-muted sm:hidden">
                      Par {h.par} / SI {h.strokeIndex}
                    </p>
                  </div>
                  <span className="hidden text-center text-sm text-muted sm:block">
                    {h.par}
                  </span>
                  <span className="hidden text-center text-sm text-muted sm:block">
                    {h.strokeIndex}
                  </span>
                  <ScoreInput
                    label={`Hole ${i + 1} strokes`}
                    min={1}
                    value={h.strokes}
                    onChange={(value) => setHole(i, { strokes: value })}
                  />
                  <ScoreInput
                    label={`Hole ${i + 1} putts`}
                    min={0}
                    value={h.putts}
                    invalid={puttsInvalid}
                    onChange={(value) => setHole(i, { putts: value })}
                  />
                  <div className="hidden justify-center sm:flex">
                    <span
                      className={`inline-flex h-6 min-w-10 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${
                        gir
                          ? "bg-accent text-accent-fg"
                          : "bg-background text-muted"
                      }`}
                      title={gir ? "Green in regulation" : "No green in regulation"}
                    >
                      {gir ? "Hit" : "-"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleExpand(i)}
                    className="grid h-9 w-9 place-items-center justify-self-end rounded-md text-muted transition hover:bg-background hover:text-foreground"
                    aria-label={`Toggle hole ${i + 1} details`}
                    title={`Hole ${i + 1} details`}
                  >
                    {isOpen ? (
                      <ChevronDown width={18} height={18} className="rotate-180" />
                    ) : (
                      <MoreHorizontalIcon width={18} height={18} />
                    )}
                  </button>
                </div>

                {hasScore && (
                  <div className="flex gap-2 px-3 pb-2 text-xs text-muted sm:hidden">
                    <span>{toPar != null ? toParLabel(toPar) : ""}</span>
                    <span>GIR {gir ? "Hit" : "Miss"}</span>
                  </div>
                )}

                {isOpen && (
                  <div className="grid gap-3 border-t border-border bg-background/70 px-3 py-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                    {h.par !== 3 && (
                      <RoundField label="Fairway">
                        <select
                          value={
                            h.fairwayHit === null ? "" : h.fairwayHit ? "hit" : "miss"
                          }
                          onChange={(e) =>
                            setHole(i, {
                              fairwayHit:
                                e.target.value === ""
                                  ? null
                                  : e.target.value === "hit",
                            })
                          }
                          className={compactFieldClass}
                        >
                          <option value="">Not tracked</option>
                          <option value="hit">Hit</option>
                          <option value="miss">Miss</option>
                        </select>
                      </RoundField>
                    )}
                    <RoundField label="GIR">
                      <select
                        value={h.girOverride === null ? "auto" : h.girOverride ? "yes" : "no"}
                        onChange={(e) =>
                          setHole(i, {
                            girOverride:
                              e.target.value === "auto"
                                ? null
                                : e.target.value === "yes",
                          })
                        }
                        className={compactFieldClass}
                      >
                        <option value="auto">Auto</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </RoundField>
                    <RoundField label="Penalties">
                      <input
                        type="number"
                        min={0}
                        value={h.penalties}
                        onChange={(e) => setHole(i, { penalties: e.target.value })}
                        className={`${compactFieldClass} text-center tabular-nums`}
                      />
                    </RoundField>
                    <RoundField label="Up and down">
                      <select
                        value={
                          !h.upDownAttempt ? "none" : h.upDownSuccess ? "made" : "miss"
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          setHole(i, {
                            upDownAttempt: v !== "none",
                            upDownSuccess: v === "made",
                          });
                        }}
                        className={compactFieldClass}
                      >
                        <option value="none">No attempt</option>
                        <option value="made">Made</option>
                        <option value="miss">Missed</option>
                      </select>
                    </RoundField>
                    <RoundField label="Sand save">
                      <select
                        value={
                          !h.sandAttempt ? "none" : h.sandSuccess ? "made" : "miss"
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          setHole(i, {
                            sandAttempt: v !== "none",
                            sandSuccess: v === "made",
                          });
                        }}
                        className={compactFieldClass}
                      >
                        <option value="none">No attempt</option>
                        <option value="made">Made</option>
                        <option value="miss">Missed</option>
                      </select>
                    </RoundField>
                    <RoundField label="Drive yards">
                      <input
                        type="number"
                        min={0}
                        value={h.driveDistance}
                        onChange={(e) => setHole(i, { driveDistance: e.target.value })}
                        placeholder="-"
                        className={`${compactFieldClass} text-center tabular-nums`}
                      />
                    </RoundField>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="grid gap-3 md:grid-cols-[1fr_12rem]">
        <div className="md:col-span-2">
          <OwnerKeyField value={ownerKey} onValueChange={setOwnerKey} />
        </div>
        <RoundField label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What stood out?"
            className="min-h-24 rounded-lg border border-border bg-background px-3 py-2 text-sm transition placeholder:text-muted/70"
          />
        </RoundField>
        <RoundField label="PCC adjustment">
          <input
            type="number"
            min={-1}
            max={3}
            value={pcc}
            onChange={(e) => setPcc(e.target.value)}
            className={`${fieldClass} text-center tabular-nums`}
          />
        </RoundField>
      </Card>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div>
        <Button onClick={onSubmit} disabled={pending} className="w-full py-3 shadow-lg">
          {pending ? "Saving..." : initial ? "Save changes" : "Save round"}
        </Button>
      </div>
    </div>
  );
}
