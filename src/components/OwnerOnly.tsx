"use client";

import type { ReactNode } from "react";
import { useOwner } from "@/components/OwnerProvider";

/** Renders its children only when the owner key is unlocked. */
export function OwnerOnly({ children }: { children: ReactNode }) {
  const { unlocked } = useOwner();
  return unlocked ? <>{children}</> : null;
}
