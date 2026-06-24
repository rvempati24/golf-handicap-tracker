"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
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
      backStrokes = 0;
    holes.forEach((h, i) => {
      const s = Number(h.strokes);
      if (h.strokes !== "" && s > 0) {
        strokes += s;
        par += h.par;
        entered++;
        if (i < 9) frontStrokes += s;
        else backStrokes += s;
      }
      const p = Number(h.putts);
      if (h.putts !== "") putts += p;
    });
    return { strokes, putts, par, entered, frontStrokes, backStrokes };
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

  return (
    <div className="flex flex-col gap-4">
      {/* Round meta */}
      <Card className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Course</span>
          <select
            value={courseId}
            onChange={(e) => onCourseChange(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Tee set</span>
          <select
            value={teeSetId}
            onChange={(e) => setTeeSetId(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2"
          >
            {course?.teeSets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} · {t.courseRating}/{t.slopeRating}
              </option>
            ))}
            {course && course.teeSets.length === 0 && (
              <option value="">No tee sets — add one first</option>
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Weather</span>
          <input
            value={weather}
            onChange={(e) => setWeather(e.target.value)}
            placeholder="optional"
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
      </Card>

      {/* Scorecard */}
      <Card className="p-0">
        <div className="hidden grid-cols-[3rem_2.5rem_2.5rem_1fr_1fr_3rem_2rem] gap-2 border-b border-border px-3 py-2 text-xs font-medium text-muted sm:grid">
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
              <li key={i} className="px-3 py-2">
                <div className="grid grid-cols-[2.2rem_1fr_1fr_2.5rem_2rem] items-center gap-2 sm:grid-cols-[3rem_2.5rem_2.5rem_1fr_1fr_3rem_2rem]">
                  <div className="text-sm font-semibold">
                    {i + 1}
                    <span className="ml-1 text-xs font-normal text-muted sm:hidden">
                      P{h.par}·{h.strokeIndex}
                    </span>
                  </div>
                  <span className="hidden text-center text-sm text-muted sm:block">
                    {h.par}
                  </span>
                  <span className="hidden text-center text-sm text-muted sm:block">
                    {h.strokeIndex}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    placeholder="—"
                    value={h.strokes}
                    onChange={(e) => setHole(i, { strokes: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-2 py-2 text-center tabular-nums"
                    aria-label={`Hole ${i + 1} strokes`}
                  />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="—"
                    value={h.putts}
                    onChange={(e) => setHole(i, { putts: e.target.value })}
                    className={`w-full rounded-lg border bg-background px-2 py-2 text-center tabular-nums ${
                      puttsInvalid ? "border-red-500" : "border-border"
                    }`}
                    aria-label={`Hole ${i + 1} putts`}
                  />
                  <div className="hidden justify-center sm:flex">
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${
                        gir ? "bg-accent" : "bg-border"
                      }`}
                      title={gir ? "GIR" : "No GIR"}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleExpand(i)}
                    className="justify-self-end rounded-md px-2 py-1 text-muted hover:bg-background"
                    aria-label="More fields"
                  >
                    {isOpen ? "▲" : "⋯"}
                  </button>
                </div>

                {/* Per-hole quick summary on mobile */}
                {hasScore && (
                  <div className="mt-1 flex gap-2 text-xs text-muted sm:hidden">
                    <span>{toPar != null ? toParLabel(toPar) : ""}</span>
                    <span>{gir ? "GIR ✓" : "GIR ✗"}</span>
                  </div>
                )}

                {isOpen && (
                  <div className="mt-2 grid grid-cols-2 gap-3 rounded-lg bg-background p-3 text-sm sm:grid-cols-3">
                    {h.par !== 3 && (
                      <label className="flex items-center justify-between gap-2">
                        <span>Fairway</span>
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
                          className="rounded-md border border-border bg-surface px-2 py-1"
                        >
                          <option value="">—</option>
                          <option value="hit">Hit</option>
                          <option value="miss">Miss</option>
                        </select>
                      </label>
                    )}
                    <label className="flex items-center justify-between gap-2">
                      <span>GIR</span>
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
                        className="rounded-md border border-border bg-surface px-2 py-1"
                      >
                        <option value="auto">Auto</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>Penalties</span>
                      <input
                        type="number"
                        min={0}
                        value={h.penalties}
                        onChange={(e) => setHole(i, { penalties: e.target.value })}
                        className="w-14 rounded-md border border-border bg-surface px-2 py-1 text-center tabular-nums"
                      />
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>Up &amp; down</span>
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
                        className="rounded-md border border-border bg-surface px-2 py-1"
                      >
                        <option value="none">—</option>
                        <option value="made">Made</option>
                        <option value="miss">Missed</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>Sand save</span>
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
                        className="rounded-md border border-border bg-surface px-2 py-1"
                      >
                        <option value="none">—</option>
                        <option value="made">Made</option>
                        <option value="miss">Missed</option>
                      </select>
                    </label>
                    <label className="flex items-center justify-between gap-2">
                      <span>Drive (y)</span>
                      <input
                        type="number"
                        min={0}
                        value={h.driveDistance}
                        onChange={(e) => setHole(i, { driveDistance: e.target.value })}
                        placeholder="—"
                        className="w-16 rounded-md border border-border bg-surface px-2 py-1 text-center tabular-nums"
                      />
                    </label>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Totals footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-3 text-sm">
          <div className="flex gap-4">
            <span className="text-muted">
              Out <span className="font-semibold text-foreground tabular-nums">{totals.frontStrokes || "—"}</span>
            </span>
            <span className="text-muted">
              In <span className="font-semibold text-foreground tabular-nums">{totals.backStrokes || "—"}</span>
            </span>
            <span className="text-muted">
              Total{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {totals.strokes || "—"}
              </span>
              {totals.entered === 18 && (
                <span className="ml-1">({toParLabel(totals.strokes - totals.par)})</span>
              )}
            </span>
            <span className="text-muted">
              Putts <span className="font-semibold text-foreground tabular-nums">{totals.putts || "—"}</span>
            </span>
          </div>
          <span className="text-xs text-muted">{totals.entered}/18 holes</span>
        </div>
      </Card>

      {/* Advanced + notes */}
      <Card className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="How'd it go?"
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-medium">PCC adjustment</span>
          <input
            type="number"
            min={-1}
            max={3}
            value={pcc}
            onChange={(e) => setPcc(e.target.value)}
            className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-center tabular-nums"
          />
          <span className="text-xs text-muted">
            Playing Conditions Calculation (default 0)
          </span>
        </label>
      </Card>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="sticky bottom-16 z-10 sm:bottom-0">
        <Button onClick={onSubmit} disabled={pending} className="w-full py-3 shadow-lg">
          {pending ? "Saving…" : initial ? "Save changes" : "Save round"}
        </Button>
      </div>
    </div>
  );
}
