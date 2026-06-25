import { PageHeader } from "@/components/ui";
import { getRounds } from "@/lib/rounds";
import { computeShotStrokesGained, type SgCategory } from "@/lib/strokes-gained";
import { getStoredWeeklyPlan } from "@/lib/plan-store";
import { mondayOf, isoDate, dayIndexOf } from "@/lib/weekly-plan";
import PlanView from "./PlanView";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const now = new Date();
  const weekStart = isoDate(mondayOf(now));
  const todayIndex = dayIndexOf(now);

  const [rounds, storedPlan] = await Promise.all([
    getRounds(),
    getStoredWeeklyPlan(weekStart),
  ]);

  // Weakest strokes-gained categories first, used to focus the generic plan.
  const sg = computeShotStrokesGained(rounds, "tour");
  const weakOrder: SgCategory[] | null = sg
    ? [...sg.byCategory].sort((a, b) => a.perRound - b.perRound).map((c) => c.category)
    : null;

  return (
    <div>
      <PageHeader
        title="Weekly plan"
        subtitle="A fresh, checkable practice plan for this week"
      />
      <PlanView
        weekStart={weekStart}
        todayIndex={todayIndex}
        storedPlan={storedPlan}
        weakOrder={weakOrder}
        hasShotData={Boolean(sg)}
        hasApiKey={Boolean(process.env.GEMINI_API_KEY)}
      />
    </div>
  );
}
