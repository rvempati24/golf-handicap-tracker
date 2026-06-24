import { timingSafeEqual } from "crypto";

const KEY_FIELD = "ownerKey";

export function ownerKeyError(): string {
  return "Enter the owner key to make changes.";
}

function configuredOwnerKey(): string | null {
  const key = process.env.OWNER_WRITE_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

function sameKey(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isOwnerKeyValid(value: unknown): boolean {
  const expected = configuredOwnerKey();
  if (!expected || typeof value !== "string") return false;
  return sameKey(value.trim(), expected);
}

export function formOwnerKey(formData: FormData): string {
  const value = formData.get(KEY_FIELD);
  return typeof value === "string" ? value : "";
}
