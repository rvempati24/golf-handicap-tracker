"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Card } from "@/components/ui";
import { HOLE_COUNT } from "@/lib/holes";
import type { ActionState } from "./actions";

type Props = {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial?: {
    id?: string;
    name: string;
    location: string | null;
    holePars: number[];
    holeStrokeIndex: number[];
  };
};

const DEFAULT_PARS = Array(HOLE_COUNT).fill(4);
const DEFAULT_SI = Array.from({ length: HOLE_COUNT }, (_, i) => i + 1);

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export default function CourseForm({ action, initial }: Props) {
  const [state, formAction] = useActionState(action, { ok: false });
  const [pars, setPars] = useState<number[]>(initial?.holePars ?? DEFAULT_PARS);
  const [si, setSi] = useState<number[]>(
    initial?.holeStrokeIndex ?? DEFAULT_SI,
  );

  const totalPar = useMemo(() => pars.reduce((a, b) => a + (b || 0), 0), [pars]);
  const siValid = useMemo(() => {
    const sorted = [...si].sort((a, b) => a - b);
    return sorted.every((v, i) => v === i + 1);
  }, [si]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}

      <Card className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Course name</span>
          <input
            name="name"
            required
            defaultValue={initial?.name ?? ""}
            placeholder="e.g. Coyote Crossing Golf Club"
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Location</span>
          <input
            name="location"
            defaultValue={initial?.location ?? ""}
            placeholder="City, State"
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">Per-hole par &amp; stroke index</h2>
          <div className="flex gap-3 text-sm">
            <span className="text-muted">
              Par <span className="font-semibold text-foreground">{totalPar}</span>
            </span>
            <span className={siValid ? "text-muted" : "text-red-600"}>
              SI {siValid ? "✓" : "needs 1–18"}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-1 text-center text-sm">
            <thead>
              <tr className="text-xs text-muted">
                <th className="text-left font-medium">Hole</th>
                {Array.from({ length: HOLE_COUNT }, (_, i) => (
                  <th key={i} className="font-medium">
                    {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th className="text-left text-xs font-medium text-muted">Par</th>
                {pars.map((p, i) => (
                  <td key={i}>
                    <input
                      name={`par_${i}`}
                      type="number"
                      min={3}
                      max={6}
                      value={p}
                      onChange={(e) => {
                        const next = [...pars];
                        next[i] = Number(e.target.value);
                        setPars(next);
                      }}
                      className="w-10 rounded-md border border-border bg-background px-1 py-1 text-center tabular-nums"
                    />
                  </td>
                ))}
              </tr>
              <tr>
                <th className="text-left text-xs font-medium text-muted">SI</th>
                {si.map((s, i) => (
                  <td key={i}>
                    <input
                      name={`si_${i}`}
                      type="number"
                      min={1}
                      max={18}
                      value={s}
                      onChange={(e) => {
                        const next = [...si];
                        next[i] = Number(e.target.value);
                        setSi(next);
                      }}
                      className="w-10 rounded-md border border-border bg-background px-1 py-1 text-center tabular-nums"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Saved.
        </p>
      )}

      <div className="flex gap-2">
        <SubmitButton label={initial?.id ? "Save course" : "Create course"} />
      </div>
    </form>
  );
}
