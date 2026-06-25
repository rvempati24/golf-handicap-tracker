"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { OwnerKeyHiddenInput } from "@/components/OwnerKeyField";
import { useOwner } from "@/components/OwnerProvider";
import { deleteRound } from "../actions";

// Editing/deleting a round is owner-only — hidden entirely when locked so the
// round is purely viewable.
export default function RoundOwnerActions({ roundId }: { roundId: string }) {
  const { unlocked } = useOwner();
  if (!unlocked) return null;

  return (
    <div className="flex gap-2">
      <Link href={`/rounds/${roundId}/edit`}>
        <Button variant="ghost">Edit round</Button>
      </Link>
      <form action={deleteRound}>
        <OwnerKeyHiddenInput />
        <input type="hidden" name="id" value={roundId} />
        <Button variant="danger" type="submit">
          Delete
        </Button>
      </form>
    </div>
  );
}
