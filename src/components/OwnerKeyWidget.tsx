"use client";

import { useState } from "react";
import { useOwner } from "@/components/OwnerProvider";
import { KeyIcon, LockIcon } from "@/components/icons";

export function OwnerKeyWidget() {
  const { unlocked, checking, unlock, lock } = useOwner();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!value.trim()) return;
    setBusy(true);
    setError(false);
    const ok = await unlock(value);
    setBusy(false);
    if (ok) {
      setOpen(false);
      setValue("");
    } else {
      setError(true);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unlocked ? "Owner mode on" : "Unlock owner features"}
        className={`flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition ${
          unlocked
            ? "border-accent/40 bg-accent-soft text-accent"
            : "border-border bg-surface text-muted hover:text-foreground"
        }`}
      >
        {unlocked ? <KeyIcon width={15} height={15} /> : <LockIcon width={15} height={15} />}
        <span className="hidden sm:inline">
          {checking ? "…" : unlocked ? "Owner" : "Unlock"}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-border bg-surface p-3 shadow-card">
            {unlocked ? (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Owner mode is on</p>
                <p className="text-xs text-muted">
                  All tools are unlocked on this device.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    lock();
                    setOpen(false);
                  }}
                  className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
                >
                  <LockIcon width={14} height={14} /> Lock
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">Enter owner key</p>
                <p className="text-xs text-muted">
                  Unlocks stats, insights, plan, swing and editing.
                </p>
                <input
                  type="password"
                  autoFocus
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    setError(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onSubmit();
                  }}
                  placeholder="Owner key"
                  className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
                />
                {error && (
                  <p className="text-xs text-red-600">That key isn&apos;t right.</p>
                )}
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={busy || !value.trim()}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-50"
                >
                  <KeyIcon width={14} height={14} /> {busy ? "Checking…" : "Unlock"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
