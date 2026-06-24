"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { OwnerKeyField } from "@/components/OwnerKeyField";
import { HOLE_COUNT } from "@/lib/holes";
import type { ActionState } from "./actions";
import type { TeeSetView } from "@/lib/courses";

type Props = {
  courseId: string;
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial?: TeeSetView;
  onDone?: () => void;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </Button>
  );
}

export default function TeeSetForm({ courseId, action, initial }: Props) {
  const [state, formAction] = useActionState(action, { ok: false });
  const [showYards, setShowYards] = useState(!!initial?.yardages);
  const yards = initial?.yardages ?? Array(HOLE_COUNT).fill(0);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="courseId" value={courseId} />
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <OwnerKeyField />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="col-span-2 flex flex-col gap-1 text-sm sm:col-span-1">
          <span className="font-medium">Tee name</span>
          <input
            name="name"
            required
            defaultValue={initial?.name ?? ""}
            placeholder="Black"
            className="rounded-lg border border-border bg-background px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Course rating</span>
          <input
            name="courseRating"
            type="number"
            step="0.1"
            required
            defaultValue={initial?.courseRating ?? ""}
            placeholder="72.9"
            className="rounded-lg border border-border bg-background px-3 py-2 tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Slope</span>
          <input
            name="slopeRating"
            type="number"
            required
            defaultValue={initial?.slopeRating ?? ""}
            placeholder="140"
            className="rounded-lg border border-border bg-background px-3 py-2 tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Par</span>
          <input
            name="par"
            type="number"
            required
            defaultValue={initial?.par ?? 72}
            className="rounded-lg border border-border bg-background px-3 py-2 tabular-nums"
          />
        </label>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setShowYards((s) => !s)}
          className="text-sm font-medium text-accent"
        >
          {showYards ? "− Hide" : "+ Add"} per-hole yardages (optional)
        </button>
        {showYards && (
          <div className="mt-2 overflow-x-auto">
            <table className="border-separate border-spacing-1 text-center text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  {Array.from({ length: HOLE_COUNT }, (_, i) => (
                    <th key={i} className="font-medium">
                      {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {Array.from({ length: HOLE_COUNT }, (_, i) => (
                    <td key={i}>
                      <input
                        name={`yardages_${i}`}
                        type="number"
                        defaultValue={yards[i] || ""}
                        className="w-14 rounded-md border border-border bg-background px-1 py-1 text-center tabular-nums"
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

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

      <div>
        <SubmitButton label={initial?.id ? "Save tee set" : "Add tee set"} />
      </div>
    </form>
  );
}
