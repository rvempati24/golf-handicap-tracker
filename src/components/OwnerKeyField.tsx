"use client";

import { useState } from "react";

const STORAGE_KEY = "golf-tracker-owner-key";

export function useOwnerKey() {
  const [key, setKey] = useState(() =>
    typeof window === "undefined"
      ? ""
      : window.localStorage.getItem(STORAGE_KEY) ?? "",
  );

  function onChange(value: string) {
    setKey(value);
    window.localStorage.setItem(STORAGE_KEY, value);
  }

  return { ownerKey: key, setOwnerKey: onChange };
}

export function OwnerKeyField({
  compact = false,
  value,
  onValueChange,
}: {
  compact?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const ownState = useOwnerKey();
  const ownerKey = value ?? ownState.ownerKey;
  const setOwnerKey = onValueChange ?? ownState.setOwnerKey;

  return (
    <label className={`flex flex-col gap-1.5 text-sm ${compact ? "" : "w-full"}`}>
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">
        Owner key
      </span>
      <input
        name="ownerKey"
        type="password"
        value={ownerKey}
        onChange={(e) => setOwnerKey(e.target.value)}
        autoComplete="current-password"
        placeholder="Required to save changes"
        className="h-10 rounded-lg border border-border bg-background px-3 text-sm transition placeholder:text-muted/70"
      />
    </label>
  );
}

export function OwnerKeyHiddenInput() {
  const { ownerKey } = useOwnerKey();
  return <input type="hidden" name="ownerKey" value={ownerKey} />;
}
