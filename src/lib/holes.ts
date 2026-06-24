// Helpers for the 18-element hole arrays that we persist as JSON strings
// in SQLite (which has no native array type).

export const HOLE_COUNT = 18;

/** Parse a JSON-encoded integer array, falling back to a zero-filled array. */
export function parseHoleArray(
  json: string | null | undefined,
  fallback = 0,
): number[] {
  if (!json) return Array(HOLE_COUNT).fill(fallback);
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return Array(HOLE_COUNT).fill(fallback);
    // Normalize to exactly 18 entries.
    const out = Array(HOLE_COUNT)
      .fill(fallback)
      .map((f, i) => {
        const v = parsed[i];
        return typeof v === "number" && Number.isFinite(v) ? v : f;
      });
    return out;
  } catch {
    return Array(HOLE_COUNT).fill(fallback);
  }
}

/** Serialize an integer array to a JSON string for storage. */
export function serializeHoleArray(arr: number[]): string {
  return JSON.stringify(arr.slice(0, HOLE_COUNT));
}

/** Validate that an array is a well-formed stroke-index permutation of 1..18. */
export function isValidStrokeIndex(arr: number[]): boolean {
  if (arr.length !== HOLE_COUNT) return false;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted.every((v, i) => v === i + 1);
}
