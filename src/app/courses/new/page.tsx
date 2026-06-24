import { PageHeader } from "@/components/ui";
import Link from "next/link";
import CourseForm from "../CourseForm";
import { createCourse } from "../actions";

export default function NewCoursePage() {
  return (
    <div>
      <PageHeader
        title="Add course"
        subtitle="Enter par and stroke index for all 18 holes"
        action={
          <Link href="/courses/import" className="text-sm text-muted hover:text-foreground">
            Import instead
          </Link>
        }
      />
      <CourseForm action={createCourse} />
    </div>
  );
}
