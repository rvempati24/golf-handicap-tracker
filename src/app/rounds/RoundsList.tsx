"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
import { ChevronRight } from "@/components/icons";
import { toParLabel } from "@/lib/scoring";

export type RoundListItem = {
  id: string;
  date: string;
  courseName: string;
  teeName: string;
  totalStrokes: number | null;
  teePar: number;
  scoreDifferential: number | null;
};

type SortKey = "date" | "score" | "differential";

export default function RoundsList({ rounds }: { rounds: RoundListItem[] }) {
  const [sort, setSort] = useState<SortKey>("date");
  const [dir, setDir] = useState<1 | -1>(-1);

  function changeSort(key: SortKey) {
    if (key === sort) setDir((d) => (d === 1 ? -1 : 1));
    else {
      setSort(key);
      setDir(key === "date" ? -1 : 1);
    }
  }

  const sorted = [...rounds].sort((a, b) => {
    let av: number, bv: number;
    if (sort === "date") {
      av = new Date(a.date).getTime();
      bv = new Date(b.date).getTime();
    } else if (sort === "score") {
      av = a.totalStrokes ?? Infinity;
      bv = b.totalStrokes ?? Infinity;
    } else {
      av = a.scoreDifferential ?? Infinity;
      bv = b.scoreDifferential ?? Infinity;
    }
    return (av - bv) * dir;
  });

  const arrow = (key: SortKey) => (sort === key ? (dir === 1 ? " ↑" : " ↓") : "");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 text-xs">
        {(["date", "score", "differential"] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => changeSort(k)}
            className={`rounded-full border px-3 py-1 font-medium capitalize transition ${
              sort === k
                ? "border-accent/40 bg-accent-soft text-accent"
                : "border-border text-muted hover:bg-surface-2"
            }`}
          >
            {k}
            {arrow(k)}
          </button>
        ))}
      </div>

      {sorted.map((r) => {
        const toPar =
          r.totalStrokes != null ? r.totalStrokes - r.teePar : null;
        return (
          <Link key={r.id} href={`/rounds/${r.id}`} className="group block">
            <Card className="flex items-center gap-3 py-4 transition hover:border-border-strong hover:shadow-pop">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.courseName}</p>
                <p className="text-sm text-muted">
                  {new Date(r.date).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {r.teeName}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-medium tabular-nums">
                  {r.totalStrokes ?? "—"}
                  {toPar != null && (
                    <span className="ml-1 text-sm font-normal text-muted">
                      {toParLabel(toPar)}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {r.scoreDifferential != null
                    ? `Diff ${r.scoreDifferential.toFixed(1)}`
                    : "Diff pending"}
                </p>
              </div>
              <ChevronRight
                width={18}
                height={18}
                className="text-muted transition group-hover:translate-x-0.5"
              />
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
