import { getRounds } from "@/lib/rounds";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import RoundsList, { type RoundListItem } from "./RoundsList";

export const dynamic = "force-dynamic";

export default async function RoundsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const rounds = await getRounds();
  const { error } = await searchParams;
  const items: RoundListItem[] = rounds.map((r) => ({
    id: r.id,
    date: r.datePlayed.toISOString(),
    courseName: r.courseName,
    teeName: r.teeName,
    totalStrokes: r.totalStrokes,
    teePar: r.teePar,
    scoreDifferential: r.scoreDifferential,
  }));

  return (
    <div>
      <PageHeader
        title="Rounds"
        subtitle={`${rounds.length} round${rounds.length === 1 ? "" : "s"} logged`}
        action={<LinkButton href="/rounds/new">+ New round</LinkButton>}
      />
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
      {items.length === 0 ? (
        <EmptyState
          title="No rounds yet"
          description="Log your first round to start tracking."
          action={<LinkButton href="/rounds/new">+ New round</LinkButton>}
        />
      ) : (
        <RoundsList rounds={items} />
      )}
    </div>
  );
}
