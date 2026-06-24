import { PageHeader } from "@/components/ui";
import { getInsightReports } from "@/lib/insights";
import InsightsView from "./InsightsView";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const reports = await getInsightReports();
  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  return (
    <div>
      <PageHeader
        title="Insights"
        subtitle="AI coaching grounded in your rounds and stats"
      />
      <InsightsView initialReports={reports} hasApiKey={hasApiKey} />
    </div>
  );
}
