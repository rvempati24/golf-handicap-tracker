"use server";

import { isOwnerKeyValid } from "@/lib/owner-key";

/** Verify an owner key against OWNER_WRITE_KEY (timing-safe). Used to unlock
 * the full nav on the client without ever exposing the configured key. */
export async function verifyOwnerKey(key: string): Promise<boolean> {
  return isOwnerKeyValid(key);
}
