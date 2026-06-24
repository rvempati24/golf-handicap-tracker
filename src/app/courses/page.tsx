import Link from "next/link";
import { getCourses } from "@/lib/courses";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const courses = await getCourses();
  const { error } = await searchParams;

  return (
    <div>
      <PageHeader
        title="Courses"
        subtitle="Manage courses and their tee sets"
        action={
          <LinkButton href="/courses/new">+ Add course</LinkButton>
        }
      />

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          description="Add a course with its tee sets to start logging rounds."
          action={<LinkButton href="/courses/new">+ Add course</LinkButton>}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {courses.map((c) => (
            <Link key={c.id} href={`/courses/${c.id}`}>
              <Card className="transition hover:border-accent">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium">{c.name}</h2>
                    <p className="text-sm text-muted">
                      {c.location ?? "—"} · Par {c.par} · {c.roundCount} round
                      {c.roundCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="text-muted">›</span>
                </div>
                {c.teeSets.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.teeSets.map((t) => (
                      <span
                        key={t.id}
                        className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted"
                      >
                        {t.name} · {t.courseRating}/{t.slopeRating}
                        {t.totalYards ? ` · ${t.totalYards}y` : ""}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
