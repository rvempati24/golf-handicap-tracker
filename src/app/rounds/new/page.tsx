import { getCourses } from "@/lib/courses";
import { EmptyState, LinkButton, PageHeader } from "@/components/ui";
import RoundForm, { type CourseOption } from "../RoundForm";
import { createRound } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewRoundPage() {
  const courses = await getCourses();
  const playable = courses.filter((c) => c.teeSets.length > 0);

  const options: CourseOption[] = playable.map((c) => ({
    id: c.id,
    name: c.name,
    par: c.par,
    holePars: c.holePars,
    holeStrokeIndex: c.holeStrokeIndex,
    teeSets: c.teeSets.map((t) => ({
      id: t.id,
      name: t.name,
      courseRating: t.courseRating,
      slopeRating: t.slopeRating,
      par: t.par,
    })),
  }));

  return (
    <div>
      <PageHeader title="New round" subtitle="Hole-by-hole scorecard entry" />
      {options.length === 0 ? (
        <EmptyState
          title="Add a course first"
          description="You need at least one course with a tee set before logging a round."
          action={<LinkButton href="/courses/new">+ Add course</LinkButton>}
        />
      ) : (
        <RoundForm courses={options} action={createRound} />
      )}
    </div>
  );
}
