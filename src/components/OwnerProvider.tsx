"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { verifyOwnerKey } from "@/app/owner-actions";

// Shared with OwnerKeyField's useOwnerKey so the per-page key fields and the
// global unlock stay in sync via the same localStorage entry.
const STORAGE_KEY = "golf-tracker-owner-key";

type OwnerContextValue = {
  /** True once a correct owner key has been verified this session/device. */
  unlocked: boolean;
  /** True while the stored key is being verified on first load. */
  checking: boolean;
  /** Verify + persist a key. Returns whether it was valid. */
  unlock: (key: string) => Promise<boolean>;
  /** Forget the key and re-hide owner features. */
  lock: () => void;
};

const OwnerContext = createContext<OwnerContextValue | null>(null);

export function OwnerProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);

  // On load, re-verify any stored key so a refresh keeps you unlocked.
  useEffect(() => {
    let active = true;
    const stored =
      typeof window === "undefined"
        ? ""
        : window.localStorage.getItem(STORAGE_KEY) ?? "";
    (async () => {
      const ok = stored ? await verifyOwnerKey(stored) : false;
      if (!active) return;
      setUnlocked(ok);
      setChecking(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const unlock = useCallback(async (key: string) => {
    const trimmed = key.trim();
    const ok = await verifyOwnerKey(trimmed);
    if (ok) {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
      setUnlocked(true);
    }
    return ok;
  }, []);

  const lock = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setUnlocked(false);
  }, []);

  return (
    <OwnerContext.Provider value={{ unlocked, checking, unlock, lock }}>
      {children}
    </OwnerContext.Provider>
  );
}

export function useOwner(): OwnerContextValue {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error("useOwner must be used within OwnerProvider");
  return ctx;
}
