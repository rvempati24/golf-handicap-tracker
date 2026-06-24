// Shared scoring helpers used by entry, history, and the stats engine.

/**
 * Green in regulation: reached the green with at least two putts remaining,
 * i.e. strokes-to-green (strokes − putts) ≤ par − 2.
 */
export function deriveGir(
  strokes: number,
  putts: number,
  par: number,
): boolean {
  if (!strokes || strokes < 1) return false;
  return strokes - putts <= par - 2;
}

/** Format a number relative to par as "+3" / "E" / "-1". */
export function toParLabel(toPar: number): string {
  if (toPar === 0) return "E";
  return toPar > 0 ? `+${toPar}` : `${toPar}`;
}

/** Name of a hole result relative to par (eagle/birdie/par/bogey/...). */
export function scoreName(strokes: number, par: number): string {
  const diff = strokes - par;
  if (strokes === 1) return "Ace";
  if (diff <= -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double bogey";
  return `+${diff}`;
}
