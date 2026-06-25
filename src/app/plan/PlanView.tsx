"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Card } from "@/components/ui";
import { OwnerKeyField, useOwnerKey } from "@/components/OwnerKeyField";
import { SparkIcon } from "@/components/icons";
import type { SgCategory } from "@/lib/strokes-gained";
import {
  DAY_NAMES,
  categoryLabel,
  genericWeeklyPlan,
  type WeeklyPlan,
} from "@/lib/weekly-plan";
import { generateWeeklyPlan } from "./actions";

function checksKey(weekStart: string) {
  return `golf-plan-checks-${weekStart}`;
}

function dateForDay(weekStart: string, dayIndex: number): Date {
  const [y, m, d] = weekStart.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dayIndex);
  return dt;
}

export default function PlanView({
  weekStart,
  todayIndex,
  storedPlan,
  weakOrder,
  hasShotData,
  hasApiKey,
}: {
  weekStart: string;
  todayIndex: number;
  storedPlan: WeeklyPlan | null;
  weakOrder: SgCategory[] | null;
  hasShotData: boolean;
  hasApiKey: boolean;
}) {
  const generic = useMemo(
    () => genericWeeklyPlan(weekStart, weakOrder),
    [weekStart, weakOrder],
  );
  const [plan, setPlan] = useState<WeeklyPlan>(storedPlan ?? generic);
  const [checks, setChecks] = useState<Record<string, boolean>>(() => {
    if (typeof window === "undefined") return {};
    try {
      return JSON.parse(window.localStorage.getItem(checksKey(weekStart)) ?? "{}");
    } catch {
      return {};
    }
  });
  const { ownerKey, setOwnerKey } = useOwnerKey();
  const [error, setError] = useState<string | null>(null);
  const [pending, startGen] = useTransition();

  function toggle(id: string) {
    setChecks((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        window.localStorage.setItem(checksKey(weekStart), JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function onRegenerate() {
    setError(null);
    startGen(async () => {
      const res = await generateWeeklyPlan(weekStart, ownerKey);
      if (!res.ok) setError(res.error);
      else setPlan(res.plan);
    });
  }

  const visibleDays = [];
  for (let d = todayIndex; d <= 6; d++) visibleDays.push(d);

  const itemsByDay = (dayIndex: number) =>
    plan.items.filter((it) => it.dayIndex === dayIndex);

  const remaining = plan.items.filter(
    (it) => it.dayIndex >= todayIndex && !checks[it.id],
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                plan.source === "ai"
                  ? "bg-accent text-accent-fg"
                  : "bg-surface-2 text-muted"
              }`}
            >
              {plan.source === "ai" ? "Tailored by AI" : "Generic plan"}
            </span>
            <span className="text-muted">
              {remaining} task{remaining === 1 ? "" : "s"} left this week
            </span>
          </div>
          <Button
            variant="ghost"
            onClick={onRegenerate}
            disabled={pending || !hasApiKey || !ownerKey.trim()}
            className="text-sm"
          >
            <SparkIcon width={15} height={15} />
            {pending ? "Building plan…" : "Generate tailored plan"}
          </Button>
        </div>

        {!ownerKey.trim() && hasApiKey && (
          <div className="max-w-xs">
            <OwnerKeyField value={ownerKey} onValueChange={setOwnerKey} />
            <p className="mt-1 text-xs text-muted">
              Enter your owner key to generate an AI-tailored plan.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <p className="text-xs text-muted">
          {plan.source === "ai"
            ? "Tailored from your strokes-gained profile and recent coaching chat."
            : hasShotData
              ? "Built around your weakest strokes-gained areas. "
              : "Generic starter plan — log shot-by-shot rounds for a plan tuned to your game. "}
          It refreshes every Monday, and past days drop off as the week goes on.
        </p>
      </Card>

      {/* Days (today → Sunday) */}
      {visibleDays.map((dayIndex) => {
        const items = itemsByDay(dayIndex);
        const date = dateForDay(weekStart, dayIndex);
        const isToday = dayIndex === todayIndex;
        const dayDone = items.length > 0 && items.every((it) => checks[it.id]);
        return (
          <Card key={dayIndex} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="flex items-center gap-2 font-medium">
                {DAY_NAMES[dayIndex]}
                {isToday && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                    Today
                  </span>
                )}
              </h2>
              <span className="text-xs text-muted">
                {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                {dayDone && " · done ✓"}
              </span>
            </div>

            {items.length === 0 ? (
              <p className="text-sm text-muted">Rest day — recover and reset.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((it) => {
                  const done = !!checks[it.id];
                  return (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => toggle(it.id)}
                        className="flex w-full items-start gap-3 rounded-lg border border-border bg-background p-3 text-left transition hover:border-border-strong"
                      >
                        <span
                          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[11px] ${
                            done
                              ? "border-accent bg-accent text-accent-fg"
                              : "border-border text-transparent"
                          }`}
                        >
                          ✓
                        </span>
                        <span className="flex-1">
                          <span
                            className={`text-sm ${done ? "text-muted line-through" : ""}`}
                          >
                            {it.text}
                          </span>
                          <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted">
                            {categoryLabel(it.category)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
