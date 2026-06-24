"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui";
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
            className={`rounded-full border px-3 py-1 font-medium capitalize ${
              sort === k
                ? "border-accent text-accent"
                : "border-border text-muted"
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
          <Link key={r.id} href={`/rounds/${r.id}`}>
            <Card className="flex items-center justify-between gap-3 transition hover:border-accent">
              <div>
                <p className="font-medium">{r.courseName}</p>
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
                <p className="text-lg font-semibold tabular-nums">
                  {r.totalStrokes ?? "—"}
                  {toPar != null && (
                    <span className="ml-1 text-sm font-normal text-muted">
                      ({toParLabel(toPar)})
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted">
                  {r.scoreDifferential != null
                    ? `Diff ${r.scoreDifferential.toFixed(1)}`
                    : "Diff pending"}
                </p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
