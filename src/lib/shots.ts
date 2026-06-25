// Shot tracking logic — smart inference so entry stays simple.
// You record: club + direction/result + lie (+ optional distance).
// Shot type, lie progression, and penalties are inferred, and a PGA-style
// timeline is generated for display.
//
// Bucketing follows the Strokes Gained model: classification is driven by
// distance-to-the-hole and lie, not the club.
//   - Off the tee : tee shot on a par 4 / par 5
//   - Approach    : > ~30 yds to the hole and not a par 4/5 tee shot
//                   (includes par-3 tee shots, par-5 layups, partial wedges)
//   - Around green: <= ~30 yds to the hole, not on the green (chips/pitches/sand)
//   - Putting     : on the green
export const AROUND_GREEN_YARDS = 30;

export type ShotType = "tee" | "layup" | "approach" | "short_game" | "bunker" | "putt";

export const SHOT_TYPES: ShotType[] = [
  "tee",
  "layup",
  "approach",
  "short_game",
  "bunker",
  "putt",
];

export const TYPE_LABEL: Record<ShotType, string> = {
  tee: "Drive",
  layup: "Layup",
  approach: "Approach",
  short_game: "Chip / pitch",
  bunker: "Bunker shot",
  putt: "Putt",
};

// Where the ball ended, grouped for an optgroup dropdown.
export const OUTCOME_GROUPS: {
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    label: "In play",
    options: [
      { value: "fairway", label: "Fairway" },
      { value: "green", label: "Green" },
      { value: "fringe", label: "Fringe / just off" },
      { value: "short", label: "Short" },
      { value: "left", label: "Rough left" },
      { value: "right", label: "Rough right" },
      { value: "long", label: "Long" },
      { value: "short_left", label: "Short left" },
      { value: "short_right", label: "Short right" },
      { value: "long_left", label: "Long left" },
      { value: "long_right", label: "Long right" },
      { value: "bunker", label: "Bunker" },
    ],
  },
  {
    label: "Penalty",
    options: [
      { value: "water", label: "Water — ahead" },
      { value: "water_left", label: "Water — left" },
      { value: "water_right", label: "Water — right" },
      { value: "ob", label: "Out of bounds — ahead" },
      { value: "ob_left", label: "Out of bounds — left" },
      { value: "ob_right", label: "Out of bounds — right" },
    ],
  },
  {
    label: "Holed",
    options: [{ value: "holed", label: "In the hole" }],
  },
];

export const CLUBS = [
  "Driver", "3W", "5W", "7W", "Hybrid", "2i", "3i", "4i", "5i", "6i",
  "7i", "8i", "9i", "PW", "GW", "SW", "LW", "Putter",
];

const PUTT_RE = /putt/i;

const PENALTY_OUTCOMES = new Set([
  "water", "water_left", "water_right", "ob", "ob_left", "ob_right",
]);

export function isPenaltyOutcome(outcome: string | null | undefined): boolean {
  return outcome != null && PENALTY_OUTCOMES.has(outcome);
}

/** The lie a shot starts from, given where the previous shot ended. */
export function nextLieFromOutcome(outcome: string | null | undefined): string {
  switch (outcome) {
    case "fairway":
      return "fairway";
    case "green":
      return "green";
    case "fringe":
      return "fringe";
    case "bunker":
      return "bunker";
    case "holed":
      return "holed";
    case "left":
    case "right":
    case "short":
    case "long":
    case "short_left":
    case "short_right":
    case "long_left":
    case "long_right":
      return "rough";
    default:
      // penalties (water/ob) — played from a drop
      return "rough";
  }
}

/**
 * Infer shot type from position, par, lie, club, and remaining distance to the
 * hole (yards). Distance is the strongest signal and applies to non-tee shots.
 */
export function inferShotType(
  index: number,
  par: number,
  startLie: string,
  club: string | null,
  distanceToPin: number | null | undefined,
): ShotType {
  const c = club ?? "";
  if (startLie === "green" || PUTT_RE.test(c)) return "putt";
  if (index === 0) return par === 3 ? "approach" : "tee";

  const d = distanceToPin ?? null;
  if (startLie === "bunker") {
    if (d != null) return d <= AROUND_GREEN_YARDS ? "bunker" : "approach";
    return "bunker";
  }
  if (d != null) return d <= AROUND_GREEN_YARDS ? "short_game" : "approach";

  // No distance given — fall back on lie. Default full shots to approach so a
  // partial wedge isn't mis-counted as a chip; greenside lies stay short game.
  if (startLie === "fringe") return "short_game";
  return "approach";
}

