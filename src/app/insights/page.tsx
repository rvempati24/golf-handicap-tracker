import { EmptyState, PageHeader } from "@/components/ui";

export default function InsightsPage() {
  return (
    <div>
      <PageHeader title="Insights" subtitle="AI coaching from your data" />
      <EmptyState
        title="Coming in milestone 5"
        description="AI insights arrive once stats are in place."
      />
    </div>
  );
}
