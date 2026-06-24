import { notFound } from "next/navigation";
import Link from "next/link";
import { getCourse } from "@/lib/courses";
import { Button, Card, PageHeader } from "@/components/ui";
import { OwnerKeyHiddenInput } from "@/components/OwnerKeyField";
import CourseForm from "../CourseForm";
import TeeSetManager from "../TeeSetManager";
import { deleteCourse, updateCourse } from "../actions";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const course = await getCourse(id);
  if (!course) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={course.name}
        subtitle={course.location ?? undefined}
        action={
          <Link href="/courses" className="text-sm text-muted hover:text-foreground">
            ← All courses
          </Link>
        }
      />

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium">Course details</h2>
        <CourseForm
          action={updateCourse}
          initial={{
            id: course.id,
            name: course.name,
            location: course.location,
            holePars: course.holePars,
            holeStrokeIndex: course.holeStrokeIndex,
          }}
        />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Tee sets</h2>
        <TeeSetManager courseId={course.id} teeSets={course.teeSets} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Danger zone</h2>
        <Card className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">Delete this course</p>
            <p className="text-sm text-muted">
              {course.roundCount > 0
                ? "This course has rounds and cannot be deleted."
                : "This cannot be undone."}
            </p>
          </div>
          <form action={deleteCourse}>
            <OwnerKeyHiddenInput />
            <input type="hidden" name="id" value={course.id} />
            <Button
              variant="danger"
              type="submit"
              disabled={course.roundCount > 0}
            >
              Delete
            </Button>
          </form>
        </Card>
      </section>
    </div>
  );
}