export type InputShot = {
  club: string | null;
  outcome: string | null;
  endLie?: string | null;
  /** Drive length (tee), remaining yards to the hole (approach/short), or feet (putt). */
  distance: number | null;
  /** Manual type override; when set, inference is skipped. */
  typeOverride?: ShotType | null;
};

export type ResolvedShot = InputShot & {
  index: number;
  shotType: ShotType;
  startLie: string;
  endLie: string;
  penalty: boolean;
};

/** Resolve raw shots into fully-typed shots with inferred fields. */
export function resolveShots(shots: InputShot[], par: number): ResolvedShot[] {
  let lie = "tee";
  return shots.map((s, index) => {
    const startLie = index === 0 ? "tee" : lie;
    // Distance is "to pin" for non-tee shots; for the tee shot it's drive length.
    const toPin = index === 0 ? null : s.distance;
    const inferred = inferShotType(index, par, startLie, s.club, toPin);
    const shotType = s.typeOverride ?? inferred;
    const penalty = isPenaltyOutcome(s.outcome);
    const endLie = s.endLie || (s.outcome ? nextLieFromOutcome(s.outcome) : "");
    lie = endLie;
    return { ...s, index, shotType, startLie, endLie, penalty };
  });
}

const OUTCOME_PHRASE: Record<string, string> = {
  fairway: "to the fairway",
  green: "onto the green",
  fringe: "to the fringe",
  short: "short",
  left: "missed left",
  right: "missed right",
  long: "long",
  short_left: "short left",
  short_right: "short right",
  long_left: "long left",
  long_right: "long right",
  bunker: "into a bunker",
  water: "into the water",
  water_left: "into the water (left)",
  water_right: "into the water (right)",
  ob: "out of bounds",
  ob_left: "out of bounds (left)",
  ob_right: "out of bounds (right)",
  holed: "in the hole",
};

export type TimelineEntry = {
  strokeNo: number;
  kind: "shot" | "penalty";
  title: string;
  detail: string;
};

type TimelineShot = {
  shotType: ShotType;
  club: string | null;
  outcome: string | null;
  endLie?: string | null;
  distance: number | null;
  penalty: boolean;
};

const LIE_NAME: Record<string, string> = {
  fairway: "fairway",
  rough: "rough",
  bunker: "bunker",
  green: "green",
  fringe: "fringe",
};

// Directional nuance carried by the dial outcome, kept alongside the lie.
const OUTCOME_DIRECTION: Record<string, string> = {
  left: "left",
  right: "right",
  short: "short",
  long: "long",
  short_left: "short-left",
  short_right: "short-right",
  long_left: "long-left",
  long_right: "long-right",
};

/** A concise "where it finished" phrase combining the ending lie + direction. */
function finishedText(
  endLie: string | null | undefined,
  outcome: string | null | undefined,
): string {
  if (outcome === "holed" || endLie === "holed") return "holed";
  if (isPenaltyOutcome(outcome)) {
    return outcome && outcome.startsWith("ob") ? "out of bounds" : "in the water";
  }
  const lie = endLie ? LIE_NAME[endLie] : null;
  const dir = outcome ? OUTCOME_DIRECTION[outcome] : null;
  if (lie && dir) return `${lie}, ${dir}`;
  if (lie) return lie;
  if (dir) return dir;
  if (outcome) return OUTCOME_PHRASE[outcome] ?? "";
  return "";
}

/** Build a PGA-style numbered shot timeline (penalty strokes inserted inline). */
export function buildTimeline(shots: TimelineShot[]): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let stroke = 0;
  for (const s of shots) {
    stroke += 1;
    // A putt is always with the putter — make that explicit rather than blank.
    const club = s.club || (s.shotType === "putt" ? "Putter" : null);
    const title = club ? `${TYPE_LABEL[s.shotType]} (${club})` : TYPE_LABEL[s.shotType];
    const dist =
      s.distance != null && s.distance > 0
        ? s.shotType === "putt"
          ? `${s.distance} ft`
          : `${s.distance} yds`
        : "";
    const finished = finishedText(s.endLie, s.outcome);
    const detail = [dist, finished].filter(Boolean).join(" → ");
    entries.push({ strokeNo: stroke, kind: "shot", title, detail });
    if (s.penalty) {
      stroke += 1;
      entries.push({ strokeNo: stroke, kind: "penalty", title: "Penalty", detail: "+1 stroke" });
    }
  }
  return entries;
}
