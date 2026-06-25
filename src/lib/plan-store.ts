import { prisma } from "@/lib/prisma";
import type { WeeklyPlan, PlanItem } from "@/lib/weekly-plan";

// Weekly plans are persisted as InsightReport rows with kind="plan" so no
// schema change is needed; `question` holds the week's Monday for lookup and
// `content` is the JSON WeeklyPlan.

/** The stored AI plan for a given week's Monday, or null if none exists. */
export async function getStoredWeeklyPlan(
  weekStart: string,
): Promise<WeeklyPlan | null> {
  const row = await prisma.insightReport.findFirst({
    where: { kind: "plan", question: weekStart },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.content) as Partial<WeeklyPlan>;
    if (!Array.isArray(parsed.items)) return null;
    return {
      weekStart,
      source: parsed.source === "ai" ? "ai" : "generic",
      items: parsed.items as PlanItem[],
    };
  } catch {
    return null;
  }
}
