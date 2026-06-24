"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import {
  ArrowLeft,
  ChevronRight,
  EditIcon,
  FlagIcon,
  PlusIcon,
  TargetIcon,
  TrashIcon,
} from "@/components/icons";
import { OwnerKeyField, useOwnerKey } from "@/components/OwnerKeyField";
import { toParLabel } from "@/lib/scoring";
import {
  CLUBS,
  SHOT_TYPES,
  TYPE_LABEL,
  buildTimeline,
  resolveShots,
  type InputShot,
  type ShotType,
} from "@/lib/shots";
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

// Minimal per-shot state — you record club + outcome (+ optional distance).
// Type, lie, and penalties are inferred (see @/lib/shots); type is overridable.
type ShotState = {
  id: string;
  club: string;
  outcome: string;
  endLie: string;
  distance: string;
  typeOverride: ShotType | "";
};

type HoleState = {
  par: number;
  strokeIndex: number;
  shots: ShotState[];
};

type DerivedHole = {
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
};

const DRAFT_KEY = "golf:round-draft:v1";

const fieldClass =
  "h-10 rounded-lg border border-border bg-background px-3 text-sm transition placeholder:text-muted/70";

const compactFieldClass =
  "h-10 w-full rounded-lg border border-border bg-background px-2 text-sm transition";

const greenTargets = [
  { value: "long_left", label: "Long left" },
  { value: "long", label: "Long" },
  { value: "long_right", label: "Long right" },
  { value: "left", label: "Left" },
  { value: "green", label: "Green", center: true },
  { value: "right", label: "Right" },
  { value: "short_left", label: "Short left" },
  { value: "short", label: "Short" },
  { value: "short_right", label: "Short right" },
];

const teeDirections = [
  { value: "left", label: "Left" },
  { value: "fairway", label: "Center" },
  { value: "right", label: "Right" },
  { value: "water_left", label: "Water L" },
  { value: "water", label: "Water" },
  { value: "water_right", label: "Water R" },
  { value: "ob_left", label: "OB L" },
  { value: "ob", label: "OB" },
  { value: "ob_right", label: "OB R" },
];

