import { EmptyState, PageHeader } from "@/components/ui";

export default function NewRoundPage() {
  return (
    <div>
      <PageHeader title="New round" subtitle="Hole-by-hole scorecard entry" />
      <EmptyState
        title="Coming in milestone 2"
        description="Scorecard entry is next."
      />
    </div>
  );
}
