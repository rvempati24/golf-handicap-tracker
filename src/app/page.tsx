import { LinkButton, PageHeader, EmptyState } from "@/components/ui";

export default function Home() {
  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Your handicap and performance at a glance"
      />
      <EmptyState
        title="Dashboard coming soon"
        description="The handicap engine, stats, and trend charts arrive in upcoming milestones. For now, set up your courses and log a round."
        action={
          <div className="flex gap-2">
            <LinkButton href="/rounds/new">Log a round</LinkButton>
            <LinkButton href="/courses" variant="ghost">
              Manage courses
            </LinkButton>
          </div>
        }
      />
    </div>
  );
}
