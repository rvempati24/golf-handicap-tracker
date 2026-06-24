import { EmptyState, PageHeader } from "@/components/ui";

export default function RoundsPage() {
  return (
    <div>
      <PageHeader title="Rounds" subtitle="Your round history" />
      <EmptyState
        title="Coming in milestone 2"
        description="Round entry and history are next."
      />
    </div>
  );
}
