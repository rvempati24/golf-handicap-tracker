"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { OwnerKeyHiddenInput } from "@/components/OwnerKeyField";
import type { TeeSetView } from "@/lib/courses";
import TeeSetForm from "./TeeSetForm";
import { createTeeSet, updateTeeSet, deleteTeeSet } from "./actions";

export default function TeeSetManager({
  courseId,
  teeSets,
}: {
  courseId: string;
  teeSets: TeeSetView[];
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {teeSets.length === 0 && (
        <p className="text-sm text-muted">No tee sets yet — add one below.</p>
      )}

      {teeSets.map((t) =>
        editing === t.id ? (
          <Card key={t.id} className="border-accent">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-medium">Edit “{t.name}”</h3>
              <button
                onClick={() => setEditing(null)}
                className="text-sm text-muted"
              >
                Cancel
              </button>
            </div>
            <TeeSetForm
              courseId={courseId}
              action={updateTeeSet}
              initial={t}
            />
          </Card>
        ) : (
          <Card key={t.id} className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">{t.name}</p>
              <p className="text-sm text-muted">
                CR {t.courseRating} · Slope {t.slopeRating} · Par {t.par}
                {t.totalYards ? ` · ${t.totalYards} yds` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(t.id)}>
                Edit
              </Button>
              <form action={deleteTeeSet}>
                <OwnerKeyHiddenInput />
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="courseId" value={courseId} />
                <Button variant="danger" type="submit">
                  Delete
                </Button>
              </form>
            </div>
          </Card>
        ),
      )}

      {adding ? (
        <Card className="border-accent">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium">New tee set</h3>
            <button
              onClick={() => setAdding(false)}
              className="text-sm text-muted"
            >
              Cancel
            </button>
          </div>
          <TeeSetForm courseId={courseId} action={createTeeSet} />
        </Card>
      ) : (
        <Button variant="ghost" onClick={() => setAdding(true)}>
          + Add tee set
        </Button>
      )}
    </div>
  );
}
