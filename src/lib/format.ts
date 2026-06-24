export function fmtNum(x: number | null, digits = 1): string {
  return x == null ? "—" : x.toFixed(digits);
}

export function fmtPct(x: number | null, digits = 0): string {
  return x == null ? "—" : `${x.toFixed(digits)}%`;
}

export function fmtIndex(x: number | null): string {
  if (x == null) return "—";
  // WHS plus handicaps display with a leading "+".
  return x < 0 ? `+${Math.abs(x).toFixed(1)}` : x.toFixed(1);
}

export function fmtSigned(x: number, digits = 2): string {
  const v = x.toFixed(digits);
  return x > 0 ? `+${v}` : v;
}
