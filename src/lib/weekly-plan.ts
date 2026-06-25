// Weekly practice plan: a Monday-anchored, day-by-day checklist derived from
// the player's strokes-gained weaknesses. The generic plan is deterministic
// per week (so it changes every Monday and check-state stays stable), and can
// be replaced by an AI-tailored plan that folds in the coaching conversation.

import type { SgCategory } from "@/lib/strokes-gained";

export type PlanItem = {
  id: string;
  dayIndex: number; // 0 = Monday … 6 = Sunday
  text: string;
  category: string;
};

export type WeeklyPlan = {
  weekStart: string; // ISO date (YYYY-MM-DD) of the Monday
  source: "generic" | "ai";
  items: PlanItem[];
};

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** Monday (00:00 local) of the week containing `date`. */
export function mondayOf(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return d;
}

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 0 = Monday … 6 = Sunday for `date` within its week. */
export function dayIndexOf(date: Date): number {
  return (date.getDay() + 6) % 7;
}

/** Whole weeks since an epoch Monday — used to vary the plan each week. */
export function weekNumber(monday: Date): number {
  const epoch = Date.UTC(2024, 0, 1); // a Monday
  const ms = Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate());
  return Math.floor((ms - epoch) / (7 * 24 * 60 * 60 * 1000));
}

const TASK_POOL: Record<string, string[]> = {
  approach: [
    "Wedge ladder — 50/75/100 yd targets, 10 balls each",
    "150-yd approach: 15 balls, note how many find the green",
    "Approach dispersion drill: pick a target, 20 balls, track left/right miss",
    "Half-wedge control: 30/40/50 yd carry numbers, 15 balls",
    "Mid-iron windows: hit 10 balls flighting low, 10 high",
  ],
  putting: [
    "Lag ladder: 20/30/40 ft, two-putt every time (3 sets)",
    "Gate drill: 4-footers, make 30 in a row",
    "3-putt avoidance: 30–40 ft lags, leave inside 3 ft",
    "Clock drill: 6-footers around the hole, 2 laps",
    "Speed control: roll 10 putts to the fringe without falling off",
  ],
  aroundGreen: [
    "Chipping: 20 balls, focus on a consistent landing spot",
    "Up-and-down game: 9 random greenside spots, get it up and down",
    "Bunker splash: 15 shots, all finishing on the green",
    "Pitch trajectory: low/medium/high to the same flag, 5 each",
    "Short-game ladder: 10/20/30 yd carries, 8 balls each",
  ],
  offTheTee: [
    "Driver range: 20 balls to a fairway-width target, track hits",
    "Tee-shot routine: commit to one target per ball, 15 balls",
    "Shape control: 10 balls a soft fade, 10 a soft draw",
    "Tempo driver: smooth 80% swings, 20 balls",
    "3-wood off the deck and tee: 15 balls to a target",
  ],
  general: [
    "Mobility + stretch session (15 min)",
    "Play 9 holes focusing only on tempo and routine",
    "Review your last round's strokes-gained and note one takeaway",
    "Putt on the carpet at home: 50 short putts",
    "Rest / active recovery — let the work soak in",
  ],
};

const CATEGORY_LABEL: Record<string, string> = {
  approach: "Approach",
  putting: "Putting",
  aroundGreen: "Short game",
  offTheTee: "Driving",
  general: "General",
};

export function categoryLabel(category: string): string {
  return CATEGORY_LABEL[category] ?? category;
}

const DEFAULT_FOCUS: SgCategory[] = ["approach", "putting", "aroundGreen", "offTheTee"];

/**
 * Deterministic generic plan for a week. `weakOrder` is the player's SG
 * categories sorted weakest-first; the two weakest get the most attention.
 */
export function genericWeeklyPlan(
  weekStart: string,
  weakOrder: SgCategory[] | null,
): WeeklyPlan {
  const focus = weakOrder && weakOrder.length === 4 ? weakOrder : DEFAULT_FOCUS;
  const [w0, w1, w2] = focus;
  const wk = weekNumber(new Date(weekStart));

  // Category emphasis across the week — heaviest on the two weakest areas.
  const dayCats: string[] = [
    w0, // Mon
    w1, // Tue
    w2, // Wed
    w0, // Thu
    "putting", // Fri — putting always pays
    "general", // Sat — round / recovery
    w1, // Sun
  ];

  const items: PlanItem[] = [];
  dayCats.forEach((cat, dayIndex) => {
    const pool = TASK_POOL[cat] ?? TASK_POOL.general;
    const text = pool[(wk * 3 + dayIndex) % pool.length];
    items.push({ id: `${weekStart}-${dayIndex}-0`, dayIndex, text, category: cat });
    // A lighter second item midweek and on the weekend for variety.
    if (dayIndex === 2 || dayIndex === 5) {
      const gPool = TASK_POOL.general;
      items.push({
        id: `${weekStart}-${dayIndex}-1`,
        dayIndex,
        text: gPool[(wk + dayIndex) % gPool.length],
        category: "general",
      });
    }
  });

  return { weekStart, source: "generic", items };
}

/** Attach stable ids to AI-produced items and clamp day indices to 0–6. */
export function normalizeAiItems(
  weekStart: string,
  raw: { dayIndex: number; text: string; category?: string }[],
): PlanItem[] {
  const perDay: Record<number, number> = {};
  return raw
    .filter((r) => r.text && r.text.trim().length > 0)
    .map((r) => {
      const dayIndex = Math.min(6, Math.max(0, Math.round(r.dayIndex)));
      const n = (perDay[dayIndex] = (perDay[dayIndex] ?? 0) + 1) - 1;
      return {
        id: `${weekStart}-${dayIndex}-${n}`,
        dayIndex,
        text: r.text.trim(),
        category: r.category ?? "general",
      };
    });
}