const lieOptions = [
  { value: "fairway", label: "Fairway" },
  { value: "rough", label: "Rough" },
  { value: "bunker", label: "Bunker" },
  { value: "green", label: "Green" },
  { value: "fringe", label: "Fringe" },
];

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function numberOrNull(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInputShots(shots: ShotState[]): InputShot[] {
  return shots.map((s) => ({
    club: s.club || null,
    outcome: s.outcome || null,
    endLie: s.endLie || null,
    distance: numberOrNull(s.distance),
    typeOverride: s.typeOverride || null,
  }));
}

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
      className={`rounded-lg border px-3 py-2 ${
        tone === "accent"
          ? "border-accent/25 bg-accent-soft"
          : "border-border bg-background"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-display text-lg font-medium tabular-nums leading-none">
        {value}
      </p>
    </div>
  );
}

function newShot(opts?: { putter?: boolean; driver?: boolean }): ShotState {
  return {
    id: id(),
    club: opts?.putter ? "Putter" : opts?.driver ? "Driver" : "",
    outcome: "",
    endLie: "",
    distance: "",
    typeOverride: "",
  };
}

function isHoleComplete(hole: HoleState): boolean {
  return hole.shots.some((shot) => shot.outcome === "holed" || shot.endLie === "holed");
}

function blankHoles(pars: number[], si: number[]): HoleState[] {
  return Array.from({ length: 18 }, (_, i) => ({
    par: pars[i] ?? 4,
    strokeIndex: si[i] ?? i + 1,
    shots: [],
  }));
}

function deriveHole(h: HoleState): DerivedHole {
  const resolved = resolveShots(toInputShots(h.shots), h.par);
  const penalties = resolved.filter((s) => s.penalty).length;
  const strokes = resolved.length + penalties;
  const putts = resolved.filter((s) => s.shotType === "putt").length;

  const tee = resolved[0];
  const fairwayHit =
    h.par === 3
      ? null
      : tee && (tee.outcome || tee.endLie)
        ? tee.outcome === "fairway" || tee.outcome === "green" || tee.endLie === "fairway"
        : null;

  const greenIdx = resolved.findIndex(
    (s) => s.endLie === "green" || s.outcome === "green" || s.outcome === "holed",
  );
  let girHit = false;
  if (greenIdx >= 0) {
    const penaltiesBefore = resolved
      .slice(0, greenIdx)
      .filter((s) => s.penalty).length;
    girHit = greenIdx + 1 + penaltiesBefore <= h.par - 2;
  }

  const sandAttempt = resolved.some(
    (s) => s.shotType === "bunker" || s.startLie === "bunker",
  );
  const upDownAttempt =
    !girHit &&
    resolved.some((s) => s.shotType === "short_game" || s.shotType === "bunker");
  const upDownSuccess = upDownAttempt && strokes <= h.par && strokes > 0;
  const sandSuccess = sandAttempt && strokes <= h.par && strokes > 0;
  const driveDistance =
    tee && tee.shotType === "tee" && tee.distance != null ? tee.distance : null;

  return {
    strokes,
    putts,
    fairwayHit,
    girHit,
    penalties,
    upDownAttempt,
    upDownSuccess,
    sandAttempt,
    sandSuccess,
    driveDistance,
  };
}

// Reconstruct simple shots from a legacy round that has no shot-level data.
function legacyShotsFromHole(h: RoundFormInitial["holes"][number]): ShotState[] {
  const shots: ShotState[] = [];
  if (h.par !== 3) {
    shots.push({
      ...newShot({ driver: true }),
      outcome: h.fairwayHit == null ? "" : h.fairwayHit ? "fairway" : "left",
      endLie: h.fairwayHit ? "fairway" : "rough",
    });
  }
  const nonPuttShots = Math.max(0, h.strokes - h.putts - h.penalties - shots.length);
  for (let i = 0; i < nonPuttShots; i++) shots.push(newShot());
  for (let i = 0; i < h.putts; i++) {
    shots.push({
      ...newShot({ putter: true }),
      outcome: i === h.putts - 1 ? "holed" : "",
      endLie: i === h.putts - 1 ? "holed" : "green",
    });
  }
  return shots.length ? shots : [newShot({ driver: h.par !== 3 })];
}

type Draft = {
  courseId: string;
  teeSetId: string;
  date: string;
  notes: string;
  weather: string;
  pcc: string;
  holes: HoleState[];
};

function readDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!Array.isArray(d.holes) || d.holes.length !== 18) return null;
    const hasContent = d.holes.some((h) => h.shots && h.shots.length > 0);
    return hasContent ? d : null;
  } catch {
    return null;
  }
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
  shots?: {
    holeNumber: number;
    shotNumber: number;
    club: string | null;
    shotType: string;
    startDistanceYards: number | null;
    endDistanceYards: number | null;
    startLie: string | null;
    endLie: string | null;
    result: string | null;
    penalty: boolean;
  }[];
};

function ChoiceButton({
  active,
  label,
  onClick,
  className = "",
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
        active
          ? "border-accent bg-accent text-accent-fg"
          : "border-border bg-surface hover:border-border-strong hover:bg-surface-2"
      } ${className}`}
    >
      {label}
    </button>
  );
}

