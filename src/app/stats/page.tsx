import { EmptyState, PageHeader } from "@/components/ui";

export default function StatsPage() {
  return (
    <div>
      <PageHeader title="Stats" subtitle="Performance metrics and trends" />
      <EmptyState
        title="Coming in milestone 4"
        description="The stats engine and trend charts arrive after the handicap engine."
      />
    </div>
  );
}