function ShotResultControl({
  shot,
  type,
  onChange,
}: {
  shot: ShotState;
  type: ShotType;
  onChange: (patch: Partial<ShotState>) => void;
}) {
  const isTeeLike = type === "tee" || type === "layup";
  const isPutt = type === "putt";

  if (isPutt) {
    return (
      <div className="flex flex-col gap-2 sm:col-span-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Putt result
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {[
            { value: "left", label: "Left", lie: "green" },
            { value: "short", label: "Short", lie: "green" },
            { value: "holed", label: "Holed", lie: "holed" },
            { value: "long", label: "Long", lie: "green" },
            { value: "right", label: "Right", lie: "green" },
          ].map((option) => (
            <ChoiceButton
              key={option.value}
              active={shot.outcome === option.value}
              label={option.label}
              onClick={() => onChange({ outcome: option.value, endLie: option.lie })}
            />
          ))}
        </div>
      </div>
    );
  }

  if (isTeeLike) {
    return (
      <div className="grid gap-3 sm:col-span-3 lg:grid-cols-[1fr_16rem]">
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Direction
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {teeDirections.map((option) => (
              <ChoiceButton
                key={option.value}
                active={shot.outcome === option.value}
                label={option.label}
                onClick={() =>
                  onChange({
                    outcome: option.value,
                    endLie:
                      option.value === "fairway"
                        ? "fairway"
                        : option.value.startsWith("water") || option.value.startsWith("ob")
                          ? "rough"
                          : shot.endLie || "rough",
                  })
                }
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">
            Lie
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {lieOptions.map((option) => (
              <ChoiceButton
                key={option.value}
                active={shot.endLie === option.value}
                label={option.label}
                onClick={() =>
                  onChange({
                    endLie: option.value,
                    outcome:
                      option.value === "bunker"
                        ? "bunker"
                        : option.value === "green"
                          ? "green"
                          : shot.outcome,
                  })
                }
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:col-span-3 lg:grid-cols-[18rem_1fr]">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Green target
        </p>
        <div className="grid aspect-square max-w-72 grid-cols-3 gap-1.5 rounded-full border border-border bg-surface-2 p-2">
          {greenTargets.map((target) => (
            <ChoiceButton
              key={target.value}
              active={shot.outcome === target.value}
              label={target.label}
              className={target.center ? "rounded-full text-sm" : "rounded-xl"}
              onClick={() =>
                onChange({
                  outcome: target.value,
                  endLie: target.value === "green" ? "green" : shot.endLie || "rough",
                })
              }
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">
          Lie
        </p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {[...lieOptions, { value: "holed", label: "Holed" }].map((option) => (
            <ChoiceButton
              key={option.value}
              active={shot.endLie === option.value || (option.value === "holed" && shot.outcome === "holed")}
              label={option.label}
              onClick={() =>
                onChange({
                  endLie: option.value,
                  outcome: option.value === "holed" ? "holed" : option.value === "green" ? "green" : shot.outcome,
                })
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

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

  // Read any saved in-progress round once (new rounds only).
  const draft = useMemo(() => (initial ? null : readDraft()), [initial]);
  const [restored, setRestored] = useState(!!draft);

  const [courseId, setCourseId] = useState(
    initial?.courseId ?? draft?.courseId ?? courses[0]?.id ?? "",
  );
  const course = courses.find((c) => c.id === courseId);
  const [teeSetId, setTeeSetId] = useState(
    initial?.teeSetId ?? draft?.teeSetId ?? courses[0]?.teeSets[0]?.id ?? "",
  );
  const [date, setDate] = useState(
    initial?.datePlayed ?? draft?.date ?? new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(initial?.notes ?? draft?.notes ?? "");
  const [weather, setWeather] = useState(initial?.weather ?? draft?.weather ?? "");
  const [pcc, setPcc] = useState(initial ? String(initial.pcc) : (draft?.pcc ?? "0"));
  const [activeHole, setActiveHole] = useState(0);
  const [editHoles, setEditHoles] = useState<Set<number>>(new Set());

  const [holes, setHoles] = useState<HoleState[]>(() => {
    if (initial) {
      const shotsByHole = new Map<number, ShotState[]>();
      for (const shot of initial.shots ?? []) {
        const list = shotsByHole.get(shot.holeNumber) ?? [];
        list.push({
          id: id(),
          club: shot.club ?? "",
          outcome: shot.result ?? "",
          endLie: shot.endLie ?? "",
          distance: shot.startDistanceYards != null ? String(shot.startDistanceYards) : "",
          typeOverride: SHOT_TYPES.includes(shot.shotType as ShotType)
            ? (shot.shotType as ShotType)
            : "",
        });
        shotsByHole.set(shot.holeNumber, list);
      }
      return initial.holes.map((h, i) => ({
        par: h.par,
        strokeIndex: h.strokeIndex,
        shots: shotsByHole.get(i + 1) ?? legacyShotsFromHole(h),
      }));
    }
    if (draft) return draft.holes;
    const c = courses[0];
    return blankHoles(c?.holePars ?? [], c?.holeStrokeIndex ?? []);
  });

  // Auto-save in-progress new rounds to the device so closing the app is safe.
  useEffect(() => {
    if (initial) return;
    if (typeof window === "undefined") return;
    const hasContent = holes.some((h) => h.shots.length > 0);
    try {
      if (hasContent) {
        const snap: Draft = { courseId, teeSetId, date, notes, weather, pcc, holes };
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(snap));
      } else {
        window.localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      /* storage full / unavailable — ignore */
    }
  }, [initial, courseId, teeSetId, date, notes, weather, pcc, holes]);

  function clearDraft() {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
    }
  }

  function startOver() {
    clearDraft();
    setRestored(false);
    const c = courses.find((x) => x.id === courseId) ?? courses[0];
    setHoles(blankHoles(c?.holePars ?? [], c?.holeStrokeIndex ?? []));
    setEditHoles(new Set());
    setActiveHole(0);
  }

  function onCourseChange(idValue: string) {
    setCourseId(idValue);
    const c = courses.find((x) => x.id === idValue);
    setTeeSetId(c?.teeSets[0]?.id ?? "");
    setHoles((prev) =>
      prev.map((h, i) => ({
        ...h,
        par: c?.holePars[i] ?? h.par,
        strokeIndex: c?.holeStrokeIndex[i] ?? h.strokeIndex,
      })),
    );
  }

  function updateHole(index: number, patch: Partial<HoleState>) {
    setHoles((prev) => prev.map((h, i) => (i === index ? { ...h, ...patch } : h)));
  }

  function updateShot(shotId: string, patch: Partial<ShotState>) {
    setHoles((prev) =>
      prev.map((h, i) =>
        i === activeHole
          ? { ...h, shots: h.shots.map((s) => (s.id === shotId ? { ...s, ...patch } : s)) }
          : h,
      ),
    );
  }

  function markEditing(hole: number, on: boolean) {
    setEditHoles((prev) => {
      const next = new Set(prev);
      if (on) next.add(hole);
      else next.delete(hole);
      return next;
    });
  }

  function addShot() {
    const hole = holes[activeHole];
    const resolved = resolveShots(toInputShots(hole.shots), hole.par);
    const previous = resolved[resolved.length - 1];
    if (previous?.endLie === "holed") return;
    const isFirst = hole.shots.length === 0;
    const shouldPutt = previous?.endLie === "green";
    const driver = isFirst && hole.par !== 3 && !shouldPutt;
    updateHole(activeHole, {
      shots: [...hole.shots, newShot({ putter: shouldPutt, driver })],
    });
    markEditing(activeHole, true);
  }

  function removeShot(shotId: string) {
    const hole = holes[activeHole];
    updateHole(activeHole, { shots: hole.shots.filter((s) => s.id !== shotId) });
  }

  function goTo(target: number) {
    markEditing(activeHole, false); // collapse the hole we're leaving
    setActiveHole(Math.max(0, Math.min(17, target)));
  }

  const derived = useMemo(() => holes.map(deriveHole), [holes]);
  const totals = useMemo(() => {
    const entered = derived.filter((h) => h.strokes > 0).length;
    const completed = holes.filter(isHoleComplete).length;
    const strokes = derived.reduce((sum, h) => sum + h.strokes, 0);
    const putts = derived.reduce((sum, h) => sum + h.putts, 0);
    const par = holes.reduce((sum, h) => sum + h.par, 0);
    const gir = derived.filter((h) => h.girHit).length;
    const fairways = derived.filter((h) => h.fairwayHit != null);
    return {
      entered,
      completed,
      strokes,
      putts,
      par,
      gir,
      fairwaysHit: fairways.filter((h) => h.fairwayHit).length,
      fairwaysTracked: fairways.length,
    };
  }, [derived, holes]);

  function validate(): { ok: boolean; error?: string; input?: RoundInput } {
    if (!courseId) return { ok: false, error: "Pick a course." };
    if (!teeSetId) return { ok: false, error: "Pick a tee set." };
    const missing = derived.findIndex((h) => h.strokes < 1);
    if (missing >= 0) return { ok: false, error: `Hole ${missing + 1}: add at least one shot.` };
    const incomplete = holes.findIndex((h) => !isHoleComplete(h));
    if (incomplete >= 0) {
      return { ok: false, error: `Hole ${incomplete + 1}: finish the hole by marking a shot in the hole.` };
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
        strokes: derived[i].strokes,
        putts: derived[i].putts,
        fairwayHit: derived[i].fairwayHit,
        girOverride: derived[i].girHit,
        penalties: derived[i].penalties,
        upDownAttempt: derived[i].upDownAttempt,
        upDownSuccess: derived[i].upDownSuccess,
        sandAttempt: derived[i].sandAttempt,
        sandSuccess: derived[i].sandSuccess,
        driveDistance: derived[i].driveDistance,
      })),
      shots: holes.flatMap((h, i) =>
        resolveShots(toInputShots(h.shots), h.par).map((s) => ({
          holeNumber: i + 1,
          shotNumber: s.index + 1,
          club: s.club,
          shotType: s.shotType,
          startDistanceYards: s.distance,
          endDistanceYards: null,
          startLie: s.startLie,
          endLie: s.endLie,
          result: s.outcome,
          penalty: s.penalty,
        })),
      ),
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
      clearDraft();
      router.push(res.id ? `/rounds/${res.id}` : "/rounds");
      router.refresh();
    });
  }

  const currentHole = holes[activeHole];
  const currentDerived = derived[activeHole];
  const currentComplete = isHoleComplete(currentHole);
  const progress = Math.round((totals.completed / 18) * 100);
  const isEditing = editHoles.has(activeHole) || currentHole.shots.length === 0;

  // Live-resolved shots for the active hole (drives type badges + timeline).
  const resolvedCurrent = useMemo(
    () => resolveShots(toInputShots(currentHole.shots), currentHole.par),
    [currentHole],
  );
  const timeline = useMemo(
    () =>
      buildTimeline(
        resolvedCurrent.map((s) => ({
          shotType: s.shotType,
          club: s.club,
          outcome: s.outcome,
          distance: s.distance,
          penalty: s.penalty,
        })),
      ),
    [resolvedCurrent],
  );

  function distanceLabel(type: ShotType): string {
    if (type === "putt") return "Length (ft)";
    if (type === "tee") return "Drive (yds)";
    return "To pin (yds)";
  }

  return (
    <div className="flex flex-col gap-4">
      {restored && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm">
          <span className="text-foreground">Resumed your in-progress round.</span>
          <button type="button" onClick={startOver} className="font-medium text-accent underline">
            Start over
          </button>
        </div>
      )}

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-[1.1fr_1fr]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <RoundField label="Date">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
            </RoundField>
            <RoundField label="Course">
              <select value={courseId} onChange={(e) => onCourseChange(e.target.value)} className={fieldClass}>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </RoundField>
            <RoundField label="Tee set">
              <select value={teeSetId} onChange={(e) => setTeeSetId(e.target.value)} className={fieldClass}>
                {course?.teeSets.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} · {t.courseRating}/{t.slopeRating}</option>
                ))}
              </select>
            </RoundField>
            <RoundField label="Weather">
              <input value={weather} onChange={(e) => setWeather(e.target.value)} placeholder="Optional" className={fieldClass} />
            </RoundField>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <SummaryChip
              label="Total"
              value={totals.strokes ? `${totals.strokes} ${totals.entered === 18 ? toParLabel(totals.strokes - totals.par) : ""}` : "-"}
              tone="accent"
            />
            <SummaryChip label="Putts" value={totals.putts || "-"} />
            <SummaryChip label="GIR" value={`${totals.gir}/${totals.entered || 0}`} />
            <SummaryChip
              label="Fairways"
              value={totals.fairwaysTracked ? `${totals.fairwaysHit}/${totals.fairwaysTracked}` : "-"}
            />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-border bg-surface-2 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <TargetIcon width={17} height={17} className="text-accent" />
              <div>
                <h2 className="text-sm font-semibold">Shot log</h2>
                <p className="text-xs text-muted">{totals.completed}/18 holes completed</p>
              </div>
            </div>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        <div className="grid gap-0 lg:grid-cols-[15rem_1fr]">
          <div className="border-b border-border bg-background p-3 lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-6 gap-1 lg:grid-cols-3">
              {holes.map((h, i) => {
                const d = derived[i];
                const active = i === activeHole;
                const done = isHoleComplete(h);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goTo(i)}
                    className={`rounded-md border px-2 py-2 text-left transition ${
                      active
                        ? "border-accent bg-accent-soft text-foreground"
                        : done
                          ? "border-accent/30 bg-surface hover:bg-surface-2"
                          : "border-border bg-surface hover:bg-surface-2"
                    }`}
                  >
                    <span className="block text-xs font-semibold tabular-nums">H{i + 1}</span>
                    <span className="block text-[10px] text-muted">P{h.par}</span>
                    <span className="block text-sm font-medium tabular-nums">{d.strokes || "-"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FlagIcon width={18} height={18} className="text-accent" />
                  <h3 className="font-display text-2xl font-medium">Hole {activeHole + 1}</h3>
                </div>
                <p className="text-sm text-muted">
                  Par {currentHole.par} / SI {currentHole.strokeIndex}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                <SummaryChip label="Score" value={currentDerived.strokes || "-"} tone="accent" />
                <SummaryChip label="Putts" value={currentDerived.putts || "-"} />
                <SummaryChip label="GIR" value={currentDerived.girHit ? "Hit" : "-"} />
                <SummaryChip
                  label="FW"
                  value={currentDerived.fairwayHit == null ? "-" : currentDerived.fairwayHit ? "Hit" : "Miss"}
                />
              </div>
            </div>

            {isEditing ? (
              <>
                {/* Entry — club + outcome (+ optional distance). Type inferred, overridable. */}
                <ul className="flex flex-col gap-2">
                  {currentHole.shots.length === 0 && (
                    <li className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted">
                      Add the first shot for this hole — the type is filled in for you.
                    </li>
                  )}

                  {currentHole.shots.map((shot, index) => {
                    const type = resolvedCurrent[index]?.shotType ?? "approach";
                    return (
                      <li key={shot.id} className="rounded-lg border border-border bg-background p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums">
                              {index + 1}
                            </span>
                            <select
                              value={type}
                              onChange={(e) => {
                                const nextType = e.target.value as ShotType;
                                updateShot(shot.id, {
                                  typeOverride: nextType,
                                  club: nextType === "putt" ? "Putter" : shot.club,
                                });
                              }}
                              className="h-7 rounded-md bg-accent-soft px-2 text-xs font-semibold text-accent"
                              aria-label={`Shot ${index + 1} type`}
                            >
                              {SHOT_TYPES.map((t) => (
                                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeShot(shot.id)}
                            className="grid h-8 w-8 place-items-center rounded-md text-muted transition hover:bg-surface-2 hover:text-foreground"
                            aria-label={`Remove shot ${index + 1}`}
                          >
                            <TrashIcon width={16} height={16} />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <RoundField label="Club">
                            <select
                              value={shot.club}
                              onChange={(e) => updateShot(shot.id, { club: e.target.value })}
                              className={compactFieldClass}
                            >
                              <option value="">—</option>
                              {CLUBS.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </RoundField>
                          <RoundField label={distanceLabel(type)}>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              value={shot.distance}
                              onChange={(e) => updateShot(shot.id, { distance: e.target.value })}
                              className={`${compactFieldClass} tabular-nums`}
                              placeholder="Optional"
                            />
                          </RoundField>
                          <ShotResultControl
                            shot={shot}
                            type={type}
                            onChange={(patch) => updateShot(shot.id, patch)}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="ghost" onClick={() => addShot()} disabled={currentComplete}>
                    <PlusIcon width={16} height={16} /> Add shot
                  </Button>
                  {currentComplete && (
                    <span className="inline-flex items-center rounded-lg border border-accent/25 bg-accent-soft px-3 py-2 text-sm font-medium text-accent">
                      Hole complete
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-border bg-background p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Shot record
                  </p>
                  <button
                    type="button"
                    onClick={() => markEditing(activeHole, true)}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-accent transition hover:bg-accent-soft"
                  >
                    <EditIcon width={15} height={15} /> Edit
                  </button>
                </div>
                <TimelineList timeline={timeline} />
              </div>
            )}

            {/* Live timeline while editing */}
            {isEditing && timeline.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                  Hole {activeHole + 1} timeline
                </p>
                <TimelineList timeline={timeline} />
              </div>
            )}

            {/* Hole navigation */}
            <div className="mt-5 flex items-center justify-between gap-2 border-t border-border pt-4">
              <Button type="button" variant="ghost" onClick={() => goTo(activeHole - 1)} disabled={activeHole === 0}>
                <ArrowLeft width={16} height={16} /> Prev
              </Button>
              {activeHole < 17 ? (
                <Button type="button" onClick={() => goTo(activeHole + 1)} disabled={currentHole.shots.length > 0 && !currentComplete}>
                  {currentHole.shots.length > 0 && !currentComplete ? "Mark holed to continue" : "Next hole"}
                  <ChevronRight width={16} height={16} />
                </Button>
              ) : (
                <span className="text-sm font-medium text-muted">Last hole — save below</span>
              )}
            </div>
          </div>
        </div>
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
          <input type="number" min={-1} max={3} value={pcc} onChange={(e) => setPcc(e.target.value)} className={`${fieldClass} text-center tabular-nums`} />
        </RoundField>
      </Card>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <Button onClick={onSubmit} disabled={pending} className="w-full py-3 shadow-lg">
        {pending ? "Saving..." : initial ? "Save changes" : "Save round"}
      </Button>
    </div>
  );
}

function TimelineList({
  timeline,
}: {
  timeline: { strokeNo: number; kind: "shot" | "penalty"; title: string; detail: string }[];
}) {
  if (timeline.length === 0) {
    return <p className="text-sm text-muted">No shots recorded.</p>;
  }
  return (
    <ol className="flex flex-col gap-1.5">
      {timeline.map((e, idx) => (
        <li key={idx} className="flex items-baseline gap-3 text-sm">
          <span
            className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums ${
              e.kind === "penalty"
                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                : "bg-accent-soft text-accent"
            }`}
          >
            {e.strokeNo}
          </span>
          <span className={e.kind === "penalty" ? "text-red-600 dark:text-red-400" : ""}>
            <span className="font-medium">{e.title}</span>
            {e.detail && <span className="text-muted"> — {e.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
